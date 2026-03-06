import test from 'node:test'
import assert from 'node:assert/strict'
import { resolveWithinWorkspace } from '../../src/main/agent/workspace-path'
import { resolveInsideWorkspace } from '../../src/main/workspace-path'

test('resolveWithinWorkspace resolves relative paths under workspaceRoot', () => {
  const root = '/tmp/workspace'
  const p = resolveWithinWorkspace(root, 'src/index.ts')
  assert.ok(p.startsWith(root + '/'))
  assert.ok(p.endsWith('/src/index.ts'))
})

test('resolveWithinWorkspace rejects absolute paths', () => {
  assert.throws(() => resolveWithinWorkspace('/tmp/workspace', '/etc/passwd'), /Absolute paths/i)
})

test('resolveWithinWorkspace rejects path traversal outside workspaceRoot', () => {
  assert.throws(
    () => resolveWithinWorkspace('/tmp/workspace', '../secrets.txt'),
    /escapes workspaceRoot/i
  )
})

test('resolveInsideWorkspace rejects absolute paths and workspace escape', () => {
  const root = '/tmp/workspace'
  assert.throws(
    () => resolveInsideWorkspace(root, '/etc/passwd'),
    /Absolute paths are not allowed/i
  )
  assert.throws(
    () => resolveInsideWorkspace(root, '\\server\\share'),
    /Absolute paths are not allowed/i
  )
  assert.throws(
    () => resolveInsideWorkspace(root, 'C:\\Windows\\system.ini'),
    /Absolute paths are not allowed/i
  )
  assert.throws(() => resolveInsideWorkspace(root, '../secrets.txt'), /escapes workspace/i)
})
