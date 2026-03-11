# Releasing

## How it works

Push a version tag to `main` and CI builds everything automatically.

## Steps

1. Bump `version` in `package.json`.
2. Commit and push to `main`.
3. Create and push the tag:
   ```bash
   git tag v0.1.0-alpha.2
   git push origin v0.1.0-alpha.2
   ```
4. CI builds Windows, Linux, and macOS artifacts and creates a **draft** GitHub Release.
5. Review the draft at https://github.com/jay-south/skynul/releases and click **Publish**.
6. Once published, `electron-updater` will notify existing users via the in-app update toast.

## Versioning

Use SemVer pre-releases during alpha:

- `0.1.0-alpha.1`, `0.1.0-alpha.2`, ...

## Platforms

| Platform | Artifacts                    |
| -------- | ---------------------------- |
| Windows  | NSIS installer + portable    |
| macOS    | DMG                          |
| Linux    | AppImage, snap, deb          |

## Notes

- You can keep pushing directly to `main`. CI only triggers on `v*` tags.
- Do not put secrets in `VITE_*` env vars; they get bundled into the renderer JS.
- The update toast appears automatically when users run a version older than the latest published release.
