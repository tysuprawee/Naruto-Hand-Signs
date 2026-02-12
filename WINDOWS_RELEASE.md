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
3. Enter Challenge and submit one score successfully.
4. Version gate works (`app_config` version mismatch blocks game).
5. Maintenance gate works (`app_config` maintenance row blocks game).
6. Sound/music playback works.
7. Asset-heavy pages render correctly (library, quests, about).
8. Supabase online/offline behavior does not crash the app.
9. Portable launcher update works end-to-end:
   - old local version,
   - new `app_config` version + zip URL + checksum,
   - launcher downloads and updates app before start.
