import type { ChannelId, ChannelSettings as ChannelSettingsType } from '@skynul/shared'
import { useCallback, useEffect, useState } from 'react'

import discordIcon from '../assets/discord.svg'
import signalIcon from '../assets/signal.svg'
import slackIcon from '../assets/slack.svg'
import telegramIcon from '../assets/telegram.svg'
import whatsappIcon from '../assets/whatsapp.svg'
import { cn } from '../lib/utils'
import { Button } from './ui/button'

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
    <div className="settingsSection">
      <div className="settingsLabel">Messaging Channels</div>
      {error && <div className="composerError">{error}</div>}

      <button
        className={cn(
          'w-full flex items-center justify-between gap-[12px] p-[12px] rounded-[14px] border border-[var(--nb-border)] bg-[var(--nb-panel)] cursor-pointer text-left',
          autoApprove &&
            'border-[color-mix(in_srgb,var(--nb-accent-2),transparent_60%)] bg-[color-mix(in_srgb,var(--nb-accent-2),transparent_92%)]'
        )}
        onClick={() => void handleAutoApproveToggle()}
        style={{ marginBottom: 12 }}
      >
        <div className="flex flex-col min-w-0">
          <div className="text-[14px] font-semibold text-[color-mix(in_srgb,var(--nb-text),transparent_10%)]">
            Aprobar tareas automáticamente
          </div>
          <div className="text-[12px] font-[520] text-[var(--nb-muted)]">
            {autoApprove
              ? 'Las tareas de canales se ejecutan sin confirmación'
              : 'Las tareas quedan pendientes hasta que las apruebes'}
          </div>
        </div>
        <div
          className={cn(
            'w-[44px] h-[26px] rounded-full border border-[var(--nb-border)] bg-[color-mix(in_srgb,var(--nb-text),transparent_92%)] p-[3px] flex items-center justify-start',
            autoApprove &&
              'border-[color-mix(in_srgb,var(--nb-accent-2),transparent_60%)] bg-[color-mix(in_srgb,var(--nb-accent-2),transparent_78%)]'
          )}
          aria-hidden="true"
        >
          <div
            className={cn(
              'w-[18px] h-[18px] rounded-full bg-[var(--nb-panel-2)] border border-[var(--nb-border)] shadow-[0_10px_22px_rgba(0,0,0,0.08)] transition-transform duration-[140ms] ease-out',
              autoApprove && 'translate-x-[18px] border-[color-mix(in_srgb,var(--nb-accent-2),transparent_65%)]'
            )}
          />
        </div>
      </button>

      <div className="channelGrid">
        {channels.map((ch) => {
          const info = CHANNEL_INFO[ch.id]
          const isExpanded = expandedId === ch.id
          const isBusy = busy === ch.id

          return (
            <div key={ch.id} className="channelCard">
              <button
                type="button"
                className="channelCardHeader"
                onClick={() => setExpandedId(isExpanded ? null : ch.id)}
              >
                <span className="channelIcon" aria-hidden="true">
                  <img className="channelIconImg" src={info.iconSrc} alt="" />
                </span>
                <span className="channelName">{info.label}</span>
                <span
                  className="channelStatusDot"
                  style={{ backgroundColor: STATUS_COLORS[ch.status] ?? '#666' }}
                  title={ch.status}
                />
                {ch.paired && <span className="settingsBadge">Paired</span>}
              </button>

              {isExpanded && (
                <div className="channelCardBody">
                  <div className="settingsFieldHint">{info.desc}</div>

                  {/* Credentials input */}
                  {info.credentialField && (
                    <div className="channelCredRow" style={{ flexDirection: 'column', gap: 6 }}>
                      {ch.hasCredentials && !credDraft && (
                        <div className="channelSavedCred">
                          <span className="credMask">••••••••••••••••</span>
                          <Button
                            type="button"
                            size="small"
                            variant="default"
                            onClick={() => setCredDraft(' ')}
                          >
                            Change
                          </Button>
                        </div>
                      )}
                      {(!ch.hasCredentials || credDraft) && (
                        <>
                          <input
                            type="password"
                            className="apiKeyInput"
                            placeholder={info.credentialPlaceholder}
                            value={credDraft}
                            onChange={(e) => setCredDraft(e.target.value)}
                            aria-label={info.credentialLabel}
                          />
                          {info.credentialField2 && (
                            <input
                              type="password"
                              className="apiKeyInput"
                              placeholder={info.credentialPlaceholder2}
                              value={credDraft2}
                              onChange={(e) => setCredDraft2(e.target.value)}
                              aria-label={info.credentialLabel2}
                            />
                          )}
                          <Button
                            type="button"
                            variant="default"
                            onClick={() => void handleSaveCredentials(ch.id)}
                            disabled={isBusy || !credDraft.trim()}
                          >
                            {isBusy ? '...' : 'Save'}
                          </Button>
                        </>
                      )}
                    </div>
                  )}

                  {/* Enable toggle */}
                  <button
                    className={cn(
                      'w-full flex items-center justify-between gap-[12px] p-[12px] rounded-[14px] border border-[var(--nb-border)] bg-[var(--nb-panel)] cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-[0.65]',
                      ch.enabled &&
                        'border-[color-mix(in_srgb,var(--nb-accent-2),transparent_60%)] bg-[color-mix(in_srgb,var(--nb-accent-2),transparent_92%)]'
                    )}
                    onClick={() => void handleToggle(ch.id, ch.enabled)}
                    disabled={isBusy}
                  >
                    <div className="flex flex-col min-w-0">
                      <div className="text-[14px] font-semibold text-[color-mix(in_srgb,var(--nb-text),transparent_10%)]">
                        Active
                      </div>
                      <div className="text-[12px] font-[520] text-[var(--nb-muted)]">
                        {ch.enabled ? `Status: ${ch.status}` : 'Channel is off'}
                      </div>
                    </div>
                    <div
                      className={cn(
                        'w-[44px] h-[26px] rounded-full border border-[var(--nb-border)] bg-[color-mix(in_srgb,var(--nb-text),transparent_92%)] p-[3px] flex items-center justify-start',
                        ch.enabled &&
                          'border-[color-mix(in_srgb,var(--nb-accent-2),transparent_60%)] bg-[color-mix(in_srgb,var(--nb-accent-2),transparent_78%)]'
                      )}
                      aria-hidden="true"
                    >
                      <div
                        className={cn(
                          'w-[18px] h-[18px] rounded-full bg-[var(--nb-panel-2)] border border-[var(--nb-border)] shadow-[0_10px_22px_rgba(0,0,0,0.08)] transition-transform duration-[140ms] ease-out',
                          ch.enabled &&
                            'translate-x-[18px] border-[color-mix(in_srgb,var(--nb-accent-2),transparent_65%)]'
                        )}
                      />
                    </div>
                  </button>

                  {/* Pairing flow */}
                  {ch.enabled && !ch.paired && (
                    <div className="channelPairing">
                      {ch.pairingCode ? (
                        <div className="settingsFieldHint">
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
                        <Button
                          variant="default"
                          onClick={() => void handleGeneratePairing(ch.id)}
                          disabled={isBusy}
                        >
                          {isBusy ? '...' : 'Generate Pairing Code'}
                        </Button>
                      )}
                    </div>
                  )}

                  {/* Paired info */}
                  {ch.enabled && ch.paired && (
                    <div className="channelPaired">
                      <div className="settingsFieldHint">
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
                      <Button
                        variant="default"
                        onClick={() => void handleUnpair(ch.id)}
                        disabled={isBusy}
                      >
                        Unpair
                      </Button>
                    </div>
                  )}

                  {ch.error && <div className="composerError">{ch.error}</div>}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
