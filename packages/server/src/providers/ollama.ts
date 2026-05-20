import type { ChatMessage } from '@skynul/shared'

const DEFAULT_BASE_URL = 'http://localhost:11434'
const DEFAULT_MODEL = 'qwen3.5:27b'

type OllamaChatResponse = {
  message?: { content?: string }
}

export async function ollamaRespond(opts: { messages: ChatMessage[] }): Promise<string> {
  const baseUrl = process.env.OLLAMA_BASE_URL || DEFAULT_BASE_URL
  const model = process.env.OLLAMA_MODEL || DEFAULT_MODEL
  const truncated = opts.messages.slice(-20)

  const res = await fetch(`${baseUrl}/api/chat`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model,
      messages: truncated.map((m) => ({ role: m.role, content: m.content })),
      format: 'json',
      stream: false
    })
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`Ollama error: ${res.status} ${res.statusText}${txt ? ` - ${txt}` : ''}`)
  }

  const data = (await res.json()) as OllamaChatResponse
  const text = data.message?.content ?? ''
  if (!text.trim()) throw new Error('Ollama returned an empty response')
  return text
}
