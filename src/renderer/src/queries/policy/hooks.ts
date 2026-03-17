import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { policyKeys } from './keys'
import {
  fetchPolicy,
  setLanguage,
  setTheme,
  setCapability,
  setTaskMemory,
  setAutoApprove,
  setProvider,
  pickWorkspace
} from './service'
import type { LanguageCode, ThemeMode, CapabilityId, ProviderId } from '../../../../shared/policy'

// ═══════════════════════════════════════════════════════════════════════════════
// QUERIES
// ═══════════════════════════════════════════════════════════════════════════════

export function usePolicy() {
  return useQuery({
    queryKey: policyKeys.detail(),
    queryFn: fetchPolicy
  })
}

// ═══════════════════════════════════════════════════════════════════════════════
// MUTATIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function useSetLanguage() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (language: LanguageCode) => setLanguage({ language }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: policyKeys.detail() })
    }
  })
}

export function useSetTheme() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (themeMode: ThemeMode) => setTheme({ themeMode }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: policyKeys.detail() })
    }
  })
}

export function useSetCapability() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ capability, enabled }: { capability: CapabilityId; enabled: boolean }) =>
      setCapability({ capability, enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: policyKeys.detail() })
    }
  })
}

export function useSetTaskMemory() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (enabled: boolean) => setTaskMemory({ enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: policyKeys.detail() })
    }
  })
}

export function useSetAutoApprove() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (enabled: boolean) => setAutoApprove({ enabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: policyKeys.detail() })
    }
  })
}

export function useSetProvider() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (providerId: ProviderId) => setProvider({ providerId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: policyKeys.detail() })
    }
  })
}

export function usePickWorkspace() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: pickWorkspace,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: policyKeys.detail() })
    }
  })
}
