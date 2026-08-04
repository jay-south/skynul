import type { TaskStreamEvent } from '@shared'
import { API_V1_WS } from '@/lib/api'

export type TaskStreamHandlers = {
  onEvent?: (event: TaskStreamEvent) => void
  onError?: (error: Event) => void
  onClose?: () => void
}

export function connectTaskStream(taskId: string, handlers: TaskStreamHandlers = {}): () => void {
  const ws = new WebSocket(`${API_V1_WS}/tasks/${taskId}/stream`)

  ws.onmessage = (message) => {
    try {
      const event = JSON.parse(String(message.data)) as TaskStreamEvent
      handlers.onEvent?.(event)
    } catch {
      // ignore malformed frames
    }
  }

  ws.onerror = (error) => {
    handlers.onError?.(error)
  }

  ws.onclose = () => {
    handlers.onClose?.()
  }

  return () => {
    ws.close()
  }
}
