import { resolve, relative, sep } from 'path'

export function resolveInsideWorkspace(workspaceRoot: string, relPath: string): string {
  if (!relPath || typeof relPath !== 'string') {
    throw new Error('Invalid path')
  }

  // Hard rule: callers must provide relative paths only.
  if (relPath.startsWith('/') || relPath.startsWith('\\')) {
    throw new Error('Absolute paths are not allowed')
  }
  if (/^[a-zA-Z]:\\/.test(relPath)) {
    throw new Error('Absolute paths are not allowed')
  }

  const abs = resolve(workspaceRoot, relPath)
  const rel = relative(workspaceRoot, abs)

  if (rel === '' || rel === '.') return abs
  if (rel.startsWith('..' + sep) || rel === '..') {
    throw new Error('Path escapes workspace')
  }
  return abs
}
