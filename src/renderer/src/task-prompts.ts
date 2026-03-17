export type SavedPrompt = { id: string; text: string }

export const SAVED_PROMPTS_KEY = 'skynul.savedTaskPrompts.v1'

export function loadSavedPrompts(): SavedPrompt[] {
  try {
    const raw = localStorage.getItem(SAVED_PROMPTS_KEY)
    return raw ? (JSON.parse(raw) as SavedPrompt[]) : []
  } catch {
    return []
  }
}

export function persistSavedPrompts(prompts: SavedPrompt[]): void {
  localStorage.setItem(SAVED_PROMPTS_KEY, JSON.stringify(prompts))
}

export function savePromptText(savedPrompts: SavedPrompt[], text: string): SavedPrompt[] {
  const trimmed = text.trim()
  if (!trimmed) return savedPrompts
  const id = `sp_${Date.now().toString(36)}`
  return [{ id, text: trimmed }, ...savedPrompts.filter((p) => p.text !== trimmed)]
}

export function deleteSavedPrompt(savedPrompts: SavedPrompt[], id: string): SavedPrompt[] {
  return savedPrompts.filter((p) => p.id !== id)
}
