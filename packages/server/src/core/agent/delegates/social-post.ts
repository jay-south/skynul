import type { VisionMessage } from '../../transport/providers/codex-vision'
import type { TaskManager } from '../task-manager'

export async function autoDelegateForSocialPost(
  task: { prompt: string; parentTaskId?: string; id: string },
  tm: TaskManager,
  history: VisionMessage[],
): Promise<void> {
  const p = task.prompt.toLowerCase()
  const wantsPost = /(\bpost\b|\btweet\b|\bpublish\b|poste(a|ar)|public(a|ar)|borrador|draft)/.test(p)
  const wantsX = /(\bx\b|twitter|x\.com)/.test(p)
  const wantsImage = /(\bimage\b|\bimagen\b|\bmeme\b|\bpicture\b|\bgenerate\b.*\bimage\b)/.test(p)
  const wantsCopy = /(\bcopy\b|caption|two\s*lines|2\s*lines|dos\s*lineas|hashtags|cta)/.test(p)
  const shouldDelegate = (wantsPost && wantsX && wantsImage && wantsCopy) || (wantsPost && wantsImage && wantsCopy)

  if (!shouldDelegate) return
  if (task.parentTaskId) return

  const copyPrompt =
    "You MUST respond using the Skynul agent JSON protocol (thought + action). " +
    'Return ONE JSON object only. action.type MUST be "done". ' +
    'action.summary must contain plain text with: 3 numbered options (TWO lines each) and then "Recommended:". ' +
    "Constraints: English, bullish BTC meme vibe, short and punchy, subtle Argentine wink, avoid spam/repeated hashtags."
  const designPrompt =
    "You MUST respond using the Skynul agent JSON protocol (thought + action). " +
    'Return ONE JSON object only. action.type MUST be "done". ' +
    "action.summary must contain plain text with: (1) image-gen prompt, (2) on-image text, (3) composition notes, (4) aspect ratio for X."

  const [copyRes, designRes] = await Promise.all([
    tm.spawnAndWait(copyPrompt, [], task.id, { agentRole: 'Copy' }),
    tm.spawnAndWait(designPrompt, [], task.id, { agentRole: 'Design' }),
  ])

  history.push({
    role: 'user',
    content: [{
      type: 'input_text',
      text:
        `Sub-agent outputs (use these; do NOT redo):\n` +
        `- Copy (${copyRes.taskId}): ${copyRes.output}\n` +
        `- Design (${designRes.taskId}): ${designRes.output}\n\n` +
        `Now execute the full flow in X: open composer, generate/upload image based on Design, paste final chosen copy, and POST.`,
    }],
  })
}
