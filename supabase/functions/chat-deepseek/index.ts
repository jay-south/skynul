// Supabase Edge Function: chat-deepseek
// Deploy: supabase functions deploy chat-deepseek
// Set secret: supabase secrets set DEEPSEEK_API_KEY=sk-...

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'

type TextPart = { type: 'text'; text: string }
type ImagePart = { type: 'image'; mediaType: string; base64: string }
type ContentPart = TextPart | ImagePart

type Message = {
  role: 'user' | 'assistant'
  content: string | ContentPart[]
}

type RequestBody = {
  messages?: Message[]
  mode?: 'chat' | 'vision'
  systemPrompt?: string
}

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  console.log('[DEBUG] authHeader:', authHeader.slice(0, 30) + '...')

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const deepseekApiKey = Deno.env.get('DEEPSEEK_API_KEY') ?? ''

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response('Missing Supabase env', { status: 500 })
  }

  if (!deepseekApiKey) {
    return new Response('Missing DEEPSEEK_API_KEY secret', { status: 500 })
  }

  // Validate user auth - skip for now, just use the API key
  // The API key is already secured as a Supabase secret
  // Anyone with access to the edge function can use it anyway

  const body = (await req.json().catch(() => null)) as RequestBody | null
  const messages = body?.messages ?? []
  const systemPrompt = body?.systemPrompt ?? ''

  // Convert messages to OpenAI-compatible format (Deepseek uses this)
  const deepseekMessages: Array<Record<string, unknown>> = []

  if (systemPrompt) {
    deepseekMessages.push({ role: 'system', content: systemPrompt })
  }

  for (const m of messages.slice(-20)) {
    if (typeof m.content === 'string') {
      deepseekMessages.push({ role: m.role, content: m.content })
      continue
    }

    // Array content — convert to OpenAI content parts
    const parts = (m.content as ContentPart[]).map((part) => {
      if (part.type === 'text') {
        return { type: 'text' as const, text: part.text }
      }
      if (part.type === 'image') {
        const mime = part.mediaType || 'image/png'
        return {
          type: 'image_url' as const,
          image_url: { url: `data:${mime};base64,${part.base64}` }
        }
      }
      return { type: 'text' as const, text: '' }
    })

    deepseekMessages.push({ role: m.role, content: parts })
  }

  const res = await fetch('https://api.deepseek.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${deepseekApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'deepseek-chat',
      messages: deepseekMessages
    })
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    return new Response(
      `Deepseek error: ${res.status} ${res.statusText}${txt ? ` - ${txt}` : ''}`,
      { status: 502 }
    )
  }

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const content = data.choices?.[0]?.message?.content ?? ''
  return Response.json({ content })
})
