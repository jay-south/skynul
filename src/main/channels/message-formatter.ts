import type { Task } from '../../shared/task'

const STATUS_EMOJI: Record<string, string> = {
  pending_approval: '\u23f3',
  approved: '\u2705',
  running: '\u25b6\ufe0f',
  completed: '\u2705',
  failed: '\u274c',
  cancelled: '\u26d4'
}

function statusIcon(status: string): string {
  return STATUS_EMOJI[status] ?? '\u2753'
}

function truncate(text: string, max: number): string {
  return text.length > max ? text.slice(0, max - 1) + '\u2026' : text
}

export function formatTaskSummary(task: Task): string {
  return [
    `${statusIcon(task.status)} *Task created*`,
    `ID: \`${task.id}\``,
    `Prompt: ${truncate(task.prompt, 200)}`,
    `Status: ${task.status}`
  ].join('\n')
}

export function formatStepUpdate(task: Task): string {
  const step = task.steps[task.steps.length - 1]
  const thought = step?.thought ? `\nThought: ${truncate(step.thought, 150)}` : ''
  const action = step ? `\nAction: \`${step.action.type}\`` : ''
  return [
    `\u25b6\ufe0f *Step ${task.steps.length}/${task.maxSteps}*`,
    `Task: \`${task.id}\`${thought}${action}`
  ].join('\n')
}

export function formatTaskComplete(task: Task): string {
  const summary = task.summary ? `\nSummary: ${truncate(task.summary, 300)}` : ''
  return [
    `\u2705 *Task completed*`,
    `ID: \`${task.id}\``,
    `Steps: ${task.steps.length}${summary}`
  ].join('\n')
}

export function formatTaskFailed(task: Task): string {
  const error = task.error ? `\nError: ${truncate(task.error, 200)}` : ''
  return [
    `\u274c *Task failed*`,
    `ID: \`${task.id}\``,
    `Steps: ${task.steps.length}${error}`
  ].join('\n')
}

export function formatTaskList(tasks: Task[]): string {
  if (tasks.length === 0) return 'No tasks found.'

  const lines = tasks.slice(0, 10).map((t) => {
    return `${statusIcon(t.status)} \`${t.id}\` — ${truncate(t.prompt, 60)} [${t.status}]`
  })

  if (tasks.length > 10) {
    lines.push(`\n_...and ${tasks.length - 10} more_`)
  }

  return lines.join('\n')
}
