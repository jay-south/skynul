import type { CapabilityId, LanguageCode, ProviderId, ThemeMode } from "@skynul/shared"
import { useMutation, useQuery } from "@tanstack/react-query"
import { policyKeys } from "./keys"
import { useInvalidate } from "../invalidation"
import { fetchPolicy, pickWorkspace, setAutoApprove, setCapability, setLanguage, setOpenAIModel, setProvider, setTaskMemory, setTheme } from "./service"

export function usePolicy() {
  return useQuery({ queryKey: policyKeys.detail(), queryFn: fetchPolicy })
}

function useInvalidatePolicy() {
  const invalidate = useInvalidate()
  return () => invalidate(policyKeys.detail())
}

export function useSetLanguage() {
  const invalidate = useInvalidatePolicy()
  return useMutation({ mutationFn: (language: LanguageCode) => setLanguage({ language }), onSuccess: invalidate })
}

export function useSetTheme() {
  const invalidate = useInvalidatePolicy()
  return useMutation({ mutationFn: (themeMode: ThemeMode) => setTheme({ themeMode }), onSuccess: invalidate })
}

export function useSetCapability() {
  const invalidate = useInvalidatePolicy()
  return useMutation({ mutationFn: ({ capability, enabled }: { capability: CapabilityId; enabled: boolean }) => setCapability({ capability, enabled }), onSuccess: invalidate })
}

export function useSetTaskMemory() {
  const invalidate = useInvalidatePolicy()
  return useMutation({ mutationFn: (enabled: boolean) => setTaskMemory({ enabled }), onSuccess: invalidate })
}

export function useSetAutoApprove() {
  const invalidate = useInvalidatePolicy()
  return useMutation({ mutationFn: (enabled: boolean) => setAutoApprove({ enabled }), onSuccess: invalidate })
}

export function useSetProvider() {
  const invalidate = useInvalidatePolicy()
  return useMutation({ mutationFn: (providerId: ProviderId) => setProvider({ providerId }), onSuccess: invalidate })
}

export function usePickWorkspace() {
  const invalidate = useInvalidatePolicy()
  return useMutation({ mutationFn: pickWorkspace, onSuccess: invalidate })
}

export function useSetOpenAIModel() {
  const invalidate = useInvalidatePolicy()
  return useMutation({ mutationFn: (model: string) => setOpenAIModel({ model }), onSuccess: invalidate })
}
