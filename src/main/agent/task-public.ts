import type { Task } from '../../shared/task'

export function isInternalTask(task: Task): boolean {
  return task.visibility === 'internal'
}

export function toRendererTask(task: Task): Task | null {
  if (isInternalTask(task)) return null
  if (!('visibility' in task)) return task
  // Strip visibility on the wire (keep renderer contract minimal)
  const { visibility: _visibility, ...rest } = task as Task & { visibility?: unknown }
  return rest as Task
}

export function toRendererTaskList(tasks: Task[]): Task[] {
  const out: Task[] = []
  for (const t of tasks) {
    const safe = toRendererTask(t)
    if (safe) out.push(safe)
  }
  return out
}
