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

/** Regex that matches status-log noise (allows optional · and whitespace/newlines). */
const NOISE_REGEX = /\s*·?\s*CDP\s+browser\s+bridge\s+ready\.?\s*(Starting\s+agent\s+loop\.\.\.)?\s*/gi

/**
 * Remove status-log noise from anywhere in the string (middle or end).
 * This fixes responses where UI/stream concatenated our status with the model output.
 */
function stripEmbeddedNoise(text: string): string {
  return text.replace(NOISE_REGEX, ' ').trim()
}

/**
 * Strip trailing lines that look like status logs.
 */
function stripTrailingNoise(text: string): string {
  const lines = text.split('\n')
  while (lines.length > 0) {
    const last = lines[lines.length - 1].trim()
    if (!last) {
      lines.pop()
      continue
    }
    if (last.startsWith('·') || /Starting agent loop|bridge ready|CDP browser/i.test(last)) {
      lines.pop()
      continue
    }
    break
  }
  return lines.join('\n').trim()
}

/**
 * Parse the model response into a thought + action.
 * Throws if the response cannot be parsed.
 */
export function parseModelResponse(raw: string): ModelResponse {
  let trimmed = raw.trim()
  trimmed = stripEmbeddedNoise(trimmed)
  trimmed = stripTrailingNoise(trimmed)

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

  const preview = trimmed.slice(0, 200)
  if (/^\s*\{\s*"thought"\s*:/.test(trimmed) && !trimmed.includes('"action"')) {
    throw new Error(
      `Model response looks truncated (has "thought" but no "action"). Keep thought short and always output full JSON with both thought and action. Raw: ${preview}`
    )
  }
  throw new Error(`Could not parse model response as JSON action: ${preview}`)
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
  'fail',
  // CDP browser agent actions
  'navigate',
  'pressKey',
  'evaluate',
  // Polymarket trading actions
  'polymarket_get_account_summary',
   'polymarket_get_trader_leaderboard',
  'polymarket_place_order',
  'polymarket_close_position'
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
