import type { ChannelId } from '@shared'
import { ChevronDown } from 'lucide-react'
import { useState } from 'react'
import discordIcon from '@/assets/discord.svg'
import signalIcon from '@/assets/signal.svg'
import slackIcon from '@/assets/slack.svg'
import telegramIcon from '@/assets/telegram.svg'
import whatsappIcon from '@/assets/whatsapp.svg'
import { SettingsInset, SettingsRow } from '@/components/feature/settings/settings-primitives'
import { ThemeIcon } from '@/components/theme-icon'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import {
  useChannels,
  useGenerateChannelPairing,
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
    credentialPlaceholder: string
    credentialField2?: string
    credentialPlaceholder2?: string
  }
> = {
  telegram: {
    label: 'Telegram',
    iconSrc: telegramIcon,
    desc: 'Bot token from @BotFather',
    credentialField: 'token',
    credentialPlaceholder: '123456:ABC-DEF1234...'
  },
  whatsapp: {
    label: 'WhatsApp',
    iconSrc: whatsappIcon,
    desc: 'QR-based auth via whatsapp-web.js',
    credentialField: '',
    credentialPlaceholder: ''
  },
  discord: {
    label: 'Discord',
    iconSrc: discordIcon,
    desc: 'Bot token from Discord Developer Portal',
    credentialField: 'token',
    credentialPlaceholder: 'MTA2NjY...'
  },
  signal: {
    label: 'Signal',
    iconSrc: signalIcon,
    desc: 'signal-cli REST API',
    credentialField: 'apiUrl',
    credentialPlaceholder: 'http://localhost:8080'
  },
  slack: {
    label: 'Slack',
    iconSrc: slackIcon,
    desc: 'Socket Mode — Bot + App tokens',
    credentialField: 'botToken',
    credentialPlaceholder: 'xoxb-...',
    credentialField2: 'appToken',
    credentialPlaceholder2: 'xapp-...'
  }
}

const STATUS_COLOR: Record<string, string> = {
  connected: 'bg-emerald-500',
  connecting: 'bg-amber-500',
  disconnected: 'bg-nb-muted/50',
  error: 'bg-nb-danger'
}

