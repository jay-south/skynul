import type { PolicyState } from '@skynul/shared'
import { api } from '@/lib/api'
import type {
  SetAutoApproveRequest,
  SetCapabilityRequest,
  SetLanguageRequest,
  SetProviderRequest,
  SetThemeRequest
} from './types'

export async function fetchPolicy(): Promise<PolicyState> {
  return api('/policy')
}

export async function setLanguage(data: SetLanguageRequest): Promise<PolicyState> {
  return api('/policy/language', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function setTheme(data: SetThemeRequest): Promise<PolicyState> {
  return api('/policy/theme', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function setCapability(data: SetCapabilityRequest): Promise<PolicyState> {
  return api('/policy/capability', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function setAutoApprove(data: SetAutoApproveRequest): Promise<PolicyState> {
  return api('/policy/auto-approve', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function setProvider(data: SetProviderRequest): Promise<PolicyState> {
  return api('/policy/provider', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function setProviderModel(data: { model: string }): Promise<PolicyState> {
  return api('/policy/provider/model', {
    method: 'PUT',
    body: JSON.stringify(data)
  })
}

export async function pickWorkspace(): Promise<PolicyState> {
  return api('/policy/workspace', { method: 'POST' })
}
