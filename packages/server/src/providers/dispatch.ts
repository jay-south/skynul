import type { ChatMessage, ProviderId } from '@skynul/shared'
import { claudeRespond } from './claude'
import { deepseekRespond } from './deepseek'
import { geminiRespond } from './gemini'
import { glmRespond } from './glm'
import { kimiRespond } from './kimi'
import { minimaxRespond } from './minimax'
import { ollamaRespond } from './ollama'
import { openrouterRespond } from './openrouter'

function getApiKey(key: string): string | undefined {
  return process.env[key] || process.env[key.replace(/\./g, '_')]
}

export async function dispatchChat(provider: ProviderId, messages: ChatMessage[]): Promise<string> {
  if (provider === 'chatgpt') {
    const apiKey = getApiKey('openai.apiKey')
    if (!apiKey) {
      throw new Error('Set an OpenAI API key (OPENAI_API_KEY env var) to use this provider.')
    }
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model: 'gpt-4.1-mini', messages: messages.slice(-20) })
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`OpenAI API error ${res.status}: ${text}`)
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content ?? ''
  }

  if (provider === 'claude') {
    const apiKey = getApiKey('claude.apiKey')
    if (!apiKey) throw new Error('Claude API key not set (CLAUDE_API_KEY env var)')
    return claudeRespond({ apiKey, messages })
  }

  if (provider === 'deepseek') {
    const apiKey = getApiKey('deepseek.apiKey')
    if (!apiKey) throw new Error('DeepSeek API key not set (DEEPSEEK_API_KEY env var)')
    return deepseekRespond({ apiKey, messages })
  }

  if (provider === 'kimi') {
    const apiKey = getApiKey('kimi.apiKey')
    if (!apiKey) throw new Error('Kimi API key not set (KIMI_API_KEY env var)')
    return kimiRespond({ apiKey, messages })
  }

  if (provider === 'glm') {
    const apiKey = getApiKey('glm.apiKey')
    if (!apiKey) throw new Error('GLM API key not set (GLM_API_KEY env var)')
    return glmRespond({ apiKey, messages })
  }

  if (provider === 'minimax') {
    const apiKey = getApiKey('minimax.apiKey')
    if (!apiKey) throw new Error('MiniMax API key not set (MINIMAX_API_KEY env var)')
    return minimaxRespond({ apiKey, messages })
  }

  if (provider === 'openrouter') {
    const apiKey = getApiKey('openrouter.apiKey')
    if (!apiKey) throw new Error('OpenRouter API key not set (OPENROUTER_API_KEY env var)')
    return openrouterRespond({ apiKey, messages })
  }

  if (provider === 'gemini') {
    const apiKey = getApiKey('gemini.apiKey')
    if (!apiKey) throw new Error('Gemini API key not set (GEMINI_API_KEY env var)')
    return geminiRespond({ apiKey, messages })
  }

  if (provider === 'ollama') {
    return ollamaRespond({ messages })
  }

  throw new Error(`Unknown provider: ${provider}`)
}
