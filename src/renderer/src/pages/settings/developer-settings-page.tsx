import { Section, SectionLabel, SettingsShell } from '../../components/layout'
import { t } from '../../i18n'
import { usePickWorkspace, usePolicy, useSetCapability } from '../../queries'

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
          className={`cap ${policy?.capabilities['cmd.run'] ? 'on' : 'off'}`}
          onClick={handleToggleCmdRun}
          disabled={!policy}
        >
          <div className="capLeft">
            <div className="capTitle">Run Commands</div>
            <div className="capDesc">Allow the agent to execute shell commands</div>
          </div>
          <div className="capToggle" aria-hidden="true">
            <div className="capKnob" />
          </div>
        </button>
      </Section>

      <Section>
        <SectionLabel>Workspace</SectionLabel>
        <div className="pathBox" title={workspaceLabel}>
          {workspaceLabel}
        </div>
        <button type="button" className="btn" onClick={handlePickWorkspace}>
          {t(lang, 'settings_pick_workspace')}
        </button>
        <div className="settingsFieldHint">Working directory for shell commands</div>
      </Section>
    </SettingsShell>
  )
}
