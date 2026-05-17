import type { TaskAction, Task } from '@skynul/shared'

export type InterTaskAPI = {
  list: () => Task[]
  get: (id: string) => Task | undefined
  spawnAndWait: (prompt: string, parentTaskId?: string, agentIdentity?: { agentName?: string; agentRole?: string }) => Promise<{ taskId: string; status: Task['status']; output: string; summary?: string; error?: string }>
  sendMessage: (targetId: string, fromId: string, message: string) => void
}

export async function handleInterTaskAction(action: TaskAction, api: InterTaskAPI, taskId: string): Promise<string> {
  const raw = action as Record<string, unknown>

  switch (raw.type as string) {
    case 'task_list_peers': {
      const all = api.list()
      const peers = all.filter((t) => t.id !== taskId).map((t) => ({ id: t.id, prompt: t.prompt.slice(0, 120), status: t.status }))
      return JSON.stringify(peers)
    }
    case 'task_send': {
      const result = await api.spawnAndWait(raw.prompt as string, taskId, {
        agentName: raw.agentName as string | undefined, agentRole: raw.agentRole as string | undefined,
      })
      return `Sub-task ${result.taskId} ${result.status}: ${result.output}`
    }
    case 'task_read': {
      const target = api.get(raw.taskId as string)
      if (!target) return `[Error: task ${raw.taskId} not found]`
      return JSON.stringify({ id: target.id, status: target.status, summary: target.summary ?? null })
    }
    case 'task_message': {
      try {
        api.sendMessage(raw.taskId as string, taskId, raw.message as string)
        return `Message sent to ${raw.taskId}`
      } catch (e) {
        return `[Error: ${e instanceof Error ? e.message : String(e)}]`
      }
    }
    default:
      return '[Error: unknown inter-task action]'
  }
}
