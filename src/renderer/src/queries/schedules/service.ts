import type { Schedule, ScheduleCreateRequest } from './types'
import { apiV1 } from '@/lib/api'

export async function fetchSchedules(): Promise<Schedule[]> {
  const res = await apiV1<{ schedules: Schedule[] }>('/schedules')
  return res.schedules
}

export async function createSchedule(data: ScheduleCreateRequest): Promise<Schedule[]> {
  const res = await apiV1<{ schedules: Schedule[] }>('/schedules', {
    method: 'POST',
    body: JSON.stringify(data)
  })
  return res.schedules
}

export async function toggleSchedule(id: string): Promise<Schedule[]> {
  const res = await apiV1<{ schedules: Schedule[] }>(`/schedules/${id}/toggle`, {
    method: 'PUT'
  })
  return res.schedules
}

export async function deleteSchedule(id: string): Promise<Schedule[]> {
  const res = await apiV1<{ schedules: Schedule[] }>(`/schedules/${id}`, {
    method: 'DELETE'
  })
  return res.schedules
}
