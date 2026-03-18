import type { Task } from '@skynul/shared'
import styles from './task-detail-view.module.css'
import { TaskStepLog } from './task-step-log'

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
    <div className={styles.taskDetail}>
      <div className={styles.taskDetailHeader}>
        <div className={styles.taskDetailPrompt}>{task.prompt}</div>
        <div className={styles.taskDetailMeta}>
          <span className={styles.taskDetailStatus}>
            {STATUS_LABELS[task.status] ?? task.status}
          </span>
          {task.steps.length > 0 && <span> · {task.steps.length} steps</span>}
          {task.error && <span className={styles.taskDetailError}> · {task.error}</span>}
          {task.summary && <span className={styles.taskDetailSummary}> · {task.summary}</span>}
        </div>
        <div className={styles.taskDetailActions}>
          {task.status === 'pending_approval' && (
            <>
              <button
                type="button"
                className={`btn ${styles.taskBtnApprove}`}
                onClick={props.onApprove}
              >
                Approve & Run
              </button>
              <button
                type="button"
                className={`btn ${styles.taskBtnCancel}`}
                onClick={props.onCancel}
              >
                Cancel
              </button>
            </>
          )}
          {task.status === 'running' && (
            <button
              type="button"
              className={`btn ${styles.taskBtnCancel}`}
              onClick={props.onCancel}
            >
              Stop Task
            </button>
          )}
        </div>
      </div>

      <div className={styles.taskDetailBody}>
        <div className={styles.taskScreenshot}>
          {lastStep ? (
            <img
              src={`data:image/png;base64,${lastStep.screenshotBase64}`}
              alt="Latest screenshot"
              className={styles.taskScreenshotImg}
            />
          ) : (
            <div className={styles.taskScreenshotEmpty}>
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
