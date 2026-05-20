import { ContentCard } from '@/components/content-card'
import { CapabilityToggle } from '@/components/feature/settings'
import { usePolicy, useSetCapability } from '@/queries'

export function DeveloperPage(): React.JSX.Element {
  const { data: policy } = usePolicy()
  const setCapabilityMutation = useSetCapability()

  const handleToggleCmdRun = () => {
    if (!policy) return
    setCapabilityMutation.mutate({
      capability: 'cmd.run',
      enabled: !policy.capabilities['cmd.run']
    })
  }

  return (
    <div className="flex flex-col gap-4">
      <ContentCard
        title="Shell Access"
        description="Allow the agent to execute shell commands on your system."
      >
        <CapabilityToggle
          title="Run Commands"
          description="Enable the agent to run shell commands"
          enabled={!!policy?.capabilities['cmd.run']}
          onToggle={handleToggleCmdRun}
          disabled={!policy}
        />
      </ContentCard>

      <ContentCard title="Debug" description="Additional developer options and logs.">
        <div className="text-xs text-nb-muted">More developer options coming soon.</div>
      </ContentCard>
    </div>
  )
}
