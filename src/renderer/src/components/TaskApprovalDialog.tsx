import type { Task } from '../../../shared/task'
import { ALL_TASK_CAPABILITIES } from '../../../shared/task'

export function TaskApprovalDialog(props: {
  task: Task
  onApprove: () => void
  onCancel: () => void
}): React.JSX.Element {
  const { task } = props

  return (
    <div className="modalBackdrop" onMouseDown={props.onCancel}>
      <div
        className="modal"
        style={{ width: 520 }}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <div className="modalHeader">
          <div className="modalTitle">Approve Task</div>
          <button className="modalClose" onClick={props.onCancel} aria-label="Close">
            ×
          </button>
        </div>
        <div className="modalBody" style={{ gridTemplateColumns: '1fr' }}>
          <div className="modalSection">
            <div className="modalLabel">Task</div>
            <div className="taskApprovalPrompt">{task.prompt}</div>
          </div>
          <div className="modalSection">
            <div className="modalLabel">Capabilities Requested</div>
            <div className="taskCapList">
              {task.capabilities.map((capId) => {
                const cap = ALL_TASK_CAPABILITIES.find((c) => c.id === capId)
                return (
                  <div key={capId} className="taskCapChip on">
                    {cap?.title ?? capId}
                  </div>
                )
              })}
            </div>
          </div>
          <div className="modalSection">
            <div className="modalLabel">Limits</div>
            <div className="taskApprovalLimits">
              Max {task.maxSteps} steps · Timeout {Math.round(task.timeoutMs / 1000)}s
            </div>
          </div>
          <div className="taskApprovalActions">
            <button className="btn taskBtnCancel" onClick={props.onCancel}>
              Cancel
            </button>
            <button className="btn taskBtnApprove" onClick={props.onApprove}>
              Approve & Run
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
