import type { VisionMessage } from '../../transport/providers/codex-vision'

export function compressVisionHistory(history: VisionMessage[], maxLen = 8): void {
  if (history.length <= maxLen) return

  const keepFirst = 1
  const keepLast = maxLen - keepFirst - 1 // reserve 1 slot for the summary message
  const toSummarize = history.slice(keepFirst, history.length - keepLast)

  const summary = toSummarize
    .filter((m) => m.role === 'assistant')
    .map((m) => {
      const txt = m.content?.[0] && 'text' in m.content[0] ? m.content[0].text : ''
      const match = txt.match(/"type"\s*:\s*"([^"]+)"/)
      return match ? match[1] : ''
    })
    .filter(Boolean)
    .join(' → ')

  history.splice(keepFirst, toSummarize.length, {
    role: 'user',
    content: [{ type: 'input_text', text: `[Previous actions: ${summary}]` }],
  })
}
