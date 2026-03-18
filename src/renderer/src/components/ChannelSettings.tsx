import type { ChannelId, ChannelSettings as ChannelSettingsType } from '@skynul/shared'
import { useCallback, useEffect, useState } from 'react'
import discordIcon from '../assets/discord.svg'
import signalIcon from '../assets/signal.svg'
import slackIcon from '../assets/slack.svg'
import telegramIcon from '../assets/telegram.svg'
import whatsappIcon from '../assets/whatsapp.svg'
import { CapabilityToggle } from './CapabilityToggle'
import styles from './ChannelSettings.module.css'

const CHANNEL_INFO: Record<
  ChannelId,
  {
    label: string
    iconSrc: string
    desc: string
    credentialField: string
    credentialLabel: string
    credentialPlaceholder: string
    credentialField2?: string
    credentialLabel2?: string
    credentialPlaceholder2?: string
  }
> = {
  telegram: {
    label: 'Telegram',
    iconSrc: telegramIcon,
    desc: 'Bot token from @BotFather',
    credentialField: 'token',
    credentialLabel: 'Bot Token',
    credentialPlaceholder: '123456:ABC-DEF1234...'
  },
  whatsapp: {
    label: 'WhatsApp',
    iconSrc: whatsappIcon,
    desc: 'QR-based auth via whatsapp-web.js',
    credentialField: '',
    credentialLabel: '',
    credentialPlaceholder: ''
  },
  discord: {
    label: 'Discord',
    iconSrc: discordIcon,
    desc: 'Bot token from Discord Developer Portal',
    credentialField: 'token',
    credentialLabel: 'Bot Token',
    credentialPlaceholder: 'MTA2NjY...'
  },
  signal: {
    label: 'Signal',
    iconSrc: signalIcon,
    desc: 'signal-cli REST API',
    credentialField: 'apiUrl',
    credentialLabel: 'API URL',
    credentialPlaceholder: 'http://localhost:8080'
  },
  slack: {
    label: 'Slack',
    iconSrc: slackIcon,
    desc: 'Socket Mode — Bot Token + App Token',
    credentialField: 'botToken',
    credentialLabel: 'Bot Token',
    credentialPlaceholder: 'xoxb-...',
    credentialField2: 'appToken',
    credentialLabel2: 'App Token',
    credentialPlaceholder2: 'xapp-...'
  }
}

const STATUS_COLORS: Record<string, string> = {
  connected: '#4caf50',
  connecting: '#ff9800',
  disconnected: '#666',
  error: '#f44336'
}

