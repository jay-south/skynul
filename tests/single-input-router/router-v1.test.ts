import test from 'node:test'
import assert from 'node:assert/strict'
import { routeV1 } from '../../src/main/agent/router/router-v1'
import type { TaskCapabilityId } from '../../src/shared/task'

test('router-v1 is deterministic for the same input', () => {
  const userCapabilities: TaskCapabilityId[] = ['browser.cdp']
  const input = {
    displayPrompt: 'Deploy the service to Kubernetes and update the CI pipeline',
    userCapabilities
  }

  const a = routeV1(input)
  const b = routeV1(input)

  assert.deepStrictEqual(a, b)
  assert.equal(a.intent, 'infra')
})
