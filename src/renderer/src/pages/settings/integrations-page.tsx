import { ContentCard } from '@/components/content-card'
import { ChannelSettings } from '@/components/feature/settings'

export function IntegrationsPage(): React.JSX.Element {
  return (
    <div className="flex flex-col gap-4">
      <ContentCard
        title="Channels"
        description="Connect external platforms and messaging services."
      >
        <ChannelSettings />
      </ContentCard>
    </div>
  )
}
