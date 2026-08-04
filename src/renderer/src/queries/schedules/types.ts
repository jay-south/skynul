export type { Schedule, ScheduleFrequency } from '@shared'

export type ScheduleCreateRequest = {
  prompt: string
  frequency: string
  cronExpr: string
  enabled?: boolean
}
