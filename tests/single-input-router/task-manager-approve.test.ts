import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { TaskManager } from '../../src/main/agent/task-manager'
import type { TaskEnvelopeInternal } from '../../src/main/agent/task-envelope'

test('approve() validates restrict-only chain plans and rejects capability escalation', async () => {
  const userData = await mkdtemp(join(tmpdir(), 'skynul-test-userData-'))
  const prev = process.env.SKYNUL_TEST_USERDATA
  process.env.SKYNUL_TEST_USERDATA = userData

  try {
    const tm = new TaskManager()
    const task = tm.create({
      prompt: 'Do something that routes to a chain plan',
      capabilities: ['browser.cdp']
    })

    const escalatedInternal: TaskEnvelopeInternal = {
      intent: 'automation',
      mode: 'browser',
      intentCaps: ['browser.cdp'],
      contextRefs: [],
      chainPlan: {
        steps: [
          {
            id: 'step_1',
            kind: 'subtask',
            prompt: 'Escalate to app.launch (should be rejected)',
            mode: 'code',
            capabilities: ['app.launch']
          }
        ]
      },
      internalPrompt: 'internal'
    }

    ;(
      tm as unknown as { internalEnvelopes: Map<string, TaskEnvelopeInternal> }
    ).internalEnvelopes.set(task.id, escalatedInternal)

    await assert.rejects(
      async () => tm.approve(task.id),
      /Invalid chain plan: step step_1 requires capability app\.launch not present in parent task/i
    )

    assert.equal(tm.get(task.id)?.status, 'pending_approval')
  } finally {
    if (prev === undefined) delete process.env.SKYNUL_TEST_USERDATA
    else process.env.SKYNUL_TEST_USERDATA = prev
  }
})

test('approve() rejects internal tasks (no internal runners via approve)', async () => {
  const userData = await mkdtemp(join(tmpdir(), 'skynul-test-userData-'))
  const prev = process.env.SKYNUL_TEST_USERDATA
  process.env.SKYNUL_TEST_USERDATA = userData

  try {
    const tm = new TaskManager()

    const task = (
      tm as unknown as { createInternal: (req: { prompt: string; capabilities: any[] }) => any }
    ).createInternal({
      prompt: 'Internal subtask (must not be approvable)',
      capabilities: ['browser.cdp']
    })

    await assert.rejects(async () => tm.approve(task.id), /Cannot approve internal task/i)
    assert.equal(tm.get(task.id)?.status, 'pending_approval')
  } finally {
    if (prev === undefined) delete process.env.SKYNUL_TEST_USERDATA
    else process.env.SKYNUL_TEST_USERDATA = prev
  }
})
