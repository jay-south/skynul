import type { RuntimeStats } from './types'
import { apiV1 } from '@/lib/api'

export async function fetchRuntimeStats(): Promise<RuntimeStats> {
  return apiV1('/runtime/stats')
}
