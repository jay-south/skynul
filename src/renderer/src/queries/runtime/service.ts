import { apiFetch } from '@/lib/api-fetch'

export type RuntimeStats = {
  app: {
    cpuPercent: number
    memoryMB: number
  }
  system: {
    freeMemMB: number
  }
}

export async function fetchRuntimeStats(): Promise<RuntimeStats> {
  return apiFetch('/runtime/stats')
}
