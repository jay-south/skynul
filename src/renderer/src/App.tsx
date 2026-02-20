import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type { CapabilityId, ChatMessage, PolicyState, ThemeMode } from '../../shared/policy'
import type { Task, TaskCapabilityId } from '../../shared/task'
import { OAUTH_REDIRECT_TO, supabase, SUPABASE_CONFIGURED } from './supabase'
import { TaskPanel } from './components/TaskPanel'
import { TaskDetailView } from './components/TaskDetailView'
import { TaskApprovalDialog } from './components/TaskApprovalDialog'

const CAPABILITIES: Array<{ id: CapabilityId; title: string; desc: string }> = [
  {
    id: 'fs.read',
    title: 'Read Files',
    desc: 'Allow reading text files inside the workspace.'
  },
  {
    id: 'fs.write',
    title: 'Write Files',
    desc: 'Allow writing text files inside the workspace.'
  },
  {
    id: 'cmd.run',
    title: 'Run Commands',
    desc: 'Allow running approved commands (not wired yet).'
  },
  {
    id: 'net.http',
    title: 'Network Access',
    desc: 'Allow outbound HTTP requests (not wired yet).'
  }
]

type Conversation = {
  id: string
  title: string
  messages: ChatMessage[]
}

type SidebarTab = 'chats' | 'tasks'

const STORAGE_KEY = 'netbot.conversations.v1'

const DEFAULT_BOOT_MESSAGES = new Set<string>([
  'Welcome to Netbot. Pick a workspace and enable only the capabilities you need. Nothing executes without explicit permissions.',
  'Bienvenido a Netbot. Elegi un workspace y habilita solo las capabilities que necesites. Aca nada se ejecuta sin permisos.'
])

