import { useMutation, useQuery } from '@tanstack/react-query'
import { useInvalidate } from '../invalidation'
import { channelsKeys } from './keys'
import {
  fetchChannels,
  generateChannelPairing,
  patchChannel,
  unpairChannel
} from './service'
import type { ChannelId } from './types'

export function useChannels() {
  return useQuery({ queryKey: channelsKeys.lists(), queryFn: fetchChannels })
}

export function useSetChannelEnabled() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ channelId, enabled }: { channelId: ChannelId; enabled: boolean }) =>
      patchChannel(channelId, { enabled }),
    onSuccess: () => invalidate(channelsKeys.lists())
  })
}

export function useSetChannelCredentials() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ channelId, creds }: { channelId: ChannelId; creds: Record<string, string> }) =>
      patchChannel(channelId, { credentials: creds }),
    onSuccess: () => invalidate(channelsKeys.lists())
  })
}

export function useGenerateChannelPairing() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: generateChannelPairing,
    onSuccess: () => invalidate(channelsKeys.lists())
  })
}

export function useUnpairChannel() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: unpairChannel,
    onSuccess: () => invalidate(channelsKeys.lists())
  })
}
