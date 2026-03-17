import type { Schedule } from '../../../../shared/schedule'

export type ScheduleCreateRequest = {
  prompt: string
  frequency: string
  cronExpr: string
  enabled?: boolean
}

export type ScheduleListResponse = Schedule[]
