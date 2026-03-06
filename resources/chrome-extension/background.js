/**
 * Skynul CDP Relay — Chrome Extension Service Worker (Manifest V3)
 *
 * Connects to Skynul's local WebSocket relay server and executes
 * chrome.debugger commands on behalf of the Skynul agent.
 *
 * MV3 service workers die after ~30s of inactivity. We use chrome.alarms
 * as a keepalive to ensure the WS connection stays up.
 */

const RELAY_URL = 'ws://localhost:19222'
const KEEPALIVE_ALARM = 'skynul-keepalive'
const KEEPALIVE_INTERVAL_MIN = 0.5 // 30 seconds — minimum chrome.alarms allows

/** @type {WebSocket | null} */
let ws = null
/** @type {Set<number>} */
const attachedTabs = new Set()
/** @type {Set<number>} — tabs created by taskStart; cleaned up when closed */
const taskTabs = new Set()

/** Inlined JS helper: querySelector that pierces shadow DOM */
const deepQueryFn = `function deepQuery(sel) { const found = document.querySelector(sel); if (found) return found; const walk = (root) => { const r = root.querySelectorAll('*'); for (const el of r) { if (el.shadowRoot) { const f = el.shadowRoot.querySelector(sel); if (f) return f; const d = walk(el.shadowRoot); if (d) return d; } } return null; }; return walk(document); }`
/** @type {Map<string, number>} frameId → executionContextId */
const frameContexts = new Map()

// ── Keepalive via chrome.alarms ─────────────────────────────────────

chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: KEEPALIVE_INTERVAL_MIN })

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) {
    // This fires every 30s, waking the SW if it slept.
    // Reconnect if WS is dead.
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      console.log('[Skynul] Alarm keepalive — reconnecting')
      connect()
    }
  }
})

// ── WebSocket connection ────────────────────────────────────────────

function connect() {
  if (ws && (ws.readyState === WebSocket.CONNECTING || ws.readyState === WebSocket.OPEN)) return

  try {
    ws = new WebSocket(RELAY_URL)
  } catch {
    return
  }

  ws.onopen = () => {
    console.log('[Skynul] Connected to relay')
    ws.send(JSON.stringify({ type: 'hello', extensionId: chrome.runtime.id }))
  }

  ws.onmessage = async (event) => {
    try {
      await handleCommand(JSON.parse(event.data))
    } catch (e) {
      console.warn('[Skynul] Bad message:', e)
    }
  }

  ws.onclose = () => {
    console.log('[Skynul] Relay disconnected')
    ws = null
    taskTabs.clear()
    detachAll()
    // Alarm will trigger reconnect — no setTimeout needed
  }

  ws.onerror = () => ws?.close()
}

function send(data) {
  if (ws?.readyState === WebSocket.OPEN) ws.send(JSON.stringify(data))
}

// ── Command handler ─────────────────────────────────────────────────

async function handleCommand(msg) {
  const { id, action, method, params } = msg
  const tid = msg.tabId // explicit tab from BrowserBridge (may be null for legacy)
  try {
    let result
    switch (action) {
      case 'taskStart':
        result = await createTaskTab()
        break
      case 'navigate':
        result = await navigateTab(msg.url, tid)
        break
      case 'click':
        result = await clickSelector(msg.selector, msg.frameId, tid)
        break
      case 'type':
        result = await typeInto(msg.selector, msg.text, msg.frameId, tid)
        break
      case 'pressKey':
        result = await pressKey(msg.key, tid)
        break
      case 'evaluate':
        result = await evaluateJS(msg.js, msg.frameId, tid)
        break
      case 'getPageInfo':
        result = await getPageInfo(msg.frameId, tid)
        break
      case 'getFrames':
        result = await getFrames(tid)
        break
      case 'screenshot':
        result = await captureScreenshot(tid)
        break
      case 'uploadFile':
        result = await uploadFile(msg.selector, msg.filePaths, msg.frameId, tid)
        break
      case 'cdp':
        result = await sendCDP(method, params, tid ? await resolveTabId(tid) : undefined)
        break
      case 'snapshotSave':
        result = await snapshotSave(tid)
        break
      case 'snapshotRestore':
        result = await snapshotRestore(msg.snapshot, tid)
        break
      case 'ping':
        result = { pong: true }
        break
      default:
        throw new Error(`Unknown action: ${action}`)
    }
    send({ id, result })
  } catch (err) {
    send({ id, error: err.message || String(err) })
  }
}

