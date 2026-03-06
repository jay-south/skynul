import test from 'node:test'
import assert from 'node:assert/strict'
import { toRendererTaskList } from '../../src/main/agent/task-public'
import type { Task } from '../../src/shared/task'

function makeTask(partial: Partial<Task> & { id: string; prompt: string }): Task {
  return {
    id: partial.id,
    prompt: partial.prompt,
    status: partial.status ?? 'pending_approval',
    mode: partial.mode ?? 'browser',
    capabilities: partial.capabilities ?? [],
    steps: partial.steps ?? [],
    createdAt: partial.createdAt ?? 1,
    updatedAt: partial.updatedAt ?? 1,
    maxSteps: partial.maxSteps ?? 10,
    timeoutMs: partial.timeoutMs ?? 10_000,
    visibility: partial.visibility,
    parentTaskId: partial.parentTaskId,
    usage: partial.usage,
    error: partial.error,
    summary: partial.summary,
    source: partial.source
  }
}

test('task list payload excludes internal tasks (no UI leak)', () => {
  const visible = makeTask({ id: 't_visible', prompt: 'user prompt' })
  const internal = makeTask({
    id: 't_internal',
    prompt: 'internal subtask prompt (must not leak)',
    visibility: 'internal'
  })

  const listed = toRendererTaskList([visible, internal])
  assert.deepStrictEqual(
    listed.map((t) => t.id),
    ['t_visible']
  )
  assert.equal(
    listed.some((t) => t.prompt.includes('must not leak')),
    false
  )
})