export function ChannelSettings(): React.JSX.Element {
  const [channels, setChannels] = useState<ChannelSettingsType[]>([])
  const [expandedId, setExpandedId] = useState<ChannelId | null>(null)
  const [credDraft, setCredDraft] = useState('')
  const [credDraft2, setCredDraft2] = useState('')
  const [busy, setBusy] = useState<ChannelId | null>(null)
  const [error, setError] = useState('')
  const [autoApprove, setAutoApprove] = useState(true)

  const loadChannels = useCallback(async () => {
    try {
      const [all, global] = await Promise.all([
        window.skynul.channelGetAll(),
        window.skynul.channelGetGlobal()
      ])
      setChannels(all)
      setAutoApprove(global.autoApprove)
    } catch {
      // not available
    }
  }, [])

  useEffect(() => {
    void loadChannels()
  }, [loadChannels])

  const handleToggle = async (channelId: ChannelId, currentEnabled: boolean): Promise<void> => {
    setBusy(channelId)
    setError('')
    try {
      const updated = await window.skynul.channelSetEnabled(channelId, !currentEnabled)
      setChannels((prev) => prev.map((c) => (c.id === channelId ? updated : c)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const handleSaveCredentials = async (channelId: ChannelId): Promise<void> => {
    if (!credDraft.trim()) return
    setBusy(channelId)
    setError('')
    try {
      const info = CHANNEL_INFO[channelId]
      const creds: Record<string, string> = { [info.credentialField]: credDraft }
      if (info.credentialField2 && credDraft2.trim()) {
        creds[info.credentialField2] = credDraft2
      }
      const updated = await window.skynul.channelSetCredentials(channelId, creds)
      setChannels((prev) => prev.map((c) => (c.id === channelId ? updated : c)))
      setCredDraft('')
      setCredDraft2('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const handleGeneratePairing = async (channelId: ChannelId): Promise<void> => {
    setBusy(channelId)
    setError('')
    try {
      const code = await window.skynul.channelGeneratePairing(channelId)
      setChannels((prev) => prev.map((c) => (c.id === channelId ? { ...c, pairingCode: code } : c)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const handleUnpair = async (channelId: ChannelId): Promise<void> => {
    setBusy(channelId)
    setError('')
    try {
      const updated = await window.skynul.channelUnpair(channelId)
      setChannels((prev) => prev.map((c) => (c.id === channelId ? updated : c)))
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  const handleAutoApproveToggle = async (): Promise<void> => {
    try {
      const updated = await window.skynul.channelSetAutoApprove(!autoApprove)
      setAutoApprove(updated.autoApprove)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    }
  }

  return (
    <div className={styles.settingsSection}>
      <div className={styles.settingsLabel}>Messaging Channels</div>
      {error && <div className={styles.composerError}>{error}</div>}

      <CapabilityToggle
        title="Aprobar tareas automáticamente"
        description={
          autoApprove
            ? 'Las tareas de canales se ejecutan sin confirmación'
            : 'Las tareas quedan pendientes hasta que las apruebes'
        }
        enabled={autoApprove}
        onToggle={() => void handleAutoApproveToggle()}
      />

      <div className={styles.channelGrid}>
        {channels.map((ch) => {
          const info = CHANNEL_INFO[ch.id]
          const isExpanded = expandedId === ch.id
          const isBusy = busy === ch.id

          return (
            <div key={ch.id} className={styles.channelCard}>
              <button
                type="button"
                className={styles.channelCardHeader}
                onClick={() => setExpandedId(isExpanded ? null : ch.id)}
              >
                <span className={styles.channelIcon} aria-hidden="true">
                  <img className={styles.channelIconImg} src={info.iconSrc} alt="" />
                </span>
                <span className={styles.channelName}>{info.label}</span>
                <span
                  className={styles.channelStatusDot}
                  style={{ backgroundColor: STATUS_COLORS[ch.status] ?? '#666' }}
                  title={ch.status}
                />
                {ch.paired && <span className={styles.settingsBadge}>Paired</span>}
              </button>

              {isExpanded && (
                <div className={styles.channelCardBody}>
                  <div className={styles.settingsFieldHint}>{info.desc}</div>

                  {/* Credentials input */}
                  {info.credentialField && (
                    <div
                      className={styles.channelCredRow}
                      style={{ flexDirection: 'column', gap: 6 }}
                    >
                      {ch.hasCredentials && !credDraft && (
                        <div className={styles.channelSavedCred}>
                          <span className={styles.credMask}>••••••••••••••••</span>
                          <button
                            type="button"
                            className="btn"
                            style={{ fontSize: '11px', padding: '3px 10px' }}
                            onClick={() => setCredDraft(' ')}
                          >
                            Change
                          </button>
                        </div>
                      )}
                      {(!ch.hasCredentials || credDraft) && (
                        <>
                          <input
                            type="password"
                            className={styles.apiKeyInput}
                            placeholder={info.credentialPlaceholder}
                            value={credDraft}
                            onChange={(e) => setCredDraft(e.target.value)}
                            aria-label={info.credentialLabel}
                          />
                          {info.credentialField2 && (
                            <input
                              type="password"
                              className={styles.apiKeyInput}
                              placeholder={info.credentialPlaceholder2}
                              value={credDraft2}
                              onChange={(e) => setCredDraft2(e.target.value)}
                              aria-label={info.credentialLabel2}
                            />
                          )}
                          <button
                            type="button"
                            className="btn"
                            onClick={() => void handleSaveCredentials(ch.id)}
                            disabled={isBusy || !credDraft.trim()}
                          >
                            {isBusy ? '...' : 'Save'}
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Enable toggle */}
                  <CapabilityToggle
                    title="Active"
                    description={ch.enabled ? `Status: ${ch.status}` : 'Channel is off'}
                    enabled={ch.enabled}
                    onToggle={() => void handleToggle(ch.id, ch.enabled)}
                    disabled={isBusy}
                  />

                  {/* Pairing flow */}
                  {ch.enabled && !ch.paired && (
                    <div className={styles.channelPairing}>
                      {ch.pairingCode ? (
                        <div className={styles.settingsFieldHint}>
                          {ch.id === 'telegram' && (
                            <>
                              Send <code>/pair {ch.pairingCode}</code> to your bot in Telegram
                            </>
                          )}
                          {ch.id === 'discord' && (
                            <>
                              Send <code>/pair {ch.pairingCode}</code> to your bot in Discord
                            </>
                          )}
                          {ch.id === 'slack' && (
                            <>
                              Send <code>/pair {ch.pairingCode}</code> to the bot in Slack
                            </>
                          )}
                          {ch.id === 'whatsapp' && <>Scan QR code in WhatsApp</>}
                          {ch.id === 'signal' && <>Link device via Signal</>}
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="btn"
                          onClick={() => void handleGeneratePairing(ch.id)}
                          disabled={isBusy}
                        >
                          {isBusy ? '...' : 'Generate Pairing Code'}
                        </button>
                      )}
                    </div>
                  )}

                  {/* Paired info */}
                  {ch.enabled && ch.paired && (
                    <div className={styles.channelPaired}>
                      <div className={styles.settingsFieldHint}>
                        {ch.id === 'telegram' && <>Paired to chat {String(ch.meta.pairedChatId)}</>}
                        {ch.id === 'discord' && (
                          <>Paired to channel {String(ch.meta.pairedChannelId)}</>
                        )}
                        {ch.id === 'slack' && (
                          <>Paired to channel {String(ch.meta.pairedChannelId)}</>
                        )}
                        {ch.id === 'whatsapp' && <>Paired to {String(ch.meta.phoneNumber)}</>}
                        {ch.id === 'signal' && <>Paired to {String(ch.meta.phoneNumber)}</>}
                      </div>
                      <button
                        type="button"
                        className="btn"
                        onClick={() => void handleUnpair(ch.id)}
                        disabled={isBusy}
                      >
                        Unpair
                      </button>
                    </div>
                  )}

                  {ch.error && <div className={styles.composerError}>{ch.error}</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
