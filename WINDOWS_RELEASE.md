# Windows Release Guide (Pygame)

This project now includes scripts for Windows packaging:

- `scripts/windows/build_windows.ps1` -> builds `dist/JutsuAcademy/`
- `scripts/windows/make_installer.ps1` -> builds `dist_installer/*.exe` via Inno Setup
- `scripts/windows/build_portable.ps1` -> builds portable package + launcher + zip

## 1) Build Portable Folder (onedir)

Run in PowerShell from repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\build_windows.ps1
```

Output:

- `dist\JutsuAcademy\JutsuAcademy.exe`

## 2) Build Installer (.exe setup)

Install Inno Setup 6 first, then run:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\build_windows.ps1 -MakeInstaller
```

Output:

- `dist_installer\JutsuAcademy-<version>-Setup.exe`

## 3) Build Portable + Self-Updating Launcher

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\windows\build_portable.ps1
```

Output:

- `dist_portable\JutsuAcademy-Portable-v<version>\`
  - `Start-JutsuAcademy.bat`
  - `Start-JutsuAcademy.ps1`
  - `version.txt`
  - `app\JutsuAcademy.exe`
- `dist_portable\JutsuAcademy-Portable-v<version>.zip`

`build_portable.ps1` also prints SHA256 checksum for the zip.

Use `.env.release` for shipping:

- If `.env.release` exists, build scripts copy it as package `.env`.
- If not, build continues without copying env.
- Use `-AllowDefaultEnv` only for local testing (it copies `.env`).
- Recommended: put only safe/public values in `.env.release` (never service-role keys).
- Starter template: copy `/Users/bugatti/Documents/Naruto/.env.release.example` to `.env.release`.
- Build scripts hard-stop if `SUPABASE_SERVICE_ROLE_KEY` is found in the env file.

## 4) Publish Self-Update

1. Upload portable zip to a public URL (GitHub release asset, S3, etc).
2. Ensure `app_config` has `url` and `checksum` columns:

```sql
alter table public.app_config add column if not exists url text;
alter table public.app_config add column if not exists checksum text;
```

3. Update active version row:

```sql
update public.app_config
set is_active = false
where type = 'version';

insert into public.app_config (type, message, version, is_active, priority, created_at, url, checksum)
values (
  'version',
  'New update available.',
  '1.0.0',
  true,
  1000,
  now(),
  'https://<your-host>/JutsuAcademy-Portable-v1.0.0.zip',
  '<sha256_from_build_portable>'
);
```

Testers launch with `Start-JutsuAcademy.bat`. Launcher checks `app_config` and auto-updates if remote version is newer.

Suggested `.env.release`:

```env
SUPABASE_URL=https://<project>.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=<anon_key>
DISCORD_CLIENT_ID=<client_id_if_needed>
```

Do not include `SUPABASE_SERVICE_ROLE_KEY` in any shipped file.

## 5) Optional Flags

```powershell
# skip dependency install
powershell -ExecutionPolicy Bypass -File .\scripts\windows\build_windows.ps1 -SkipDeps

# keep existing build/dist folders
powershell -ExecutionPolicy Bypass -File .\scripts\windows\build_windows.ps1 -NoClean

# local-only fallback (copies .env if .env.release missing)
powershell -ExecutionPolicy Bypass -File .\scripts\windows\build_windows.ps1 -AllowDefaultEnv

# direct installer creation (if dist already exists)
powershell -ExecutionPolicy Bypass -File .\scripts\windows\make_installer.ps1

# portable build without re-running pyinstaller
powershell -ExecutionPolicy Bypass -File .\scripts\windows\build_portable.ps1 -SkipBuild

# local-only portable fallback (copies .env if .env.release missing)
powershell -ExecutionPolicy Bypass -File .\scripts\windows\build_portable.ps1 -AllowDefaultEnv
```

## 6) Pre-ship QA Checklist

1. Launch `JutsuAcademy.exe` on a clean Windows machine.
2. Camera preview works in Settings.
3. In Free Play, turn `DIAG: ON` and verify:
   - `MODEL: MEDIAPIPE`
   - `MP BACKEND: TASKS VIDEO` (or `TASKS IMAGE` / `LEGACY SOLUTIONS`)
   - `HANDS:` increases above `0` when hands are visible
   - `RAW:` changes from `IDLE` to sign names
4. Enter Challenge and submit one score successfully.
5. Version gate works (`app_config` version mismatch blocks game).
6. Maintenance gate works (`app_config` maintenance row blocks game).
7. Sound/music playback works.
8. Asset-heavy pages render correctly (library, quests, about).
9. Supabase online/offline behavior does not crash the app.
10. Portable launcher update works end-to-end:
   - old local version,
   - new `app_config` version + zip URL + checksum,
   - launcher downloads and updates app before start.

## 7) Hand Detection Troubleshooting (Windows)

If webcam preview works but signs do not progress, follow this exact flow.

### A) Always test from a fresh extraction

1. Close every running `JutsuAcademy.exe`.
2. Delete old extracted portable folder.
3. Extract the latest zip to a brand-new folder.
4. Launch from `Start-JutsuAcademy.bat`.

### B) Verify runtime settings

1. Go to Settings:
   - `Show Hand Skeleton` = ON
   - `Restricted Signs (Require 2 Hands)`:
     - ON for challenge-like behavior
     - OFF for easier Free Play testing
2. Start Free Play and toggle `DIAG: ON`.

### C) Read DIAG and decide quickly

Use these DIAG fields:

- `MP BACKEND`
- `HANDS`
- `RAW`
- `STRICT 2H`
- `MP ERR` (if present)

Interpretation:

- `MP BACKEND: NONE` or `MP ERR` contains `hand_model_missing`
  - Packaging issue. The hand model is not in the build.
- `HANDS: 0` always, but backend is loaded
  - Camera stream is available but detector is not seeing hands (camera index, lighting, framing, or backend issue).
- `HANDS: >0` but `RAW` stays `IDLE`
  - Most often strict mode + one hand visible, or confidence/gating conditions.

### D) Confirm packaged model files exist

Run in PowerShell from repo root:

```powershell
Get-ChildItem -Recurse .\dist\JutsuAcademy\_internal\models | Select-Object FullName
```

Expected to include:

- `hand_landmarker.task`
- `face_landmarker.task`

Also check MediaPipe runtime payload:

```powershell
Get-ChildItem -Recurse .\dist\JutsuAcademy\_internal | Where-Object { $_.FullName -match "mediapipe|tasks" } | Select-Object -First 40 FullName
```

### E) If still failing on one machine only

1. In Settings, click `SCAN CAMERAS` and reselect camera.
2. Close apps that may lock camera (Discord, OBS, browser tabs).
3. Ensure both hands are fully in frame under stable light.
4. Capture one screenshot with `DIAG: ON` showing:
   - `MP BACKEND`
   - `HANDS`
   - `RAW`
   - `MP ERR` (if present)

### F) Backend behavior in current build

Current runtime backend order is:

1. `TASKS VIDEO`
2. `TASKS IMAGE` fallback
3. `LEGACY SOLUTIONS` fallback

If one backend fails at runtime, the app tries the next one automatically.
