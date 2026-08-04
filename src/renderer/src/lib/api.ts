const API_BASE = 'http://localhost:3141/api'
const API_V1 = `${API_BASE}/v1`
const API_V1_WS = API_V1.replace(/^http/, 'ws')

export { API_BASE, API_V1, API_V1_WS }

type ApiErrorBody = {
  error?: { code?: string; message?: string } | string
}

export async function api<T>(path: string, options?: RequestInit): Promise<T> {
  const token = window.skynul?.getAuthToken?.() ?? ''

  const response = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers
    }
  })

  if (!response.ok) {
    const text = await response.text()
    try {
      const parsed = JSON.parse(text) as ApiErrorBody
      const err = parsed.error
      if (typeof err === 'object' && err?.message) throw new Error(err.message)
      if (typeof err === 'string') throw new Error(err)
    } catch (e) {
      if (e instanceof Error && e.message !== text) throw e
    }
    throw new Error(text || `HTTP ${response.status}`)
  }

  return response.json()
}

export async function apiV1<T>(path: string, options?: RequestInit): Promise<T> {
  const token = window.skynul?.getAuthToken?.() ?? ''

  const response = await fetch(`${API_V1}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options?.headers
    }
  })

  if (!response.ok) {
    const text = await response.text()
    try {
      const parsed = JSON.parse(text) as ApiErrorBody
      const err = parsed.error
      if (typeof err === 'object' && err?.message) throw new Error(err.message)
      if (typeof err === 'string') throw new Error(err)
    } catch (e) {
      if (e instanceof Error && e.message !== text) throw e
    }
    throw new Error(text || `HTTP ${response.status}`)
  }

  if (response.status === 204) {
    return undefined as T
  }

  return response.json()
}
