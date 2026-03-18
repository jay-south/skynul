import { PathBox, Section, SectionField, SectionLabel } from '@/components/common'
import { CapabilityToggle } from '@/components/feature/settings'
import { t } from '@/i18n'
import { usePickWorkspace, usePolicy, useSetCapability } from '@/queries'

export function DeveloperSettingsPage(): React.JSX.Element {
  const { data: policy } = usePolicy()

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
    <>
      <Section>
        <SectionLabel>Shell Access</SectionLabel>
        <CapabilityToggle
          title="Run Commands"
          description="Allow the agent to execute shell commands"
          enabled={!!policy?.capabilities['cmd.run']}
          onToggle={handleToggleCmdRun}
          disabled={!policy}
        />
      </Section>

      <Section>
        <SectionLabel>Workspace</SectionLabel>
        <PathBox title={workspaceLabel}>{workspaceLabel}</PathBox>
        <button type="button" className="btn" onClick={handlePickWorkspace}>
          {t(lang, 'settings_pick_workspace')}
        </button>
        <SectionField>
          <div>Working directory for shell commands</div>
        </SectionField>
      </Section>
    </>
  )
}
