# Tauri Build and Launch Debugging Log

Date: 2026-06-21

## Summary

This note records the Tauri packaging and launch problems fixed while making Fydor build and start reliably on macOS.

The main failures were:

- Tauri rejected the configured `frontendDist` because it pointed at Next.js standalone output containing `node_modules`.
- `tauri dev` failed because the bundled resource path did not exist during development.
- The packaged app crashed on launch because the Next server used the wrong working/data directory for PGlite.
- Finder-style launches could fail because the app tried to run `node` through a shell `PATH` that may not include Homebrew.
- A failed DMG run left a temporary disk image mounted, causing later packaging attempts to fail.

## Problems and Fixes

### 1. `frontendDist` Included `node_modules`

Error:

```text
The configured frontendDist includes the `["node_modules"]` folder.
Please isolate your web assets on a separate folder and update
tauri.conf.json > build > frontendDist.
```

Cause:

`src-tauri/tauri.conf.json` had:

```json
"frontendDist": "../.next/standalone"
```

Next.js standalone output intentionally includes `node_modules`, but Tauri expects `frontendDist` to be static web assets only.

Fix:

- Added a tiny static placeholder at `src-tauri/frontend-dist/index.html`.
- Changed `frontendDist` to `frontend-dist`.
- Bundled the real Next standalone server as a Tauri resource instead.

Important config:

```json
"build": {
  "frontendDist": "frontend-dist"
},
"bundle": {
  "resources": {
    "next-standalone/": ".next/standalone/"
  }
}
```

### 2. `tauri dev` Could Not Find the Resource Path

Error:

```text
resource path `../.next/standalone` doesn't exist
```

Cause:

Tauri validates bundled resources during dev too. `next dev` does not produce `.next/standalone`, and it can remove prior standalone output.

Fix:

- Added stable resource directory `src-tauri/next-standalone/`.
- Added `src-tauri/next-standalone/.gitkeep` so the directory exists before production build output is copied.
- Ignored generated contents while keeping the placeholder tracked:

```gitignore
src-tauri/next-standalone/*
!src-tauri/next-standalone/.gitkeep
```

### 3. Production Build Needed to Copy Standalone Output

Problem:

The packaged app needs the Next standalone server and static assets available inside the Tauri bundle.

Fix:

Updated `npm run build` to:

1. Run `next build`.
2. Copy `public` into `.next/standalone/public`.
3. Copy `.next/static` into `.next/standalone/.next/static`.
4. Refresh `src-tauri/next-standalone` from `.next/standalone`.

Current script:

```json
"build": "next build && cp -R public .next/standalone/public && cp -R .next/static .next/standalone/.next/static && mkdir -p src-tauri/next-standalone && find src-tauri/next-standalone -mindepth 1 ! -name .gitkeep -exec rm -rf {} + && cp -R .next/standalone/. src-tauri/next-standalone"
```

### 4. PGlite Initialized During `next build`

Symptom:

`next build` completed, but printed:

```text
PGlite failed to initialize properly
```

Cause:

`lib/server/db.ts` initialized PGlite at module import time. Next can import server modules while collecting page data, even before a real request needs the database.

Fix:

- Changed DB startup to lazy initialization.
- `getDb()` now initializes and awaits migrations.
- Existing `db` imports still work through a proxy that initializes on first property access.

Result:

`npm run build` no longer prints the PGlite initialization warning.

### 5. Packaged App Crashed on Launch

Crash behavior:

The release app started the Next server, then failed when the app hit a database-backed route:

```text
Error: PGlite failed to initialize properly
```

Cause:

The packaged server was launched without an explicit working directory or writable data directory. In production, bundled resources are read-only or unsuitable for app data, and `process.cwd()` is not a safe place for PGlite.

Fix:

In `src-tauri/src/main.rs`:

- Compute `server_dir` from Tauri's resource directory.
- Launch `server.js` with `.current_dir(&server_dir)`.
- Create a writable app data directory for PGlite.
- Pass that directory to Next using `PGLITE_DATA_DIR`.

In `lib/server/db.ts`:

```ts
const DATA_DIR = process.env.PGLITE_DATA_DIR ?? path.join(process.cwd(), ".pglite-data");
```

### 6. Finder Launch Could Fail to Find Node

Problem:

The release launcher used:

```rust
std::process::Command::new("node")
```

This can work in Terminal but fail from Finder, because Finder does not inherit the same shell `PATH`. On Apple Silicon Macs, Node installed by Homebrew is commonly at `/opt/homebrew/bin/node`.

Fix:

Added a small Node resolver in `src-tauri/src/main.rs`:

```rust
fn node_binary() -> &'static str {
    for candidate in [
        "/opt/homebrew/bin/node",
        "/usr/local/bin/node",
        "/usr/bin/node",
    ] {
        if std::path::Path::new(candidate).exists() {
            return candidate;
        }
    }

    "node"
}
```

Then the server is launched with:

```rust
std::process::Command::new(node_binary())
```

### 7. DMG Bundling Failed After an Earlier Failed Attempt

Symptom:

`npm run tauri:build` built the app but failed during:

```text
Running bundle_dmg.sh
failed to bundle project
```

Cause:

A previous failed DMG build left a temporary read/write disk image mounted.

Diagnosis:

```bash
hdiutil info
```

Found a mounted temporary Fydor image similar to:

```text
/Users/user/Habitz/src-tauri/target/release/bundle/macos/rw.*.Fydor_0.1.0_aarch64.dmg
/Volumes/dmg.*
```

Fix:

Detach the temporary disk:

```bash
hdiutil detach /dev/disk5
```

Use the disk identifier shown by `hdiutil info`; it may not always be `/dev/disk5`.

## Verification Commands

### Web Build

```bash
npm run build
```

Expected:

- Next.js build completes.
- No PGlite initialization warning.

### Tauri Dev

```bash
npm run tauri:dev
```

Expected:

- Next starts on `http://localhost:3001`.
- Cargo builds the Tauri app.
- Fydor launches in dev mode.

### Tauri Production Build

```bash
npm run tauri:build
```

Expected output:

```text
Finished 1 bundle at:
  /Users/user/Habitz/src-tauri/target/release/bundle/dmg/Fydor_0.1.0_aarch64.dmg
```

### Launch Smoke Test

Run the release binary:

```bash
src-tauri/target/release/fydor
```

Or simulate a Finder-like minimal environment:

```bash
env -i HOME=/Users/user USER=user PATH=/usr/bin:/bin TMPDIR=/tmp src-tauri/target/release/fydor
```

Then check the app server:

```bash
curl -I http://127.0.0.1:3001/admin/imports
```

Expected:

```text
HTTP/1.1 200 OK
```

## Files Changed for This Fix

- `.gitignore`
- `package.json`
- `lib/server/db.ts`
- `src-tauri/tauri.conf.json`
- `src-tauri/src/main.rs`
- `src-tauri/frontend-dist/index.html`
- `src-tauri/next-standalone/.gitkeep`

## Future Notes

- The current packaged app expects a local Node binary to exist. A more distributable solution would bundle a Node runtime or replace the standalone Next server with static export/API-free architecture.
- If DMG packaging fails after interruption, check `hdiutil info` for leftover mounted temporary images.
- Keep Tauri `frontendDist` free of `node_modules`; use `bundle.resources` for server/runtime assets.
- Keep PGlite data in a writable app data directory, not in bundled resources.
