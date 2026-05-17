import { zValidator } from '@hono/zod-validator'
import { readFile } from 'fs/promises'
import { Hono } from 'hono'
import { z } from 'zod'
import * as repo from '../core/repositories/skills'

const skillSchema = z.object({
  id: z.string().optional(), name: z.string().min(1), tag: z.string().min(1),
  description: z.string(), prompt: z.string(), enabled: z.boolean().optional().default(true)
})

const skills = new Hono()
  .get('/', (c) => c.json({ skills: repo.list() }))
  .post('/', zValidator('json', skillSchema), (c) => {
    const body = c.req.valid('json')
    if (body.id) repo.update(body.id, body)
    else repo.create(body.name, body.tag, body.description, body.prompt, body.enabled)
    return c.json({ skills: repo.list() })
  })
  .delete('/:id', (c) => { repo.remove(c.req.param('id')); return c.json({ skills: repo.list() }) })
  .put('/:id/toggle', (c) => {
    const id = c.req.param('id')
    const existing = repo.getById(id)
    if (existing) repo.update(id, { enabled: !existing.enabled })
    return c.json({ skills: repo.list() })
  })
  .post('/import', zValidator('json', z.object({ filePath: z.string() })), async (c) => {
    const { filePath } = c.req.valid('json'); const raw = await readFile(filePath, 'utf8')
    const isMarkdown = filePath.endsWith('.md') || filePath.endsWith('.markdown')
    const basename = filePath.split(/[\\/]/).pop() ?? 'Imported'
    const nameFromFile = basename.replace(/\.(json|md|markdown)$/i, '')
    let name = nameFromFile, tag = '', description = '', prompt = raw
    if (isMarkdown) {
      const fmMatch = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n([\s\S]*)$/)
      if (fmMatch) {
        const fm = fmMatch[1]; prompt = fmMatch[2].trim()
        for (const line of fm.split('\n')) {
          const [key, ...rest] = line.split(':'); const val = rest.join(':').trim()
          if (key.trim() === 'name') name = val
          else if (key.trim() === 'tag' || key.trim() === 'category') tag = val
          else if (key.trim() === 'description') description = val
        }
      }
    } else {
      const parsed = JSON.parse(raw) as Record<string, unknown>
      name = String(parsed.name ?? nameFromFile); tag = String(parsed.tag ?? parsed.category ?? '')
      description = String(parsed.description ?? ''); prompt = String(parsed.prompt ?? '')
    }
    repo.create(name, tag, description, prompt, true); return c.json({ skills: repo.list() })
  })

export { skills }
export type SkillsRoute = typeof skills
