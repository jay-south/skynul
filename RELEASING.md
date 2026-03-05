# Releasing (alpha)

This project ships Windows builds as:

- NSIS installer: `skynul-<version>-setup.exe`
- Portable executable: `skynul-<version>-portable.exe`

GitHub Releases constraints (free):

- Each release asset must be under 2 GiB
- No limit on total release size or bandwidth

## Alpha versioning

Use SemVer pre-releases:

- `0.1.0-alpha.1`, `0.1.0-alpha.2`, ...

## Release flow (manual)

1. Bump `package.json` version.
2. Commit and push.
3. Create a tag: `v<version>`.
4. Create a GitHub Release from the tag and upload the Windows artifacts.

Notes:

- Do not put secrets in `VITE_*` env vars; anything used in the renderer gets bundled into JS.
