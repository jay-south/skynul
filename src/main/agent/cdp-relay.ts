/**
 * CdpRelay — WebSocket server para Chrome Extension
 */

import { WebSocketServer, WebSocket } from 'ws'

const DEFAULT_PORT = 19222

export class CdpRelay {
  private wss: WebSocketServer | null = null
  private extension: WebSocket | null = null
  private pending = new Map<number, { resolve: (v: unknown) => void; reject: (e: Error) => void }>()
  private nextId = 1
  private port: number

  constructor(port: number = DEFAULT_PORT) {
    this.port = port
  }

  start(): Promise<void> {
    return new Promise((resolve) => {
      this.wss = new WebSocketServer({ port: this.port, host: '0.0.0.0' })

      this.wss.on('listening', () => {
        console.log(`[CdpRelay] ws://0.0.0.0:${this.port}`)
        resolve()
      })

      this.wss.on('connection', (socket) => {
        console.log('[CdpRelay] Extension connected')
        this.extension = socket

        socket.on('message', (data) => {
          try {
            const msg = JSON.parse(data.toString())
            if (msg.type === 'hello') return
            if (msg.id !== undefined && this.pending.has(msg.id)) {
              const p = this.pending.get(msg.id)!
              this.pending.delete(msg.id)
              msg.error ? p.reject(new Error(msg.error)) : p.resolve(msg.result)
            }
          } catch {}
        })

        socket.on('close', () => {
          this.extension = null
          for (const [, p] of this.pending) p.reject(new Error('Extension disconnected'))
          this.pending.clear()
        })
      })
    })
  }

  sendCommand(action: string, params?: Record<string, unknown>): Promise<unknown> {
    return new Promise((resolve, reject) => {
      if (!this.extension || this.extension.readyState !== WebSocket.OPEN) {
        reject(new Error('Extension not connected'))
        return
      }
      const id = this.nextId++
      this.pending.set(id, { resolve, reject })
      this.extension.send(JSON.stringify({ id, action, ...params }))
      setTimeout(() => {
        if (this.pending.has(id)) {
          this.pending.delete(id)
          reject(new Error('Command timeout'))
        }
      }, 15000)
    })
  }

  get isExtensionConnected(): boolean {
    return this.extension?.readyState === WebSocket.OPEN
  }

  stop(): void {
    this.wss?.close()
  }
}
