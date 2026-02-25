# Web Collect Dataset Runbook

Use this when collecting MediaPipe training rows from `/collect` across Mac, iPad, and iPhone.

## 0) Where to record

- Recommended for multi-device sessions: production URL
  - `https://jutsu-ai.vercel.app/collect`
- Local is fine for desktop iteration:
  - `http://localhost:3001/collect` (or your local port)
- Camera note: mobile browsers commonly require HTTPS for camera access.

## 1) Capture on each device

1. Open `/collect`.
2. Set target sign.
3. Set `Min Hands`:
   - `2` for clean two-hand dataset (recommended main release path)
   - `1` only if you intentionally want one-hand rows in release
4. Capture with manual or auto mode.
5. Export `CSV` at the end of each session.

Notes:
- `/collect` captures landmark features only, not raw camera frames.
- You can record all devices with the same format and merge later.

## 2) Fast transfer files to Mac

```bash
cd /Users/bugatti/Documents/Naruto
mkdir -p data/captures/2026-02-25
cp ~/Downloads/mediapipe_capture_*.csv data/captures/2026-02-25/
```

Tip: Replace `2026-02-25` with your session date.

## 3) Merge device CSV files

Keeps one header and appends all rows.

```bash
cd /Users/bugatti/Documents/Naruto
first_file="$(ls data/captures/2026-02-25/*.csv | grep -v 'merged_collect\\.csv$' | head -n 1)"
{ head -n 1 "$first_file"; for f in data/captures/2026-02-25/*.csv; do
    [ "$f" = "data/captures/2026-02-25/merged_collect.csv" ] && continue
    tail -n +2 "$f"
  done; } \
  > data/captures/2026-02-25/merged_collect.csv
```

If `merged_collect.csv` already exists and is huge, regenerate cleanly:

```bash
cd /Users/bugatti/Documents/Naruto
rm -f data/captures/2026-02-25/merged_collect.csv
first_file="$(ls data/captures/2026-02-25/*.csv | head -n 1)"
{ head -n 1 "$first_file"; for f in data/captures/2026-02-25/mediapipe_capture_*.csv; do tail -n +2 "$f"; done; } \
  > data/captures/2026-02-25/merged_collect.csv
```

## 4) Append merged rows into master source CSV

```bash
cd /Users/bugatti/Documents/Naruto
{ head -n 1 src/mediapipe_signs_db.csv;
  tail -n +2 src/mediapipe_signs_db.csv;
  tail -n +2 data/captures/2026-02-25/merged_collect.csv; } \
  > src/mediapipe_signs_db.next.csv
mv src/mediapipe_signs_db.next.csv src/mediapipe_signs_db.csv
```

## 5) Validate before release

```bash
cd /Users/bugatti/Documents/Naruto
python3 src/validate_mediapipe_csv.py \
  --input src/mediapipe_signs_db.csv \
  --expected-labels idle,tiger,ram,snake,horse,rat,boar,dog,bird,monkey,ox,dragon,hare,clap \
  --min-total-rows 1000
```

## 6) Data polish options (important)

### Option A: Keep release two-hand only (recommended)

Run explicit polish pass:

```bash
cd /Users/bugatti/Documents/Naruto
python3 src/polish_mediapipe_csv.py \
  --input src/mediapipe_signs_db.csv \
  --inplace
```

Then verify two-hand gate:

```bash
python3 src/validate_mediapipe_csv.py \
  --input src/mediapipe_signs_db.csv \
  --require-two-hands
```

### Option B: Keep one-hand rows intentionally

Skip manual polish and allow one-hand rows during release:

- Use `--skip-polish --allow-one-hand` in release command.

## 7) Release dataset to web/public

### Standard release (polish + validate + publish + manifest + SQL)

```bash
cd /Users/bugatti/Documents/Naruto
python3 src/release_mediapipe_dataset.py \
  --input src/mediapipe_signs_db.csv \
  --publish-path web/public/mediapipe_signs_db.csv \
  --version 2026.02.25.2 \
  --sql-out sql/dataset_version_commands.generated.sql
```

### If intentionally keeping one-hand rows

```bash
cd /Users/bugatti/Documents/Naruto
python3 src/release_mediapipe_dataset.py \
  --input src/mediapipe_signs_db.csv \
  --publish-path web/public/mediapipe_signs_db.csv \
  --version 2026.02.25.2 \
  --skip-polish \
  --allow-one-hand \
  --sql-out sql/dataset_version_commands.generated.sql
```

## 8) Update dataset row + deploy

- Apply generated SQL in Supabase SQL editor, or use `--upload-app-config` if credentials are configured.
- Deploy web app so latest `web/public/mediapipe_signs_db.csv` is live.

## 9) Post-deploy checks

1. Open:
   - `https://<your-domain>/mediapipe_signs_db.csv`
2. Confirm active dataset row:

```sql
select type, version, is_active, priority, created_at, url, checksum
from public.app_config
where type = 'dataset'
order by created_at desc;
```

3. Verify `/play` loads and sign recognition works.

## 10) Key cache rule

`/play` cache is keyed by dataset version from `app_config`.
Always bump `--version` for every dataset release.
