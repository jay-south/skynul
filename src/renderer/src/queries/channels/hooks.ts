import { useMutation, useQuery } from '@tanstack/react-query'
import { useInvalidate } from '../invalidation'
import { channelsKeys } from './keys'
import {
  fetchChannelGlobal,
  fetchChannels,
  generateChannelPairing,
  setChannelAutoApprove,
  setChannelCredentials,
  setChannelEnabled,
  unpairChannel
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
    mutationFn: ({
      channelId,
      enabled
    }: {
      channelId: import('@skynul/shared').ChannelId
      enabled: boolean
    }) => setChannelEnabled(channelId, enabled),
    onSuccess: () => invalidate(channelsKeys.lists())
  })
}

export function useSetChannelCredentials() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: ({
      channelId,
      creds
    }: {
      channelId: import('@skynul/shared').ChannelId
      creds: Record<string, string>
    }) => setChannelCredentials(channelId, creds),
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

export function useSetChannelAutoApprove() {
  const invalidate = useInvalidate()
  return useMutation({
    mutationFn: setChannelAutoApprove,
    onSuccess: () => invalidate(channelsKeys.global())
  })
}
