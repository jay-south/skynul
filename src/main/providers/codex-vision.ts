/**
 * Codex vision provider — sends screenshots + text through the ChatGPT Pro
 * endpoint using OAuth tokens. Mirrors codexRespond() but supports image
 * content parts for the computer-use agent.
 */

import { loadTokens, saveTokens } from './codex'

const ISSUER = 'https://auth.openai.com'
const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann'
const CODEX_API_ENDPOINT = 'https://chatgpt.com/backend-api/codex/responses'

type ContentPart =
  | { type: 'input_text'; text: string }
  | { type: 'input_image'; image_url: string }
  | { type: 'output_text'; text: string }

type VisionMessage = {
  role: 'user' | 'assistant' | 'system'
  content: ContentPart[]
}

interface StoredTokens {
  access: string
  refresh: string
  expires: number
  accountId?: string
}

interface TokenResponse {
  access_token: string
  refresh_token: string
  expires_in?: number
}

async function refreshStoredTokens(stored: StoredTokens): Promise<StoredTokens> {
  const response = await fetch(`${ISSUER}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: stored.refresh,
      client_id: CLIENT_ID
    }).toString()
  })
  if (!response.ok) {
    const txt = await response.text().catch(() => '')
    throw new Error(`Token refresh failed: ${response.status}${txt ? ` - ${txt}` : ''}`)
  }
  const data = (await response.json()) as TokenResponse
  return {
    access: data.access_token,
    refresh: data.refresh_token || stored.refresh,
    expires: Date.now() + (data.expires_in ?? 3600) * 1000,
    accountId: stored.accountId
  }
}

export async function codexVisionRespond(opts: {
  systemPrompt: string
  messages: VisionMessage[]
}): Promise<string> {
  let tokens = await loadTokens()
  if (!tokens || !tokens.access) {
    throw new Error('ChatGPT: not connected. Sign in from Settings.')
  }

  // Refresh if expired (with 30s margin)
  if (tokens.expires - 30_000 < Date.now()) {
    tokens = await refreshStoredTokens(tokens)
    await saveTokens(tokens)
  }

  // Build input: system prompt + conversation messages.
  // Responses API requires: user/system → input_text, assistant → output_text
  const input: VisionMessage[] = [
    { role: 'system', content: [{ type: 'input_text', text: opts.systemPrompt }] },
    ...opts.messages.slice(-20).map((msg) => {
      if (msg.role === 'assistant') {
        // Convert any input_text parts to output_text for assistant messages
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

  const headers: Record<string, string> = {
    Authorization: `Bearer ${tokens.access}`,
    'Content-Type': 'application/json',
    originator: 'netbot'
  }
  if (tokens.accountId) {
    headers['ChatGPT-Account-Id'] = tokens.accountId
  }

  const res = await fetch(CODEX_API_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      model: 'gpt-5.2',
      instructions: opts.systemPrompt,
      store: false,
      stream: true,
      input
    })
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    throw new Error(`ChatGPT Codex vision error: ${res.status} ${res.statusText}${txt ? ` - ${txt}` : ''}`)
  }

  if (!res.body) throw new Error('ChatGPT returned no response body')

  // Parse SSE stream and accumulate text deltas
  const reader = res.body.getReader()
  const decoder = new TextDecoder()
  let accumulated = ''
  let buffer = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    const lines = buffer.split('\n')
    buffer = lines.pop() ?? ''

    for (const line of lines) {
      if (!line.startsWith('data: ')) continue
      const payload = line.slice(6).trim()
      if (payload === '[DONE]') continue
      try {
        const evt = JSON.parse(payload) as Record<string, unknown>
        if (evt.type === 'response.output_text.delta' && typeof evt.delta === 'string') {
          accumulated += evt.delta
        }
        if (evt.type === 'response.output_item.done') {
          const item = evt.item as { type?: string; content?: Array<{ type: string; text?: string }> } | undefined
          if (item?.content) {
            for (const c of item.content) {
              if (c.type === 'output_text' && typeof c.text === 'string' && !accumulated) {
                accumulated += c.text
              }
            }
          }
        }
      } catch {
        // ignore malformed SSE lines
      }
    }
  }

  if (!accumulated.trim()) throw new Error('ChatGPT vision returned an empty response')
  return accumulated
}
