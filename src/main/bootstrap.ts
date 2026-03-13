import path from 'node:path'
import * as Module from 'node:module'

// electron-builder + pnpm can produce packaged apps where some transitive
// dependencies are not present inside app.asar.
//
// We ship production dependencies as extraResources under `resources/node_modules`
// and patch Node's module resolution so runtime `require()` can find them.

const extraNodeModules = path.join(process.resourcesPath, 'node_modules')

// Make Node resolve packages from our extraResources dir.
// Use NODE_PATH + _initPaths() to avoid monkey-patching internal getters.
process.env.NODE_PATH = [process.env.NODE_PATH, extraNodeModules]
  .filter(Boolean)
  .join(path.delimiter)
;(Module as unknown as { _initPaths?: () => void })._initPaths?.()

// Also push explicitly for good measure.
;(Module as unknown as { globalPaths: string[] }).globalPaths.push(extraNodeModules)

// Load the real app entry.
// This file is built to `out/main/app.js` by electron-vite.
// eslint-disable-next-line @typescript-eslint/no-var-requires
require('./app')
