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

  // Try direct JSON parse first (single clean object)
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

  // Extract the FIRST complete JSON object using brace balancing.
  // This handles cases where the model returns multiple JSONs concatenated.
  const firstJson = extractFirstJson(trimmed)
  if (firstJson) {
    try {
      return validateResponse(JSON.parse(firstJson))
    } catch {
      // continue
    }
  }

  throw new Error(`Could not parse model response as JSON action: ${trimmed.slice(0, 200)}`)
}

/**
 * Extract the first complete JSON object from a string using brace balancing.
 * Handles strings and escaped characters correctly.
 */
function extractFirstJson(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null

  let depth = 0
  let inString = false
  let escape = false

  for (let i = start; i < text.length; i++) {
    const ch = text[i]

    if (escape) {
      escape = false
      continue
    }

    if (ch === '\\' && inString) {
      escape = true
      continue
    }

    if (ch === '"') {
      inString = !inString
      continue
    }

    if (inString) continue

    if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }

  return null
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
