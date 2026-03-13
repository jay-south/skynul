const fs = require('node:fs')

/**
 * electron-builder config.
 *
 * Why this file exists:
 * - pnpm's default install layout can lead to missing runtime deps after packaging.
 * - For packaging, we optionally point electron-builder at a deployed app dir (./app)
 *   created by `pnpm --prod deploy app`, which contains a complete production
 *   node_modules tree.
 * - For local dev (postinstall: install-app-deps), we keep the default app dir
 *   (project root) so installs don't fail when ./app doesn't exist.
 */

const useDeployedAppDir = process.env.EB_USE_APP_DIR === '1' && fs.existsSync('app')

/** @type {import('electron-builder').Configuration} */
module.exports = {
  appId: 'com.skynul.app',
  productName: 'Skynul',
  directories: {
    ...(useDeployedAppDir ? { app: 'app' } : {}),
    buildResources: 'build',
    output: 'dist'
  },
  // Package app code only. We ship production deps via extraResources.
  files: ['package.json', 'out/**', 'resources/**'],
  extraResources: [
    {
      // NOTE: This path is relative to the app directory (./app when packaging).
      from: 'node_modules',
      to: 'node_modules',
      filter: ['**/*']
    }
  ],
  asarUnpack: ['resources/**'],
  win: {
    executableName: 'Skynul',
    target: ['nsis', 'portable']
  },
  nsis: {
    artifactName: '${name}-${version}-setup.${ext}',
    shortcutName: '${productName}',
    uninstallDisplayName: '${productName}',
    createDesktopShortcut: 'always'
  },
  portable: {
    artifactName: '${name}-${version}-portable.${ext}'
  },
  mac: {
    entitlementsInherit: 'build/entitlements.mac.plist',
    extendInfo: {
      NSDocumentsFolderUsageDescription:
        "Application requests access to the user's Documents folder.",
      NSDownloadsFolderUsageDescription:
        "Application requests access to the user's Downloads folder."
    },
    notarize: false
  },
  dmg: {
    artifactName: '${name}-${version}.${ext}'
  },
  linux: {
    target: ['AppImage', 'deb'],
    maintainer: 'electronjs.org',
    category: 'Utility'
  },
  appImage: {
    artifactName: '${name}-${version}.${ext}'
  },
  // Rebuild native deps against the Electron ABI during packaging.
  // (Local dev rebuild is still handled by `electron-builder install-app-deps`.)
  npmRebuild: true,
  publish: {
    provider: 'github'
  }
}
