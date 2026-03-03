import { BrowserWindow } from 'electron'
import { createServer, IncomingMessage, ServerResponse } from 'http'
import { URL } from 'url'

export type AuthCallbackServer = {
  port: number
  close: () => Promise<void>
}

function html(body: string): string {
  return `<!doctype html><html><head><meta charset="utf-8" /><title>Skynul</title></head><body style="font-family: system-ui; padding: 24px;">${body}</body></html>`
}

export async function startAuthCallbackServer(opts: {
  port: number
  mainWindow: BrowserWindow
  onCallback?: (url: string) => void
  /** Called with the OAuth code+state when a callback arrives.
   *  Return true to suppress forwarding the URL to the renderer. */
  onCodeCallback?: (code: string, state: string | null) => Promise<boolean>
}): Promise<AuthCallbackServer> {
  const { port, mainWindow, onCallback, onCodeCallback } = opts

  const server = createServer((req: IncomingMessage, res: ServerResponse) => {
    void (async () => {
      try {
        const u = new URL(req.url ?? '/', `http://127.0.0.1:${port}`)

        if (u.pathname !== '/auth/callback') {
          res.writeHead(404, { 'Content-Type': 'text/plain' })
          res.end('Not found')
          return
        }

        const code = u.searchParams.get('code')
        const state = u.searchParams.get('state')

        // Let the main process try to handle ChatGPT OAuth first.
        if (code && onCodeCallback) {
          const handled = await onCodeCallback(code, state).catch(() => false)
          if (handled) {
            onCallback?.(u.toString())
            res.writeHead(200, { 'Content-Type': 'text/html' })
            res.end(html('Authorization complete. You can close this tab and return to Skynul.'))
            return
          }
        }

        // Send the full callback URL to the renderer (Supabase flow).
        mainWindow.webContents.send('skynul:auth:callback', {
          url: u.toString()
        })

        onCallback?.(u.toString())

        res.writeHead(200, { 'Content-Type': 'text/html' })
        res.end(html('Login received. You can close this tab and go back to Skynul.'))
      } catch {
        res.writeHead(500, { 'Content-Type': 'text/plain' })
        res.end('Error')
      }
    })()
  })

  await new Promise<void>((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve())
  })

  return {
    port,
    close: async () => {
      await new Promise<void>((resolve) => server.close(() => resolve()))
    }
  }
}