function newConversation(): Conversation {
  const id = `c_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
  return {
    id,
    title: 'New chat',
    messages: []
  }
}

function sanitizeConversations(input: Conversation[]): Conversation[] {
  return input.map((c) => {
    if (c.messages.length === 0) return c
    const first = c.messages[0]
    if (first.role === 'assistant' && DEFAULT_BOOT_MESSAGES.has(first.content)) {
      return { ...c, messages: c.messages.slice(1) }
    }
    return c
  })
}

function App(): React.JSX.Element {
  const [policy, setPolicy] = useState<PolicyState | null>(null)
  const [error, setError] = useState<string>('')

  const [draft, setDraft] = useState<string>('')
  const [settingsOpen, setSettingsOpen] = useState<boolean>(false)
  const [accountEmail, setAccountEmail] = useState<string>('')
  const [accountConnected, setAccountConnected] = useState<boolean>(false)
  const [accountBusy, setAccountBusy] = useState<boolean>(false)

  const [chatgptConnected, setChatgptConnected] = useState<boolean>(false)
  const [chatgptBusy, setChatgptBusy] = useState<boolean>(false)
  const [isThinking, setIsThinking] = useState<boolean>(false)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState<boolean>(false)
  const recognitionRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null)

  // ── Sidebar tab ──────────────────────────────────────────────────────
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chats')

  // ── Task state ───────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<Task[]>([])
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [approvalTask, setApprovalTask] = useState<Task | null>(null)

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === activeTaskId) ?? null,
    [tasks, activeTaskId]
  )

  const [conversations, setConversations] = useState<Conversation[]>(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY)
      if (!raw) return [newConversation()]
      const parsed = JSON.parse(raw) as Conversation[]
      if (!Array.isArray(parsed) || parsed.length === 0) return [newConversation()]
      return sanitizeConversations(parsed)
    } catch {
      return [newConversation()]
    }
  })

  const [activeId, setActiveId] = useState<string>(
    () => conversations[0]?.id ?? newConversation().id
  )
  const scrollRef = useRef<HTMLDivElement | null>(null)

  const workspaceLabel = useMemo(() => {
    if (!policy?.workspaceRoot) return 'No workspace'
    return policy.workspaceRoot
  }, [policy])

  const themeMode = policy?.themeMode

  const activeConversation = useMemo(() => {
    return conversations.find((c) => c.id === activeId) ?? conversations[0]
  }, [activeId, conversations])

  const messages = useMemo(() => {
    return activeConversation?.messages ?? []
  }, [activeConversation])

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const p = await window.netbot.getPolicy()
        if (!alive) return
        setPolicy(p)
      } catch (e) {
        if (!alive) return
        setError(e instanceof Error ? e.message : String(e))
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  // ── Task update listener ─────────────────────────────────────────────
  useEffect(() => {
    // Load existing tasks
    void window.netbot.taskList().then(({ tasks: list }) => setTasks(list))

    // Listen for push updates
    const off = window.netbot.onTaskUpdate((updated) => {
      setTasks((prev) => {
        const idx = prev.findIndex((t) => t.id === updated.id)
        if (idx === -1) return [updated, ...prev]
        const next = [...prev]
        next[idx] = updated
        return next
      })
    })
    return off
  }, [])

  useEffect(() => {
    if (!SUPABASE_CONFIGURED || !supabase) return

    let alive = true
    void supabase.auth.getUser().then(({ data, error }) => {
      if (!alive) return
      if (error || !data.user) {
        setAccountConnected(false)
        setAccountEmail('')
        return
      }
      setAccountConnected(true)
      setAccountEmail(data.user.email ?? '')
    })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return
      const email = session?.user?.email ?? ''
      setAccountConnected(Boolean(session))
      setAccountEmail(email)
    })

    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    void window.netbot.chatgptHasAuth().then(async (connected) => {
      setChatgptConnected(connected)
      if (connected) {
        const next = await window.netbot.setActiveProvider('chatgpt')
        setPolicy(next)
      }
    })
    const offSuccess = window.netbot.onChatGPTAuthSuccess(() => {
      setChatgptConnected(true)
      setChatgptBusy(false)
      void window.netbot.setActiveProvider('chatgpt').then(setPolicy)
    })
    const offError = window.netbot.onChatGPTAuthError((msg) => {
      setError(msg)
      setChatgptBusy(false)
    })
    return () => {
      offSuccess()
      offError()
    }
  }, [])

  useEffect(() => {
    const off = window.netbot.onAuthCallback((callbackUrl) => {
      if (!SUPABASE_CONFIGURED || !supabase) {
        setError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
        return
      }

      try {
        const u = new URL(callbackUrl)
        const code = u.searchParams.get('code')
        if (!code) return
        setAccountBusy(true)
        void (async () => {
          const { data, error } = await supabase.auth.exchangeCodeForSession(code)
          if (error) throw error

          const email = data.session?.user?.email ?? ''
          setAccountConnected(Boolean(data.session))
          setAccountEmail(email)
        })()
          .catch((e) => setError(e instanceof Error ? e.message : String(e)))
          .finally(() => setAccountBusy(false))
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
      }
    })

    return () => off()
  }, [])

  useEffect(() => {
    if (!themeMode) return

    const root = document.documentElement
    const mode = themeMode

    if (mode === 'light' || mode === 'dark') {
      root.setAttribute('data-theme', mode)
      document.body.setAttribute('data-theme', mode)
      return
    }

    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const apply = (): void => {
      const next = mq.matches ? 'dark' : 'light'
      root.setAttribute('data-theme', next)
      document.body.setAttribute('data-theme', next)
    }

    apply()
    mq.addEventListener('change', apply)
    return () => mq.removeEventListener('change', apply)
  }, [themeMode])

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [messages, isThinking])

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(conversations))
    } catch {
      // ignore
    }
  }, [conversations])

  const pickWorkspace = async (): Promise<void> => {
    setError('')
    const next = await window.netbot.pickWorkspace()
    setPolicy(next)
  }

  const toggle = async (id: CapabilityId): Promise<void> => {
    if (!policy) return
    setError('')
    const next = await window.netbot.setCapability(id, !policy.capabilities[id])
    setPolicy(next)
  }

  const setTheme = async (themeMode: ThemeMode): Promise<void> => {
    if (!policy) return
    setError('')
    const next = await window.netbot.setTheme(themeMode)
    setPolicy(next)
  }

  const send = async (): Promise<void> => {
    const text = draft.trim()
    if (!text) return
    setDraft('')
    setError('')

    if (!policy?.capabilities['net.http']) {
      setError('Network Access capability is disabled.')
      return
    }

    const userMsg: ChatMessage = { role: 'user', content: text }

    setConversations((prev) =>
      prev.map((c) => {
        if (c.id !== activeId) return c
        const nextMessages = [...c.messages, userMsg]
        const nextTitle = c.title === 'New chat' ? text.slice(0, 32) || 'New chat' : c.title
        return { ...c, title: nextTitle, messages: nextMessages }
      })
    )

    try {
      const currentMessages = (activeConversation?.messages ?? []).concat(userMsg)

      setIsThinking(true)
      let content: string

      if (policy.provider.active === 'chatgpt') {
        // Route through main process → Codex endpoint
        const res = await window.netbot.chatSend(currentMessages)
        content = res.content
      } else {
        // Supabase edge function path
        if (!SUPABASE_CONFIGURED || !supabase) {
          throw new Error('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
        }
        const { data: userData, error: userErr } = await supabase.auth.getUser()
        if (userErr || !userData.user) {
          throw new Error('Not signed in. Open Settings and sign in.')
        }
        const { data, error: fnErr } = await supabase.functions.invoke('chat', {
          body: { messages: currentMessages }
        })
        if (fnErr) {
          const name = (fnErr as { name?: string }).name
          const msg = (fnErr as { message?: string }).message
          throw new Error(`Edge function error${name ? ` (${name})` : ''}: ${msg ?? String(fnErr)}`)
        }
        content = (data as { content?: string } | null)?.content ?? ''
        if (!content) throw new Error('Empty response')
      }

      const assistantMsg: ChatMessage = { role: 'assistant', content }

      setConversations((prev) =>
        prev.map((c) => {
          if (c.id !== activeId) return c
          return { ...c, messages: [...c.messages, assistantMsg] }
        })
      )
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setIsThinking(false)
    }
  }

  const createChat = (): void => {
    const c = newConversation()
    setConversations((prev) => [c, ...prev])
    setActiveId(c.id)
  }

  const signIn = async (): Promise<void> => {
    if (!SUPABASE_CONFIGURED || !supabase) {
      setError('Supabase is not configured. Set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.')
      return
    }

    setError('')
    setAccountBusy(true)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: OAUTH_REDIRECT_TO,
          skipBrowserRedirect: true
        }
      })
      if (error) throw error
      if (!data?.url) throw new Error('No OAuth URL returned')
      await window.netbot.openExternal(data.url)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAccountBusy(false)
    }
  }

  const signOut = async (): Promise<void> => {
    if (!SUPABASE_CONFIGURED || !supabase) return
    setError('')
    setAccountBusy(true)
    try {
      await supabase.auth.signOut()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setAccountBusy(false)
    }
  }

  useEffect(() => {
    if (!menuOpenId) return
    const close = (): void => setMenuOpenId(null)
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [menuOpenId])

  const deleteConversation = useCallback(
    (id: string): void => {
      setMenuOpenId(null)
      setConversations((prev) => {
        const next = prev.filter((c) => c.id !== id)
        if (next.length === 0) {
          const fresh = newConversation()
          setActiveId(fresh.id)
          return [fresh]
        }
        if (id === activeId) setActiveId(next[0].id)
        return next
      })
    },
    [activeId]
  )

  const modelLabel = useMemo(() => {
    if (!policy) return ''
    if (policy.provider.active === 'chatgpt') return 'ChatGPT Pro · gpt-5.2'
    return `OpenAI · ${policy.provider.openaiModel}`
  }, [policy])

  const toggleMic = (): void => {
    if (isRecording) {
      recognitionRef.current?.stop()
      return
    }

    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition
    if (!SR) {
      setError('Speech recognition is not supported in this environment.')
      return
    }

    const rec = new SR()
    rec.lang = 'es-AR'
    rec.interimResults = false
    rec.continuous = false

    rec.onstart = (): void => setIsRecording(true)
    rec.onend = (): void => setIsRecording(false)
    rec.onerror = (): void => setIsRecording(false)
    rec.onresult = (e: SpeechRecognitionEvent): void => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(' ')
        .trim()
      if (transcript) setDraft((prev) => (prev ? `${prev} ${transcript}` : transcript))
    }

    recognitionRef.current = rec
    rec.start()
  }

  const chatgptConnect = async (): Promise<void> => {
    setError('')
    setChatgptBusy(true)
    try {
      await window.netbot.chatgptOAuthStart()
      // Success/error handled via push events from main process
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setChatgptBusy(false)
    }
  }

  const chatgptDisconnect = async (): Promise<void> => {
    setError('')
    setChatgptBusy(true)
    try {
      await window.netbot.chatgptSignOut()
      setChatgptConnected(false)
      const next = await window.netbot.setActiveProvider('openai')
      setPolicy(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setChatgptBusy(false)
    }
  }

  // ── Task handlers ────────────────────────────────────────────────────

  const handleNewTask = async (prompt: string, caps: TaskCapabilityId[]): Promise<void> => {
    try {
      const { task } = await window.netbot.taskCreate(prompt, caps)
      setTasks((prev) => [task, ...prev])
      setActiveTaskId(task.id)
      setApprovalTask(task)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleApproveTask = async (taskId: string): Promise<void> => {
    try {
      setApprovalTask(null)
      const updated = await window.netbot.taskApprove(taskId)
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleCancelTask = async (taskId: string): Promise<void> => {
    try {
      setApprovalTask(null)
      const updated = await window.netbot.taskCancel(taskId)
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className="layout">
      <div className="titleBar">
        <button className="winBtn" onClick={() => void window.netbot.windowMinimize()} aria-label="Minimize">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <rect x="4" y="11" width="16" height="2" rx="1" />
          </svg>
        </button>
        <button className="winBtn" onClick={() => void window.netbot.windowMaximize()} aria-label="Maximize">
          <svg viewBox="0 0 24 24" width="11" height="11" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="4" y="4" width="16" height="16" rx="2" />
          </svg>
        </button>
        <button className="winBtn close" onClick={() => void window.netbot.windowClose()} aria-label="Close">
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <path d="M6.225 4.811a1 1 0 0 0-1.414 1.414L10.586 12l-5.775 5.775a1 1 0 1 0 1.414 1.414L12 13.414l5.775 5.775a1 1 0 0 0 1.414-1.414L13.414 12l5.775-5.775a1 1 0 0 0-1.414-1.414L12 10.586 6.225 4.811Z" />
          </svg>
        </button>
      </div>

      <aside className="sidebar">
        {/* ── Tab switcher ─────────────────────────────────────────── */}
        <div className="sidebarTabs">
          <button
            className={`sidebarTab ${sidebarTab === 'chats' ? 'active' : ''}`}
            onClick={() => setSidebarTab('chats')}
          >
            Chats
          </button>
          <button
            className={`sidebarTab ${sidebarTab === 'tasks' ? 'active' : ''}`}
            onClick={() => setSidebarTab('tasks')}
          >
            Tasks
          </button>
        </div>

        {/* ── Chats sidebar ───────────────────────────────────────── */}
        {sidebarTab === 'chats' && (
          <>
            <div className="rbTop">
              <div className="rbTitle">Chats</div>
              <button className="rbNew" onClick={createChat} title="New chat">
                New
              </button>
            </div>

            <div className="rbList" role="tablist" aria-label="Chats">
              {conversations.map((c) => (
                <div
                  key={c.id}
                  className={`rbItem ${c.id === activeId ? 'active' : ''}`}
                  role="tab"
                  aria-selected={c.id === activeId}
                >
                  <div className="rbItemContent" onClick={() => setActiveId(c.id)}>
                    <div className="rbItemTitle">{c.title}</div>
                    <div className="rbItemMeta">{c.messages.length} messages</div>
                  </div>
                  <button
                    className="rbMenuBtn"
                    aria-label="Chat options"
                    onClick={(e) => {
                      e.stopPropagation()
                      setMenuOpenId(menuOpenId === c.id ? null : c.id)
                    }}
                  >
                    ···
                  </button>
                  {menuOpenId === c.id && (
                    <div className="rbDropdown" onClick={(e) => e.stopPropagation()}>
                      <button className="rbDropdownItem" onClick={() => deleteConversation(c.id)}>
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </>
        )}

        {/* ── Tasks sidebar ───────────────────────────────────────── */}
        {sidebarTab === 'tasks' && (
          <TaskPanel
            tasks={tasks}
            activeTaskId={activeTaskId}
            onSelectTask={setActiveTaskId}
            onNewTask={(prompt, caps) => void handleNewTask(prompt, caps)}
          />
        )}

        <div className="rbFooter">
          <div className="sbFooterRow">
            <div className="sbFooterBrand">
              <div className="sbFooterName">Netbot</div>
            </div>
            <button
              className="iconBtn"
              onClick={() => setSettingsOpen(true)}
              aria-label="Open settings"
              title="Settings"
            >
              <svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true">
                <path
                  d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 1h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.13.52-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 7.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.3.6.22l2.39-.96c.5.41 1.05.73 1.63.94l.36 2.54c.05.24.25.42.49.42h3.8c.24 0 .44-.18.49-.42l.36-2.54c.58-.22 1.13-.52 1.63-.94l2.39.96c.22.08.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z"
                  fill="currentColor"
                />
              </svg>
            </button>
          </div>
        </div>
      </aside>

      <section className="main">
        {/* ── Chat view ───────────────────────────────────────────── */}
        {sidebarTab === 'chats' && (
          <>
            <div className="chatScroll" ref={scrollRef}>
              <div className="chat">
                {messages.map((m, idx) => (
                  <div key={idx} className={`msg ${m.role}`}>
                    <div className="msgBody">{m.content}</div>
                  </div>
                ))}
                {isThinking ? (
                  <div className="typingBubble">
                    <div className="typingDot" />
                    <div className="typingDot" />
                    <div className="typingDot" />
                  </div>
                ) : null}
              </div>
            </div>

            <footer className="composer">
              {error ? <div className="composerError">{error}</div> : null}
              <div className="composerRow">
                <div className="promptWrap">
                  {modelLabel ? <div className="modelBadge">{modelLabel}</div> : null}
                  <textarea
                    className="prompt"
                    placeholder="Message Netbot..."
                    value={draft}
                    onChange={(e) => setDraft(e.target.value)}
                    rows={3}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' && !e.shiftKey) {
                        e.preventDefault()
                        void send()
                      }
                    }}
                  />
                  <div className="promptActions">
                    <button
                      className={`micBtn${isRecording ? ' recording' : ''}`}
                      onClick={toggleMic}
                      aria-label={isRecording ? 'Stop recording' : 'Voice input'}
                      title={isRecording ? 'Stop recording' : 'Voice input'}
                    >
                      {isRecording ? (
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                          <rect x="6" y="6" width="12" height="12" rx="2" />
                        </svg>
                      ) : (
                        <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
                          <path d="M12 1a4 4 0 0 1 4 4v6a4 4 0 0 1-8 0V5a4 4 0 0 1 4-4Zm6.5 9a.5.5 0 0 1 .5.5 7 7 0 0 1-6.5 6.97V19h2a.5.5 0 0 1 0 1h-5a.5.5 0 0 1 0-1h2v-1.53A7 7 0 0 1 5 10.5a.5.5 0 0 1 1 0 6 6 0 0 0 12 0 .5.5 0 0 1 .5-.5Z" />
                        </svg>
                      )}
                    </button>
                    <button
                      className="send"
                      onClick={() => void send()}
                      disabled={!draft.trim() || isThinking}
                      aria-label="Send"
                    >
                      <svg viewBox="0 0 24 24" width="16" height="16" fill="currentColor">
                        <path d="M12 4a.75.75 0 0 1 .53.22l7 7a.75.75 0 0 1-1.06 1.06L12.75 6.81V19.25a.75.75 0 0 1-1.5 0V6.81l-5.72 5.47a.75.75 0 0 1-1.06-1.06l7-7A.75.75 0 0 1 12 4Z" />
                      </svg>
                    </button>
                  </div>
                </div>
              </div>
              <div className="composerNote">Enter to send · Shift+Enter nueva línea.</div>
            </footer>
          </>
        )}

        {/* ── Task detail view ────────────────────────────────────── */}
        {sidebarTab === 'tasks' && activeTask && (
          <TaskDetailView
            task={activeTask}
            onApprove={() => void handleApproveTask(activeTask.id)}
            onCancel={() => void handleCancelTask(activeTask.id)}
          />
        )}

        {sidebarTab === 'tasks' && !activeTask && (
          <div className="taskEmptyMain">
            <div className="taskEmptyMainText">
              Select a task from the sidebar or create a new one.
            </div>
          </div>
        )}
      </section>

      {/* ── Task approval dialog ────────────────────────────────── */}
      {approvalTask && (
        <TaskApprovalDialog
          task={approvalTask}
          onApprove={() => void handleApproveTask(approvalTask.id)}
          onCancel={() => setApprovalTask(null)}
        />
      )}

      {settingsOpen ? (
        <div className="modalBackdrop" onMouseDown={() => setSettingsOpen(false)}>
          <div
            className="modal"
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="modalHeader">
              <div className="modalTitle">Settings</div>
              <button
                className="modalClose"
                onClick={() => setSettingsOpen(false)}
                aria-label="Close"
              >
                ×
              </button>
            </div>

            <div className="modalBody">
              {error ? <div className="modalError">{error}</div> : null}
              <div className="modalSection">
                <div className="modalLabel">Workspace</div>
                <div className="pathBox" title={workspaceLabel}>
                  {workspaceLabel}
                </div>
                <button className="btn" onClick={pickWorkspace}>
                  Pick workspace
                </button>
              </div>

              <div className="modalSection">
                <div className="modalLabel">Capabilities</div>
                <div className="capList">
                  {CAPABILITIES.map((c) => (
                    <button
                      key={c.id}
                      className={`cap ${policy?.capabilities[c.id] ? 'on' : 'off'}`}
                      onClick={() => toggle(c.id)}
                      disabled={!policy}
                      title={c.desc}
                    >
                      <div className="capLeft">
                        <div className="capTitle">{c.title}</div>
                        <div className="capDesc">{c.id}</div>
                      </div>
                      <div className="capToggle" aria-hidden="true">
                        <div className="capKnob" />
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <div className="modalSection">
                <div className="modalLabel">Theme</div>
                <div className="seg">
                  {(['system', 'light', 'dark'] as const).map((m) => (
                    <button
                      key={m}
                      className={`segBtn ${policy?.themeMode === m ? 'active' : ''}`}
                      onClick={() => void setTheme(m)}
                      disabled={!policy}
                      aria-pressed={policy?.themeMode === m}
                    >
                      {m === 'system' ? 'System' : m === 'light' ? 'Light' : 'Dark'}
                    </button>
                  ))}
                </div>
              </div>

              <div className="modalSection">
                <div className="modalLabel">Account</div>
                <div className="formGrid">
                  <div className="field">
                    <div className="fieldLabel">Status</div>
                    <div className="fieldHint">
                      {SUPABASE_CONFIGURED
                        ? accountConnected
                          ? `Connected${accountEmail ? ` as ${accountEmail}` : ''}.`
                          : 'Not connected.'
                        : 'Supabase not configured.'}
                    </div>
                  </div>

                  <div className="field">
                    {accountConnected ? (
                      <button className="btn" onClick={() => void signOut()} disabled={accountBusy}>
                        Sign out
                      </button>
                    ) : (
                      <button className="btn" onClick={() => void signIn()} disabled={accountBusy}>
                        Sign in with Google
                      </button>
                    )}
                    <div className="fieldHint">Network capability must be enabled to chat.</div>
                  </div>
                </div>
              </div>

              <div className="modalSection">
                <div className="modalLabel">ChatGPT Pro</div>
                <div className="formGrid">
                  <div className="field">
                    <div className="fieldLabel">Status</div>
                    <div className="fieldHint">
                      {chatgptConnected ? 'Connected — using your ChatGPT Pro subscription.' : 'Not connected.'}
                    </div>
                  </div>
                  <div className="field">
                    {chatgptConnected ? (
                      <button className="btn" onClick={() => void chatgptDisconnect()} disabled={chatgptBusy}>
                        Disconnect
                      </button>
                    ) : (
                      <button className="btn" onClick={() => void chatgptConnect()} disabled={chatgptBusy}>
                        {chatgptBusy ? 'Connecting…' : 'Connect ChatGPT Pro'}
                      </button>
                    )}
                    <div className="fieldHint">
                      Opens a browser window to log in with your OpenAI account. No API key needed.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  )
}

export default App