export function ChannelSettings(): React.JSX.Element {
  const { data: channels = [], isLoading } = useChannels()
  const setEnabled = useSetChannelEnabled()
  const setCredentials = useSetChannelCredentials()
  const generatePairing = useGenerateChannelPairing()
  const unpair = useUnpairChannel()

  const [expandedId, setExpandedId] = useState<ChannelId | null>(null)
  const [credDraft, setCredDraft] = useState('')
  const [credDraft2, setCredDraft2] = useState('')
  const [busy, setBusy] = useState<ChannelId | null>(null)
  const [error, setError] = useState('')

  const handleToggle = async (channelId: ChannelId, enabled: boolean): Promise<void> => {
    setBusy(channelId)
    setError('')
    try {
      await setEnabled.mutateAsync({ channelId, enabled })
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
      const creds: Record<string, string> = { [info.credentialField]: credDraft.trim() }
      if (info.credentialField2 && credDraft2.trim()) creds[info.credentialField2] = credDraft2.trim()
      await setCredentials.mutateAsync({ channelId, creds })
      setCredDraft('')
      setCredDraft2('')
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e))
    } finally {
      setBusy(null)
    }
  }

  if (isLoading) {
    return <div className="px-4 py-6 text-sm text-nb-muted">Loading channels…</div>
  }

  return (
    <>
      {error && (
        <div className="mx-4 mt-3 text-xs text-nb-danger px-3 py-2 rounded-lg bg-nb-danger/10 border border-nb-danger/30">
          {error}
        </div>
      )}

      {channels.map((ch) => {
        const info = CHANNEL_INFO[ch.id]
        const isExpanded = expandedId === ch.id
        const isBusy = busy === ch.id

        return (
          <div key={ch.id}>
            <SettingsRow
              title={
                <span className="inline-flex items-center gap-2">
                  <ThemeIcon src={info.iconSrc} alt={info.label} className="size-4" />
                  {info.label}
                </span>
              }
              description={
                <span className="inline-flex items-center gap-1.5">
                  <span
                    className={cn('size-1.5 rounded-full', STATUS_COLOR[ch.status] ?? 'bg-nb-muted')}
                  />
                  {ch.paired ? 'Paired' : ch.status}
                </span>
              }
            >
              <button
                type="button"
                onClick={() => setExpandedId(isExpanded ? null : ch.id)}
                className="p-1 rounded-md border-none bg-transparent text-nb-muted hover:text-nb-text cursor-pointer"
                aria-expanded={isExpanded}
                aria-label={`Configure ${info.label}`}
              >
                <ChevronDown
                  className={cn('size-4 transition-transform', isExpanded && 'rotate-180')}
                />
              </button>
              <Switch
                checked={ch.enabled}
                disabled={isBusy}
                onCheckedChange={(checked) => void handleToggle(ch.id, checked)}
                aria-label={`Enable ${info.label}`}
              />
            </SettingsRow>

            {isExpanded && (
              <SettingsInset>
                <p className="text-xs text-nb-muted mb-3">{info.desc}</p>

                {info.credentialField && (
                  <div className="flex flex-col gap-2 mb-3">
                    {ch.hasCredentials && !credDraft ? (
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs text-nb-muted tracking-widest">••••••••</span>
                        <Button variant="outline" size="xs" onClick={() => setCredDraft(' ')}>
                          Change
                        </Button>
                      </div>
                    ) : (
                      <>
                        <Input
                          type="password"
                          className="font-mono text-xs h-9"
                          placeholder={info.credentialPlaceholder}
                          value={credDraft}
                          onChange={(e) => setCredDraft(e.target.value)}
                        />
                        {info.credentialField2 && (
                          <Input
                            type="password"
                            className="font-mono text-xs h-9"
                            placeholder={info.credentialPlaceholder2}
                            value={credDraft2}
                            onChange={(e) => setCredDraft2(e.target.value)}
                          />
                        )}
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={isBusy || !credDraft.trim()}
                          onClick={() => void handleSaveCredentials(ch.id)}
                        >
                          Save credentials
                        </Button>
                      </>
                    )}
                  </div>
                )}

                {ch.enabled && !ch.paired && (
                  <div className="flex flex-col gap-2 mb-2">
                    {ch.pairingCode ? (
                      <p className="text-xs text-nb-muted">
                        {ch.id === 'telegram' && (
                          <>
                            Send{' '}
                            <code className="rounded bg-nb-code-bg border border-nb-code-border px-1 py-0.5 font-mono text-[11px]">
                              /pair {ch.pairingCode}
                            </code>{' '}
                            to your bot
                          </>
                        )}
                        {ch.id === 'discord' && (
                          <>
                            Send{' '}
                            <code className="rounded bg-nb-code-bg border border-nb-code-border px-1 py-0.5 font-mono text-[11px]">
                              /pair {ch.pairingCode}
                            </code>{' '}
                            in Discord
                          </>
                        )}
                        {ch.id === 'slack' && (
                          <>
                            Send{' '}
                            <code className="rounded bg-nb-code-bg border border-nb-code-border px-1 py-0.5 font-mono text-[11px]">
                              /pair {ch.pairingCode}
                            </code>{' '}
                            in Slack
                          </>
                        )}
                        {(ch.id === 'whatsapp' || ch.id === 'signal') && <>Complete pairing in the client</>}
                      </p>
                    ) : (
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={isBusy}
                        onClick={() => void generatePairing.mutateAsync(ch.id)}
                      >
                        Generate pairing code
                      </Button>
                    )}
                  </div>
                )}

                {ch.enabled && ch.paired && (
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs text-nb-muted">
                      {ch.id === 'telegram' && <>Chat {String(ch.meta.pairedChatId)}</>}
                      {ch.id === 'discord' && <>Channel {String(ch.meta.pairedChannelId)}</>}
                      {ch.id === 'slack' && <>Channel {String(ch.meta.pairedChannelId)}</>}
                      {ch.id === 'whatsapp' && <>{String(ch.meta.phoneNumber)}</>}
                      {ch.id === 'signal' && <>{String(ch.meta.phoneNumber)}</>}
                    </span>
                    <Button
                      size="xs"
                      variant="ghost"
                      disabled={isBusy}
                      onClick={() => void unpair.mutateAsync(ch.id)}
                    >
                      Unpair
                    </Button>
                  </div>
                )}

                {ch.error && (
                  <p className="text-xs text-nb-danger mt-2">{ch.error}</p>
                )}
              </SettingsInset>
            )}
          </div>
        )
      })}
    </>
  )
}
