import type { ChannelId, ChannelSettings, ChannelGlobalSettings } from '@skynul/shared'
import { apiFetch } from '@/lib/api-fetch'

export async function fetchChannels(): Promise<ChannelSettings[]> {
  const res = await apiFetch<{ channels: ChannelSettings[] }>('/channels')
  return res.channels
}

export async function fetchChannelGlobal(): Promise<ChannelGlobalSettings> {
  return apiFetch('/channels/global')
}

export async function setChannelEnabled(
  channelId: ChannelId,
  enabled: boolean
): Promise<ChannelSettings> {
  return apiFetch(`/channels/${channelId}/enabled`, {
    method: 'PUT',
    body: JSON.stringify({ enabled })
  })
}

export async function setChannelCredentials(
  channelId: ChannelId,
  creds: Record<string, string>
): Promise<void> {
  await apiFetch(`/channels/${channelId}/credentials`, {
    method: 'PUT',
    body: JSON.stringify(creds)
  })
}

export async function generateChannelPairing(channelId: ChannelId): Promise<string> {
  const res = await apiFetch<{ code: string }>(`/channels/${channelId}/pairing`, {
    method: 'POST'
  })
  return res.code
}

export async function unpairChannel(channelId: ChannelId): Promise<void> {
  await apiFetch(`/channels/${channelId}/pairing`, { method: 'DELETE' })
}

export async function setChannelAutoApprove(enabled: boolean): Promise<ChannelGlobalSettings> {
  return apiFetch('/channels/auto-approve', {
    method: 'PUT',
    body: JSON.stringify({ enabled })
  })
}