// ── Debugger helpers ────────────────────────────────────────────────

async function resolveTabId(explicitTabId) {
  // If the command carries an explicit tabId (from BrowserBridge), use it
  if (explicitTabId != null) {
    try {
      await chrome.tabs.get(explicitTabId)
      return explicitTabId
    } catch {
      // tab was closed — fall through to fallback
    }
  }
  // Fallback for legacy / single-agent callers
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id) return tab.id
  ;[tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (tab?.id) return tab.id
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] })
  if (tabs.length > 0) return tabs[tabs.length - 1].id
  throw new Error('No active tab found')
}

/** Create a new tab for the task. The returned tabId must be sent back with every command. */
async function createTaskTab() {
  const tab = await chrome.tabs.create({ url: 'about:blank', active: false })
  taskTabs.add(tab.id)
  return { tabId: tab.id }
}

async function ensureAttached(tabId) {
  if (attachedTabs.has(tabId)) return
  await new Promise((resolve, reject) => {
    chrome.debugger.attach({ tabId }, '1.3', () => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
      else {
        attachedTabs.add(tabId)
        resolve()
      }
    })
  })
  // Track execution contexts so we can evaluate inside iframes
  frameContexts.clear()
  await sendCDP('Runtime.enable', {}, tabId)
  // Collect contexts that already exist (iframes loaded before attach)
  try {
    const { result } = await sendCDP(
      'Runtime.evaluate',
      {
        expression: '1',
        returnByValue: true
      },
      tabId
    ) // triggers main context
    const tree = await sendCDP('Page.getFrameTree', {}, tabId)
    const walkFrames = (node) => {
      const f = node.frame
      if (!frameContexts.has(f.id)) {
        // Probe each frame to force context creation
        sendCDP(
          'Page.createIsolatedWorld',
          { frameId: f.id, worldName: '__skynul_probe' },
          tabId
        ).catch(() => {})
      }
      for (const child of node.childFrames || []) walkFrames(child)
    }
    walkFrames(tree.frameTree)
    // Give contexts a moment to register via the event listener
    await new Promise((r) => setTimeout(r, 200))
  } catch {
    /* non-critical */
  }
}

chrome.debugger.onEvent.addListener((source, method, params) => {
  if (method === 'Runtime.executionContextCreated') {
    const ctx = params.context
    if (ctx.auxData?.frameId) {
      frameContexts.set(ctx.auxData.frameId, ctx.id)
    }
  }
  if (method === 'Runtime.executionContextDestroyed') {
    for (const [fid, cid] of frameContexts) {
      if (cid === params.executionContextId) {
        frameContexts.delete(fid)
        break
      }
    }
  }
})

function detachAll() {
  for (const tabId of attachedTabs) {
    try {
      chrome.debugger.detach({ tabId })
    } catch {
      /* ok */
    }
  }
  attachedTabs.clear()
}

async function sendCDP(method, params = {}, tabId) {
  if (!tabId) tabId = await resolveTabId()
  await ensureAttached(tabId)
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
      else resolve(result)
    })
  })
}

// ── High-level actions ──────────────────────────────────────────────

async function navigateTab(url, tid) {
  const tabId = await resolveTabId(tid)
  await ensureAttached(tabId)
  const result = await sendCDP('Page.navigate', { url }, tabId)
  // Wait for JS to execute and render dynamic content
  await new Promise((r) => setTimeout(r, 2500))
  return result
}

