import type { ChatMessage } from '../../shared/policy'

type OpenAIResponse = {
  output_text?: string
  output?: Array<{
    content?: Array<{ type: string; text?: string }>
  }>
}

export async function openaiRespond(opts: {
  apiKey: string
  model: string
  messages: ChatMessage[]
}): Promise<string> {
  const { apiKey, model, messages } = opts
  const truncated = messages.slice(-20)

  const input = truncated.map((m) => ({
    role: m.role,
    content: [{ type: 'input_text', text: m.content }]
  }))

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      input
    })
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`OpenAI error: ${res.status} ${res.statusText}${txt ? ` - ${txt}` : ''}`)
  }

  const data = (await res.json()) as OpenAIResponse
  const direct = data.output_text
  if (typeof direct === 'string' && direct.trim()) return direct

  const fromOutput = data.output?.[0]?.content
    ?.filter((c) => c.type === 'output_text' && typeof c.text === 'string')
    .map((c) => c.text)
    .join('')

  if (fromOutput && fromOutput.trim()) return fromOutput
  throw new Error('OpenAI returned an empty response')
}
