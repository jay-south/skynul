import type { ChannelId, ChannelSettings } from './types'
import { apiV1 } from '@/lib/api'

export async function fetchChannels(): Promise<ChannelSettings[]> {
  const res = await apiV1<{ channels: ChannelSettings[] }>('/channels')
  return res.channels as ChannelSettings[]
}

export async function fetchChannel(channelId: ChannelId): Promise<ChannelSettings> {
  return apiV1(`/channels/${channelId}`) as Promise<ChannelSettings>
}

export async function patchChannel(
  channelId: ChannelId,
  data: { enabled?: boolean; credentials?: Record<string, string> }
): Promise<ChannelSettings> {
  return apiV1(`/channels/${channelId}`, {
    method: 'PATCH',
    body: JSON.stringify(data)
  }) as Promise<ChannelSettings>
}

export async function generateChannelPairing(channelId: ChannelId): Promise<string> {
  const res = await apiV1<{ code: string }>(`/channels/${channelId}/pairing`, {
    method: 'POST'
  })
  return res.code
}

export async function unpairChannel(channelId: ChannelId): Promise<ChannelSettings> {
  return apiV1(`/channels/${channelId}/pairing`, { method: 'DELETE' }) as Promise<ChannelSettings>
}
