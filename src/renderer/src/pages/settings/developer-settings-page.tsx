import { Section, SectionLabel, SettingsShell } from '../../components/layout'
import { Button } from '../../components/ui/button'
import { t } from '../../i18n'
import { usePickWorkspace, usePolicy, useSetCapability } from '../../queries'
import { cn } from '../../lib/utils'

export function DeveloperSettingsPage(): React.JSX.Element {
  // Queries
  const { data: policy } = usePolicy()

  // Mutations
  const setCapabilityMutation = useSetCapability()
  const pickWorkspaceMutation = usePickWorkspace()

  const lang = policy?.language ?? 'en'

  const handleToggleCmdRun = () => {
    if (!policy) return
    setCapabilityMutation.mutate({
      capability: 'cmd.run',
      enabled: !policy.capabilities['cmd.run']
    })
  }

  const handlePickWorkspace = () => {
    pickWorkspaceMutation.mutate()
  }

  const workspaceLabel = policy?.workspaceRoot ?? 'No workspace'

  return (
    <SettingsShell>
      <Section>
        <SectionLabel>Shell Access</SectionLabel>
        <button
          type="button"
            className={cn(
              'w-full flex items-center justify-between gap-[12px] p-[12px] rounded-[14px] border border-[var(--nb-border)] bg-[var(--nb-panel)] cursor-pointer text-left disabled:cursor-not-allowed disabled:opacity-[0.65]',
              policy?.capabilities['cmd.run'] &&
                'border-[color-mix(in_srgb,var(--nb-accent-2),transparent_60%)] bg-[color-mix(in_srgb,var(--nb-accent-2),transparent_92%)]'
            )}
          onClick={handleToggleCmdRun}
          disabled={!policy}
        >
            <div className="flex flex-col min-w-0">
              <div className="text-[14px] font-semibold text-[color-mix(in_srgb,var(--nb-text),transparent_10%)]">
                Run Commands
              </div>
              <div className="text-[12px] font-[520] text-[var(--nb-muted)]">
                Allow the agent to execute shell commands
              </div>
          </div>
            <div
              aria-hidden="true"
              className={cn(
                'w-[44px] h-[26px] rounded-full border border-[var(--nb-border)] bg-[color-mix(in_srgb,var(--nb-text),transparent_92%)] p-[3px] flex items-center justify-start',
                policy?.capabilities['cmd.run'] &&
                  'border-[color-mix(in_srgb,var(--nb-accent-2),transparent_60%)] bg-[color-mix(in_srgb,var(--nb-accent-2),transparent_78%)]'
              )}
            >
              <div
                className={cn(
                  'w-[18px] h-[18px] rounded-full bg-[var(--nb-panel-2)] border border-[var(--nb-border)] shadow-[0_10px_22px_rgba(0,0,0,0.08)] transition-transform duration-[140ms] ease-out',
                  policy?.capabilities['cmd.run'] &&
                    'translate-x-[18px] border-[color-mix(in_srgb,var(--nb-accent-2),transparent_65%)]'
                )}
              />
          </div>
        </button>
      </Section>

      <Section>
        <SectionLabel>Workspace</SectionLabel>
        <div className="pathBox" title={workspaceLabel}>
          {workspaceLabel}
        </div>
        <Button type="button" variant="default" onClick={handlePickWorkspace}>
          {t(lang, 'settings_pick_workspace')}
        </Button>
        <div className="settingsFieldHint">Working directory for shell commands</div>
      </Section>
    </SettingsShell>
  )
}
