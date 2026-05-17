import type { TaskAction } from '@skynul/shared'
import { saveFact, deleteFact } from '../task-memory'

export function handleFactAction(action: TaskAction): string {
  if (action.type === 'remember_fact') {
    if (!action.fact || typeof action.fact !== 'string')
      return '[Error: "fact" string required]'
    saveFact(action.fact)
    return `Remembered: "${action.fact}"`
  }
  if (action.type === 'forget_fact') {
    if (typeof action.factId !== 'number')
      return '[Error: "factId" number required]'
    deleteFact(action.factId)
    return `Forgot fact #${action.factId}`
  }
  return '[Error: unknown fact action]'
}