/** Find a DOM node by CSS selector, piercing closed shadow DOM via CDP. Returns nodeId or null. */
async function cdpQuerySelector(selector, tabId) {
  try {
    await sendCDP('DOM.enable', {}, tabId)
    const doc = await sendCDP('DOM.getDocument', { depth: -1, pierce: true }, tabId)
    // Walk the full tree (including shadowRoots) to find a matching node
    const findNode = (node) => {
      if (!node) return null
      const tag = (node.localName || '').toLowerCase()
      const attrs = {}
      if (node.attributes) {
        for (let i = 0; i < node.attributes.length; i += 2)
          attrs[node.attributes[i]] = node.attributes[i + 1]
      }
      // Check if this node matches the selector
      const matches =
        (selector.startsWith('#') && attrs.id === selector.slice(1)) ||
        (selector.startsWith('[') &&
          (() => {
            const m = selector.match(/\[([^=]+)="([^"]+)"\]/)
            return m && attrs[m[1]] === m[2]
          })()) ||
        (selector.includes('.') &&
          !selector.startsWith('[') &&
          (() => {
            const parts = selector.split('.')
            const sTag = parts[0] || tag
            const classes = (attrs.class || '').split(' ')
            return sTag === tag && parts.slice(1).every((c) => classes.includes(c))
          })()) ||
        (selector.includes('[aria-label=') &&
          (() => {
            const m = selector.match(/\[aria-label="([^"]+)"\]/)
            return m && attrs['aria-label'] === m[1]
          })())
      if (matches) return node
      for (const child of node.children || []) {
        const found = findNode(child)
        if (found) return found
      }
      for (const sr of node.shadowRoots || []) {
        const found = findNode(sr)
        if (found) return found
      }
      return null
    }
    const target = findNode(doc.root)
    if (target?.nodeId) return target.nodeId
    return null
  } catch {
    return null
  }
}

async function clickSelector(selector, frameId, tid) {
  const tabId = await resolveTabId(tid)
  await ensureAttached(tabId)
  const opts = {
    expression: `(() => { ${deepQueryFn} const el = deepQuery(${JSON.stringify(selector)}); if (!el) return { error: 'Element not found: ${selector}' }; el.scrollIntoView({ block: 'center' }); el.click(); return { success: true, tag: el.tagName }; })()`,
    returnByValue: true
  }
  if (frameId) {
    const ctxId = frameContexts.get(frameId)
    if (ctxId) opts.contextId = ctxId
  }
  const result = await sendCDP('Runtime.evaluate', opts, tabId)
  const val = result?.result?.value
  // Fallback: if JS deepQuery failed, try CDP DOM pierce for closed shadow DOM
  if (val?.error) {
    const nodeId = await cdpQuerySelector(selector, tabId)
    if (nodeId) {
      // Get box model to find click coordinates
      try {
        const box = await sendCDP('DOM.getBoxModel', { nodeId }, tabId)
        const q = box.model.content
        const cx = (q[0] + q[2] + q[4] + q[6]) / 4
        const cy = (q[1] + q[3] + q[5] + q[7]) / 4
        await sendCDP('DOM.scrollIntoViewIfNeeded', { nodeId }, tabId)
        await sendCDP(
          'Input.dispatchMouseEvent',
          { type: 'mousePressed', x: cx, y: cy, button: 'left', clickCount: 1 },
          tabId
        )
        await sendCDP(
          'Input.dispatchMouseEvent',
          { type: 'mouseReleased', x: cx, y: cy, button: 'left', clickCount: 1 },
          tabId
        )
        return { success: true, via: 'cdp-dom' }
      } catch (e) {
        throw new Error(`CDP click failed: ${e.message}`)
      }
    }
    throw new Error(val.error)
  }
  return val || { success: true }
}

async function typeInto(selector, text, frameId, tid) {
  const tabId = await resolveTabId(tid)
  await ensureAttached(tabId)
  const opts = {
    expression: `(() => { ${deepQueryFn} const el = deepQuery(${JSON.stringify(selector)}); if (!el) return { error: 'Element not found' }; el.focus(); el.select?.(); return { success: true }; })()`,
    returnByValue: true
  }
  if (frameId) {
    const ctxId = frameContexts.get(frameId)
    if (ctxId) opts.contextId = ctxId
  }
  const focusResult = await sendCDP('Runtime.evaluate', opts, tabId)
  const focusVal = focusResult?.result?.value
  // Fallback: if JS deepQuery failed, focus via CDP DOM
  if (focusVal?.error) {
    const nodeId = await cdpQuerySelector(selector, tabId)
    if (nodeId) {
      try {
        await sendCDP('DOM.scrollIntoViewIfNeeded', { nodeId }, tabId)
        await sendCDP('DOM.focus', { nodeId }, tabId)
      } catch (e) {
        throw new Error(`CDP focus failed: ${e.message}`)
      }
    } else {
      throw new Error(focusVal.error)
    }
  }
  for (const char of text) {
    await sendCDP(
      'Input.dispatchKeyEvent',
      { type: 'keyDown', text: char, unmodifiedText: char },
      tabId
    )
    await sendCDP('Input.dispatchKeyEvent', { type: 'keyUp' }, tabId)
  }
  return { success: true }
}

