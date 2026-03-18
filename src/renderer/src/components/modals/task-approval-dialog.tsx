import type { Task } from '@skynul/shared'
import { ALL_TASK_CAPABILITIES } from '@skynul/shared'
import styles from './modal.module.css'

export function TaskApprovalDialog(props: {
  task: Task
  onApprove: () => void
  onCancel: () => void
}): React.JSX.Element {
  const { task } = props

  return (
    <div className={styles.modalBackdrop} onMouseDown={props.onCancel}>
      <div
        className={styles.modal}
        style={{ width: 520 }}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className={styles.modalHeader}>
          <div className={styles.modalTitle}>Approve Task</div>
          <button className={styles.modalClose} onClick={props.onCancel} aria-label="Close">
            ×
          </button>
        </div>
        <div className={styles.modalBody} style={{ gridTemplateColumns: '1fr' }}>
          <div className={styles.modalSection}>
            <div className={styles.modalLabel}>Task</div>
            <div className={styles.taskApprovalPrompt}>{task.prompt}</div>
          </div>
          <div className={styles.modalSection}>
            <div className={styles.modalLabel}>Capabilities Requested</div>
            <div className={styles.taskCapList}>
              {task.capabilities.map((capId) => {
                const cap = ALL_TASK_CAPABILITIES.find((c) => c.id === capId)
                return (
                  <div key={capId} className={`${styles.taskCapChip} ${styles.on}`}>
                    {cap?.title ?? capId}
                  </div>
                )
              })}
            </div>
          </div>
          <div className={styles.modalSection}>
            <div className={styles.modalLabel}>Limits</div>
            <div className={styles.taskApprovalLimits}>
              Max {task.maxSteps} steps · Timeout {Math.round(task.timeoutMs / 1000)}s
            </div>
          </div>
          <div className={styles.taskApprovalActions}>
            <button
              type="button"
              className={`btn ${styles.taskBtnCancel}`}
              onClick={props.onCancel}
            >
              Cancel
            </button>
            <button
              type="button"
              className={`btn ${styles.taskBtnApprove}`}
              onClick={props.onApprove}
            >
              Approve & Run
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
