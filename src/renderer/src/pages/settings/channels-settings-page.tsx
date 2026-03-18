import { SettingsShell } from '../../components/layout'
import { ChannelSettings } from '../../components/ChannelSettings'

export function ChannelsSettingsPage(): React.JSX.Element {
  return (
    <SettingsShell>
      <ChannelSettings />
    </SettingsShell>
  )
}
