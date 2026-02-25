import { useEffect, useMemo, useRef, useState, useCallback } from 'react'
import type {
  CapabilityId,
  ChatMessage,
  LanguageCode,
  PolicyState,
  ProviderId,
  ThemeMode
} from '../../shared/policy'
import type { Task, TaskCapabilityId } from '../../shared/task'
import { OAUTH_REDIRECT_TO, supabase, SUPABASE_CONFIGURED } from './supabase'
import { TaskPanel } from './components/TaskPanel'
import { TaskDetailView } from './components/TaskDetailView'
import { TaskApprovalDialog } from './components/TaskApprovalDialog'
import { TaskTemplates, type TaskTemplateId } from './components/TaskTemplates'
import { TaskComposer } from './components/TaskComposer'
import { t } from './i18n'

import chatgptIcon from './assets/chatgpt.svg'
import claudeIcon from './assets/claude-logo.svg'
import deepseekIcon from './assets/deepseek.svg'
import kimiIcon from './assets/kimi.svg'
import skynulLogo from './assets/logo-skynul.svg'

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

const PROVIDERS: Array<{
  id: ProviderId
  label: string
  icon: string
  desc: string
}> = [
  { id: 'chatgpt', label: 'ChatGPT Pro', icon: chatgptIcon, desc: 'OAuth · gpt-5.2 via Codex' },
  { id: 'claude', label: 'Claude', icon: claudeIcon, desc: 'Supabase edge function' },
  { id: 'deepseek', label: 'DeepSeek', icon: deepseekIcon, desc: 'Supabase edge function' },
  { id: 'kimi', label: 'Kimi', icon: kimiIcon, desc: 'API key · api.kimi.com (Kimi for Coding)' }
]

type Conversation = {
  id: string
  title: string
  messages: ChatMessage[]
}