async function pressKey(key, tid) {
  const tabId = await resolveTabId(tid)
  await ensureAttached(tabId)
  const keyMap = {
    Enter: { keyCode: 13, code: 'Enter', key: 'Enter' },
    Tab: { keyCode: 9, code: 'Tab', key: 'Tab' },
    Escape: { keyCode: 27, code: 'Escape', key: 'Escape' },
    Backspace: { keyCode: 8, code: 'Backspace', key: 'Backspace' },
    ArrowUp: { keyCode: 38, code: 'ArrowUp', key: 'ArrowUp' },
    ArrowDown: { keyCode: 40, code: 'ArrowDown', key: 'ArrowDown' },
    ArrowLeft: { keyCode: 37, code: 'ArrowLeft', key: 'ArrowLeft' },
    ArrowRight: { keyCode: 39, code: 'ArrowRight', key: 'ArrowRight' },
    Space: { keyCode: 32, code: 'Space', key: ' ' }
  }
  const mapped = keyMap[key] || { key, code: key }
  await sendCDP(
    'Input.dispatchKeyEvent',
    {
      type: 'keyDown',
      ...mapped,
      windowsVirtualKeyCode: mapped.keyCode,
      nativeVirtualKeyCode: mapped.keyCode
    },
    tabId
  )
  await sendCDP(
    'Input.dispatchKeyEvent',
    {
      type: 'keyUp',
      ...mapped,
      windowsVirtualKeyCode: mapped.keyCode,
      nativeVirtualKeyCode: mapped.keyCode
    },
    tabId
  )
  return { success: true }
}

async function evaluateJS(js, frameId, tid) {
  const tabId = await resolveTabId(tid)
  await ensureAttached(tabId)
  const opts = { expression: js, returnByValue: true }
  if (frameId) {
    const ctxId = frameContexts.get(frameId)
    if (ctxId) opts.contextId = ctxId
  }
  const result = await sendCDP('Runtime.evaluate', opts, tabId)
  return result?.result?.value ?? null
}

async function getFrames(tid) {
  const tabId = await resolveTabId(tid)
  await ensureAttached(tabId)
  const tree = await sendCDP('Page.getFrameTree', {}, tabId)
  const frames = []
  const walk = (node) => {
    const f = node.frame
    frames.push({ id: f.id, url: f.url, name: f.name || '', parentId: f.parentId || null })
    for (const child of node.childFrames || []) walk(child)
  }
  walk(tree.frameTree)
  return frames
}

