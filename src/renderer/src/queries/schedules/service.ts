import type { Schedule } from '@skynul/shared'
import type { ScheduleCreateRequest } from './types'

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

export async function fetchSchedules(): Promise<Schedule[]> {
  return api('/schedules')
}

export async function createSchedule(data: ScheduleCreateRequest): Promise<Schedule[]> {
  return api('/schedules', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

export async function toggleSchedule(id: string): Promise<Schedule[]> {
  return api(`/schedules/${id}/toggle`, { method: 'POST' })
}

export async function deleteSchedule(id: string): Promise<Schedule[]> {
  return api(`/schedules/${id}`, { method: 'DELETE' })
}
