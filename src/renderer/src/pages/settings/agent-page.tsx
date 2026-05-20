import type { CapabilityId, ProviderId } from '@skynul/shared'
import { useState } from 'react'
import chatgptIcon from '@/assets/chatgpt.svg'
import claudeIcon from '@/assets/claude-logo.svg'
import deepseekIcon from '@/assets/deepseek.svg'
import geminiIcon from '@/assets/gemini.svg'
import glmIcon from '@/assets/glm.svg'
import kimiIcon from '@/assets/kimi.svg'
import minimaxIcon from '@/assets/minimax.svg'
import openrouterIcon from '@/assets/openrouter.svg'
import { ContentCard } from '@/components/content-card'
import { CapabilityList, CapabilityToggle } from '@/components/feature/settings'
import { t } from '@/i18n'
import {
  usePolicy,
  useSetAutoApprove,
  useSetCapability,
  useSetProvider,
  useSetProviderModel
} from '@/queries'

const PROVIDERS: Array<{ id: ProviderId; label: string; icon: string; desc: string }> = [
  { id: 'chatgpt', label: 'ChatGPT Pro', icon: chatgptIcon, desc: 'OAuth · Model switchable' },
  { id: 'claude', label: 'Claude', icon: claudeIcon, desc: 'API key · console.anthropic.com' },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    icon: deepseekIcon,
    desc: 'API key · platform.deepseek.com'
  },
  { id: 'kimi', label: 'Kimi', icon: kimiIcon, desc: 'API key · api.kimi.com (Kimi for Coding)' },
  { id: 'glm', label: 'GLM', icon: glmIcon, desc: 'API key · open.bigmodel.cn' },
  { id: 'minimax', label: 'MiniMax M2.5', icon: minimaxIcon, desc: 'API key · api.minimax.chat' },
  { id: 'openrouter', label: 'OpenRouter', icon: openrouterIcon, desc: 'API key · openrouter.ai' },
  { id: 'gemini', label: 'Gemini', icon: geminiIcon, desc: 'API key · ai.google.dev' }
]

const CAPABILITIES: Array<{ id: CapabilityId; title: string; desc: string }> = [
  { id: 'fs.read', title: 'Read Files', desc: 'Allow reading text files inside the workspace.' },
  { id: 'fs.write', title: 'Write Files', desc: 'Allow writing text files inside the workspace.' },
  { id: 'cmd.run', title: 'Run Commands', desc: 'Allow running approved commands.' },
  { id: 'net.http', title: 'Network Access', desc: 'Allow outbound HTTP requests.' }
]

