import { useMutation, useQuery } from '@tanstack/react-query'
import { channelsKeys } from './keys'
import { useInvalidate } from '../invalidation'
import {
  fetchChannels, fetchChannelGlobal, setChannelEnabled, setChannelCredentials,
  generateChannelPairing, unpairChannel, setChannelAutoApprove
} from './service'

export function useChannels() {
  return useQuery({ queryKey: channelsKeys.lists(), queryFn: fetchChannels })
}

export function useChannelGlobal() {
  return useQuery({ queryKey: channelsKeys.global(), queryFn: fetchChannelGlobal })
}

export function useSetChannelEnabled() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({ channelId, enabled }: { channelId: import('@skynul/shared').ChannelId; enabled: boolean }) => setChannelEnabled(channelId, enabled),
    onSuccess: () => invalidate(channelsKeys.lists())
  })
}

export function useSetChannelCredentials() {
  return useMutation({
    mutationFn: ({ channelId, creds }: { channelId: import('@skynul/shared').ChannelId; creds: Record<string, string> }) => setChannelCredentials(channelId, creds)
  })
}

export function useGenerateChannelPairing() {
  return useMutation({ mutationFn: generateChannelPairing })
}

export function useUnpairChannel() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: unpairChannel, onSuccess: () => invalidate(channelsKeys.lists()) })
}

export function useSetChannelAutoApprove() {
  const invalidate = useInvalidate()
  return useMutation({ mutationFn: setChannelAutoApprove, onSuccess: () => invalidate(channelsKeys.global()) })
}
