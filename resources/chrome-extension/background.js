/**
 * Netbot CDP Relay — Chrome Extension Service Worker (Manifest V3)
 *
 * Connects to Netbot's local WebSocket relay server and executes
 * chrome.debugger commands on behalf of the Netbot agent.
 *
 * MV3 service workers die after ~30s of inactivity. We use chrome.alarms
 * as a keepalive to ensure the WS connection stays up.
 */

const RELAY_URL = 'ws://localhost:19222'
const KEEPALIVE_ALARM = 'netbot-keepalive'
const KEEPALIVE_INTERVAL_MIN = 0.5 // 30 seconds — minimum chrome.alarms allows

/** @type {WebSocket | null} */
let ws = null
/** @type {Set<number>} */
const attachedTabs = new Set()

// ── Keepalive via chrome.alarms ─────────────────────────────────────

chrome.alarms.create(KEEPALIVE_ALARM, { periodInMinutes: KEEPALIVE_INTERVAL_MIN })

chrome.alarms.onAlarm.addListener((alarm) => {
  if (alarm.name === KEEPALIVE_ALARM) {
    // This fires every 30s, waking the SW if it slept.
    // Reconnect if WS is dead.
    if (!ws || ws.readyState === WebSocket.CLOSED || ws.readyState === WebSocket.CLOSING) {
      console.log('[Netbot] Alarm keepalive — reconnecting')
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
    console.log('[Netbot] Connected to relay')
    ws.send(JSON.stringify({ type: 'hello', extensionId: chrome.runtime.id }))
  }

  ws.onmessage = async (event) => {
    try {
      await handleCommand(JSON.parse(event.data))
    } catch (e) {
      console.warn('[Netbot] Bad message:', e)
    }
  }

  ws.onclose = () => {
    console.log('[Netbot] Relay disconnected')
    ws = null
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
  try {
    let result
    switch (action) {
      case 'navigate':
        result = await navigateTab(msg.url)
        break
      case 'click':
        result = await clickSelector(msg.selector)
        break
      case 'type':
        result = await typeInto(msg.selector, msg.text)
        break
      case 'pressKey':
        result = await pressKey(msg.key)
        break
      case 'evaluate':
        result = await evaluateJS(msg.js)
        break
      case 'getPageInfo':
        result = await getPageInfo()
        break
      case 'screenshot':
        result = await captureScreenshot()
        break
      case 'cdp':
        result = await sendCDP(method, params)
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

async function getActiveTabId() {
  // Try active tab in current window first
  let [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
  if (tab?.id)
    return tab.id
    // Fallback: active tab in any window (Netbot may have focus, not Chrome)
  ;[tab] = await chrome.tabs.query({ active: true, lastFocusedWindow: true })
  if (tab?.id) return tab.id
  // Last resort: any non-chrome tab
  const tabs = await chrome.tabs.query({ url: ['http://*/*', 'https://*/*'] })
  if (tabs.length > 0) return tabs[tabs.length - 1].id
  throw new Error('No active tab found')
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
}

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
  if (!tabId) tabId = await getActiveTabId()
  await ensureAttached(tabId)
  return new Promise((resolve, reject) => {
    chrome.debugger.sendCommand({ tabId }, method, params, (result) => {
      if (chrome.runtime.lastError) reject(new Error(chrome.runtime.lastError.message))
      else resolve(result)
    })
  })
}

// ── High-level actions ──────────────────────────────────────────────

async function navigateTab(url) {
  const tabId = await getActiveTabId()
  await ensureAttached(tabId)
  const result = await sendCDP('Page.navigate', { url }, tabId)
  // Wait for JS to execute and render dynamic content
  await new Promise((r) => setTimeout(r, 2500))
  return result
}

async function clickSelector(selector) {
  const tabId = await getActiveTabId()
  await ensureAttached(tabId)
  const result = await sendCDP(
    'Runtime.evaluate',
    {
      expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return { error: 'Element not found: ${selector}' }; el.scrollIntoView({ block: 'center' }); el.click(); return { success: true, tag: el.tagName }; })()`,
      returnByValue: true
    },
    tabId
  )
  const val = result?.result?.value
  if (val?.error) throw new Error(val.error)
  return val || { success: true }
}

async function typeInto(selector, text) {
  const tabId = await getActiveTabId()
  await ensureAttached(tabId)
  await sendCDP(
    'Runtime.evaluate',
    {
      expression: `(() => { const el = document.querySelector(${JSON.stringify(selector)}); if (!el) return { error: 'Element not found' }; el.focus(); el.select?.(); return { success: true }; })()`,
      returnByValue: true
    },
    tabId
  )
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

async function pressKey(key) {
  const tabId = await getActiveTabId()
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

async function evaluateJS(js) {
  const tabId = await getActiveTabId()
  await ensureAttached(tabId)
  const result = await sendCDP('Runtime.evaluate', { expression: js, returnByValue: true }, tabId)
  return result?.result?.value ?? null
}

async function getPageInfo() {
  const tabId = await getActiveTabId()
  await ensureAttached(tabId)

  // Get basic page info + elements in one call
  const result = await sendCDP(
    'Runtime.evaluate',
    {
      expression: `(() => {
      const b = document.body;
      if (!b) return { url: location.href, title: document.title, text: '', elements: [] };
      
      // Get text content
      const w = document.createTreeWalker(b, NodeFilter.SHOW_TEXT, { 
        acceptNode(n) { 
          const e = n.parentElement; 
          if (!e) return 2; 
          const t = e.tagName; 
          if (t==='SCRIPT'||t==='STYLE'||t==='NOSCRIPT') return 2; 
          const s = getComputedStyle(e); 
          if (s.display==='none'||s.visibility==='hidden') return 2; 
          return (n.textContent||'').trim().length>0?1:2; 
        } 
      }); 
      const p = []; 
      while(w.nextNode()) p.push((w.currentNode.textContent||'').trim()); 
      const tx = p.join(' '); 
      
      // Get interactive elements
      const elements = [];
      const seen = new Set();
      const isVisible = (el) => {
        const s = window.getComputedStyle(el);
        return s.display !== 'none' && s.visibility !== 'hidden' && s.opacity !== '0';
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
          if (classes.length > 0) {
            return el.tagName.toLowerCase() + '.' + classes.join('.');
          }
        }
        // Fallback: tag with nth-of-type index
        const tag = el.tagName.toLowerCase();
        const siblings = Array.from(el.parentElement?.children || []).filter(
          sib => sib.tagName.toLowerCase() === tag
        );
        if (siblings.length > 1) {
          const index = siblings.indexOf(el) + 1;
          return tag + ':nth-of-type(' + index + ')';
        }
        return tag;
      };
      
      const selectors = [
        'button:not([disabled])', 'a[href]', 'input:not([type="hidden"]):not([disabled])',
        'textarea:not([disabled])', 'select:not([disabled])',
        '[role="button"]', '[role="link"]', '[role="textbox"]', '[role="combobox"]',
        '[role="searchbox"]', '[onclick]'
      ];
      
      selectors.forEach(sel => {
        document.querySelectorAll(sel).forEach(el => {
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
      
      return { 
        url: location.href, 
        title: document.title, 
        text: tx.length>4000?tx.slice(0,4000)+'...':tx,
        elements: elements.slice(0, 30)
      }; 
    })()`,
      returnByValue: true
    },
    tabId
  )
  return result?.result?.value ?? { url: '', title: '', text: '', elements: [] }
}

async function captureScreenshot() {
  const tabId = await getActiveTabId()
  await ensureAttached(tabId)
  const result = await sendCDP('Page.captureScreenshot', { format: 'png' }, tabId)
  return { data: result.data }
}

// ── Lifecycle ───────────────────────────────────────────────────────

chrome.debugger.onDetach.addListener((source) => {
  if (source.tabId) attachedTabs.delete(source.tabId)
})

chrome.tabs.onRemoved.addListener((tabId) => attachedTabs.delete(tabId))

// Initial connect
connect()
