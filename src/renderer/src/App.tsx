import { useEffect, useMemo, useState, useCallback } from 'react'
import type {
  CapabilityId,
  LanguageCode,
  PolicyState,
  ProviderId,
  ThemeMode
} from '../../shared/policy'
import type { Task, TaskCapabilityId } from '../../shared/task'
import { OAUTH_REDIRECT_TO, supabase, SUPABASE_CONFIGURED } from './supabase'
import { TaskPanel } from './components/TaskPanel'
import { ChatFeed } from './components/ChatFeed'
import { CollectiveChatFeed } from './components/CollectiveChatFeed'
import { MultiAgentControlRoom } from './components/MultiAgentControlRoom'
import { InputBar } from './components/InputBar'
import { TaskDashboard } from './components/TaskDashboard'
import { ScheduleDetail, SchedulePanel, NewScheduleForm } from './components/SchedulePanel'
import { t } from './i18n'
import { SkillGraph } from './components/SkillGraph'
import { ChannelSettings } from './components/ChannelSettings'
import { AuthModal, type AuthProvider } from './components/AuthModal'
import { UpdateToast } from './components/UpdateToast'
import type { Skill } from '../../shared/skill'
import type { Schedule } from '../../shared/schedule'

import chatgptIcon from './assets/chatgpt.svg'
import claudeIcon from './assets/claude-logo.svg'
import deepseekIcon from './assets/deepseek.svg'
import kimiIcon from './assets/kimi.svg'
import glmIcon from './assets/glm.svg'
import minimaxIcon from './assets/minimax.svg'
import openrouterIcon from './assets/openrouter.svg'
import geminiIcon from './assets/gemini.svg'
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
  { id: 'kimi', label: 'Kimi', icon: kimiIcon, desc: 'API key · api.kimi.com (Kimi for Coding)' },
  { id: 'glm', label: 'GLM', icon: glmIcon, desc: 'API key · open.bigmodel.cn' },
  { id: 'minimax', label: 'MiniMax M2.5', icon: minimaxIcon, desc: 'API key · api.minimax.chat' },
  { id: 'openrouter', label: 'OpenRouter', icon: openrouterIcon, desc: 'API key · openrouter.ai' },
  { id: 'gemini', label: 'Gemini', icon: geminiIcon, desc: 'API key · ai.google.dev' }
]

type SidebarTab = 'tasks' | 'settings' | 'dashboard'

type SnapshotEntry = {
  id: string
  name: string
  url: string
  title: string
  createdAt: number
}

