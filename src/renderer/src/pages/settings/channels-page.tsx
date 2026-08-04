import { SettingsPageHeader, SettingsSection } from '@/components/feature/settings'
import { ChannelSettings } from '@/components/feature/settings/channel-settings'

export function ChannelsPage(): React.JSX.Element {
  return (
    <>
      <SettingsPageHeader
        title="Channels"
        description="Messaging platforms that create tasks through the same pipeline as the desktop app."
      />
      <SettingsSection>
        <ChannelSettings />
      </SettingsSection>
    </>
  )
}
