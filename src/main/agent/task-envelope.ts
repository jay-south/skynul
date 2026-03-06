import type { TaskCapabilityId, TaskContextRef, TaskIntent, TaskMode } from '../../shared/task'

export type ChainPlanStep = {
  id: string
  kind: 'subtask'
  prompt: string
  mode: TaskMode
  capabilities: TaskCapabilityId[]
}

export type ChainPlan = {
  steps: ChainPlanStep[]
}

export type TaskEnvelopeInternal = {
  intent: TaskIntent
  mode: TaskMode
  intentCaps: TaskCapabilityId[]
  contextRefs: TaskContextRef[]
  chainPlan: ChainPlan
  internalPrompt: string
}

export type TaskEnvelope = {
  taskId: string
  display: {
    prompt: string
  }
  internal: TaskEnvelopeInternal
}

export function validateChainPlanRestrictOnly(args: {
  chainPlan: ChainPlan
  parentCaps: TaskCapabilityId[]
}): void {
  const parent = new Set(args.parentCaps)

  for (const step of args.chainPlan.steps) {
    for (const cap of step.capabilities) {
      if (!parent.has(cap)) {
        throw new Error(
          `Invalid chain plan: step ${step.id} requires capability ${cap} not present in parent task`
        )
      }
    }
  }
}