async function getPageInfo(frameId, tid) {
  const tabId = await resolveTabId(tid)
  await ensureAttached(tabId)

  const evalOpts = {
    returnByValue: true
  }
  if (frameId) {
    const ctxId = frameContexts.get(frameId)
    if (ctxId) evalOpts.contextId = ctxId
  }

  // Get basic page info + elements in one call
  const result = await sendCDP(
    'Runtime.evaluate',
    {
      ...evalOpts,
      expression: `(() => {
      const b = document.body;
      if (!b) return { url: location.href, title: document.title, text: '', elements: [] };
      
      // Collect all roots (document + shadow roots recursively)
      const roots = [document];
      const walkRoots = (node) => {
        if (!node) return;
        if (node.shadowRoot) { roots.push(node.shadowRoot); walkRoots(node.shadowRoot); }
        const children = node.children || node.childNodes || [];
        for (const c of children) { if (c.nodeType === 1) walkRoots(c); }
      };
      walkRoots(b);

      // Get text content from all roots
      const p = [];
      for (const root of roots) {
        const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
          acceptNode(n) {
            const e = n.parentElement;
            if (!e) return 2;
            const t = e.tagName;
            if (t==='SCRIPT'||t==='STYLE'||t==='NOSCRIPT') return 2;
            try { const s = getComputedStyle(e); if (s.display==='none'||s.visibility==='hidden') return 2; } catch { return 2; }
            return (n.textContent||'').trim().length>0?1:2;
          }
        });
        while(w.nextNode()) p.push((w.currentNode.textContent||'').trim());
      }
      const tx = p.join(' ');

      // Get interactive elements from all roots
      const elements = [];
      const seen = new Set();
      const isVisible = (el) => {
        try { const s = window.getComputedStyle(el); return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0'; } catch { return false; }
      };
      const getSelector = (el) => {
        if (el.id) return '#' + el.id;
        const testId = el.getAttribute('data-testid') || el.getAttribute('data-id');
        if (testId) return '[data-testid="' + testId + '"]';
        const name = el.getAttribute('name');
        if (name) return el.tagName.toLowerCase() + '[name="' + name + '"]';
        const placeholder = el.placeholder;
        if (placeholder) return el.tagName.toLowerCase() + '[placeholder="' + placeholder + '"]';
        if (el.className && typeof el.className === 'string') {
          const classes = el.className.split(' ').filter(c => c.length > 0);
          if (classes.length > 0) return el.tagName.toLowerCase() + '.' + classes.join('.');
        }
        const tag = el.tagName.toLowerCase();
        const siblings = Array.from(el.parentElement?.children || []).filter(sib => sib.tagName.toLowerCase() === tag);
        if (siblings.length > 1) return tag + ':nth-of-type(' + (siblings.indexOf(el) + 1) + ')';
        return tag;
      };

      const selectors = [
        'button:not([disabled])', 'a[href]', 'input:not([type="hidden"]):not([disabled])',
        'textarea:not([disabled])', 'select:not([disabled])',
        '[role="button"]', '[role="link"]', '[role="textbox"]', '[role="combobox"]',
        '[role="searchbox"]', '[onclick]'
      ];

      for (const root of roots) {
        selectors.forEach(sel => {
          try { root.querySelectorAll(sel) } catch { return; }
          root.querySelectorAll(sel).forEach(el => {
            if (!isVisible(el)) return;
            const tag = el.tagName.toLowerCase();
            const type = el.type || '';
            const text = (el.textContent?.slice(0, 50).trim() || el.placeholder || el.value || '');
            const selector = getSelector(el);
            if (!selector) return;
            const key = tag + ':' + selector;
            if (seen.has(key)) return;
            seen.add(key);
            elements.push({ tag, type: type || undefined, selector, text: text || undefined, interactive: true });
          });
        });
      }
      
      return { 
        url: location.href, 
        title: document.title, 
        text: tx.length>4000?tx.slice(0,4000)+'...':tx,
        elements: elements.slice(0, 30)
      }; 
    })()`
    },
    tabId
  )
  const info = result?.result?.value ?? { url: '', title: '', text: '', elements: [] }

  // Fallback: if JS walker found 0 elements, use CDP DOM domain to pierce closed shadow DOM
  if (info.elements.length === 0) {
    try {
      await sendCDP('DOM.enable', {}, tabId)
      const docResult = await sendCDP('DOM.getDocument', { depth: -1, pierce: true }, tabId)
      const elements = []
      const interactiveTags = new Set(['button', 'a', 'input', 'textarea', 'select'])
      const interactiveRoles = new Set([
        'button',
        'link',
        'textbox',
        'combobox',
        'searchbox',
        'tab',
        'menuitem'
      ])
      const seen = new Set()

      const walkNodes = (node) => {
        if (!node) return
        const tag = (node.localName || '').toLowerCase()
        const attrs = {}
        if (node.attributes) {
          for (let i = 0; i < node.attributes.length; i += 2) {
            attrs[node.attributes[i]] = node.attributes[i + 1]
          }
        }
        const role = attrs.role || ''
        const isInteractive =
          interactiveTags.has(tag) ||
          interactiveRoles.has(role) ||
          attrs.onclick ||
          attrs['data-action']
        if (isInteractive && tag !== 'script' && tag !== 'style') {
          let selector = ''
          if (attrs.id) selector = '#' + attrs.id
          else if (attrs['data-testid']) selector = `[data-testid="${attrs['data-testid']}"]`
          else if (attrs.name) selector = `${tag}[name="${attrs.name}"]`
          else if (attrs.placeholder) selector = `${tag}[placeholder="${attrs.placeholder}"]`
          else if (attrs.class)
            selector = tag + '.' + attrs.class.split(' ').filter(Boolean).join('.')
          else if (attrs['aria-label']) selector = `${tag}[aria-label="${attrs['aria-label']}"]`
          else selector = tag
          const text = (node.children || [])
            .filter((c) => c.nodeType === 3)
            .map((c) => (c.nodeValue || '').trim())
            .join(' ')
            .slice(0, 50)
          const key = tag + ':' + selector
          if (!seen.has(key)) {
            seen.add(key)
            elements.push({
              tag,
              type: attrs.type || undefined,
              selector,
              text: text || undefined,
              interactive: true
            })
          }
        }
        for (const child of node.children || []) walkNodes(child)
        // Pierce into shadow DOM children
        for (const child of node.shadowRoots || []) walkNodes(child)
      }
      walkNodes(docResult.root)
      if (elements.length > 0) {
        info.elements = elements.slice(0, 30)
      }
      await sendCDP('DOM.disable', {}, tabId)
    } catch {
      /* non-critical fallback */
    }
  }

  return info
}

