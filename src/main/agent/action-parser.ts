/**
 * Extracts a TaskAction JSON from the model's raw response text.
 * The model should respond with raw JSON, but we handle edge cases
 * like markdown code fences or extra text around the JSON.
 */

import type { TaskAction } from '../../shared/task'

type ModelResponse = {
  thought?: string
  action: TaskAction
}

/**
 * Parse the model response into a thought + action.
 * Throws if the response cannot be parsed.
 */
export function parseModelResponse(raw: string): ModelResponse {
  const trimmed = raw.trim()

  // Try direct JSON parse first
  try {
    return validateResponse(JSON.parse(trimmed))
  } catch {
    // continue
  }

  // Try extracting JSON from markdown code fences
  const fenceMatch = trimmed.match(/```(?:json)?\s*\n?([\s\S]*?)\n?\s*```/)
  if (fenceMatch) {
    try {
      return validateResponse(JSON.parse(fenceMatch[1].trim()))
    } catch {
      // continue
    }
  }

  // Try finding JSON object in the text (first { to last })
  const firstBrace = trimmed.indexOf('{')
  const lastBrace = trimmed.lastIndexOf('}')
  if (firstBrace !== -1 && lastBrace > firstBrace) {
    try {
      return validateResponse(JSON.parse(trimmed.slice(firstBrace, lastBrace + 1)))
    } catch {
      // continue
    }
  }

  throw new Error(`Could not parse model response as JSON action: ${trimmed.slice(0, 200)}`)
}

const VALID_ACTION_TYPES = new Set([
  'click',
  'double_click',
  'type',
  'key',
  'scroll',
  'move',
  'launch',
  'wait',
  'done',
  'fail'
])

function validateResponse(obj: unknown): ModelResponse {
  if (!obj || typeof obj !== 'object') {
    throw new Error('Response is not an object')
  }

  const rec = obj as Record<string, unknown>
  const action = rec.action as Record<string, unknown> | undefined

  if (!action || typeof action !== 'object' || !action.type) {
    throw new Error('Response missing action.type')
  }

  if (!VALID_ACTION_TYPES.has(action.type as string)) {
    throw new Error(`Unknown action type: ${action.type}`)
  }

  return {
    thought: typeof rec.thought === 'string' ? rec.thought : undefined,
    action: action as unknown as TaskAction
  }
}
