import type { Task } from '@skynul/shared'
import { TaskStepLog } from './TaskStepLog'

const STATUS_LABELS: Record<string, string> = {
  pending_approval: 'Pending Approval',
  approved: 'Approved',
  running: 'Running',
  completed: 'Completed',
  failed: 'Failed',
  cancelled: 'Cancelled'
}

export function TaskDetailView(props: {
  task: Task
  onApprove: () => void
  onCancel: () => void
}): React.JSX.Element {
  const { task } = props
  const lastStep = task.steps[task.steps.length - 1]

  return (
    <div className="taskDetail">
      <div className="taskDetailHeader">
        <div className="taskDetailPrompt">{task.prompt}</div>
        <div className="taskDetailMeta">
          <span className="taskDetailStatus">{STATUS_LABELS[task.status] ?? task.status}</span>
          {task.steps.length > 0 && <span> · {task.steps.length} steps</span>}
          {task.error && <span className="taskDetailError"> · {task.error}</span>}
          {task.summary && <span className="taskDetailSummary"> · {task.summary}</span>}
        </div>
        <div className="taskDetailActions">
          {task.status === 'pending_approval' && (
            <>
              <button className="btn taskBtnApprove" onClick={props.onApprove}>
                Approve & Run
              </button>
              <button className="btn taskBtnCancel" onClick={props.onCancel}>
                Cancel
              </button>
            </>
          )}
          {task.status === 'running' && (
            <button className="btn taskBtnCancel" onClick={props.onCancel}>
              Stop Task
            </button>
          )}
        </div>
      </div>

      <div className="taskDetailBody">
        <div className="taskScreenshot">
          {lastStep ? (
            <img
              src={`data:image/png;base64,${lastStep.screenshotBase64}`}
              alt="Latest screenshot"
              className="taskScreenshotImg"
            />
          ) : (
            <div className="taskScreenshotEmpty">
              {task.status === 'pending_approval'
                ? 'Approve the task to start'
                : task.status === 'running'
                  ? task.summary || 'Starting...'
                  : task.status === 'failed'
                    ? task.error || 'Task failed'
                    : 'No screenshots'}
            </div>
          )}
        </div>

        <TaskStepLog steps={task.steps} />
      </div>
    </div>
  )
}
