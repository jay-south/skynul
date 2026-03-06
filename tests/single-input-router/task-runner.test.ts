import test from 'node:test'
import assert from 'node:assert/strict'
import { mkdtemp } from 'fs/promises'
import { tmpdir } from 'os'
import { join } from 'path'
import { TaskRunner } from '../../src/main/agent/task-runner'
import type { Task } from '../../src/shared/task'

function makeTask(partial: Partial<Task> & { id: string; prompt: string }): Task {
  return {
    id: partial.id,
    prompt: partial.prompt,
    status: partial.status ?? 'pending_approval',
    mode: partial.mode ?? 'code',
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

test('TaskRunner uses executionPrompt for the model while keeping task.prompt unchanged', async () => {
  const task = makeTask({ id: 't1', prompt: 'DISPLAY PROMPT', mode: 'code' })

  const runner = new TaskRunner(
    task,
    {
      provider: 'chatgpt',
      openaiModel: 'gpt-4.1',
      executionPrompt: 'INTERNAL EXECUTION PROMPT',
      policy: {
        workspaceRoot: null,
        capabilities: { 'fs.read': false, 'fs.write': false, 'cmd.run': false, 'net.http': false }
      }
    },
    {
      onUpdate: () => {
        /* no-op */
      }
    }
  )

  assert.equal(runner.getTask().prompt, 'DISPLAY PROMPT')
  assert.equal(
    (runner as unknown as { executionPrompt: string }).executionPrompt,
    'INTERNAL EXECUTION PROMPT'
  )
})

test('TaskRunner policy enforcement denies file_write when fs.write is disabled', async () => {
  const workspaceRoot = await mkdtemp(join(tmpdir(), 'skynul-test-workspace-'))
  const task = makeTask({ id: 't2', prompt: 'Write a file', mode: 'code' })

  const runner = new TaskRunner(
    task,
    {
      provider: 'chatgpt',
      openaiModel: 'gpt-4.1',
      policy: {
        workspaceRoot,
        capabilities: { 'fs.read': true, 'fs.write': false, 'cmd.run': false, 'net.http': false }
      }
    },
    {
      onUpdate: () => {
        /* no-op */
      }
    }
  )

  await assert.rejects(
    async () =>
      (
        runner as unknown as { executeCodeAction: (a: unknown) => Promise<string | undefined> }
      ).executeCodeAction({
        type: 'file_write',
        path: 'out.txt',
        content: 'hello'
      }),
    /Policy denied: file_write requires fs\.write/i
  )
})

test('TaskRunner denies browser actions when missing effective task capabilities', async () => {
  const task = makeTask({
    id: 't3',
    prompt: 'Navigate somewhere',
    mode: 'browser',
    capabilities: ['browser.cdp', 'app.launch']
  })

  const runner = new TaskRunner(
    task,
    {
      provider: 'chatgpt',
      openaiModel: 'gpt-4.1',
      // Deliberately omit browser.cdp from effective caps
      effectiveTaskCapabilities: ['app.launch'],
      policy: {
        workspaceRoot: null,
        capabilities: { 'fs.read': false, 'fs.write': false, 'cmd.run': false, 'net.http': false }
      }
    },
    { onUpdate: () => {} }
  )

  await assert.rejects(
    async () =>
      (
        runner as unknown as {
          executeCdpAction: (bridge: unknown, action: unknown) => Promise<string | undefined>
        }
      ).executeCdpAction(
        {},
        {
          type: 'navigate',
          url: 'https://example.com'
        }
      ),
    /Capability denied: navigate requires browser\.cdp/i
  )
})
