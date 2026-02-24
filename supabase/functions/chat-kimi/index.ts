// Supabase Edge Function: chat-kimi
// Deploy: supabase functions deploy chat-kimi
// Set secret: supabase secrets set KIMI_API_KEY=sk-...

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
  console.log('[KIMI] authHeader present:', authHeader ? 'YES' : 'NO')

  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const kimiApiKey = Deno.env.get('KIMI_API_KEY') ?? ''

  console.log('[KIMI] ENV check:', {
    supabaseUrl: supabaseUrl ? 'SET' : 'MISSING',
    supabaseAnonKey: supabaseAnonKey ? 'SET' : 'MISSING',
    kimiApiKey: kimiApiKey ? 'SET' : 'MISSING'
  })

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response(
      JSON.stringify({
        error: 'Missing Supabase env',
        details: { supabaseUrl: !!supabaseUrl, supabaseAnonKey: !!supabaseAnonKey }
      }),
      {
        status: 500,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  if (!kimiApiKey) {
    return new Response(JSON.stringify({ error: 'Missing KIMI_API_KEY secret' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    })
  }

  // Validate user auth via Supabase
  console.log('[KIMI] Validating auth...')
  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, {
    headers: {
      Authorization: authHeader,
      apikey: supabaseAnonKey
    }
  })

  if (!userRes.ok) {
    const userError = await userRes.text().catch(() => 'Unknown auth error')
    console.log('[KIMI] Auth failed:', userRes.status, userError)
    return new Response(
      JSON.stringify({ error: 'Unauthorized', status: userRes.status, details: userError }),
      {
        status: 401,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  console.log('[KIMI] Auth OK')

  const body = (await req.json().catch(() => null)) as RequestBody | null
  const messages = body?.messages ?? []
  const systemPrompt = body?.systemPrompt ?? ''

  console.log('[KIMI] Request:', {
    messageCount: messages.length,
    mode: body?.mode,
    hasSystemPrompt: !!systemPrompt
  })

  // Convert messages to OpenAI-compatible format (Moonshot uses this)
  const kimiMessages: Array<Record<string, unknown>> = []

  if (systemPrompt) {
    kimiMessages.push({ role: 'system', content: systemPrompt })
  }

  for (const m of messages.slice(-20)) {
    if (typeof m.content === 'string') {
      kimiMessages.push({ role: m.role, content: m.content })
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

    kimiMessages.push({ role: m.role, content: parts })
  }

  // Kimi K2.5 — native multimodal model
  const model = 'kimi-k2.5'

  console.log('[KIMI] Calling Moonshot API with', kimiMessages.length, 'messages, model:', model)

  const res = await fetch('https://api.moonshot.ai/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${kimiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model,
      messages: kimiMessages,
      temperature: 0.3,
      max_tokens: 4096
    })
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    console.error('[KIMI] Moonshot API Error:', res.status, res.statusText, txt)
    return new Response(
      JSON.stringify({
        error: 'Moonshot API error',
        status: res.status,
        statusText: res.statusText,
        details: txt
      }),
      {
        status: 502,
        headers: { 'Content-Type': 'application/json' }
      }
    )
  }

  console.log('[KIMI] Moonshot API OK')

  const data = (await res.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }

  const content = data.choices?.[0]?.message?.content ?? ''
  console.log('[KIMI] Response content length:', content.length)

  return Response.json({ content })
})
