# Contributing to Jutsu Academy

This repository is public. Do not commit secrets.

## Security Rules (Required)

- Never commit `.env` files or private keys.
- Never share `SUPABASE_SERVICE_ROLE_KEY`.
- Only client-safe values are allowed in local dev for this project:
  - `SUPABASE_URL`
  - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
  - `DISCORD_CLIENT_ID`
  - optional alias: `SUPABASE_ANON_KEY` (same anon value)

If a secret is leaked, rotate it immediately.

## 1) Online Dev Setup (Owner Shares Manually)

The project owner should send values privately (Discord DM, Signal, 1Password, etc.).
Do not send them through public channels or commit history.

Create local `.env` in repo root:

macOS / Linux / Git Bash:

```bash
cat > .env << 'EOF'
SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
DISCORD_CLIENT_ID=your_discord_client_id
SUPABASE_ANON_KEY=your_anon_key
EOF
```

Windows PowerShell:

```powershell
@"
SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
DISCORD_CLIENT_ID=your_discord_client_id
SUPABASE_ANON_KEY=your_anon_key
"@ | Set-Content -NoNewline .env
```

Windows cmd.exe:

```cmd
(
echo SUPABASE_URL=https://your-project-id.supabase.co
echo NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
echo DISCORD_CLIENT_ID=your_discord_client_id
echo SUPABASE_ANON_KEY=your_anon_key
) > .env
```

Install dependencies, then run:

```bash
python -m venv .venv
source .venv/bin/activate   # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python src/jutsu_academy/main_pygame.py
```

You can skip activating the virtual environment only if your machine already has all required packages installed globally. Virtual environment is strongly recommended.

Use a separate Supabase project for development if possible.

## 2) Before Opening a PR

Run these checks locally:

```bash
git status
git diff -- . ':(exclude).env' ':(exclude).env.local'
rg -n "SUPABASE_SERVICE_ROLE_KEY|DISCORD_CLIENT_SECRET|SERVICE_ROLE" .
```

Confirm:
- No key values are present in staged files.
- No `discord_*.json`, `.env`, or credential files are staged.
- Changes are limited to intended files.

## 3) What To Share With Teammates

Send this package:
- Repo URL
- Setup commands from this file
- Optional cloud env values (manual/private message only)

Do not send:
- Service role key
- Personal session/token files
- Any `.env` file from your machine
