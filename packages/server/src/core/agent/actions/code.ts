import type { TaskAction } from '@skynul/shared'
import type { CodeContext } from './types'
import { scrapeUrl } from '../web-scraper'
import { createExcelFromTsv } from '../excel-writer'
import { headTail } from '../utils/helpers'

const $ = (a: TaskAction): Record<string, unknown> => a as unknown as Record<string, unknown>

export async function handleShell(action: TaskAction, ctx: CodeContext): Promise<string | undefined> {
  const raw = $(action)
  return ctx.shell(raw.command as string, raw.cwd as string | undefined, raw.timeout as number | undefined)
}

export async function handleWait(action: TaskAction): Promise<string | undefined> {
  await new Promise((r) => setTimeout(r, ($(action).ms as number) ?? 1000))
  return undefined
}

export async function handleWebScrape(action: TaskAction): Promise<string> {
  const raw = $(action)
  return scrapeUrl(raw.url as string, (raw.instruction as string) ?? '')
}

export async function handleSaveToExcel(action: TaskAction, ctx: CodeContext): Promise<string> {
  const raw = $(action)
  const lastData = ctx.getLastScrapeData()
  if (!lastData) return '[Error: no data available. Use web_scrape first.]'
  try {
    const filePath = await createExcelFromTsv(lastData, raw.filename as string, raw.filter as string | undefined)
    return `Excel saved: ${filePath}`
  } catch (e) {
    return `[Error creating Excel: ${e instanceof Error ? e.message : String(e)}]`
  }
}

export async function handleLaunch(action: TaskAction, ctx: CodeContext): Promise<string | undefined> {
  return ctx.shell(`powershell.exe -NoProfile -Command "Start-Process '${$(action).app}'"`)
}

export async function handleFileRead(action: TaskAction): Promise<string> {
  const fs = await import('fs/promises')
  const path = await import('path')
  const raw = $(action)
  const filePath = raw.cwd ? path.resolve(raw.cwd as string, raw.path as string) : path.resolve(raw.path as string)
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    let lines = content.split('\n')
    const startLine = raw.offset && (raw.offset as number) > 0 ? (raw.offset as number) - 1 : 0
    if (raw.limit && (raw.limit as number) > 0) {
      lines = lines.slice(startLine, startLine + (raw.limit as number))
    } else if (startLine > 0) {
      lines = lines.slice(startLine)
    }
    const numbered = lines.map((line, i) => `${String(startLine + i + 1).padStart(6)}\t${line}`)
    return headTail(numbered.join('\n'), 8000)
  } catch (e) {
    return `[Error reading ${filePath}: ${e instanceof Error ? e.message : String(e)}]`
  }
}

export async function handleFileWrite(action: TaskAction): Promise<string> {
  const fs = await import('fs/promises')
  const path = await import('path')
  const raw = $(action)
  const filePath = raw.cwd ? path.resolve(raw.cwd as string, raw.path as string) : path.resolve(raw.path as string)
  try {
    await fs.mkdir(path.dirname(filePath), { recursive: true })
    await fs.writeFile(filePath, raw.content as string, 'utf-8')
    return `File written: ${filePath} (${(raw.content as string ?? '').length} bytes)`
  } catch (e) {
    return `[Error writing ${filePath}: ${e instanceof Error ? e.message : String(e)}]`
  }
}

export async function handleFileEdit(action: TaskAction): Promise<string> {
  const fs = await import('fs/promises')
  const path = await import('path')
  const raw = $(action)
  const filePath = raw.cwd ? path.resolve(raw.cwd as string, raw.path as string) : path.resolve(raw.path as string)
  try {
    const content = await fs.readFile(filePath, 'utf-8')
    const oldStr = raw.old_string as string
    const newStr = raw.new_string as string
    const count = content.split(oldStr).length - 1
    if (count === 0) return `[Error: old_string not found in ${filePath}]`
    if (count > 1) return `[Error: old_string found ${count} times in ${filePath} — must be unique. Add more context.]`
    const updated = content.replace(oldStr, newStr)
    await fs.writeFile(filePath, updated, 'utf-8')
    return `File edited: ${filePath} (replaced 1 occurrence)`
  } catch (e) {
    return `[Error editing ${filePath}: ${e instanceof Error ? e.message : String(e)}]`
  }
}

export async function handleFileList(action: TaskAction): Promise<string> {
  const { exec } = require('child_process') as typeof import('child_process')
  const raw = $(action)
  const pattern = (raw.pattern as string) ?? '*'
  return new Promise((resolve) => {
    const fdCmd = `fd --type f --glob '${pattern.replace(/'/g, "'\\''")}'`
    exec(fdCmd, { timeout: 10_000, maxBuffer: 512 * 1024, cwd: raw.cwd as string | undefined }, (err, stdout) => {
      if (!err && stdout.trim()) { resolve(headTail(stdout.trim(), 6000)); return }
      const findCmd = `find . -type f -name '${pattern.replace(/'/g, "'\\''")}'`
      exec(findCmd, { timeout: 10_000, maxBuffer: 512 * 1024, cwd: raw.cwd as string | undefined }, (err2, stdout2) => {
        if (err2) { resolve(`[Error listing files: ${err2.message}]`); return }
        resolve(headTail(stdout2.trim() || '(no files found)', 6000))
      })
    })
  })
}

export async function handleFileSearch(action: TaskAction): Promise<string> {
  const { exec } = require('child_process') as typeof import('child_process')
  const raw = $(action)
  const pattern = (raw.pattern as string) ?? ''
  const dir = (raw.path as string) || '.'
  const globFlag = raw.glob ? ` --glob '${(raw.glob as string).replace(/'/g, "'\\''")}'` : ''
  return new Promise((resolve) => {
    const rgCmd = `rg -n --max-count 50 '${pattern.replace(/'/g, "'\\''")}' ${dir}${globFlag}`
    exec(rgCmd, { timeout: 10_000, maxBuffer: 512 * 1024, cwd: raw.cwd as string | undefined }, (err, stdout) => {
      if (!err || (err as any)?.code === 1) { resolve(headTail((stdout || '').trim() || '(no matches found)', 6000)); return }
      const grepGlob = raw.glob ? ` --include='${(raw.glob as string).replace(/'/g, "'\\''")}'` : ''
      const grepCmd = `grep -rn '${pattern.replace(/'/g, "'\\''")}' ${dir}${grepGlob} | head -50`
      exec(grepCmd, { timeout: 10_000, maxBuffer: 512 * 1024, cwd: raw.cwd as string | undefined }, (err2, stdout2) => {
        if (err2 && !(err2 as any)?.code) { resolve(`[Error searching: ${err2.message}]`); return }
        resolve(headTail((stdout2 || '').trim() || '(no matches found)', 6000))
      })
    })
  })
}
