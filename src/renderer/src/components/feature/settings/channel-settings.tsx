import type { ChannelId } from '@skynul/shared'
import { useState } from 'react'
import discordIcon from '@/assets/discord.svg'
import signalIcon from '@/assets/signal.svg'
import slackIcon from '@/assets/slack.svg'
import telegramIcon from '@/assets/telegram.svg'
import whatsappIcon from '@/assets/whatsapp.svg'
import { CapabilityToggle } from '@/components/feature/settings'
import {
  useChannelGlobal,
  useChannels,
  useGenerateChannelPairing,
  useSetChannelAutoApprove,
  useSetChannelCredentials,
  useSetChannelEnabled,
  useUnpairChannel
} from '@/queries/channels/hooks'

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
  const { data: channels = [], isLoading } = useChannels()
  const { data: global } = useChannelGlobal()
  const setEnabled = useSetChannelEnabled()
  const setCredentials = useSetChannelCredentials()
  const generatePairing = useGenerateChannelPairing()
  const unpair = useUnpairChannel()
  const setAutoApprove = useSetChannelAutoApprove()

  const [expandedId, setExpandedId] = useState<ChannelId | null>(null)
  const [credDraft, setCredDraft] = useState('')
  const [credDraft2, setCredDraft2] = useState('')
  const [busy, setBusy] = useState<ChannelId | null>(null)
  const [error, setError] = useState('')

  const autoApprove = global?.autoApprove ?? true

  const handleToggle = async (channelId: ChannelId, currentEnabled: boolean): Promise<void> => {
    setBusy(channelId)
    setError('')
    try {
      await setEnabled.mutateAsync({ channelId, enabled: !currentEnabled })
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
      if (info.credentialField2 && credDraft2.trim()) creds[info.credentialField2] = credDraft2
      await setCredentials.mutateAsync({ channelId, creds })
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
      await generatePairing.mutateAsync(channelId)
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
      await unpair.mutateAsync(channelId)
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  if (isLoading) return <div className="flex flex-col gap-3">Loading channels...</div>

  return (
    <div className="flex flex-col gap-3">
      <div className="text-xs font-bold text-nb-muted uppercase tracking-[0.04em]">
        Messaging Channels
      </div>
      {error && (
        <div className="text-xs text-nb-danger px-2.5 py-2 rounded-lg bg-nb-danger/10 border border-nb-danger/30">
          {error}
        </div>
      )}

      <CapabilityToggle
        title="Aprobar tareas automáticamente"
        description={
          autoApprove
            ? 'Las tareas de canales se ejecutan sin confirmación'
            : 'Las tareas quedan pendientes hasta que las apruebes'
        }
        enabled={autoApprove}
        onToggle={() =>
          void setAutoApprove
            .mutateAsync(!autoApprove)
            .catch((e) => setError(e instanceof Error ? e.message : String(e)))
        }
      />

      <div className="flex flex-col gap-2">
        {channels.map((ch) => {
          const info = CHANNEL_INFO[ch.id]
          const isExpanded = expandedId === ch.id
          const isBusy = busy === ch.id

          return (
            <div
              key={ch.id}
              className="border border-nb-border rounded-xl overflow-hidden bg-nb-panel"
            >
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : ch.id)}
                className="flex items-center gap-2.5 w-full px-3.5 py-3 bg-none border-none cursor-pointer text-nb-text text-xs font-semibold text-left hover:bg-nb-accent-2/8 transition-colors duration-100"
              >
                <span className="w-[18px] h-[18px] inline-flex items-center justify-center shrink-0">
                  <img
                    className="w-[18px] h-[18px] block object-contain brightness-0 dark:brightness-0 dark:invert"
                    src={info.iconSrc}
                    alt=""
                  />
                </span>
                <span className="flex-1">{info.label}</span>
                <span
                  className="w-2 h-2 rounded-full shrink-0"
                  style={{ backgroundColor: STATUS_COLORS[ch.status] ?? '#666' }}
                  title={ch.status}
                />
                {ch.paired && (
                  <span className="inline-flex items-center text-[9px] font-bold uppercase tracking-[0.04em] text-white bg-nb-accent-2 px-2 py-[3px] rounded-full align-middle">
                    Paired
                  </span>
                )}
              </button>

              {isExpanded && (
                <div className="px-3.5 pb-3.5 flex flex-col gap-2.5">
                  <div className="text-[11px] font-medium text-nb-muted">{info.desc}</div>

                  {info.credentialField && (
                    <div className="flex flex-col gap-1.5">
                      {ch.hasCredentials && !credDraft && (
                        <div className="flex items-center gap-2.5">
                          <span className="font-mono text-nb-muted tracking-[2px]">
                            ••••••••••••••••
                          </span>
                          <button
                            type="button"
                            className="text-[11px] px-2.5 py-[3px] bg-nb-panel-2 border border-nb-border rounded-lg cursor-pointer text-nb-text"
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
                            className="w-full px-3 py-2.5 rounded-xl border border-nb-border bg-nb-panel-2 text-xs text-nb-text outline-none font-mono focus:border-nb-accent-2/50"
                            placeholder={info.credentialPlaceholder}
                            value={credDraft}
                            onChange={(e) => setCredDraft(e.target.value)}
                            aria-label={info.credentialLabel}
                          />
                          {info.credentialField2 && (
                            <input
                              type="password"
                              className="w-full px-3 py-2.5 rounded-xl border border-nb-border bg-nb-panel-2 text-xs text-nb-text outline-none font-mono focus:border-nb-accent-2/50"
                              placeholder={info.credentialPlaceholder2}
                              value={credDraft2}
                              onChange={(e) => setCredDraft2(e.target.value)}
                              aria-label={info.credentialLabel2}
                            />
                          )}
                          <button
                            type="button"
                            className="px-2.5 py-[3px] bg-nb-panel-2 border border-nb-border rounded-lg cursor-pointer text-nb-text text-xs"
                            onClick={() => void handleSaveCredentials(ch.id)}
                            disabled={isBusy || !credDraft.trim()}
                          >
                            {isBusy ? '...' : 'Save'}
                          </button>
                        </>
                      )}
                    </div>
                  )}

                  <CapabilityToggle
                    title="Active"
                    description={ch.enabled ? `Status: ${ch.status}` : 'Channel is off'}
                    enabled={ch.enabled}
                    onToggle={() => void handleToggle(ch.id, ch.enabled)}
                    disabled={isBusy}
                  />

                  {ch.enabled && !ch.paired && (
                    <div className="flex flex-col gap-2">
                      {ch.pairingCode ? (
                        <div className="text-[11px] font-medium text-nb-muted">
                          {ch.id === 'telegram' && (
                            <>
                              Send{' '}
                              <code className="bg-nb-code-bg border border-nb-code-border rounded px-1">
                                /pair {ch.pairingCode}
                              </code>{' '}
                              to your bot in Telegram
                            </>
                          )}
                          {ch.id === 'discord' && (
                            <>
                              Send{' '}
                              <code className="bg-nb-code-bg border border-nb-code-border rounded px-1">
                                /pair {ch.pairingCode}
                              </code>{' '}
                              to your bot in Discord
                            </>
                          )}
                          {ch.id === 'slack' && (
                            <>
                              Send{' '}
                              <code className="bg-nb-code-bg border border-nb-code-border rounded px-1">
                                /pair {ch.pairingCode}
                              </code>{' '}
                              to the bot in Slack
                            </>
                          )}
                          {ch.id === 'whatsapp' && <>Scan QR code in WhatsApp</>}
                          {ch.id === 'signal' && <>Link device via Signal</>}
                        </div>
                      ) : (
                        <button
                          type="button"
                          className="px-2.5 py-[3px] bg-nb-panel-2 border border-nb-border rounded-lg cursor-pointer text-nb-text text-xs"
                          onClick={() => void handleGeneratePairing(ch.id)}
                          disabled={isBusy}
                        >
                          {isBusy ? '...' : 'Generate Pairing Code'}
                        </button>
                      )}
                    </div>
                  )}

                  {ch.enabled && ch.paired && (
                    <div className="flex flex-col gap-2">
                      <div className="text-[11px] font-medium text-nb-muted">
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
                        className="px-2.5 py-[3px] bg-nb-panel-2 border border-nb-border rounded-lg cursor-pointer text-nb-text text-xs"
                        onClick={() => void handleUnpair(ch.id)}
                        disabled={isBusy}
                      >
                        Unpair
                      </button>
                    </div>
                  )}

                  {ch.error && (
                    <div className="text-xs text-nb-danger px-2.5 py-2 rounded-lg bg-nb-danger/10 border border-nb-danger/30">
                      {ch.error}
                    </div>
                  )}
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
