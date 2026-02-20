// Supabase Edge Function: chat
// Deploy: supabase functions deploy chat
// Set secret: supabase secrets set OPENAI_API_KEY=sk-...

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

type ChatMessage = { role: 'user' | 'assistant'; content: string }

serve(async (req) => {
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405 })
  }

  const authHeader = req.headers.get('Authorization') ?? ''
  const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? ''
  const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? ''
  const openaiApiKey = Deno.env.get('OPENAI_API_KEY') ?? ''

  if (!supabaseUrl || !supabaseAnonKey) {
    return new Response('Missing Supabase env', { status: 500 })
  }

  if (!openaiApiKey) {
    return new Response('Missing OPENAI_API_KEY secret', { status: 500 })
  }

  const supabase = createClient(supabaseUrl, supabaseAnonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false }
  })

  const { data: userData, error: userErr } = await supabase.auth.getUser()
  if (userErr || !userData.user) {
    return new Response('Unauthorized', { status: 401 })
  }

  const body = (await req.json().catch(() => null)) as { messages?: ChatMessage[] } | null
  const messages = body?.messages ?? []
  const truncated = messages.slice(-20)

  const input = truncated.map((m) => ({
    role: m.role,
    content: [{ type: 'input_text', text: m.content }]
  }))

  const res = await fetch('https://api.openai.com/v1/responses', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${openaiApiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: 'gpt-4.1-mini',
      input
    })
  })

  if (!res.ok) {
    const txt = await res.text().catch(() => '')
    return new Response(`OpenAI error: ${res.status} ${res.statusText}${txt ? ` - ${txt}` : ''}`, {
      status: 502
    })
  }

  const data = (await res.json()) as { output_text?: string }
  const content = data.output_text ?? ''
  return Response.json({ content })
})