type SidebarTab = 'chats' | 'tasks' | 'settings'

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
  const [accountEmail, setAccountEmail] = useState<string>('')
  const [accountConnected, setAccountConnected] = useState<boolean>(false)
  const [accountBusy, setAccountBusy] = useState<boolean>(false)

  const [chatgptConnected, setChatgptConnected] = useState<boolean>(false)
  const [chatgptBusy, setChatgptBusy] = useState<boolean>(false)
  const [providerSwitchBusy, setProviderSwitchBusy] = useState<boolean>(false)
  const [providerApiKeys, setProviderApiKeys] = useState<Record<string, boolean>>({})
  const [apiKeyDraft, setApiKeyDraft] = useState<string>('')
  const [apiKeyBusy, setApiKeyBusy] = useState<boolean>(false)
  const [hasApiKey, setHasApiKey] = useState<boolean>(false)
  const [isThinking, setIsThinking] = useState<boolean>(false)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [isRecording, setIsRecording] = useState<boolean>(false)
  const [isMaximized, setIsMaximized] = useState<boolean>(false)
  const recognitionRef = useRef<InstanceType<typeof SpeechRecognition> | null>(null)

  // ── Trading secrets modal ────────────────────────────────────────────
  const [tradingModal, setTradingModal] = useState<'polymarket' | 'binance' | null>(null)
  const [tradingSecrets, setTradingSecrets] = useState<Record<string, string>>({})
  const [tradingSaving, setTradingSaving] = useState(false)

  // ── Sidebar tab ──────────────────────────────────────────────────────
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('chats')

  // ── Task state ───────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<Task[]>([])
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)
  const [approvalTask, setApprovalTask] = useState<Task | null>(null)

  // ── Task template flow (renders in main panel) ─────────────────────
  const [showTemplates, setShowTemplates] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<TaskTemplateId | null>(null)

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === activeTaskId) ?? null,
    [tasks, activeTaskId]
  )

  const lang: LanguageCode = policy?.language ?? 'en'

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

  // ── Maximize state listener ──────────────────────────────────────────
  useEffect(() => {
    return window.netbot.onWindowMaximized(setIsMaximized)
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

  // Refresh API key status for provider badges when opening Settings
  useEffect(() => {
    if (sidebarTab !== 'settings') return
    const ids: ProviderId[] = ['kimi', 'claude', 'deepseek']
    let alive = true
    void Promise.all(ids.map((id) => window.netbot.hasProviderApiKey(id).then((has) => [id, has] as const))).then(
      (pairs) => {
        if (alive) setProviderApiKeys(Object.fromEntries(pairs))
      }
    )
    return () => {
      alive = false
    }
  }, [sidebarTab])

  // When an API-key provider is selected, check if it has a key and clear draft
  const apiKeyProvider = policy?.provider.active
  useEffect(() => {
    if (apiKeyProvider !== 'kimi' && apiKeyProvider !== 'claude' && apiKeyProvider !== 'deepseek') return
    setApiKeyDraft('')
    let alive = true
    void window.netbot.hasProviderApiKey(apiKeyProvider).then((has) => {
      if (alive) setHasApiKey(has)
    })
    return () => {
      alive = false
    }
  }, [apiKeyProvider])

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

  const setLanguage = async (language: LanguageCode): Promise<void> => {
    if (!policy) return
    setError('')
    const next = await window.netbot.setLanguage(language)
    setPolicy(next)
  }

  const saveProviderApiKey = async (): Promise<void> => {
    const active = policy?.provider.active
    if (active !== 'kimi' && active !== 'claude' && active !== 'deepseek') return
    const key = apiKeyDraft.trim()
    if (!key) {
      setError('API key is required.')
      return
    }
    setError('')
    setApiKeyBusy(true)
    try {
      await window.netbot.setProviderApiKey(active, key)
      setApiKeyDraft('')
      setHasApiKey(true)
      setProviderApiKeys((prev) => ({ ...prev, [active]: true }))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setApiKeyBusy(false)
    }
  }

  const setActiveProvider = async (id: ProviderId): Promise<void> => {
    if (providerSwitchBusy) return
    // Si hacen click en el provider ya activo, cambiar a otro para poder "salir" (ej. de Kimi)
    const current = policy?.provider.active
    const target: ProviderId =
      current === id
        ? (PROVIDERS.find((p) => p.id !== id)?.id ?? id)
        : id
    if (target === id && current === id) return

    setError('')
    setProviderSwitchBusy(true)
    const timeoutMs = 8000
    const timeoutId = window.setTimeout(() => {
      setProviderSwitchBusy(false)
      setError('Provider change timed out. Try again.')
    }, timeoutMs)
    try {
      const next = await window.netbot.setActiveProvider(target)
      setPolicy(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      window.clearTimeout(timeoutId)
      setProviderSwitchBusy(false)
    }
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
      const active = policy?.provider.active ?? 'chatgpt'

      setIsThinking(true)
      let content: string

      // All providers (ChatGPT, Kimi, Claude, DeepSeek) go through main process:
      // ChatGPT uses Codex OAuth; others use stored API keys and their APIs (e.g. Kimi at api.kimi.com/coding/v1).
      const res = await window.netbot.chatSend(currentMessages)
      content = res.content

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
    const p = PROVIDERS.find((pr) => pr.id === policy.provider.active)
    return p?.label ?? policy.provider.active
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
    rec.lang = lang === 'es' ? 'es-AR' : 'en-US'
    rec.interimResults = true
    rec.continuous = true

    const baseText = draft.trim()

    rec.onstart = (): void => setIsRecording(true)
    rec.onend = (): void => setIsRecording(false)
    rec.onerror = (): void => setIsRecording(false)
    rec.onresult = (e: SpeechRecognitionEvent): void => {
      const transcript = Array.from(e.results)
        .map((r) => r[0].transcript)
        .join(' ')
        .trim()
      setDraft(baseText ? `${baseText} ${transcript}` : transcript)
    }

    recognitionRef.current = rec
    rec.start()
  }

  const chatgptConnect = async (): Promise<void> => {
    setError('')
    setChatgptBusy(true)
    try {
      await window.netbot.chatgptOAuthStart()
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
      setShowTemplates(false)
      setSelectedTemplate(null)
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

  const handleDeleteTask = useCallback(
    (taskId: string): void => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      if (activeTaskId === taskId) setActiveTaskId(null)
      void window.netbot.taskDelete(taskId).catch(() => {})
    },
    [activeTaskId]
  )

  // ── Trading secrets helpers ──────────────────────────────────────────
  const POLYMARKET_KEYS = ['POLYMARKET_PRIVATE_KEY', 'POLYMARKET_FUNDER_ADDRESS', 'POLYMARKET_SIGNATURE_TYPE'] as const

  const openTradingModal = useCallback(async (platform: 'polymarket' | 'binance') => {
    setTradingModal(platform)
    if (platform === 'polymarket') {
      const vals: Record<string, string> = {}
      for (const k of POLYMARKET_KEYS) {
        const v = await window.netbot.getSecret(k)
        vals[k] = v ?? ''
      }
      setTradingSecrets(vals)
    }
  }, [])

  const saveTradingSecrets = useCallback(async () => {
    setTradingSaving(true)
    try {
      for (const [k, v] of Object.entries(tradingSecrets)) {
        if (v) await window.netbot.setSecret(k, v)
      }
      setTradingModal(null)
    } finally {
      setTradingSaving(false)
    }
  }, [tradingSecrets])

  // ── Determine what to show in the main panel for tasks tab ─────────
  const taskMainView = useMemo(() => {
    if (activeTask) return 'detail' as const
    if (selectedTemplate) return 'composer' as const
    if (showTemplates) return 'templates' as const
    return 'empty' as const
  }, [activeTask, selectedTemplate, showTemplates])

  return (
    <div className={`layout${isMaximized ? ' maximized' : ''}`}>
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
            {t(lang, 'sidebar_chats')}
          </button>
          <button
            className={`sidebarTab ${sidebarTab === 'tasks' ? 'active' : ''}`}
            onClick={() => {
              setSidebarTab('tasks')
              // Mostrar las cards de templates en el centro (igual que "New task") cuando no hay tarea seleccionada
              if (!activeTaskId && !selectedTemplate) setShowTemplates(true)
            }}
          >
            {t(lang, 'sidebar_tasks')}
          </button>
        </div>

        {/* ── Chats / Tasks / Settings content ─────────────────────── */}
        <div className="sidebarContent">
          {sidebarTab === 'chats' && (
            <>
              <div className="rbTop">
                <div className="rbTitle">{t(lang, 'chats_title')}</div>
                <button className="rbNew" onClick={createChat} title={t(lang, 'chats_new_title')}>
                  {t(lang, 'chats_new')}
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
                        <button className="rbDropdownItem danger" onClick={() => deleteConversation(c.id)}>
                          {t(lang, 'common_delete')}
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {sidebarTab === 'tasks' && (
            <TaskPanel
              tasks={tasks}
              activeTaskId={activeTaskId}
              onSelectTask={(id) => {
                setActiveTaskId(id)
                setShowTemplates(false)
                setSelectedTemplate(null)
              }}
              onNewTask={() => {
                setActiveTaskId(null)
                setShowTemplates(true)
                setSelectedTemplate(null)
              }}
              onDeleteTask={handleDeleteTask}
            />
          )}

          {sidebarTab === 'settings' && (
            <div className="settingsSidebarHint">
              <div className="rbTitle">{t(lang, 'settings_title')}</div>
            </div>
          )}
        </div>

        <div className="rbFooter">
          <div className="sbFooterRow">
            <div className="sbFooterBrand">
              <img src={skynulLogo} alt="Netbot" className="sbFooterLogo" />
            </div>
            <button
              className={`sbFooterSettingsBtn ${sidebarTab === 'settings' ? 'active' : ''}`}
              onClick={() => setSidebarTab('settings')}
              aria-label={t(lang, 'settings_open_title')}
              title={t(lang, 'settings_open_title')}
            >
              <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true">
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
        {/* ── Chat view: input centrado si no hay mensajes; abajo cuando ya hay conversación ── */}
        {sidebarTab === 'chats' && (() => {
          const chatEmpty = messages.length === 0 && !isThinking
          const composerEl = (
            <footer className="composer">
              {error ? <div className="composerError">{error}</div> : null}
              <div className="composerRow">
                <div className="promptWrap">
                  {modelLabel ? <div className="modelBadge">{modelLabel}</div> : null}
                  <textarea
                    className="prompt"
                    placeholder={t(lang, 'composer_placeholder')}
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
                  <div className="promptActionsLeft">
                    <button
                      type="button"
                      className="attachBtn"
                      onClick={async () => {
                        const { canceled, filePaths } = await window.netbot.showOpenFilesDialog()
                        if (!canceled && filePaths.length) {
                          // TODO: adjuntar filePaths al mensaje y enviar con el chat
                        }
                      }}
                      aria-label={t(lang, 'composer_attach_label')}
                      title={t(lang, 'composer_attach_label')}
                    >
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden>
                        <path d="M12 4a1 1 0 0 1 1 1v6h6a1 1 0 1 1 0 2h-6v6a1 1 0 1 1-2 0v-6H5a1 1 0 1 1 0-2h6V5a1 1 0 0 1 1-1Z" />
                      </svg>
                    </button>
                  </div>
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
              <div className="composerNote">{t(lang, 'composer_note')}</div>
            </footer>
          )
          if (chatEmpty) {
            return (
              <div className="chatMain chatMain--centered">
                <div className="chatComposerCenter">
                  <div className="chatEmptyGreeting">{t(lang, 'chat_greeting_empty')}</div>
                  {composerEl}
                </div>
              </div>
            )
          }
          return (
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
              {composerEl}
            </>
          )
        })()}

        {/* ── Task views in main panel ─────────────────────────────── */}
        {sidebarTab === 'tasks' && taskMainView === 'detail' && activeTask && (
          <TaskDetailView
            task={activeTask}
            onApprove={() => void handleApproveTask(activeTask.id)}
            onCancel={() => void handleCancelTask(activeTask.id)}
          />
        )}

        {sidebarTab === 'tasks' && taskMainView === 'templates' && (
          <div className="mainPanelCenter">
            <TaskTemplates
              lang={lang}
              onPick={(id) => {
                setSelectedTemplate(id)
                setShowTemplates(false)
              }}
            />
          </div>
        )}

        {sidebarTab === 'tasks' && taskMainView === 'composer' && selectedTemplate && (
          <div className="mainPanelCenter">
            <TaskComposer
              lang={lang}
              template={selectedTemplate}
              onCancel={() => {
                setSelectedTemplate(null)
                setShowTemplates(true)
              }}
              onSubmit={(text, caps) => void handleNewTask(text, caps)}
            />
          </div>
        )}

        {sidebarTab === 'tasks' && taskMainView === 'empty' && (
          <div className="taskEmptyMain">
            <div className="taskEmptyMainText">
              {t(lang, 'task_empty_main')}
            </div>
          </div>
        )}

        {/* ── Settings panel ──────────────────────────────────────── */}
        {sidebarTab === 'settings' && (
          <div className="settingsPanel">
            <div className="settingsPanelInner">
              <h2 className="settingsPanelTitle">{t(lang, 'settings_title')}</h2>

              {error ? <div className="composerError">{error}</div> : null}

              {/* ── AI Provider ─────────────────────────────────── */}
              <div className="settingsSection">
                <div className="settingsLabel">{t(lang, 'settings_provider')}</div>
                <div className="providerGrid">
                  {PROVIDERS.map((p) => {
                    const isActive = policy?.provider.active === p.id
                    const showConnected =
                      (p.id === 'chatgpt' && chatgptConnected) || (p.id !== 'chatgpt' && providerApiKeys[p.id])
                    const isKimi = p.id === 'kimi'
                    return (
                      <button
                        key={p.id}
                        type="button"
                        className={`providerCard ${isActive ? 'active' : ''} ${isKimi ? 'providerCard--kimi' : ''}`}
                        onClick={() => void setActiveProvider(p.id)}
                        disabled={providerSwitchBusy}
                      >
                        <img
                          src={p.icon}
                          alt={p.label}
                          className="providerIcon"
                        />
                        {isKimi && <div className="providerCardLabel">KIMI k2-5</div>}
                        {showConnected && (
                          <div className="providerCardBadge">
                            <span className="providerCardBadgeCheck" aria-hidden>✓</span>
                            {t(lang, 'provider_connected')}
                          </div>
                        )}
                      </button>
                    )
                  })}
                </div>
              </div>

              {/* ── ChatGPT OAuth (only when chatgpt is active) ── */}
              {policy?.provider.active === 'chatgpt' && (
                <div className="settingsSection">
                  <div className="settingsLabel">{t(lang, 'settings_chatgpt_pro')}</div>
                  <div className="settingsField">
                    <div className="settingsFieldHint">
                      {chatgptConnected
                        ? t(lang, 'chatgpt_status_connected')
                        : t(lang, 'chatgpt_status_not_connected')}
                    </div>
                    {chatgptConnected ? (
                      <button className="btn" onClick={() => void chatgptDisconnect()} disabled={chatgptBusy}>
                        {t(lang, 'chatgpt_disconnect')}
                      </button>
                    ) : (
                      <button className="btn" onClick={() => void chatgptConnect()} disabled={chatgptBusy}>
                        {chatgptBusy ? t(lang, 'chatgpt_connecting') : t(lang, 'chatgpt_connect')}
                      </button>
                    )}
                    <div className="settingsFieldHint">{t(lang, 'chatgpt_hint')}</div>
                  </div>
                </div>
              )}

              {/* ── API key for Kimi / Claude / DeepSeek (when that provider is active) ── */}
              {(policy?.provider.active === 'kimi' ||
                policy?.provider.active === 'claude' ||
                policy?.provider.active === 'deepseek') && (
                <div className="settingsSection">
                  <div className="settingsLabel">
                    {t(lang, `settings_${policy.provider.active}_key` as 'settings_kimi_key' | 'settings_claude_key' | 'settings_deepseek_key')}
                  </div>
                  <div className="settingsField">
                    {hasApiKey && (
                      <div className="settingsFieldHint">
                        {t(lang, `${policy.provider.active}_key_configured` as 'kimi_key_configured' | 'claude_key_configured' | 'deepseek_key_configured')}
                      </div>
                    )}
                    <input
                      type="password"
                      className="apiKeyInput"
                      placeholder={t(lang, 'provider_api_key_placeholder')}
                      value={apiKeyDraft}
                      onChange={(e) => setApiKeyDraft(e.target.value)}
                      aria-label={t(lang, 'provider_api_key_placeholder')}
                    />
                    <button
                      type="button"
                      className="btn"
                      onClick={() => void saveProviderApiKey()}
                      disabled={apiKeyBusy || !apiKeyDraft.trim()}
                    >
                      {apiKeyBusy ? '...' : t(lang, 'provider_api_key_save')}
                    </button>
                    <div className="settingsFieldHint">
                      {t(lang, `${policy.provider.active}_key_get_from` as 'kimi_key_get_from' | 'claude_key_get_from' | 'deepseek_key_get_from')}
                    </div>
                  </div>
                </div>
              )}

              {/* ── Language ─────────────────────────────────────── */}
              <div className="settingsSection">
                <div className="settingsLabel">{t(lang, 'settings_language')}</div>
                <div className="seg seg--2col">
                  {(['en', 'es'] as const).map((l) => (
                    <button
                      key={l}
                      className={`segBtn ${lang === l ? 'active' : ''}`}
                      onClick={() => void setLanguage(l)}
                      aria-pressed={lang === l}
                    >
                      {l === 'en' ? 'English' : 'Espanol'}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Theme ───────────────────────────────────────── */}
              <div className="settingsSection">
                <div className="settingsLabel">{t(lang, 'settings_theme')}</div>
                <div className="seg">
                  {(['system', 'light', 'dark'] as const).map((m) => (
                    <button
                      key={m}
                      className={`segBtn ${policy?.themeMode === m ? 'active' : ''}`}
                      onClick={() => void setTheme(m)}
                      disabled={!policy}
                      aria-pressed={policy?.themeMode === m}
                    >
                      {t(lang, `theme_${m}` as 'theme_system' | 'theme_light' | 'theme_dark')}
                    </button>
                  ))}
                </div>
              </div>

              {/* ── Workspace ───────────────────────────────────── */}
              <div className="settingsSection">
                <div className="settingsLabel">{t(lang, 'settings_workspace')}</div>
                <div className="pathBox" title={workspaceLabel}>
                  {workspaceLabel}
                </div>
                <button className="btn" onClick={pickWorkspace}>
                  {t(lang, 'settings_pick_workspace')}
                </button>
              </div>

              {/* ── Capabilities ─────────────────────────────────── */}
              <div className="settingsSection">
                <div className="settingsLabel">{t(lang, 'settings_capabilities')}</div>
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

              {/* ── Trading Options ──────────────────────────────── */}
              <div className="settingsSection">
                <div className="settingsLabel">Trading Options</div>
                <div className="settingsField" style={{ flexDirection: 'row', gap: 8 }}>
                  <button className="btn" onClick={() => void openTradingModal('polymarket')}>
                    Polymarket
                  </button>
                  <button className="btn" disabled>
                    Binance
                  </button>
                </div>
              </div>

              {/* ── Account ─────────────────────────────────────── */}
              <div className="settingsSection">
                <div className="settingsLabel">{t(lang, 'settings_account')}</div>
                <div className="settingsField">
                  <div className="settingsFieldHint">
                    {SUPABASE_CONFIGURED
                      ? accountConnected
                        ? accountEmail
                          ? t(lang, 'account_connected_as', { email: accountEmail })
                          : t(lang, 'account_connected')
                        : t(lang, 'account_not_connected')
                      : t(lang, 'account_supabase_not_configured')}
                  </div>
                  {accountConnected ? (
                    <button className="btn" onClick={() => void signOut()} disabled={accountBusy}>
                      {t(lang, 'account_sign_out')}
                    </button>
                  ) : (
                    <button className="btn" onClick={() => void signIn()} disabled={accountBusy}>
                      {t(lang, 'account_sign_in_google')}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* ── Trading secrets modal ─────────────────────────────────── */}
      {tradingModal === 'polymarket' && (
        <div className="modalBackdrop" onMouseDown={() => setTradingModal(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modalHeader">
              <div className="modalTitle">Polymarket Configuration</div>
              <button className="modalClose" onClick={() => setTradingModal(null)} aria-label="Close">&times;</button>
            </div>
            <div className="modalBody" style={{ gridTemplateColumns: '1fr' }}>
              {POLYMARKET_KEYS.map((k) => (
                <div className="modalSection" key={k}>
                  <div className="modalLabel">{k}</div>
                  <input
                    type={k === 'POLYMARKET_SIGNATURE_TYPE' ? 'text' : 'password'}
                    className="input"
                    value={tradingSecrets[k] ?? ''}
                    placeholder={k === 'POLYMARKET_SIGNATURE_TYPE' ? '0, 1 or 2 (default: 2)' : ''}
                    onChange={(e) => setTradingSecrets((prev) => ({ ...prev, [k]: e.target.value }))}
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
            </div>
            <div className="modalFooter">
              <button className="btn" onClick={() => setTradingModal(null)}>Cancel</button>
              <button className="btn" onClick={() => void saveTradingSecrets()} disabled={tradingSaving}>
                {tradingSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Task approval dialog ────────────────────────────────── */}
      {approvalTask && (
        <TaskApprovalDialog
          task={approvalTask}
          onApprove={() => void handleApproveTask(approvalTask.id)}
          onCancel={() => setApprovalTask(null)}
        />
      )}
    </div>
  )
}

export default App
