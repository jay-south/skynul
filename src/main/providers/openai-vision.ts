/**
 * OpenAI vision provider — sends screenshots + text to a vision-capable model
 * and returns the raw response text (which should contain a JSON action).
 *
 * Follows the same pattern as openai.ts but uses image_url content parts.
 */

type ContentPart =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string }
  | { type: 'output_text'; text: string }

type VisionMessage = {
  role: 'user' | 'assistant' | 'system'
  content: ContentPart[]
}

type OpenAIResponse = {
  output_text?: string
  output?: Array<{
    content?: Array<{ type: string; text?: string }>
  }>
}

export async function openaiVisionRespond(opts: {
  apiKey: string
  model: string
  systemPrompt: string
  messages: VisionMessage[]
}): Promise<string> {
  const { apiKey, model, systemPrompt, messages } = opts

  // Responses API: user/system → input_text, assistant → output_text
  const input: VisionMessage[] = [
    { role: 'system', content: [{ type: 'input_text', text: systemPrompt }] },
    ...messages.slice(-20).map((msg) => {
      if (msg.role === 'assistant') {
        return {
          ...msg,
          content: msg.content.map((part) => {
            if (part.type === 'input_text') {
              return { type: 'output_text' as const, text: part.text }
            }
            return part
          })
        }
      }
      return msg
    })
  ]

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ model, input, max_output_tokens: 1024 })
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`OpenAI vision error: ${res.status} ${res.statusText}${txt ? ` - ${txt}` : ''}`)
  }

  const data = (await res.json()) as OpenAIResponse

  const direct = data.output_text
  if (typeof direct === 'string' && direct.trim()) return direct

  const fromOutput = data.output?.[0]?.content
    ?.filter((c) => c.type === 'output_text' && typeof c.text === 'string')
    .map((c) => c.text)
    .join('')

  if (fromOutput && fromOutput.trim()) return fromOutput
  throw new Error('OpenAI vision returned an empty response')
}
