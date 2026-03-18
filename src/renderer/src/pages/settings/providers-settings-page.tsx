import type { ProviderId } from '@skynul/shared'
import { useEffect, useState } from 'react'
// Provider icons
import chatgptIcon from '../../assets/chatgpt.svg'
import claudeIcon from '../../assets/claude-logo.svg'
import deepseekIcon from '../../assets/deepseek.svg'
import geminiIcon from '../../assets/gemini.svg'
import glmIcon from '../../assets/glm.svg'
import kimiIcon from '../../assets/kimi.svg'
import minimaxIcon from '../../assets/minimax.svg'
import openrouterIcon from '../../assets/openrouter.svg'
import { CardGrid, Section, SectionLabel } from '../../components/layout'
import { t } from '../../i18n'
import { usePolicy, useSetOpenAIModel, useSetProvider } from '../../queries'
import styles from './providers-settings-page.module.css'

const PROVIDERS: Array<{
  id: ProviderId
  label: string
  icon: string
  desc: string
}> = [
  {
    id: 'chatgpt',
    label: 'ChatGPT Pro',
    icon: chatgptIcon,
    desc: 'OAuth · Model switchable'
  },
  {
    id: 'claude',
    label: 'Claude',
    icon: claudeIcon,
    desc: 'Supabase edge function'
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    icon: deepseekIcon,
    desc: 'Supabase edge function'
  },
  {
    id: 'kimi',
    label: 'Kimi',
    icon: kimiIcon,
    desc: 'API key · api.kimi.com (Kimi for Coding)'
  },
  {
    id: 'glm',
    label: 'GLM',
    icon: glmIcon,
    desc: 'API key · open.bigmodel.cn'
  },
  {
    id: 'minimax',
    label: 'MiniMax M2.5',
    icon: minimaxIcon,
    desc: 'API key · api.minimax.chat'
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    icon: openrouterIcon,
    desc: 'API key · openrouter.ai'
  },
  {
    id: 'gemini',
    label: 'Gemini',
    icon: geminiIcon,
    desc: 'API key · ai.google.dev'
  }
]

export function ProvidersSettingsPage(): React.JSX.Element {
  const [apiKeyDraft, setApiKeyDraft] = useState('')
  const [chatgptConnected, setChatgptConnected] = useState(false)

  // Queries
  const { data: policy } = usePolicy()

  // Mutations
  const setProviderMutation = useSetProvider()
  const setOpenAIModelMutation = useSetOpenAIModel()

  const lang = policy?.language ?? 'en'
  const activeProvider = policy?.provider.active

  // Check ChatGPT auth status on mount
  useEffect(() => {
    // TODO: Implement chatgpt auth check via API
    setChatgptConnected(false)
  }, [])

  const handleSetProvider = (id: ProviderId) => {
    if (activeProvider === id) return
    setProviderMutation.mutate(id)
  }

  const handleSaveApiKey = () => {
    // TODO: Implement API key save via API
    console.log('Save API key:', apiKeyDraft)
    setApiKeyDraft('')
  }

  return (
    <>
      {/* AI Provider Selection */}
      <Section>
        <SectionLabel>{t(lang, 'settings_provider')}</SectionLabel>

        <CardGrid columns={3}>
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
                className={`${styles.providerCard} ${isActive ? 'active' : ''} ${
                  isKimi ? styles.providerCardKimi : ''
                } ${isGLM ? styles.providerCardGlm : ''} ${
                  isMiniMax ? styles.providerCardMinimax : ''
                } ${isOpenRouter ? styles.providerCardOpenrouter : ''} ${
                  isGemini ? styles.providerCardGemini : ''
                }`}
                onClick={() => handleSetProvider(p.id)}
                disabled={setProviderMutation.isPending}
              >
                {isGLM ? (
                  <div
                    className={`${styles.providerTextLogo} ${styles.providerTextLogoBold}`}
                    aria-label={p.label}
                  >
                    GLM
                  </div>
                ) : isMiniMax ? (
                  <div
                    className={`${styles.providerTextLogo} ${styles.providerTextLogoRegular}`}
                    aria-label={p.label}
                  >
                    MiniMax M2.5
                  </div>
                ) : (
                  <img src={p.icon} alt={p.label} className={styles.providerIcon} />
                )}
                {isKimi && <div className={styles.providerCardLabel}>KIMI k2-5</div>}
                {isOpenRouter && (
                  <div className={`${styles.providerCardLabel} ${styles.providerCardLabelMedium}`}>
                    OPEN ROUTER
                  </div>
                )}
                {isActive && p.id === 'chatgpt' && chatgptConnected && (
                  <div className={styles.providerCardBadge}>
                    <span className={styles.providerCardBadgeCheck} aria-hidden>
                      ✓
                    </span>
                    {t(lang, 'provider_connected')}
                  </div>
                )}
              </button>
            )
          })}
        </CardGrid>

        {/* Model selector for ChatGPT provider */}
        {activeProvider === 'chatgpt' && chatgptConnected && (
          <div
            style={{
              marginTop: '10px',
              display: 'flex',
              alignItems: 'center',
              gap: '8px'
            }}
          >
            <label
              style={{
                fontSize: '12px',
                color: 'var(--text-muted, #888)',
                whiteSpace: 'nowrap'
              }}
            >
              Model:
            </label>
            <select
              value={policy?.provider.openaiModel || 'gpt-5.3-codex'}
              onChange={async (e) => {
                await setOpenAIModelMutation.mutateAsync(e.target.value)
              }}
              style={{
                flex: 1,
                padding: '6px 8px',
                fontSize: '12px',
                borderRadius: '8px',
                border: '1px solid var(--nb-border)',
                background: 'var(--nb-panel)',
                color: 'var(--text-primary, #fff)',
                cursor: 'pointer'
              }}
            >
              <option value="gpt-5.3-codex">GPT-5.3 Codex</option>
              <option value="gpt-5.2-codex">GPT-5.2 Codex</option>
            </select>
          </div>
        )}
      </Section>

      {/* API Key for other providers */}
      {activeProvider && activeProvider !== 'chatgpt' && activeProvider !== 'ollama' && (
        <div className={styles.settingsSection}>
          <div className={styles.settingsLabel}>
            {t(lang, `settings_${activeProvider}_key` as `settings_${typeof activeProvider}_key`)}
          </div>
          <div className={styles.settingsField}>
            <input
              type="password"
              className={styles.apiKeyInput}
              placeholder={t(lang, 'provider_api_key_placeholder')}
              value={apiKeyDraft}
              onChange={(e) => setApiKeyDraft(e.target.value)}
              aria-label={t(lang, 'provider_api_key_placeholder')}
            />
            <button
              type="button"
              className="btn"
              onClick={handleSaveApiKey}
              disabled={!apiKeyDraft.trim()}
            >
              {t(lang, 'provider_api_key_save')}
            </button>
            <div className={styles.settingsFieldHint}>
              {t(lang, `${activeProvider}_key_get_from` as `${typeof activeProvider}_key_get_from`)}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
