import type { CapabilityId } from '@skynul/shared'
import { Section, SectionLabel, SettingsShell } from '../../components/layout'
import { Button } from '../../components/ui/button'
import { t } from '../../i18n'
import { usePolicy, useSetAutoApprove, useSetCapability, useSetTaskMemory } from '../../queries'
import { cn } from '../../lib/utils'

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

export function ComputerSettingsPage(): React.JSX.Element {
  // Queries
  const { data: policy } = usePolicy()

  // Mutations
  const setCapabilityMutation = useSetCapability()
  const setTaskMemoryMutation = useSetTaskMemory()
  const setAutoApproveMutation = useSetAutoApprove()

  const lang = policy?.language ?? 'en'

  const handleToggleCapability = (id: CapabilityId) => {
    if (!policy) return
    setCapabilityMutation.mutate({
      capability: id,
      enabled: !policy.capabilities[id]
    })
  }

  const handleToggleTaskMemory = () => {
    if (!policy) return
    setTaskMemoryMutation.mutate(!policy.taskMemoryEnabled)
  }

  const handleToggleAutoApprove = () => {
    if (!policy) return
    setAutoApproveMutation.mutate(!policy.taskAutoApprove)
  }

  return (
    <SettingsShell>
      {/* Task Memory */}
      <Section>
        <SectionLabel>Task Memory</SectionLabel>
        <button
          type="button"
          className={cn(
            'w-full flex items-center justify-between gap-[12px] p-[12px] rounded-[14px] border border-[var(--nb-border)] bg-[var(--nb-panel)] cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-[0.65]',
            policy?.taskMemoryEnabled &&
              'border-[color-mix(in_srgb,var(--nb-accent-2),transparent_60%)] bg-[color-mix(in_srgb,var(--nb-accent-2),transparent_92%)]'
          )}
          onClick={handleToggleTaskMemory}
          disabled={!policy}
        >
          <div className="flex flex-col min-w-0">
            <div className="text-[14px] font-semibold text-[color-mix(in_srgb,var(--nb-text),transparent_10%)]">
              Learn from Tasks
            </div>
            <div className="text-[12px] font-[520] text-[var(--nb-muted)]">
              Remember past results to improve future tasks
            </div>
          </div>
          <div
            className={cn(
              'w-[44px] h-[26px] rounded-full border border-[var(--nb-border)] bg-[color-mix(in_srgb,var(--nb-text),transparent_92%)] p-[3px] flex items-center justify-start',
              policy?.taskMemoryEnabled &&
                'border-[color-mix(in_srgb,var(--nb-accent-2),transparent_60%)] bg-[color-mix(in_srgb,var(--nb-accent-2),transparent_78%)]'
            )}
            aria-hidden="true"
          >
            <div
              className={cn(
                'w-[18px] h-[18px] rounded-full bg-[var(--nb-panel-2)] border border-[var(--nb-border)] shadow-[0_10px_22px_rgba(0,0,0,0.08)] transition-transform duration-[140ms] ease-out',
                policy?.taskMemoryEnabled && 'translate-x-[18px] border-[color-mix(in_srgb,var(--nb-accent-2),transparent_65%)]'
              )}
            />
          </div>
        </button>
        <button
          type="button"
          className={cn(
            'w-full flex items-center justify-between gap-[12px] p-[12px] rounded-[14px] border border-[var(--nb-border)] bg-[var(--nb-panel)] cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-[0.65]',
            policy?.taskAutoApprove &&
              'border-[color-mix(in_srgb,var(--nb-accent-2),transparent_60%)] bg-[color-mix(in_srgb,var(--nb-accent-2),transparent_92%)]'
          )}
          onClick={handleToggleAutoApprove}
          disabled={!policy}
        >
          <div className="flex flex-col min-w-0">
            <div className="text-[14px] font-semibold text-[color-mix(in_srgb,var(--nb-text),transparent_10%)]">
              Auto-Approve Tasks
            </div>
            <div className="text-[12px] font-[520] text-[var(--nb-muted)]">
              Skip capability confirmation and run immediately
            </div>
          </div>
          <div
            className={cn(
              'w-[44px] h-[26px] rounded-full border border-[var(--nb-border)] bg-[color-mix(in_srgb,var(--nb-text),transparent_92%)] p-[3px] flex items-center justify-start',
              policy?.taskAutoApprove &&
                'border-[color-mix(in_srgb,var(--nb-accent-2),transparent_60%)] bg-[color-mix(in_srgb,var(--nb-accent-2),transparent_78%)]'
            )}
            aria-hidden="true"
          >
            <div
              className={cn(
                'w-[18px] h-[18px] rounded-full bg-[var(--nb-panel-2)] border border-[var(--nb-border)] shadow-[0_10px_22px_rgba(0,0,0,0.08)] transition-transform duration-[140ms] ease-out',
                policy?.taskAutoApprove && 'translate-x-[18px] border-[color-mix(in_srgb,var(--nb-accent-2),transparent_65%)]'
              )}
            />
          </div>
        </button>
      </Section>

      {/* Capabilities */}
      <Section>
        <SectionLabel>{t(lang, 'settings_capabilities')}</SectionLabel>
        <div className="flex flex-col gap-[10px]">
          {CAPABILITIES.map((c) => (
            <button
              key={c.id}
              type="button"
              className={cn(
                'w-full flex items-center justify-between gap-[12px] p-[12px] rounded-[14px] border border-[var(--nb-border)] bg-[var(--nb-panel)] cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-[0.65]',
                policy?.capabilities[c.id] &&
                  'border-[color-mix(in_srgb,var(--nb-accent-2),transparent_60%)] bg-[color-mix(in_srgb,var(--nb-accent-2),transparent_92%)]'
              )}
              onClick={() => handleToggleCapability(c.id)}
              disabled={!policy}
              title={c.desc}
            >
              <div className="flex flex-col min-w-0">
                <div className="text-[14px] font-semibold text-[color-mix(in_srgb,var(--nb-text),transparent_10%)]">
                  {c.title}
                </div>
                <div className="text-[12px] font-[520] text-[var(--nb-muted)]">{c.id}</div>
              </div>
              <div
                className={cn(
                  'w-[44px] h-[26px] rounded-full border border-[var(--nb-border)] bg-[color-mix(in_srgb,var(--nb-text),transparent_92%)] p-[3px] flex items-center justify-start',
                  policy?.capabilities[c.id] &&
                    'border-[color-mix(in_srgb,var(--nb-accent-2),transparent_60%)] bg-[color-mix(in_srgb,var(--nb-accent-2),transparent_78%)]'
                )}
                aria-hidden="true"
              >
                <div
                  className={cn(
                    'w-[18px] h-[18px] rounded-full bg-[var(--nb-panel-2)] border border-[var(--nb-border)] shadow-[0_10px_22px_rgba(0,0,0,0.08)] transition-transform duration-[140ms] ease-out',
                    policy?.capabilities[c.id] &&
                      'translate-x-[18px] border-[color-mix(in_srgb,var(--nb-accent-2),transparent_65%)]'
                  )}
                />
              </div>
            </button>
          ))}
        </div>
      </Section>

      {/* Trading Options */}
      <Section>
        <SectionLabel>Trading Options</SectionLabel>
        <div className="settingsField" style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Button type="button" variant="default" disabled>
            Polymarket
          </Button>
          <Button type="button" variant="default" disabled>
            Binance
          </Button>
        </div>
      </Section>
    </SettingsShell>
  )
}
