import type { TaskAction } from '@skynul/shared'
import type { ActionContext } from './types'

export function handleSetIdentity(action: TaskAction, ctx: ActionContext): string {
  const raw = action as Record<string, unknown>
  if (raw.name && typeof raw.name === 'string') ctx.task.agentName = raw.name
  if (raw.role && typeof raw.role === 'string') ctx.task.agentRole = raw.role as string
  ctx.pushUpdate()
  return `Identity: ${ctx.task.agentName ?? ''}${ctx.task.agentRole ? ` (${ctx.task.agentRole})` : ''}`
}
