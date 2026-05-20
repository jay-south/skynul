import type { Task, TaskStep } from '@skynul/shared'
import { TaskRunner } from './agent/task-runner'
import { ChannelManager } from './channels/channel-manager'
import { type SidecarInput, startInputLoop, writeOutput } from './protocol'

const runners = new Map<string, TaskRunner>()
let channelManager: ChannelManager | null = null

function onStep(_taskId: string, step: TaskStep): void {
  writeOutput({ type: 'task_update', task_id: _taskId, status: 'running', step })
}

function onComplete(task: Task): void {
  runners.delete(task.id)
  writeOutput({
    type: 'task_update',
    task_id: task.id,
    status: task.status,
    summary: task.summary ?? undefined
  })
  channelManager?.relayTaskUpdate(task)
}

function handleInput(input: SidecarInput): void {
  switch (input.type) {
    case 'init': {
      if (input.config.channels) {
        channelManager = new ChannelManager(input.config.channels)
        channelManager.setAutoApprove(true)
        void channelManager.startAll()
      }
      break
    }

    case 'execute': {
      const task: Task = {
        id: input.task.id,
        prompt: input.task.prompt,
        attachments: input.task.attachments,
        status: 'running',
        mode: input.task.mode,
        capabilities: input.task.capabilities,
        steps: [],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        maxSteps: input.task.maxSteps,
        timeoutMs: input.task.timeoutMs,
        source: input.task.source
      }

      const runner = new TaskRunner(
        task,
        {
          provider: input.provider.id,
          model: input.provider.model,
          apiKey: input.provider.apiKey
        },
        { onStep, onComplete }
      )

      runners.set(task.id, runner)
      void runner.run()
      break
    }

    case 'message': {
      const runner = runners.get(input.task_id)
      if (runner) {
        writeOutput({ type: 'error', message: 'message command not supported in current sidecar' })
      }
      break
    }

    case 'cancel': {
      const runner = runners.get(input.task_id)
      if (runner) runner.abort('Cancelled by user')
      break
    }
  }
}

// ── Lifecycle ────────────────────────────────────────────────────────────────

async function shutdown(): Promise<void> {
  for (const runner of runners.values()) {
    runner.abort('Sidecar shutting down')
  }
  runners.clear()
  await channelManager?.stopAll()
  process.exit(0)
}

process.on('SIGINT', () => void shutdown())
process.on('SIGTERM', () => void shutdown())

// ── Start ────────────────────────────────────────────────────────────────────

writeOutput({ type: 'ready' })
startInputLoop(handleInput)
