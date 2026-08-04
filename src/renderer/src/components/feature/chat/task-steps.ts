import type { TaskResponse, TaskStreamStep } from '@shared'

export type TaskStepRecord = NonNullable<TaskResponse['steps']>[number]

export function formatStepLabel(tool: string, argsJson?: string): string {
  if (!argsJson) return tool
  try {
    const args = JSON.parse(argsJson) as Record<string, string>
    switch (tool) {
      case 'bash':
        return args.command?.slice(0, 80) ?? tool
      case 'find':
      case 'glob':
        return [args.pattern, args.path].filter(Boolean).join(' · ') || tool
      case 'grep':
        return [args.pattern, args.path].filter(Boolean).join(' · ') || tool
      case 'read':
      case 'write':
      case 'edit':
        return args.path ?? tool
      case 'ls':
        return args.path ?? tool
      case 'fetch':
        return args.url?.slice(0, 80) ?? tool
      default:
        return argsJson.slice(0, 60)
    }
  } catch {
    return argsJson.slice(0, 60)
  }
}

export function stepsFromRecords(steps: TaskStepRecord[] | undefined): TaskStreamStep[] {
  if (!steps?.length) return []
  return steps.map((step) => ({
    tool: step.tool,
    label: formatStepLabel(step.tool, step.arguments),
    ok: !step.error
  }))
}

export function stepsFromTask(task: TaskResponse): TaskStreamStep[] {
  return stepsFromRecords(task.steps)
}
