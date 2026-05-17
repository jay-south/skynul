const API_BASE = 'http://localhost:3141/api'

/**
 * Authenticated fetch for the Skynul server API.
 * Attaches the Bearer token from Electron preload automatically.
 */
export async function apiFetch<T>(path: string, options?: RequestInit): Promise<T> {
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
    const error = await response.text()
    throw new Error(error || `HTTP ${response.status}`)
  }

  return response.json()
}
