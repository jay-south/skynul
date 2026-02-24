// Supabase Edge Function: chat-claude
// Deploy: supabase functions deploy chat-claude
// Set secret: supabase secrets set ANTHROPIC_API_KEY=sk-ant-...

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

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
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const anthropicApiKey = Deno.env.get('ANTHROPIC_API_KEY') ?? ''

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response('Missing Supabase env', { status: 500 })
  }

  if (!anthropicApiKey) {
    return new Response('Missing ANTHROPIC_API_KEY secret', { status: 500 })
  }

  // Validate user auth
  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false }
  })

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as RequestBody | null
  const messages = body?.messages ?? []
  const mode = body?.mode ?? 'chat'
  const systemPrompt = body?.systemPrompt ?? ''

  // Convert messages to Anthropic format
  const anthropicMessages = messages.slice(-20).map((m) => {
    if (typeof m.content === 'string') {
      return { role: m.role, content: m.content }
    }

    // Array content — convert our format to Anthropic content blocks
    const blocks = (m.content as ContentPart[]).map((part) => {
      if (part.type === 'text') {
        return { type: 'text' as const, text: part.text }
      }
      if (part.type === 'image') {
        return {
          type: 'image' as const,
          source: {
            type: 'base64' as const,
            media_type: part.mediaType || 'image/png',
            data: part.base64
          }
        }
      }
      return { type: 'text' as const, text: '' }
    })

    return { role: m.role, content: blocks }
  })

  const anthropicBody: Record<string, unknown> = {
    model: 'claude-sonnet-4-20250514',
    max_tokens: 4096,
    messages: anthropicMessages
  }

  if (systemPrompt) {
    anthropicBody.system = systemPrompt
  }

  const res = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'x-api-key': anthropicApiKey,
      'anthropic-version': '2023-06-01',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(anthropicBody)
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    return new Response(
      `Anthropic error: ${res.status} ${res.statusText}${txt ? ` - ${txt}` : ''}`,
      { status: 502 }
    )
  }

  const data = (await res.json()) as {
    content?: Array<{ type: string; text?: string }>
  }

  const content =
    data.content
      ?.filter((c) => c.type === 'text' && typeof c.text === 'string')
      .map((c) => c.text)
      .join('') ?? ''

  return Response.json({ content })
})