function BrowserSnapshotsSection(): React.JSX.Element {
  const [snapshots, setSnapshots] = useState<SnapshotEntry[]>([])
  const [snapName, setSnapName] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async () => {
    try {
      const list = await window.skynul.browserSnapshotList()
      setSnapshots(
        list.map((s) => ({
          id: s.id,
          name: s.name,
          url: s.url,
          title: s.title,
          createdAt: s.createdAt
        }))
      )
    } catch {
      // extension might not be connected
    }
  }, [])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const handleSave = async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await window.skynul.browserSnapshotSave(snapName || 'Untitled')
      setSnapName('')
      await refresh()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleRestore = async (id: string): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      await window.skynul.browserSnapshotRestore(id)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(false)
    }
  }

  const handleDelete = async (id: string): Promise<void> => {
    await window.skynul.browserSnapshotDelete(id)
    await refresh()
  }

  return (
    <div className="settingsSection">
      <div className="settingsLabel">Browser Snapshots</div>
      <div className="settingsField" style={{ gap: 8 }}>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          <input
            type="text"
            className="settingsInput"
            placeholder="Snapshot name..."
            value={snapName}
            onChange={(e) => setSnapName(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && void handleSave()}
            style={{ flex: 1 }}
          />
          <button className="btn" onClick={() => void handleSave()} disabled={busy}>
            {busy ? 'Saving…' : 'Save Current'}
          </button>
        </div>
        {error && <div style={{ color: '#ff6b6b', fontSize: 12 }}>{error}</div>}
        {snapshots.length === 0 && (
          <div style={{ color: '#888', fontSize: 13 }}>No snapshots saved yet</div>
        )}
        {snapshots.map((s) => (
          <div
            key={s.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              padding: '6px 8px',
              background: 'rgba(255,255,255,0.04)',
              borderRadius: 6,
              fontSize: 13
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div
                style={{
                  fontWeight: 500,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {s.name}
              </div>
              <div
                style={{
                  color: '#888',
                  fontSize: 11,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap'
                }}
              >
                {s.url} · {new Date(s.createdAt).toLocaleDateString()}
              </div>
            </div>
            <button
              className="btn"
              style={{ fontSize: 11, padding: '2px 8px' }}
              onClick={() => void handleRestore(s.id)}
              disabled={busy}
            >
              Restore
            </button>
            <button
              className="btn"
              style={{ fontSize: 11, padding: '2px 8px', opacity: 0.7 }}
              onClick={() => void handleDelete(s.id)}
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

function App(): React.JSX.Element {
  const [policy, setPolicy] = useState<PolicyState | null>(null)
  const [error, setError] = useState<string>('')

  const [accountEmail, setAccountEmail] = useState<string>('')
  const [accountConnected, setAccountConnected] = useState<boolean>(false)
  const [accountBusy, setAccountBusy] = useState<boolean>(false)
  const [accountLoading, setAccountLoading] = useState<boolean>(() => SUPABASE_CONFIGURED)

  const [authModalOpen, setAuthModalOpen] = useState(false)
  const [authError, setAuthError] = useState<string>('')

  const [chatgptConnected, setChatgptConnected] = useState<boolean>(false)
  const [chatgptBusy, setChatgptBusy] = useState<boolean>(false)
  const [providerSwitchBusy, setProviderSwitchBusy] = useState<boolean>(false)
  const [providerApiKeys, setProviderApiKeys] = useState<Record<string, boolean>>({})
  const [apiKeyDraft, setApiKeyDraft] = useState<string>('')
  const [apiKeyBusy, setApiKeyBusy] = useState<boolean>(false)
  const [hasApiKey, setHasApiKey] = useState<boolean>(false)
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null)
  const [isMaximized, setIsMaximized] = useState<boolean>(false)

  // ── Settings tab ────────────────────────────────────────────────────
  const [settingsTab, setSettingsTab] = useState<
    'general' | 'providers' | 'computer' | 'channels' | 'skills' | 'developer'
  >('general')

  // ── Skills ─────────────────────────────────────────────────────────
  const [skills, setSkills] = useState<Skill[]>([])
  const [skillModal, setSkillModal] = useState<Skill | 'new' | null>(null)
  const [skillDraft, setSkillDraft] = useState({ name: '', tag: '', description: '', prompt: '' })

  // ── Trading secrets modal ────────────────────────────────────────────
  const [tradingModal, setTradingModal] = useState<'polymarket' | 'binance' | null>(null)
  const [tradingSecrets, setTradingSecrets] = useState<Record<string, string>>({})
  const [tradingSaving, setTradingSaving] = useState(false)
  const [polymarketConfigured, setPolymarketConfigured] = useState(false)

  // ── Sidebar tab ──────────────────────────────────────────────────────
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>('tasks')

  // ── Task state ───────────────────────────────────────────────────────
  const [tasks, setTasks] = useState<Task[]>([])
  const [activeTaskId, setActiveTaskId] = useState<string | null>(null)

  // ── Task template flow (renders in main panel) ─────────────────────
  const [taskSubTab, setTaskSubTab] = useState<'tasks' | 'scheduled'>('tasks')
  const [showNewSchedule, setShowNewSchedule] = useState(false)
  const [activeScheduleId, setActiveScheduleId] = useState<string | null>(null)
  const [viewingProcessTaskId, setViewingProcessTaskId] = useState<string | null>(null)
  const [schedules, setSchedules] = useState<Schedule[]>([])

  // ── Composer state (inline in main panel) ──────────────────────────
  const [composerPrompt, setComposerPrompt] = useState('')
  const [composerCapsOverride, setComposerCapsOverride] = useState<Set<TaskCapabilityId> | null>(
    null
  )

  // ── Profile dropdown ───────────────────────────────────────────────
  const [profileOpen, setProfileOpen] = useState(false)

  const activeTask = useMemo(
    () => tasks.find((t) => t.id === activeTaskId) ?? null,
    [tasks, activeTaskId]
  )

  // Default ON. Can be disabled via VITE_MULTI_AGENT_PANEL=0 if needed.
  const multiAgentPanelEnabled =
    (import.meta.env.VITE_MULTI_AGENT_PANEL as string | undefined) !== '0'

  const rootTaskForActive = useMemo(() => {
    if (!activeTask) return null
    const byId = new Map(tasks.map((t) => [t.id, t] as const))
    let cur: Task | undefined = activeTask
    let hops = 0
    while (cur?.parentTaskId && hops < 50) {
      const next = byId.get(cur.parentTaskId)
      if (!next) break
      cur = next
      hops++
    }
    return cur ?? activeTask
  }, [activeTask, tasks])

  const hasMultiAgents = useMemo(() => {
    if (!rootTaskForActive) return false
    const byId = new Map(tasks.map((t) => [t.id, t] as const))
    return tasks.some((t) => {
      if (t.id === rootTaskForActive.id) return false
      let cur: Task | undefined = t
      let hops = 0
      while (cur?.parentTaskId && hops < 50) {
        if (cur.parentTaskId === rootTaskForActive.id) return true
        cur = byId.get(cur.parentTaskId)
        hops++
      }
      return false
    })
  }, [rootTaskForActive, tasks])

  const lang: LanguageCode = policy?.language ?? 'en'

  const workspaceLabel = useMemo(() => {
    if (!policy?.workspaceRoot) return 'No workspace'
    return policy.workspaceRoot
  }, [policy])

  const themeMode = policy?.themeMode

  useEffect(() => {
    let alive = true
    ;(async () => {
      try {
        const p = await window.skynul.getPolicy()
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
    return window.skynul.onWindowMaximized(setIsMaximized)
  }, [])

  // ── ESC key: close UI layers, then back ───────────────────────────────
  useEffect(() => {
    const handler = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return

      if (authModalOpen) {
        setAuthModalOpen(false)
        setAuthError('')
        return
      }

      if (profileOpen) {
        setProfileOpen(false)
        return
      }

      if (sidebarTab === 'settings') {
        setSidebarTab('tasks')
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [authModalOpen, profileOpen, sidebarTab])

  // ── Task update listener ─────────────────────────────────────────────
  useEffect(() => {
    // Load existing tasks
    void window.skynul.taskList().then(({ tasks: list }) => setTasks(list))

    // Listen for push updates
    const off = window.skynul.onTaskUpdate((updated) => {
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

  // ── Settings loader ────────────────────────────────────────────────
  useEffect(() => {
    void (async () => {
      try {
        const pmKey = await window.skynul.getSecret('POLYMARKET_PRIVATE_KEY')
        setPolymarketConfigured(Boolean(pmKey))
        const sk = await window.skynul.skillList()
        setSkills(sk)
        const sc = await window.skynul.scheduleList()
        setSchedules(sc)
      } catch {
        // not available
      }
    })()
  }, [])

  useEffect(() => {
    if (!SUPABASE_CONFIGURED || !supabase) return

    let alive = true
    setAccountLoading(true)
    void supabase.auth
      .getUser()
      .then(({ data, error }) => {
        if (!alive) return
        if (error || !data.user) {
          setAccountConnected(false)
          setAccountEmail('')
          return
        }
        setAccountConnected(true)
        setAccountEmail(data.user.email ?? '')
      })
      .finally(() => {
        if (alive) setAccountLoading(false)
      })

    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!alive) return
      const email = session?.user?.email ?? ''
      setAccountConnected(Boolean(session))
      setAccountEmail(email)
      setAccountLoading(false)
    })

    return () => {
      alive = false
      data.subscription.unsubscribe()
    }
  }, [])

  // Refresh API key status for provider badges when opening Settings
  useEffect(() => {
    if (sidebarTab !== 'settings') return
    const ids: ProviderId[] = [
      'kimi',
      'claude',
      'deepseek',
      'glm',
      'minimax',
      'openrouter',
      'gemini'
    ]
    let alive = true
    void Promise.all(
      ids.map((id) => window.skynul.hasProviderApiKey(id).then((has) => [id, has] as const))
    ).then((pairs) => {
      if (alive) setProviderApiKeys(Object.fromEntries(pairs))
    })
    return () => {
      alive = false
    }
  }, [sidebarTab])

  // When an API-key provider is selected, check if it has a key and clear draft
  const apiKeyProvider = policy?.provider.active
  useEffect(() => {
    if (
      apiKeyProvider !== 'kimi' &&
      apiKeyProvider !== 'claude' &&
      apiKeyProvider !== 'deepseek' &&
      apiKeyProvider !== 'glm' &&
      apiKeyProvider !== 'minimax' &&
      apiKeyProvider !== 'openrouter' &&
      apiKeyProvider !== 'gemini'
    )
      return
    setApiKeyDraft('')
    let alive = true
    void window.skynul.hasProviderApiKey(apiKeyProvider).then((has) => {
      if (alive) setHasApiKey(has)
    })
    return () => {
      alive = false
    }
  }, [apiKeyProvider])

  useEffect(() => {
    void window.skynul.chatgptHasAuth().then(async (connected) => {
      setChatgptConnected(connected)
      if (connected) {
        const next = await window.skynul.setActiveProvider('chatgpt')
        setPolicy(next)
      }
    })
    const offSuccess = window.skynul.onChatGPTAuthSuccess(() => {
      setChatgptConnected(true)
      setChatgptBusy(false)
      void window.skynul.setActiveProvider('chatgpt').then(setPolicy)
    })
    const offError = window.skynul.onChatGPTAuthError((msg) => {
      setError(msg)
      setChatgptBusy(false)
    })
    return () => {
      offSuccess()
      offError()
    }
  }, [])

  useEffect(() => {
    const off = window.skynul.onAuthCallback((callbackUrl) => {
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

  const pickWorkspace = async (): Promise<void> => {
    setError('')
    const next = await window.skynul.pickWorkspace()
    setPolicy(next)
  }

  const toggle = async (id: CapabilityId): Promise<void> => {
    if (!policy) return
    setError('')
    const next = await window.skynul.setCapability(id, !policy.capabilities[id])
    setPolicy(next)
  }

  const setTheme = async (themeMode: ThemeMode): Promise<void> => {
    if (!policy) return
    setError('')
    const next = await window.skynul.setTheme(themeMode)
    setPolicy(next)
  }

  const setLanguage = async (language: LanguageCode): Promise<void> => {
    if (!policy) return
    setError('')
    const next = await window.skynul.setLanguage(language)
    setPolicy(next)
  }

  const saveProviderApiKey = async (): Promise<void> => {
    const active = policy?.provider.active
    if (
      active !== 'kimi' &&
      active !== 'claude' &&
      active !== 'deepseek' &&
      active !== 'glm' &&
      active !== 'minimax' &&
      active !== 'openrouter' &&
      active !== 'gemini'
    )
      return
    const key = apiKeyDraft.trim()
    if (!key) {
      setError('API key is required.')
      return
    }
    setError('')
    setApiKeyBusy(true)
    try {
      await window.skynul.setProviderApiKey(active, key)
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
    const target: ProviderId = current === id ? (PROVIDERS.find((p) => p.id !== id)?.id ?? id) : id
    if (target === id && current === id) return

    setError('')
    setProviderSwitchBusy(true)
    const timeoutMs = 8000
    const timeoutId = window.setTimeout(() => {
      setProviderSwitchBusy(false)
      setError('Provider change timed out. Try again.')
    }, timeoutMs)
    try {
      const next = await window.skynul.setActiveProvider(target)
      setPolicy(next)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      window.clearTimeout(timeoutId)
      setProviderSwitchBusy(false)
    }
  }

  const signIn = async (provider: AuthProvider): Promise<boolean> => {
    if (!SUPABASE_CONFIGURED || !supabase) return false

    setAuthError('')
    setAccountBusy(true)
    try {
      const { data, error } = await supabase.auth.signInWithOAuth({
        provider,
        options: {
          redirectTo: OAUTH_REDIRECT_TO,
          skipBrowserRedirect: true
        }
      })
      if (error) throw error
      if (!data?.url) throw new Error('No OAuth URL returned')
      await window.skynul.openExternal(data.url)
      return true
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : String(e))
      return false
    } finally {
      setAccountBusy(false)
    }
  }

  const openAuthModal = (): void => {
    setAuthError('')
    setAuthModalOpen(true)
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

  const chatgptConnect = async (): Promise<void> => {
    setError('')
    setChatgptBusy(true)
    try {
      await window.skynul.chatgptOAuthStart()
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
      setChatgptBusy(false)
    }
  }

  const chatgptDisconnect = async (): Promise<void> => {
    setError('')
    setChatgptBusy(true)
    try {
      await window.skynul.chatgptSignOut()
      setChatgptConnected(false)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setChatgptBusy(false)
    }
  }

  // ── Task handlers ────────────────────────────────────────────────────

  const handleNewTask = async (
    prompt: string,
    caps: TaskCapabilityId[],
    mode?: 'browser' | 'code',
    attachments?: string[]
  ): Promise<void> => {
    try {
      const { task } = await window.skynul.taskCreate(prompt, caps, {
        mode: mode ?? 'browser',
        attachments
      })
      setTasks((prev) => [task, ...prev])
      setActiveTaskId(task.id)
      if (policy?.taskAutoApprove) {
        void handleApproveTask(task.id)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleApproveTask = async (taskId: string): Promise<void> => {
    try {
      const updated = await window.skynul.taskApprove(taskId)
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleCancelTask = async (taskId: string): Promise<void> => {
    try {
      const updated = await window.skynul.taskCancel(taskId)
      setTasks((prev) => prev.map((t) => (t.id === updated.id ? updated : t)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  const handleDeleteTask = useCallback(
    (taskId: string): void => {
      setTasks((prev) => prev.filter((t) => t.id !== taskId))
      if (activeTaskId === taskId) setActiveTaskId(null)
      void window.skynul.taskDelete(taskId).catch(() => {})
    },
    [activeTaskId]
  )

  // ── Schedule handlers ─────────────────────────────────────────────────

  const handleToggleSchedule = useCallback(async (id: string) => {
    try {
      const updated = await window.skynul.scheduleToggle(id)
      setSchedules(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const handleDeleteSchedule = useCallback(async (id: string) => {
    try {
      const updated = await window.skynul.scheduleDelete(id)
      setSchedules(updated)
      setActiveScheduleId((prev) => (prev === id ? null : prev))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  const handleSaveSchedule = useCallback(async (data: Record<string, unknown>) => {
    try {
      const updated = await window.skynul.scheduleSave(data)
      setSchedules(updated)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }, [])

  // ── Trading secrets helpers ──────────────────────────────────────────
  const POLYMARKET_KEYS = [
    'POLYMARKET_PRIVATE_KEY',
    'POLYMARKET_FUNDER_ADDRESS',
    'POLYMARKET_SIGNATURE_TYPE'
  ] as const

  const openTradingModal = useCallback(async (platform: 'polymarket' | 'binance') => {
    setTradingModal(platform)
    if (platform === 'polymarket') {
      const vals: Record<string, string> = {}
      for (const k of POLYMARKET_KEYS) {
        const v = await window.skynul.getSecret(k)
        vals[k] = v ?? ''
      }
      setTradingSecrets(vals)
    }
  }, [])

  const saveTradingSecrets = useCallback(async () => {
    setTradingSaving(true)
    try {
      for (const [k, v] of Object.entries(tradingSecrets)) {
        if (v) await window.skynul.setSecret(k, v)
      }
      if (tradingSecrets['POLYMARKET_PRIVATE_KEY']) setPolymarketConfigured(true)
      setTradingModal(null)
    } finally {
      setTradingSaving(false)
    }
  }, [tradingSecrets])

  // ── Composer helpers ────────────────────────────────────────────────
  const composerAutoCaps = useMemo(() => {
    const lower = composerPrompt.toLowerCase()
    const CAP_KEYWORDS: Array<{ cap: TaskCapabilityId; words: string[] }> = [
      {
        cap: 'browser.cdp',
        words: [
          'browser',
          'webpage',
          'website',
          'scrape',
          'navigate',
          'url',
          'busca',
          'search',
          'googl',
          'precio',
          'price',
          'compr',
          'buy',
          'reserv',
          'book',
          'flight',
          'vuelo',
          'hotel',
          'viaj',
          'travel',
          'paquete',
          'package',
          'oferta',
          'deal',
          'tienda',
          'store',
          'shop',
          'amazon',
          'mercadolibre',
          'airbnb',
          'despegar',
          'download',
          'descargar',
          'open',
          'web'
        ]
      },
      {
        cap: 'app.launch',
        words: ['launch', 'whatsapp', 'telegram', 'discord', 'slack', 'spotify']
      },
      {
        cap: 'polymarket.trading',
        words: ['polymarket']
      },
      {
        cap: 'office.professional',
        words: ['excel', 'word', 'powerpoint', 'spreadsheet', 'document', 'formatting']
      }
    ]
    const detected = new Set<TaskCapabilityId>()
    for (const { cap, words } of CAP_KEYWORDS) {
      if (words.some((w) => lower.includes(w))) detected.add(cap)
    }
    // Default: always include browser.cdp unless it's purely code mode
    if (detected.size === 0) detected.add('browser.cdp')
    return [...detected]
  }, [composerPrompt])

  const composerActiveCaps = composerCapsOverride ?? new Set(composerAutoCaps)

  // ── Profile dropdown close on outside click ────────────────────────
  useEffect(() => {
    if (!profileOpen) return
    const close = (e: MouseEvent): void => {
      const target = e.target as HTMLElement
      if (!target.closest('.profileBtn') && !target.closest('.profileDropdown')) {
        setProfileOpen(false)
      }
    }
    document.addEventListener('click', close)
    return () => document.removeEventListener('click', close)
  }, [profileOpen])

  const isCollectiveMode = Boolean(multiAgentPanelEnabled && rootTaskForActive && hasMultiAgents)
  const controlTaskId = isCollectiveMode ? (rootTaskForActive?.id ?? activeTaskId) : activeTaskId
  const controlTask = useMemo(
    () => (controlTaskId ? (tasks.find((t) => t.id === controlTaskId) ?? null) : null),
    [controlTaskId, tasks]
  )
  const isActiveTaskRunning = (controlTask ?? activeTask)?.status === 'running'

  const handleInputSubmit = (text: string, attachments?: string[]): void => {
    const target = isCollectiveMode ? controlTask : activeTask
    if (target && target.status === 'running') {
      void window.skynul.taskSendMessage(target.id, text)
      return
    }
    // Create new task — detect mode from prompt
    const caps = [...composerActiveCaps]
    let detectedMode: 'browser' | 'code' = 'browser'
    // Only use code mode if no browser/polymarket caps are needed
    if (!caps.includes('browser.cdp') && !caps.includes('polymarket.trading')) {
      const codeWords = [
        'command',
        'script',
        'headless',
        'fetch',
        'curl',
        'code',
        'git',
        'build',
        'deploy'
      ]
      if (codeWords.some((w) => text.toLowerCase().includes(w))) detectedMode = 'code'
    }
    void handleNewTask(text, caps, detectedMode, attachments)
    setComposerPrompt('')
    setComposerCapsOverride(null)
  }

  return (
    <div className={`layout${isMaximized ? ' maximized' : ''}`}>
      <div className="titleBar">
        <button
          className="winBtn"
          onClick={() => void window.skynul.windowMinimize()}
          aria-label="Minimize"
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <rect x="4" y="11" width="16" height="2" rx="1" />
          </svg>
        </button>
        <button
          className="winBtn"
          onClick={() => void window.skynul.windowMaximize()}
          aria-label="Maximize"
        >
          <svg
            viewBox="0 0 24 24"
            width="11"
            height="11"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <rect x="4" y="4" width="16" height="16" rx="2" />
          </svg>
        </button>
        <button
          className="winBtn close"
          onClick={() => void window.skynul.windowClose()}
          aria-label="Close"
        >
          <svg viewBox="0 0 24 24" width="12" height="12" fill="currentColor">
            <path d="M6.225 4.811a1 1 0 0 0-1.414 1.414L10.586 12l-5.775 5.775a1 1 0 1 0 1.414 1.414L12 13.414l5.775 5.775a1 1 0 0 0 1.414-1.414L13.414 12l5.775-5.775a1 1 0 0 0-1.414-1.414L12 10.586 6.225 4.811Z" />
          </svg>
        </button>
      </div>

      <aside className="sidebar">
        {/* ── Tasks / Settings content ─────────────────────────────── */}
        <div className="sidebarContent">
          {(sidebarTab === 'tasks' || sidebarTab === 'dashboard') && (
            <>
              <div className="seg seg--2col" style={{ margin: '0 8px 4px' }}>
                <button
                  className={`segBtn ${taskSubTab === 'tasks' ? 'active' : ''}`}
                  onClick={() => setTaskSubTab('tasks')}
                >
                  Tasks
                </button>
                <button
                  className={`segBtn ${taskSubTab === 'scheduled' ? 'active' : ''}`}
                  onClick={() => setTaskSubTab('scheduled')}
                >
                  Scheduled
                </button>
              </div>
              {taskSubTab === 'tasks' && (
                <TaskPanel
                  tasks={tasks}
                  activeTaskId={activeTaskId}
                  onSelectTask={(id) => {
                    setActiveTaskId(id)
                    if (sidebarTab === 'dashboard') setSidebarTab('tasks')
                  }}
                  onNewTask={() => {
                    setActiveTaskId(null)
                    if (sidebarTab === 'dashboard') setSidebarTab('tasks')
                  }}
                  onStopTask={(id) => void handleCancelTask(id)}
                  onDeleteTask={handleDeleteTask}
                />
              )}
              {taskSubTab === 'scheduled' && (
                <SchedulePanel
                  schedules={schedules}
                  activeScheduleId={activeScheduleId}
                  onToggle={(id) => void handleToggleSchedule(id)}
                  onDelete={(id) => void handleDeleteSchedule(id)}
                  onSelect={(id) => {
                    setActiveScheduleId(id)
                    setShowNewSchedule(false)
                    if (sidebarTab === 'dashboard') setSidebarTab('tasks')
                  }}
                  onNewSchedule={() => {
                    setShowNewSchedule(true)
                    setActiveScheduleId(null)
                    if (sidebarTab === 'dashboard') setSidebarTab('tasks')
                  }}
                />
              )}
            </>
          )}

          {sidebarTab === 'settings' && (
            <div className="settingsSidebarHint">
              <div className="rbTitle">{t(lang, 'settings_title')}</div>
            </div>
          )}
        </div>

        <div className="rbFooter">
          <div className="sbFooterBrand" style={{ marginBottom: 8 }}>
            <img src={skynulLogo} alt="Skynul" className="sbFooterLogo" />
          </div>
          <div style={{ position: 'relative' }}>
            <button className="profileBtn" onClick={() => setProfileOpen(!profileOpen)}>
              <div className="profileAvatar">{(accountEmail || 'U').slice(0, 2).toUpperCase()}</div>
              <span className="profileEmail">
                {accountLoading
                  ? t(lang, 'auth_loading_account')
                  : accountEmail || t(lang, 'auth_not_signed_in')}
              </span>
              <svg
                viewBox="0 0 24 24"
                width="12"
                height="12"
                fill="currentColor"
                style={{ flexShrink: 0, opacity: 0.5 }}
              >
                <path d={profileOpen ? 'M7 14l5-5 5 5z' : 'M7 10l5 5 5-5z'} />
              </svg>
            </button>
            {profileOpen && (
              <div className="profileDropdown">
                <button
                  className="profileDropdownItem"
                  onClick={() => {
                    setSidebarTab('dashboard')
                    setProfileOpen(false)
                  }}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M3 13h8V3H3v10zm0 8h8v-6H3v6zm10 0h8V11h-8v10zm0-18v6h8V3h-8z" />
                  </svg>
                  Dashboard
                </button>
                <button
                  className="profileDropdownItem"
                  onClick={() => {
                    setSidebarTab('settings')
                    setProfileOpen(false)
                  }}
                >
                  <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                    <path d="M19.14 12.94c.04-.31.06-.63.06-.94s-.02-.63-.06-.94l2.03-1.58a.5.5 0 0 0 .12-.64l-1.92-3.32a.5.5 0 0 0-.6-.22l-2.39.96a7.2 7.2 0 0 0-1.63-.94l-.36-2.54A.5.5 0 0 0 13.9 1h-3.8a.5.5 0 0 0-.49.42l-.36 2.54c-.58.22-1.13.52-1.63.94l-2.39-.96a.5.5 0 0 0-.6.22L2.71 7.48a.5.5 0 0 0 .12.64l2.03 1.58c-.04.31-.06.63-.06.94s.02.63.06.94L2.83 14.52a.5.5 0 0 0-.12.64l1.92 3.32c.13.22.39.3.6.22l2.39-.96c.5.41 1.05.73 1.63.94l.36 2.54c.05.24.25.42.49.42h3.8c.24 0 .44-.18.49-.42l.36-2.54c.58-.22 1.13-.52 1.63-.94l2.39.96c.22.08.47 0 .6-.22l1.92-3.32a.5.5 0 0 0-.12-.64l-2.03-1.58ZM12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Z" />
                  </svg>
                  Settings
                </button>
                {accountLoading ? (
                  <button className="profileDropdownItem" disabled>
                    {t(lang, 'auth_loading')}
                  </button>
                ) : accountConnected ? (
                  <button
                    className="profileDropdownItem danger"
                    onClick={() => {
                      void signOut()
                      setProfileOpen(false)
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                      <path d="M17 7l-1.41 1.41L18.17 11H8v2h10.17l-2.58 2.58L17 17l5-5zM4 5h8V3H4c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h8v-2H4V5z" />
                    </svg>
                    {t(lang, 'auth_logout')}
                  </button>
                ) : (
                  <button
                    className="profileDropdownItem"
                    onClick={() => {
                      setProfileOpen(false)
                      openAuthModal()
                    }}
                  >
                    <svg viewBox="0 0 24 24" width="14" height="14" fill="currentColor">
                      <path d="M10 17l5-5-5-5v10zm9-14H5c-1.1 0-2 .9-2 2v4h2V5h14v14H5v-4H3v4c0 1.1.9 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2z" />
                    </svg>
                    {t(lang, 'auth_login')}
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </aside>

      <section className="main">
        {/* ── Chat-feed task view ─────────────────────────────────── */}
        {sidebarTab === 'tasks' &&
          (activeTask ? (
            <div className="chatFeedLayout">
              {multiAgentPanelEnabled && rootTaskForActive && hasMultiAgents && (
                <MultiAgentControlRoom
                  rootTask={rootTaskForActive}
                  tasks={tasks}
                  activeTaskId={activeTask.id}
                  onSelectTask={(id) => setActiveTaskId(id)}
                />
              )}
              {isCollectiveMode && controlTask ? (
                <CollectiveChatFeed rootTask={controlTask} tasks={tasks} />
              ) : (
                <ChatFeed
                  task={activeTask}
                  onApprove={() => void handleApproveTask(activeTask.id)}
                  onCancel={() => void handleCancelTask(activeTask.id)}
                  onDontAskAgain={() => void window.skynul.setTaskAutoApprove(true).then(setPolicy)}
                />
              )}
              <InputBar
                lang={lang}
                autoCaps={composerAutoCaps}
                compact={true}
                onSubmit={handleInputSubmit}
                onStop={
                  isActiveTaskRunning
                    ? () => void handleCancelTask((controlTask ?? activeTask).id)
                    : undefined
                }
                onTextChange={(t) => {
                  setComposerPrompt(t)
                  if (composerCapsOverride) setComposerCapsOverride(null)
                }}
              />
            </div>
          ) : taskSubTab === 'scheduled' && showNewSchedule ? (
            <div className="chatFeedCentered">
              <NewScheduleForm
                onSave={(data) => {
                  void handleSaveSchedule(data)
                  setShowNewSchedule(false)
                }}
                onCancel={() => setShowNewSchedule(false)}
              />
            </div>
          ) : taskSubTab === 'scheduled' && activeScheduleId && viewingProcessTaskId ? (
            /* ── Viewing a specific run's conversation ────────────── */
            (() => {
              const runTask = tasks.find((t) => t.id === viewingProcessTaskId)
              if (!runTask) return <div className="taskEmpty">Run not found.</div>
              return (
                <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
                  <div className="schedProcessBackBar">
                    <button
                      className="schedProcessBackBtn"
                      onClick={() => setViewingProcessTaskId(null)}
                    >
                      <svg
                        viewBox="0 0 24 24"
                        width="14"
                        height="14"
                        fill="currentColor"
                        aria-hidden="true"
                      >
                        <path d="M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20z" />
                      </svg>
                      Back
                    </button>
                  </div>
                  <ChatFeed
                    task={runTask}
                    onApprove={() => void window.skynul.taskApprove(runTask.id)}
                    onCancel={() => void window.skynul.taskCancel(runTask.id)}
                    onDontAskAgain={() => {}}
                  />
                </div>
              )
            })()
          ) : taskSubTab === 'scheduled' && activeScheduleId ? (
            <div className="chatFeedCentered">
              {(() => {
                const s = schedules.find((sc) => sc.id === activeScheduleId)
                if (!s) return <div className="taskEmpty">Schedule not found.</div>
                return (
                  <ScheduleDetail
                    schedule={s}
                    tasks={tasks}
                    onToggle={() => void handleToggleSchedule(s.id)}
                    onDelete={() => void handleDeleteSchedule(s.id)}
                    onBack={() => {
                      setActiveScheduleId(null)
                      setViewingProcessTaskId(null)
                    }}
                    onViewProcess={(taskId) => setViewingProcessTaskId(taskId)}
                  />
                )
              })()}
            </div>
          ) : (
            <div className="chatFeedCentered">
              <div className="composerHeading">Automate anything.</div>
              <InputBar
                lang={lang}
                autoCaps={composerAutoCaps}
                compact={false}
                onSubmit={handleInputSubmit}
                onTextChange={(t) => {
                  setComposerPrompt(t)
                  if (composerCapsOverride) setComposerCapsOverride(null)
                }}
              />
            </div>
          ))}

        {/* ── Dashboard panel (stats + recent) ─────────────────────────── */}
        {sidebarTab === 'dashboard' && (
          <div className="settingsPanel">
            <div className="settingsPanelInner">
              <div className="settingsBackBar">
                <button
                  className="backBtn"
                  onClick={() => setSidebarTab('tasks')}
                  aria-label="Back to tasks"
                  title="Back to tasks"
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                    <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                  </svg>
                  <span>Back</span>
                </button>
              </div>
              <h2 className="settingsPanelTitle">Dashboard</h2>
              <TaskDashboard
                tasks={tasks}
                schedules={schedules}
                onSelectTask={(id) => {
                  setActiveTaskId(id)
                  setSidebarTab('tasks')
                }}
                onSelectSchedule={(id) => {
                  setActiveScheduleId(id)
                  setSidebarTab('tasks')
                  setTaskSubTab('scheduled')
                  setShowNewSchedule(false)
                }}
              />
            </div>
          </div>
        )}

        {/* ── Settings panel ──────────────────────────────────────── */}
        {sidebarTab === 'settings' && (
          <div className="settingsPanel">
            <div className="settingsPanelInner">
              <div className="settingsBackBar">
                <button
                  className="backBtn"
                  onClick={() => setSidebarTab('tasks')}
                  aria-label="Back to tasks"
                  title="Back to tasks (Esc)"
                >
                  <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">
                    <path d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z" />
                  </svg>
                  <span>Back</span>
                </button>
              </div>
              <h2 className="settingsPanelTitle">{t(lang, 'settings_title')}</h2>

              {/* ── Settings tabs ─────────────────────────────── */}
              <div className="seg">
                {(
                  ['general', 'providers', 'computer', 'channels', 'developer', 'skills'] as const
                ).map((tab) => (
                  <button
                    key={tab}
                    className={`segBtn ${settingsTab === tab ? 'active' : ''}`}
                    onClick={() => setSettingsTab(tab)}
                    aria-pressed={settingsTab === tab}
                  >
                    {
                      {
                        general: 'General',
                        providers: 'Providers',
                        computer: 'Computer',
                        channels: 'Channels',
                        developer: 'Developer',
                        skills: 'Skills'
                      }[tab]
                    }
                  </button>
                ))}
              </div>

              {error ? <div className="composerError">{error}</div> : null}

              {/* ═══════════════ TAB: Providers ═══════════════ */}
              {settingsTab === 'providers' && (
                <>
                  {/* ── AI Provider ─────────────────────────────────── */}
                  <div className="settingsSection">
                    <div className="settingsLabel">{t(lang, 'settings_provider')}</div>
                    <div className="providerGrid">
                      {PROVIDERS.map((p) => {
                        const isActive = policy?.provider.active === p.id
                        const showConnected =
                          isActive &&
                          ((p.id === 'chatgpt' && chatgptConnected) ||
                            (p.id !== 'chatgpt' && providerApiKeys[p.id]))
                        const isKimi = p.id === 'kimi'
                        const isGLM = p.id === 'glm'
                        const isMiniMax = p.id === 'minimax'
                        const isOpenRouter = p.id === 'openrouter'
                        const isGemini = p.id === 'gemini'
                        return (
                          <button
                            key={p.id}
                            type="button"
                            className={`providerCard ${isActive ? 'active' : ''} ${isKimi ? 'providerCard--kimi' : ''} ${isGLM ? 'providerCard--glm' : ''} ${isMiniMax ? 'providerCard--minimax' : ''} ${isOpenRouter ? 'providerCard--openrouter' : ''} ${isGemini ? 'providerCard--gemini' : ''}`}
                            onClick={() => void setActiveProvider(p.id)}
                            disabled={providerSwitchBusy}
                          >
                            {isGLM ? (
                              <div
                                className="providerTextLogo providerTextLogo--bold"
                                aria-label={p.label}
                              >
                                GLM
                              </div>
                            ) : isMiniMax ? (
                              <div
                                className="providerTextLogo providerTextLogo--regular"
                                aria-label={p.label}
                              >
                                MiniMax M2.5
                              </div>
                            ) : (
                              <img src={p.icon} alt={p.label} className="providerIcon" />
                            )}
                            {isKimi && <div className="providerCardLabel">KIMI k2-5</div>}
                            {isOpenRouter && (
                              <div className="providerCardLabel providerCardLabel--medium">
                                OPEN ROUTER
                              </div>
                            )}
                            {showConnected && (
                              <div className="providerCardBadge">
                                <span className="providerCardBadgeCheck" aria-hidden>
                                  ✓
                                </span>
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
                          <button
                            className="btn"
                            onClick={() => void chatgptDisconnect()}
                            disabled={chatgptBusy}
                          >
                            {t(lang, 'chatgpt_disconnect')}
                          </button>
                        ) : (
                          <button
                            className="btn"
                            onClick={() => void chatgptConnect()}
                            disabled={chatgptBusy}
                          >
                            {chatgptBusy
                              ? t(lang, 'chatgpt_connecting')
                              : t(lang, 'chatgpt_connect')}
                          </button>
                        )}
                        <div className="settingsFieldHint">{t(lang, 'chatgpt_hint')}</div>
                      </div>
                    </div>
                  )}

                  {/* ── API key for Kimi / Claude / DeepSeek (when that provider is active) ── */}
                  {(policy?.provider.active === 'kimi' ||
                    policy?.provider.active === 'claude' ||
                    policy?.provider.active === 'deepseek' ||
                    policy?.provider.active === 'glm' ||
                    policy?.provider.active === 'minimax' ||
                    policy?.provider.active === 'openrouter' ||
                    policy?.provider.active === 'gemini') && (
                    <div className="settingsSection">
                      <div className="settingsLabel">
                        {t(
                          lang,
                          `settings_${policy.provider.active}_key` as
                            | 'settings_kimi_key'
                            | 'settings_claude_key'
                            | 'settings_deepseek_key'
                            | 'settings_glm_key'
                            | 'settings_minimax_key'
                            | 'settings_openrouter_key'
                            | 'settings_gemini_key'
                        )}
                      </div>
                      <div className="settingsField">
                        {hasApiKey && (
                          <div className="settingsFieldHint">
                            {t(
                              lang,
                              `${policy.provider.active}_key_configured` as
                                | 'kimi_key_configured'
                                | 'claude_key_configured'
                                | 'deepseek_key_configured'
                                | 'glm_key_configured'
                                | 'minimax_key_configured'
                                | 'openrouter_key_configured'
                                | 'gemini_key_configured'
                            )}
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
                          {t(
                            lang,
                            `${policy.provider.active}_key_get_from` as
                              | 'kimi_key_get_from'
                              | 'claude_key_get_from'
                              | 'deepseek_key_get_from'
                              | 'glm_key_get_from'
                              | 'minimax_key_get_from'
                              | 'openrouter_key_get_from'
                              | 'gemini_key_get_from'
                          )}
                        </div>
                      </div>
                    </div>
                  )}
                </>
              )}

              {/* ═══════════════ TAB: Computer ═══════════════ */}
              {settingsTab === 'computer' && (
                <>
                  {/* ── Task Memory ──────────────────────────────────── */}
                  <div className="settingsSection">
                    <div className="settingsLabel">Task Memory</div>
                    <button
                      className={`cap ${policy?.taskMemoryEnabled ? 'on' : 'off'}`}
                      onClick={async () => {
                        const next = !policy?.taskMemoryEnabled
                        const p = await window.skynul.setTaskMemoryEnabled(next)
                        setPolicy(p)
                      }}
                      disabled={!policy}
                    >
                      <div className="capLeft">
                        <div className="capTitle">Learn from Tasks</div>
                        <div className="capDesc">Remember past results to improve future tasks</div>
                      </div>
                      <div className="capToggle" aria-hidden="true">
                        <div className="capKnob" />
                      </div>
                    </button>
                    <button
                      className={`cap ${policy?.taskAutoApprove ? 'on' : 'off'}`}
                      onClick={async () => {
                        const next = !policy?.taskAutoApprove
                        const p = await window.skynul.setTaskAutoApprove(next)
                        setPolicy(p)
                      }}
                      disabled={!policy}
                    >
                      <div className="capLeft">
                        <div className="capTitle">Auto-Approve Tasks</div>
                        <div className="capDesc">
                          Skip capability confirmation and run immediately
                        </div>
                      </div>
                      <div className="capToggle" aria-hidden="true">
                        <div className="capKnob" />
                      </div>
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
                    <div
                      className="settingsField"
                      style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}
                    >
                      <button className="btn" onClick={() => void openTradingModal('polymarket')}>
                        Polymarket
                        {polymarketConfigured && <span className="settingsBadgeDot">✓</span>}
                      </button>
                      <button className="btn" disabled>
                        Binance
                      </button>
                    </div>
                  </div>

                  {/* ── Browser Snapshots ──────────────────────────── */}
                  <BrowserSnapshotsSection />
                </>
              )}

              {/* ═══════════════ TAB: Channels ═══════════════ */}
              {settingsTab === 'channels' && <ChannelSettings />}

              {/* ═══════════════ TAB: General ═══════════════ */}
              {settingsTab === 'general' && (
                <>
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

                  <div className="settingsSection">
                    <div className="settingsLabel">{t(lang, 'settings_account')}</div>
                    <div className="settingsField">
                      <div className="settingsFieldHint">
                        {!SUPABASE_CONFIGURED
                          ? t(lang, 'account_supabase_not_configured')
                          : accountLoading
                            ? t(lang, 'auth_loading_account')
                            : accountConnected
                              ? accountEmail
                                ? t(lang, 'account_connected_as', { email: accountEmail })
                                : t(lang, 'account_connected')
                              : t(lang, 'account_not_connected')}
                      </div>
                      {accountConnected ? (
                        <button
                          className="btn"
                          onClick={() => void signOut()}
                          disabled={accountBusy}
                        >
                          {t(lang, 'account_sign_out')}
                        </button>
                      ) : (
                        <button
                          className="btn"
                          onClick={openAuthModal}
                          disabled={accountBusy || accountLoading}
                        >
                          {t(lang, 'auth_login')}
                        </button>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* ═══════════════ TAB: Developer ═══════════════ */}
              {settingsTab === 'developer' && (
                <>
                  <div className="settingsSection">
                    <div className="settingsLabel">Shell Access</div>
                    <button
                      className={`cap ${policy?.capabilities['cmd.run'] ? 'on' : 'off'}`}
                      onClick={() => toggle('cmd.run')}
                      disabled={!policy}
                    >
                      <div className="capLeft">
                        <div className="capTitle">Run Commands</div>
                        <div className="capDesc">Allow the agent to execute shell commands</div>
                      </div>
                      <div className="capToggle" aria-hidden="true">
                        <div className="capKnob" />
                      </div>
                    </button>
                  </div>

                  <div className="settingsSection">
                    <div className="settingsLabel">Workspace</div>
                    <div className="pathBox" title={workspaceLabel}>
                      {workspaceLabel}
                    </div>
                    <button className="btn" onClick={pickWorkspace}>
                      {t(lang, 'settings_pick_workspace')}
                    </button>
                    <div className="settingsFieldHint">Working directory for shell commands</div>
                  </div>
                </>
              )}

              {/* ═══════════════ TAB: Skills ═══════════════ */}
              {settingsTab === 'skills' && (
                <>
                  <div className="settingsSection">
                    <div className="settingsLabel">Skill Graph</div>
                    <SkillGraph skills={skills} />
                  </div>

                  <div className="settingsSection">
                    <div className="settingsLabel">Manage Skills</div>
                    <div style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                      <button
                        className="btn btnFilled"
                        onClick={() => {
                          setSkillDraft({ name: '', tag: '', description: '', prompt: '' })
                          setSkillModal('new')
                        }}
                      >
                        Create Skill
                      </button>
                      <button
                        className="btn btnFilled"
                        onClick={async () => {
                          const result = await window.skynul.showOpenFilesDialog()
                          if (result.canceled || result.filePaths.length === 0) return
                          try {
                            for (const fp of result.filePaths) {
                              const updated = await window.skynul.skillImport(fp)
                              setSkills(updated)
                            }
                          } catch (e) {
                            setError(`Import failed: ${e instanceof Error ? e.message : String(e)}`)
                          }
                        }}
                      >
                        Import Skill
                      </button>
                    </div>
                    <div className="settingsFieldHint">
                      Supports .json and .md (with YAML frontmatter)
                    </div>
                    {skills.length > 0 && (
                      <div className="capList">
                        {skills.map((s) => (
                          <button
                            key={s.id}
                            className={`cap ${s.enabled ? 'on' : 'off'}`}
                            onClick={async () => {
                              const updated = await window.skynul.skillToggle(s.id)
                              setSkills(updated)
                            }}
                          >
                            <div className="capLeft">
                              <div className="capTitle">{s.name}</div>
                              <div className="capDesc">{s.tag}</div>
                            </div>
                            <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                              <span
                                style={{
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  color: 'var(--nb-muted)'
                                }}
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  setSkillDraft({
                                    name: s.name,
                                    tag: s.tag,
                                    description: s.description,
                                    prompt: s.prompt
                                  })
                                  setSkillModal(s)
                                }}
                              >
                                Edit
                              </span>
                              <span
                                style={{
                                  fontSize: 12,
                                  cursor: 'pointer',
                                  color: 'var(--nb-muted)'
                                }}
                                onClick={async (e) => {
                                  e.stopPropagation()
                                  const updated = await window.skynul.skillDelete(s.id)
                                  setSkills(updated)
                                }}
                              >
                                Del
                              </span>
                              <div className="capToggle" aria-hidden="true">
                                <div className="capKnob" />
                              </div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}
      </section>

      {/* ── Skill modal ───────────────────────────────────────────── */}
      {skillModal && (
        <div className="modalBackdrop" onMouseDown={() => setSkillModal(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 500 }}>
            <div className="modalHeader">
              <div className="modalTitle">{skillModal === 'new' ? 'New Skill' : 'Edit Skill'}</div>
              <button className="modalClose" onClick={() => setSkillModal(null)} aria-label="Close">
                &times;
              </button>
            </div>
            <div className="modalBody" style={{ gridTemplateColumns: '1fr' }}>
              <div className="modalSection">
                <div className="modalLabel">Name</div>
                <input
                  className="apiKeyInput"
                  value={skillDraft.name}
                  onChange={(e) => setSkillDraft({ ...skillDraft, name: e.target.value })}
                  placeholder="e.g. Polymarket Trader"
                />
              </div>
              <div className="modalSection">
                <div className="modalLabel">Tag</div>
                <input
                  className="apiKeyInput"
                  value={skillDraft.tag}
                  onChange={(e) => setSkillDraft({ ...skillDraft, tag: e.target.value })}
                  placeholder="e.g. trading, excel, research"
                />
              </div>
              <div className="modalSection">
                <div className="modalLabel">Description</div>
                <input
                  className="apiKeyInput"
                  value={skillDraft.description}
                  onChange={(e) => setSkillDraft({ ...skillDraft, description: e.target.value })}
                  placeholder="Short description"
                />
              </div>
              <div className="modalSection">
                <div className="modalLabel">Prompt / Instructions</div>
                <textarea
                  className="apiKeyInput"
                  style={{ minHeight: 120, resize: 'vertical', fontFamily: 'inherit' }}
                  value={skillDraft.prompt}
                  onChange={(e) => setSkillDraft({ ...skillDraft, prompt: e.target.value })}
                  placeholder="Instructions the agent should follow for this skill..."
                />
              </div>
            </div>
            <div className="modalFooter">
              <button
                className="btn"
                disabled={!skillDraft.name.trim() || !skillDraft.prompt.trim()}
                onClick={async () => {
                  const payload = {
                    ...skillDraft,
                    enabled: true,
                    ...(skillModal !== 'new' ? { id: skillModal.id } : {})
                  }
                  const updated = await window.skynul.skillSave(payload)
                  setSkills(updated)
                  setSkillModal(null)
                }}
              >
                {skillModal === 'new' ? 'Create' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Trading secrets modal ─────────────────────────────────── */}
      {tradingModal === 'polymarket' && (
        <div className="modalBackdrop" onMouseDown={() => setTradingModal(null)}>
          <div className="modal" onMouseDown={(e) => e.stopPropagation()} style={{ maxWidth: 460 }}>
            <div className="modalHeader">
              <div className="modalTitle">Polymarket Configuration</div>
              <button
                className="modalClose"
                onClick={() => setTradingModal(null)}
                aria-label="Close"
              >
                &times;
              </button>
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
                    onChange={(e) =>
                      setTradingSecrets((prev) => ({ ...prev, [k]: e.target.value }))
                    }
                    style={{ width: '100%', boxSizing: 'border-box' }}
                  />
                </div>
              ))}
            </div>
            <div className="modalFooter">
              <button className="btn" onClick={() => setTradingModal(null)}>
                Cancel
              </button>
              <button
                className="btn"
                onClick={() => void saveTradingSecrets()}
                disabled={tradingSaving}
              >
                {tradingSaving ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      <AuthModal
        open={authModalOpen}
        lang={lang}
        supabaseConfigured={SUPABASE_CONFIGURED}
        busy={accountBusy}
        error={authError}
        onClearError={() => setAuthError('')}
        onClose={() => {
          setAuthModalOpen(false)
          setAuthError('')
        }}
        onSignIn={(provider) => {
          void signIn(provider).then((ok) => {
            if (ok) setAuthModalOpen(false)
          })
        }}
      />

      <UpdateToast />
    </div>
  )
}

export default App