async function captureScreenshot(tid) {
  const tabId = await resolveTabId(tid)
  await ensureAttached(tabId)
  const result = await sendCDP('Page.captureScreenshot', { format: 'png' }, tabId)
  return { data: result.data }
}

async function uploadFile(selector, filePaths, frameId, tid) {
  const tabId = await resolveTabId(tid)
  await ensureAttached(tabId)

  if (!Array.isArray(filePaths) || filePaths.length === 0) {
    throw new Error('uploadFile: filePaths is required')
  }

  await sendCDP('DOM.enable', {}, tabId)

  let nodeId = null
  try {
    // Preferred: CDP DOM.querySelector with pierce=true document tree.
    const doc = await sendCDP('DOM.getDocument', { depth: -1, pierce: true }, tabId)
    const rootNodeId = doc?.root?.nodeId
    if (rootNodeId) {
      const q = await sendCDP('DOM.querySelector', { nodeId: rootNodeId, selector }, tabId)
      if (q?.nodeId) nodeId = q.nodeId
    }
  } catch {
    // ignore
  }

  // Also try DOM.performSearch which can traverse deeper trees.
  if (!nodeId) {
    try {
      const search = await sendCDP(
        'DOM.performSearch',
        {
          query: selector,
          includeUserAgentShadowDOM: true
        },
        tabId
      )
      const sid = search?.searchId
      const count = search?.resultCount ?? 0
      if (sid && count > 0) {
        const res = await sendCDP(
          'DOM.getSearchResults',
          {
            searchId: sid,
            fromIndex: 0,
            toIndex: Math.min(1, count)
          },
          tabId
        )
        const ids = res?.nodeIds || []
        if (ids.length > 0) nodeId = ids[0]
        try {
          await sendCDP('DOM.discardSearchResults', { searchId: sid }, tabId)
        } catch {}
      }
    } catch {
      // ignore
    }
  }

  // If not found in main document, try inside iframe documents.
  if (!nodeId) {
    try {
      const tree = await sendCDP('Page.getFrameTree', {}, tabId)
      const ids = []
      const walk = (n) => {
        if (!n) return
        if (n.frame?.id) ids.push(n.frame.id)
        for (const c of n.childFrames || []) walk(c)
      }
      walk(tree.frameTree)

      // Skip the first (root) frame.
      for (const fid of ids.slice(1)) {
        try {
          const owner = await sendCDP('DOM.getFrameOwner', { frameId: fid }, tabId)
          const backendNodeId = owner?.backendNodeId
          if (!backendNodeId) continue
          const desc = await sendCDP('DOM.describeNode', { backendNodeId }, tabId)
          const docNodeId = desc?.node?.contentDocument?.nodeId
          if (!docNodeId) continue
          const q = await sendCDP('DOM.querySelector', { nodeId: docNodeId, selector }, tabId)
          if (q?.nodeId) {
            nodeId = q.nodeId
            break
          }
        } catch {
          // keep trying other frames
        }
      }
    } catch {
      // ignore
    }
  }

  if (!nodeId) {
    // Fallback: Runtime.evaluate (deepQuery) + DOM.requestNode.
    const evalOpts = {
      expression: `(() => { ${deepQueryFn} const el = deepQuery(${JSON.stringify(selector)}); return el || null; })()`,
      returnByValue: false
    }
    if (frameId) {
      const ctxId = frameContexts.get(frameId)
      if (ctxId) evalOpts.contextId = ctxId
    }
    const evalRes = await sendCDP('Runtime.evaluate', evalOpts, tabId)
    const objId = evalRes?.result?.objectId
    if (objId) {
      try {
        const node = await sendCDP('DOM.requestNode', { objectId: objId }, tabId)
        if (node?.nodeId) nodeId = node.nodeId
      } catch {
        // ignore
      }
    }
  }

  if (!nodeId) {
    // Last resort: limited matcher.
    nodeId = await cdpQuerySelector(selector, tabId)
  }

  if (!nodeId) throw new Error(`uploadFile: Could not resolve nodeId for selector: ${selector}`)

  await sendCDP('DOM.setFileInputFiles', { nodeId, files: filePaths }, tabId)
  try {
    await sendCDP('DOM.disable', {}, tabId)
  } catch {}
  return { success: true }
}

