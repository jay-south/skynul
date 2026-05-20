import type { ChannelGlobalSettings, ChannelId, ChannelSettings } from '@skynul/shared'
import { api } from '@/lib/api'

export async function fetchChannels(): Promise<ChannelSettings[]> {
  const res = await api<{ channels: ChannelSettings[] }>('/channels')
  return res.channels
}

export async function fetchChannelGlobal(): Promise<ChannelGlobalSettings> {
  return api('/channels/global')
}

export async function setChannelEnabled(
  channelId: ChannelId,
  enabled: boolean
): Promise<ChannelSettings> {
  return api(`/channels/${channelId}/enabled`, {
    method: 'PUT',
    body: JSON.stringify({ enabled })
  })
}

export async function setChannelCredentials(
  channelId: ChannelId,
  creds: Record<string, string>
): Promise<void> {
  await api(`/channels/${channelId}/credentials`, {
    method: 'PUT',
    body: JSON.stringify(creds)
  })
}

export async function generateChannelPairing(channelId: ChannelId): Promise<string> {
  const res = await api<{ code: string }>(`/channels/${channelId}/pairing`, {
    method: 'POST'
  })
  return res.code
}

export async function unpairChannel(channelId: ChannelId): Promise<void> {
  await api(`/channels/${channelId}/pairing`, { method: 'DELETE' })
}

export async function setChannelAutoApprove(enabled: boolean): Promise<ChannelGlobalSettings> {
  return api('/channels/auto-approve', {
    method: 'PUT',
    body: JSON.stringify({ enabled })
  })
}