export function AgentPage(): React.JSX.Element {
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [chatgptConnected] = useState(false)

  const { data: policy } = usePolicy()
  const setProviderMutation = useSetProvider()
  const setProviderModelMutation = useSetProviderModel()
  const setCapabilityMutation = useSetCapability()
  const setAutoApproveMutation = useSetAutoApprove()

  const lang = policy?.language ?? 'en'
  const activeProvider = policy?.provider.active

  const handleSetProvider = (id: ProviderId) => {
    if (activeProvider === id) return
    setProviderMutation.mutate(id)
  }

  const handleToggleCapability = (id: CapabilityId) => {
    if (!policy) return
    setCapabilityMutation.mutate({ capability: id, enabled: !policy.capabilities[id] })
  }

  const handleToggleAutoApprove = () => {
    if (!policy) return
    setAutoApproveMutation.mutate(!policy.taskAutoApprove)
  }

  return (
    <div className="flex flex-col gap-4">
      <ContentCard title="AI Providers" description="Select the active provider for your agent.">
        <div className="grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-2.5">
          {PROVIDERS.map((p) => {
            const isActive = activeProvider === p.id
            const isKimi = p.id === 'kimi'
            const isGLM = p.id === 'glm'
            const isMiniMax = p.id === 'minimax'
            const isOpenRouter = p.id === 'openrouter'
            const isGemini = p.id === 'gemini'

            return (
              <button
                key={p.id}
                type="button"
                onClick={() => handleSetProvider(p.id)}
                disabled={setProviderMutation.isPending}
                className={`relative cursor-pointer flex flex-col items-center justify-center rounded-xl border transition-all duration-150
                  ${
                    isActive
                      ? 'border-nb-accent-2 bg-nb-accent-2/12'
                      : 'border-nb-border bg-nb-panel-2 hover:border-nb-accent-2/50 hover:bg-nb-accent-2/8'
                  }
                  ${isKimi ? 'py-3 px-3 gap-1.5' : 'p-5 gap-0'}`}
              >
                {isGLM ? (
                  <div className="text-nb-text leading-none text-center text-[30px] font-black tracking-[0.06em]">
                    GLM
                  </div>
                ) : isMiniMax ? (
                  <div className="text-nb-text leading-none text-center text-sm font-normal">
                    MiniMax M2.5
                  </div>
                ) : (
                  <img
                    src={p.icon}
                    alt={p.label}
                    className={`object-contain brightness-0 dark:brightness-0 dark:invert ${isKimi ? 'w-12 h-12' : isGemini ? 'w-14 h-14' : isOpenRouter ? 'w-12 h-12' : 'w-20 h-20'}`}
                  />
                )}
                {isKimi && (
                  <div className="text-xs font-bold text-nb-text text-center">KIMI k2-5</div>
                )}
                {isOpenRouter && (
                  <div className="text-xs text-nb-text text-center font-medium tracking-[0.08em]">
                    OPEN ROUTER
                  </div>
                )}
                {isActive && p.id === 'chatgpt' && chatgptConnected && (
                  <div className="absolute top-2 right-2 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.04em] text-white bg-nb-accent-2 px-2 py-[3px] rounded-full">
                    <span className="text-[10px] leading-none">✓</span>
                    Connected
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {activeProvider === 'chatgpt' && chatgptConnected && (
          <div className="flex items-center gap-2 mt-3">
            <label
              htmlFor="agent-provider-model"
              className="text-xs text-nb-muted whitespace-nowrap"
            >
              Model:
            </label>
            <select
              id="agent-provider-model"
              value={policy?.provider.model ?? ''}
              onChange={async (e) => {
                await setProviderModelMutation.mutateAsync(e.target.value)
              }}
              className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-nb-border bg-nb-panel-2 text-nb-text cursor-pointer"
            >
              <option value="">Auto</option>
              <option value="gpt-5.3-codex">GPT-5.3 Codex</option>
              <option value="gpt-5.2-codex">GPT-5.2 Codex</option>
            </select>
          </div>
        )}

        {activeProvider && activeProvider !== 'chatgpt' && activeProvider !== 'ollama' && (
          <div className="flex flex-col gap-2 mt-3">
            <div className="text-xs font-semibold text-nb-muted uppercase tracking-[0.04em]">
              {t(lang, `settings_${activeProvider}_key` as `settings_${typeof activeProvider}_key`)}
            </div>
            <div className="flex gap-1.5">
              <input
                type="password"
                className="flex-1 px-3 py-2 rounded-lg border border-nb-border bg-nb-panel-2 text-xs text-nb-text outline-none font-mono focus:border-nb-accent-2/50"
                placeholder={t(lang, 'provider_api_key_placeholder')}
                value={apiKeyDraft}
                onChange={(e) => setApiKeyDraft(e.target.value)}
              />
              <button
                type="button"
                onClick={() => {
                  console.log('Save API key:', apiKeyDraft)
                  setApiKeyDraft('')
                }}
                disabled={!apiKeyDraft.trim()}
                className="px-3 py-1.5 rounded-lg bg-nb-accent-2 text-white text-xs font-medium cursor-pointer border-none disabled:opacity-40"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </ContentCard>

      <ContentCard title="Task Behavior" description="Configure how the agent handles tasks.">
        <CapabilityList>
          <CapabilityToggle
            title="Auto-Approve Tasks"
            description="Skip capability confirmation and run immediately"
            enabled={!!policy?.taskAutoApprove}
            onToggle={handleToggleAutoApprove}
            disabled={!policy}
          />
        </CapabilityList>
      </ContentCard>

      <ContentCard
        title="Capabilities"
        description="Permissions the agent has to interact with your system."
      >
        <CapabilityList>
          {CAPABILITIES.map((c) => (
            <CapabilityToggle
              key={c.id}
              title={c.title}
              description={c.desc}
              enabled={!!policy?.capabilities[c.id]}
              onToggle={() => handleToggleCapability(c.id)}
              disabled={!policy}
            />
          ))}
        </CapabilityList>
      </ContentCard>
    </div>
  )
}