// ── Snapshot helpers ────────────────────────────────────────────

async function snapshotSave(tid) {
  const tabId = await resolveTabId(tid)
  await ensureAttached(tabId)

  // Get all cookies
  const cookieResult = await sendCDP('Network.getAllCookies', {}, tabId)
  const cookies = (cookieResult?.cookies ?? []).map((c) => ({
    name: c.name,
    value: c.value,
    domain: c.domain,
    path: c.path,
    secure: c.secure,
    httpOnly: c.httpOnly,
    sameSite: c.sameSite,
    expires: c.expires
  }))

  // Get localStorage, sessionStorage, URL, title, scroll
  const stateResult = await sendCDP(
    'Runtime.evaluate',
    {
      expression: `(() => {
        const ls = {};
        for (let i = 0; i < localStorage.length; i++) {
          const k = localStorage.key(i);
          ls[k] = localStorage.getItem(k);
        }
        const ss = {};
        for (let i = 0; i < sessionStorage.length; i++) {
          const k = sessionStorage.key(i);
          ss[k] = sessionStorage.getItem(k);
        }
        return {
          url: location.href,
          title: document.title,
          localStorage: ls,
          sessionStorage: ss,
          scrollX: window.scrollX,
          scrollY: window.scrollY
        };
      })()`,
      returnByValue: true
    },
    tabId
  )

  const state = stateResult?.result?.value ?? {}
  return {
    url: state.url ?? '',
    title: state.title ?? '',
    cookies,
    localStorage: state.localStorage ?? {},
    sessionStorage: state.sessionStorage ?? {},
    scrollX: state.scrollX ?? 0,
    scrollY: state.scrollY ?? 0
  }
}

async function snapshotRestore(snapshot, tid) {
  const tabId = await resolveTabId(tid)
  await ensureAttached(tabId)

  // Navigate to the saved URL
  await sendCDP('Page.navigate', { url: snapshot.url }, tabId)
  await new Promise((r) => setTimeout(r, 3000))

  // Set cookies
  if (snapshot.cookies?.length > 0) {
    await sendCDP('Network.setCookies', { cookies: snapshot.cookies }, tabId)
  }

  // Inject localStorage + sessionStorage
  const lsJson = JSON.stringify(snapshot.localStorage ?? {})
  const ssJson = JSON.stringify(snapshot.sessionStorage ?? {})
  await sendCDP(
    'Runtime.evaluate',
    {
      expression: `(() => {
        const ls = ${lsJson};
        for (const [k, v] of Object.entries(ls)) localStorage.setItem(k, v);
        const ss = ${ssJson};
        for (const [k, v] of Object.entries(ss)) sessionStorage.setItem(k, v);
        window.scrollTo(${snapshot.scrollX ?? 0}, ${snapshot.scrollY ?? 0});
      })()`,
      returnByValue: true
    },
    tabId
  )

  return { success: true }
}

// ── Lifecycle ───────────────────────────────────────────────────────

chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId) attachedTabs.delete(source.tabId)
})

chrome.tabs.onRemoved.addListener((tabId) => {
  attachedTabs.delete(tabId)
  taskTabs.delete(tabId)
})

// Initial connect
connect()
