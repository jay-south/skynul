import type { TaskMessageResponse } from '@shared'
import { stepsFromRecords } from '@/components/feature/chat/task-steps'

export function stepsFromMessage(message: TaskMessageResponse) {
  return stepsFromRecords(message.steps)
}

export { awaitingAssistantReply, conversationMessages } from '@/queries/tasks/utils'
