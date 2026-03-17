// Re-export from shared package — single source of truth
export type {
  TaskCapabilityId,
  TaskStatus,
  TaskAction,
  TaskStep,
  TaskSource,
  TaskMode,
  Task,
  TaskCreateRequest,
  TaskCreateResponse,
  TaskApproveRequest,
  TaskCancelRequest,
  TaskGetRequest,
  TaskListResponse,
  TaskUpdateEvent
} from '@skynul/shared'
export { ALL_TASK_CAPABILITIES } from '@skynul/shared'
