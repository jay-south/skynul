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
    <>
      <div className="settingsSection">
        <div className="settingsLabel">Shell Access</div>
        <button
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
      </div>

      <div className="settingsSection">
        <div className="settingsLabel">Workspace</div>
        <div className="pathBox" title={workspaceLabel}>
          {workspaceLabel}
        </div>
        <button className="btn" onClick={handlePickWorkspace}>
          {t(lang, 'settings_pick_workspace')}
        </button>
        <div className="settingsFieldHint">Working directory for shell commands</div>
      </div>
    </>
  )
}
