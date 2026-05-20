import type { ProviderId } from '@skynul/shared'
import { useEffect, useState } from 'react'
import chatgptIcon from '@/assets/chatgpt.svg'
import claudeIcon from '@/assets/claude-logo.svg'
import deepseekIcon from '@/assets/deepseek.svg'
import geminiIcon from '@/assets/gemini.svg'
import glmIcon from '@/assets/glm.svg'
import kimiIcon from '@/assets/kimi.svg'
import minimaxIcon from '@/assets/minimax.svg'
import openrouterIcon from '@/assets/openrouter.svg'
import { Section, SectionLabel } from '@/components/common'
import { t } from '@/i18n'
import { usePolicy, useSetProvider, useSetProviderModel } from '@/queries'

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

export function ProvidersSettingsPage(): React.JSX.Element {
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [chatgptConnected, setChatgptConnected] = useState(false)
  const { data: policy } = usePolicy()
  const setProviderMutation = useSetProvider()
  const setProviderModelMutation = useSetProviderModel()

  useEffect(() => {
    setChatgptConnected(false)
  }, [])

  const lang = policy?.language ?? 'en'
  const activeProvider = policy?.provider.active

  const handleSetProvider = (id: ProviderId) => {
    if (activeProvider === id) return
    setProviderMutation.mutate(id)
  }

  return (
    <>
      <Section>
        <SectionLabel>{t(lang, 'settings_provider')}</SectionLabel>

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
                className={`relative cursor-pointer flex flex-col items-center justify-center rounded-[14px] border-1.5 transition-all duration-150
                  ${
                    isActive
                      ? 'border-nb-accent-2 bg-nb-accent-2/12'
                      : 'border-nb-border bg-nb-panel hover:border-nb-accent-2/50 hover:bg-nb-accent-2/8'
                  }
                  ${isKimi ? 'py-3.5 px-3 gap-1.5' : 'p-6 gap-0'}`}
              >
                {isGLM ? (
                  <div className="text-nb-text leading-none text-center text-[34px] font-black tracking-[0.06em]">
                    GLM
                  </div>
                ) : isMiniMax ? (
                  <div className="text-nb-text leading-none text-center text-lg font-normal tracking-[0.01em]">
                    MiniMax M2.5
                  </div>
                ) : (
                  <img
                    src={p.icon}
                    alt={p.label}
                    className={`object-contain brightness-0 dark:brightness-0 dark:invert ${isKimi ? 'w-12 h-12' : isGemini ? 'w-16 h-16' : isOpenRouter ? 'w-14 h-14' : 'w-24 h-24'}`}
                  />
                )}
                {isKimi && (
                  <div className="text-xs font-bold text-nb-text text-center tracking-[0.02em]">
                    KIMI k2-5
                  </div>
                )}
                {isOpenRouter && (
                  <div
                    className={`text-xs text-nb-text text-center ${isOpenRouter ? 'font-medium tracking-[0.08em]' : 'font-bold'}`}
                  >
                    OPEN ROUTER
                  </div>
                )}
                {isActive && p.id === 'chatgpt' && chatgptConnected && (
                  <div className="absolute top-2 right-2 inline-flex items-center gap-1 text-[9px] font-bold uppercase tracking-[0.04em] text-white bg-nb-accent-2 px-2 py-[3px] rounded-full">
                    <span className="text-[10px] leading-none">✓</span>
                    {t(lang, 'provider_connected')}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {activeProvider === 'chatgpt' && chatgptConnected && (
          <div className="flex items-center gap-2 mt-2.5">
            <label
              htmlFor="settings-provider-model"
              className="text-xs text-nb-muted whitespace-nowrap"
            >
              Model:
            </label>
            <select
              id="settings-provider-model"
              value={policy?.provider.model ?? ''}
              onChange={async (e) => {
                await setProviderModelMutation.mutateAsync(e.target.value)
              }}
              className="flex-1 px-2 py-1.5 text-xs rounded-lg border border-nb-border bg-nb-panel text-nb-text cursor-pointer"
            >
              <option value="">Auto</option>
              <option value="gpt-5.3-codex">GPT-5.3 Codex</option>
              <option value="gpt-5.2-codex">GPT-5.2 Codex</option>
            </select>
          </div>
        )}
      </Section>

      {activeProvider && activeProvider !== 'chatgpt' && activeProvider !== 'ollama' && (
        <div className="flex flex-col gap-3">
          <div className="text-xs font-bold text-nb-muted uppercase tracking-[0.04em]">
            {t(lang, `settings_${activeProvider}_key` as `settings_${typeof activeProvider}_key`)}
          </div>
          <div className="grid gap-1.5">
            <input
              type="password"
              className="w-full px-3 py-2.5 rounded-xl border border-nb-border bg-nb-panel-2 text-xs text-nb-text outline-none font-mono focus:border-nb-accent-2/50"
              placeholder={t(lang, 'provider_api_key_placeholder')}
              value={apiKeyDraft}
              onChange={(e) => setApiKeyDraft(e.target.value)}
            />
            <button
              type="button"
              className="px-2.5 py-[3px] bg-nb-panel-2 border border-nb-border rounded-lg cursor-pointer text-nb-text text-xs"
              onClick={() => console.log('Save API key:', apiKeyDraft)}
              disabled={!apiKeyDraft.trim()}
            >
              {t(lang, 'provider_api_key_save')}
            </button>
            <div className="text-[11px] font-medium text-nb-muted">
              {t(lang, `${activeProvider}_key_get_from` as `${typeof activeProvider}_key_get_from`)}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
