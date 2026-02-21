# Mac Portable Build Guide (Jutsu Academy)

This guide is for building the macOS portable zip from this repo.

## 1) Prerequisites

- macOS (Apple Silicon for current build output)
- Python 3.10
- Virtual environment at `.venv`
- `pip` access for dependencies

## 2) One-time setup

```bash
cd /Users/bugatti/Documents/Naruto
python3 -m venv .venv
./.venv/bin/python -m pip install --upgrade pip
./.venv/bin/python -m pip install -r requirements.txt
./.venv/bin/python -m pip install pyinstaller flask werkzeug
```

## 3) Release env file

Create `.env.release` in repo root with release-safe values only:

```env
SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
DISCORD_CLIENT_ID=...
DISCORD_CLIENT_SECRET=...
```

Do not commit secret values to git.

## 4) Build app bundle

```bash
cd /Users/bugatti/Documents/Naruto
./.venv/bin/python -m PyInstaller --noconfirm --clean JutsuAcademy.spec
```

Output app payload:

- `dist/JutsuAcademy/`

## 5) Build portable folder + zip

```bash
cd /Users/bugatti/Documents/Naruto
PORTABLE_ROOT="dist_portable_mac"
PORTABLE_NAME="JutsuAcademy-Portable-mac-v1.0.0"
PORTABLE_DIR="$PORTABLE_ROOT/$PORTABLE_NAME"
APP_DIR="$PORTABLE_DIR/app"
ZIP_PATH="$PORTABLE_ROOT/${PORTABLE_NAME}.zip"

mkdir -p "$PORTABLE_DIR"
rm -rf "$APP_DIR"
mkdir -p "$APP_DIR"
cp -R dist/JutsuAcademy/. "$APP_DIR/"

if [ -f .env.release ]; then
  cp .env.release "$APP_DIR/.env"
fi

cat > "$PORTABLE_DIR/Start-JutsuAcademy.command" <<'EOF'
#!/bin/bash
set -e
DIR="$(cd "$(dirname "$0")" && pwd)"
cd "$DIR/app"
chmod +x ./JutsuAcademy
exec ./JutsuAcademy
EOF
chmod +x "$PORTABLE_DIR/Start-JutsuAcademy.command"

rm -f "$ZIP_PATH"
cd "$PORTABLE_ROOT"
zip -r -y "${PORTABLE_NAME}.zip" "$PORTABLE_NAME"
cd - >/dev/null
```

## 6) Verify package before sharing

```bash
cd /Users/bugatti/Documents/Naruto

# checksum
openssl dgst -sha256 dist_portable_mac/JutsuAcademy-Portable-mac-v1.0.0.zip

# auth deps present
ls dist_portable_mac/JutsuAcademy-Portable-mac-v1.0.0/app/_internal | rg "flask|werkzeug"

# runtime models present
ls dist_portable_mac/JutsuAcademy-Portable-mac-v1.0.0/app/_internal/models | rg "hand_landmarker|face_landmarker|selfie_segmenter"

# jutsu card textures present
ls dist_portable_mac/JutsuAcademy-Portable-mac-v1.0.0/app/_internal/src/pics/textured_buttons
```

## 7) Local smoke test

```bash
open /Users/bugatti/Documents/Naruto/dist_portable_mac/JutsuAcademy-Portable-mac-v1.0.0/Start-JutsuAcademy.command
```

Check:

- Discord login opens browser and returns successfully.
- Hand tracking log appears:
  - `[+] Hand tracking loaded: ...hand_landmarker.task`
- In-game sign progression advances (not just skeleton drawing).

## 8) Copy to Downloads for manual test/share

```bash
cp -f /Users/bugatti/Documents/Naruto/dist_portable_mac/JutsuAcademy-Portable-mac-v1.0.0.zip \
      /Users/bugatti/Downloads/JutsuAcademy-Portable-mac-v1.0.0.zip
```

## Troubleshooting

- `No module named 'flask'`
  - Ensure Flask/Werkzeug installed in `.venv`.
  - Ensure `JutsuAcademy.spec` includes Flask/Werkzeug hidden imports.
  - Rebuild with `--clean`.

- Login works in dev but fails in portable
  - Ensure `.env.release` was copied to `app/.env`.

- Skeleton draws but signs do not progress
  - Confirm hand model actually loaded from runtime path.
  - Confirm good lighting in DIAG panel.
  - Confirm detection text changes from `IDLE` to actual signs.

- Missing visuals/sounds
  - Verify `app/_internal/src/...` assets exist before zipping.

## Architecture note

Current build from Apple Silicon machine is arm64-targeted.  
Intel Mac support requires separate Intel/universal build process.

