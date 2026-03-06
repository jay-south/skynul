import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { TaskEnvelopeStore } from '../../src/main/agent/task-envelope-store'
import type { TaskEnvelopeInternal } from '../../src/main/agent/task-envelope'

test('TaskEnvelopeStore roundtrips internal envelopes keyed by taskId', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'skynul-test-'))
  const filePath = join(dir, 'tasks-internal.json')

  const store = new TaskEnvelopeStore(filePath)

  const internal: TaskEnvelopeInternal = {
    intent: 'dev',
    mode: 'code',
    intentCaps: ['office.professional'],
    contextRefs: [{ kind: 'file', ref: 'src/main/ipc.ts', hint: 'task list handler' }],
    chainPlan: { steps: [] },
    internalPrompt: 'Fix the task list handler.'
  }

  await store.saveAll({ task_1: internal })
  const loaded = await store.loadAll()

  assert.deepStrictEqual(loaded.task_1, internal)
})
