import type { ChatMessage, ProviderId } from '@skynul/shared'
import { get } from '../../repositories/secrets'
import { claudeRespond } from './claude'
import { deepseekRespond } from './deepseek'
import { geminiRespond } from './gemini'
import { glmRespond } from './glm'
import { kimiRespond } from './kimi'
import { minimaxRespond } from './minimax'
import { ollamaRespond } from './ollama'
import { openrouterRespond } from './openrouter'

/**
 * Dispatch a chat request to the active provider.
 *
 * Note: ChatGPT/Codex (OAuth-based) is NOT supported in standalone server mode
 * because it requires Electron's OAuth flow. Use API key-based providers instead,
 * or set up an OpenAI API key and use the openrouter/openai provider.
 */
export async function dispatchChat(provider: ProviderId, messages: ChatMessage[]): Promise<string> {
  if (provider === 'chatgpt') {
    // Codex OAuth requires Electron context — fallback to OpenAI API key if available
    const apiKey = get('openai.apiKey')
    if (!apiKey) {
      throw new Error(
        'ChatGPT OAuth is only available in desktop mode. ' +
          'Set an OpenAI API key in Settings to use this provider via the API.'
      )
    }
    // Use OpenAI-compatible endpoint directly
    const res = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4.1-mini',
        messages: messages.slice(-20)
      })
    })
    if (!res.ok) {
      const text = await res.text().catch(() => '')
      throw new Error(`OpenAI API error ${res.status}: ${text}`)
    }
    const data = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> }
    return data.choices?.[0]?.message?.content ?? ''
  }

  if (provider === 'claude') {
    const apiKey = get('claude.apiKey')
    if (!apiKey) throw new Error('Claude API key is not set. Go to Settings and add it.')
    return claudeRespond({ apiKey, messages })
  }

  if (provider === 'deepseek') {
    const apiKey = get('deepseek.apiKey')
    if (!apiKey) throw new Error('DeepSeek API key is not set. Go to Settings and add it.')
    return deepseekRespond({ apiKey, messages })
  }

  if (provider === 'kimi') {
    const apiKey = get('kimi.apiKey')
    if (!apiKey) throw new Error('Kimi API key is not set. Go to Settings and add it.')
    return kimiRespond({ apiKey, messages })
  }

  if (provider === 'glm') {
    const apiKey = get('glm.apiKey')
    if (!apiKey) throw new Error('GLM API key is not set. Go to Settings and add it.')
    return glmRespond({ apiKey, messages })
  }

  if (provider === 'minimax') {
    const apiKey = get('minimax.apiKey')
    if (!apiKey) throw new Error('MiniMax API key is not set. Go to Settings and add it.')
    return minimaxRespond({ apiKey, messages })
  }

  if (provider === 'openrouter') {
    const apiKey = get('openrouter.apiKey')
    if (!apiKey) throw new Error('OpenRouter API key is not set. Go to Settings and add it.')
    return openrouterRespond({ apiKey, messages })
  }

  if (provider === 'gemini') {
    const apiKey = get('gemini.apiKey')
    if (!apiKey) throw new Error('Gemini API key is not set. Go to Settings and add it.')
    return geminiRespond({ apiKey, messages })
  }

  if (provider === 'ollama') {
    return ollamaRespond({ messages })
  }

  throw new Error(`Unknown provider: ${provider}`)
}
