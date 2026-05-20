import { api } from '@/lib/api'

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
  return api('/runtime/stats')
}
