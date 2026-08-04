import type { ProviderId } from '@shared'
import { Check } from 'lucide-react'
import { useState } from 'react'
import chatgptIcon from '@/assets/chatgpt.svg'
import claudeIcon from '@/assets/claude-logo.svg'
import deepseekIcon from '@/assets/deepseek.svg'
import geminiIcon from '@/assets/gemini.svg'
import glmIcon from '@/assets/glm.svg'
import kimiIcon from '@/assets/kimi.svg'
import minimaxIcon from '@/assets/minimax.svg'
import openrouterIcon from '@/assets/openrouter.svg'
import {
  SettingsInset,
  SettingsPageHeader,
  SettingsRow,
  SettingsSection,
  SettingsStack
} from '@/components/feature/settings'
import { ThemeIcon } from '@/components/theme-icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { cn } from '@/lib/utils'
import { t } from '@/i18n'
import { useGeneralSettings, useModelSettings, useSetProvider, useSetProviderApiKey, useSetProviderModel } from '@/queries'

const PROVIDERS: Array<{ id: ProviderId; label: string; icon: string; desc: string }> = [
  { id: 'chatgpt', label: 'ChatGPT Pro', icon: chatgptIcon, desc: 'OAuth' },
  { id: 'claude', label: 'Claude', icon: claudeIcon, desc: 'Anthropic API' },
  { id: 'deepseek', label: 'DeepSeek', icon: deepseekIcon, desc: 'DeepSeek API' },
  { id: 'kimi', label: 'Kimi', icon: kimiIcon, desc: 'Moonshot API' },
  { id: 'glm', label: 'GLM', icon: glmIcon, desc: 'Zhipu API' },
  { id: 'minimax', label: 'MiniMax', icon: minimaxIcon, desc: 'MiniMax API' },
  { id: 'openrouter', label: 'OpenRouter', icon: openrouterIcon, desc: 'OpenRouter API' },
  { id: 'gemini', label: 'Gemini', icon: geminiIcon, desc: 'Google AI API' },
  { id: 'nvidia', label: 'NVIDIA NIM', icon: '', desc: 'build.nvidia.com free endpoints' }
]

