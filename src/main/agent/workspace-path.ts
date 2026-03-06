import path from 'path'

export function resolveWithinWorkspace(
  workspaceRoot: string,
  userPath: string,
  cwd?: string
): string {
  if (!workspaceRoot) {
    throw new Error('workspaceRoot is not set')
  }

  if (path.isAbsolute(userPath)) {
    throw new Error('Absolute paths are not allowed')
  }

  if (cwd && path.isAbsolute(cwd)) {
    throw new Error('Absolute cwd is not allowed')
  }

  const root = path.resolve(workspaceRoot)
  const base = cwd ? path.resolve(root, cwd) : root
  const resolved = path.resolve(base, userPath)

  if (resolved === root) return resolved
  if (resolved.startsWith(root + path.sep)) return resolved

  throw new Error('Path escapes workspaceRoot')
}
