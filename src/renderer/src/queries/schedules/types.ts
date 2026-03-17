import type { Schedule } from '@skynul/shared'

export type ScheduleCreateRequest = {
  prompt: string
  frequency: string
  cronExpr: string
  enabled?: boolean
}

export type ScheduleListResponse = Schedule[]
