import type { PolicyState } from '../../../../shared/policy'
import type {
  SetLanguageRequest,
  SetThemeRequest,
  SetCapabilityRequest,
  SetTaskMemoryRequest,
  SetAutoApproveRequest,
  SetProviderRequest
} from './types'

const API_BASE = 'http://localhost:3141/api'

async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options?.headers
    }
  })

  if (!response.ok) {
    const error = await response.text()
    throw new Error(error || `HTTP ${response.status}`)
  }

  return response.json()
}

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

export async function setTaskMemory(data: SetTaskMemoryRequest): Promise<PolicyState> {
  return api('/policy/task-memory', {
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

export async function pickWorkspace(): Promise<PolicyState> {
  return api('/policy/workspace', { method: 'POST' })
}