export function ModelPage(): React.JSX.Element {
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [saveError, setSaveError] = useState('')
  const [chatgptConnected] = useState(false)

  const { data: general } = useGeneralSettings()
  const { data: model } = useModelSettings()
  const setProviderMutation = useSetProvider()
  const setProviderModelMutation = useSetProviderModel()
  const setProviderApiKeyMutation = useSetProviderApiKey()

  const lang = general?.language ?? 'en'
  const activeProvider = model?.activeProvider
  const activeMeta = PROVIDERS.find((p) => p.id === activeProvider)
  const keyConfigured = activeProvider
    ? !!model?.providers.find((p) => p.id === activeProvider)?.configured
    : false

  const handleSetProvider = (id: ProviderId) => {
    if (activeProvider === id) return
    setProviderMutation.mutate(id)
    setApiKeyDraft('')
    setSaveError('')
  }

  const handleSaveApiKey = async () => {
    if (!activeProvider || activeProvider === 'ollama' || activeProvider === 'chatgpt') return
    setSaveError('')
    try {
      await setProviderApiKeyMutation.mutateAsync({
        providerId: activeProvider,
        apiKey: apiKeyDraft.trim()
      })
      setApiKeyDraft('')
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <>
      <SettingsPageHeader
        title="Model"
        description="Provider for chat and the agent harness. Keys are stored in the local database."
      />

      <SettingsStack>
        <SettingsSection title="Active provider">
          <SettingsInset>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {PROVIDERS.map((p) => {
                const isActive = activeProvider === p.id
                const configured = !!model?.providers.find((provider) => provider.id === p.id)
                  ?.configured
                const isGLM = p.id === 'glm'
                const isMiniMax = p.id === 'minimax'
                const isNvidia = p.id === 'nvidia'

                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSetProvider(p.id)}
                    disabled={setProviderMutation.isPending}
                    className={cn(
                      'relative flex flex-col items-center justify-center gap-1.5 rounded-lg border px-2 py-3 transition-all cursor-pointer disabled:opacity-50',
                      isActive
                        ? 'border-nb-accent-2/50 bg-nb-accent-2/10 ring-1 ring-nb-accent-2/30'
                        : 'border-nb-border bg-nb-panel hover:border-nb-accent-2/30 hover:bg-nb-accent-2/5'
                    )}
                  >
                    {isActive && (
                      <span className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-nb-accent-2 text-white">
                        <Check className="size-2.5" strokeWidth={3} />
                      </span>
                    )}
                    {configured && !isActive && (
                      <span className="absolute top-1.5 right-1.5 size-1.5 rounded-full bg-nb-accent-2" />
                    )}
                    {isGLM ? (
                      <span className="text-lg font-black tracking-wide text-nb-text">GLM</span>
                    ) : isMiniMax ? (
                      <span className="text-[11px] font-medium text-nb-text text-center leading-tight">
                        MiniMax
                      </span>
                    ) : isNvidia ? (
                      <span className="text-[11px] font-bold tracking-wide text-[#76b900]">
                        NVIDIA
                      </span>
                    ) : (
                      <ThemeIcon src={p.icon} alt={p.label} className="size-8" />
                    )}
                    <span className="text-[10px] font-medium text-nb-muted truncate w-full text-center">
                      {p.label}
                    </span>
                  </button>
                )
              })}
            </div>
          </SettingsInset>
        </SettingsSection>

        {activeMeta && (
          <SettingsSection title="Configuration">
            <SettingsRow title="Provider" description={activeMeta.desc}>
              <span className="text-xs font-medium text-nb-text">{activeMeta.label}</span>
            </SettingsRow>

            {activeProvider === 'chatgpt' && chatgptConnected && (
              <SettingsRow title="Model" description="ChatGPT Pro model override">
                <select
                  value={model?.model ?? ''}
                  onChange={(e) => void setProviderModelMutation.mutateAsync(e.target.value)}
                  className="h-8 rounded-lg border border-input bg-transparent px-2 text-xs text-nb-text cursor-pointer outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
                >
                  <option value="">Auto</option>
                  <option value="gpt-5.3-codex">GPT-5.3 Codex</option>
                  <option value="gpt-5.2-codex">GPT-5.2 Codex</option>
                </select>
              </SettingsRow>
            )}

            {activeProvider === 'nvidia' && (
              <SettingsRow
                title="Model"
                description="NIM model ID from build.nvidia.com (Free Endpoint)"
              >
                <Input
                  className="font-mono text-xs h-8 max-w-[280px]"
                  placeholder="meta/llama-3.1-8b-instruct"
                  defaultValue={model?.model ?? 'meta/llama-3.1-8b-instruct'}
                  onBlur={(e) => {
                    const value = e.target.value.trim()
                    if (value && value !== (model?.model ?? '')) {
                      void setProviderModelMutation.mutateAsync(value)
                    }
                  }}
                />
              </SettingsRow>
            )}

            {activeProvider &&
              activeProvider !== 'chatgpt' &&
              activeProvider !== 'ollama' && (
                <>
                  <SettingsRow
                    title="API key"
                    description={
                      keyConfigured
                        ? 'Key saved — enter a new one to replace'
                        : t(lang, `settings_${activeProvider}_key` as `settings_${typeof activeProvider}_key`)
                    }
                  >
                    {keyConfigured && (
                      <span className="text-[10px] font-medium uppercase tracking-wide text-nb-accent-2">
                        OK
                      </span>
                    )}
                  </SettingsRow>
                  <SettingsInset>
                    <div className="flex flex-col gap-2">
                      <div className="flex gap-2">
                        <Input
                          type="password"
                          className="font-mono text-xs h-9"
                          placeholder={t(lang, 'provider_api_key_placeholder')}
                          value={apiKeyDraft}
                          onChange={(e) => setApiKeyDraft(e.target.value)}
                        />
                        <Button
                          size="sm"
                          className="shrink-0 bg-nb-accent-2 hover:bg-nb-accent-2/90 text-white"
                          disabled={!apiKeyDraft.trim() || setProviderApiKeyMutation.isPending}
                          onClick={() => void handleSaveApiKey()}
                        >
                          {t(lang, 'provider_api_key_save')}
                        </Button>
                      </div>
                      {saveError && (
                        <p className="text-xs text-nb-danger">{saveError}</p>
                      )}
                    </div>
                  </SettingsInset>
                </>
              )}
          </SettingsSection>
        )}
      </SettingsStack>
    </>
  )
}
