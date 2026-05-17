import type { Schedule } from '@skynul/shared'
import { apiFetch } from '@/lib/api-fetch'

type ScheduleCreateRequest = {
  prompt: string
  frequency: string
  cronExpr: string
  enabled?: boolean
}

export async function fetchSchedules(): Promise<Schedule[]> {
  const res = await apiFetch<{ schedules: Schedule[] }>('/schedules')
  return res.schedules
}

export async function createSchedule(data: ScheduleCreateRequest): Promise<Schedule[]> {
  const res = await apiFetch<{ schedules: Schedule[] }>('/schedules', {
    method: 'POST',
    body: JSON.stringify(data)
  })
  return res.schedules
}

export async function toggleSchedule(id: string): Promise<Schedule[]> {
  const res = await apiFetch<{ schedules: Schedule[] }>(`/schedules/${id}/toggle`, {
    method: 'PUT'
  })
  return res.schedules
}

export async function deleteSchedule(id: string): Promise<Schedule[]> {
  const res = await apiFetch<{ schedules: Schedule[] }>(`/schedules/${id}`, {
    method: 'DELETE'
  })
  return res.schedules
}
