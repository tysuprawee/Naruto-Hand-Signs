# Dataset Version Runbook

Use this every time you update the `/play` dataset so caching + app_config stay correct.

## 1) Record New Data

Run recorder:

```bash
python3 src/mp_trainer.py --camera 0
```

Recorder writes to:

```text
src/mediapipe_signs_db.csv
```

## 2) Validate (optional quick gate)

```bash
python3 src/validate_mediapipe_csv.py \
  --input src/mediapipe_signs_db.csv \
  --expected-labels idle,tiger,ram,snake,horse,rat,boar,dog,bird,monkey,ox,dragon,hare,clap \
  --min-total-rows 1000
```

## 3) One-command release (polish + publish + checksum + SQL)

```bash
python3 src/release_mediapipe_dataset.py \
  --input src/mediapipe_signs_db.csv \
  --publish-path web/public/mediapipe_signs_db.csv \
  --version 2026.02.25.1 \
  --sql-out sql/dataset_version_commands.generated.sql
```

What this does:
- removes one-hand rows (unless `--skip-polish`)
- validates final dataset
- writes `web/public/mediapipe_signs_db.csv`
- writes manifest `src/mediapipe_dataset_release.json`
- prints SQL + writes SQL file if `--sql-out` is provided

Preview only (no file changes):

```bash
python3 src/release_mediapipe_dataset.py --dry-run --version 2026.02.25.1
```

## 4) Upload dataset version row to Supabase (optional automation)

If you want the script to update `app_config` automatically:

```bash
python3 src/release_mediapipe_dataset.py \
  --input src/mediapipe_signs_db.csv \
  --publish-path web/public/mediapipe_signs_db.csv \
  --version 2026.02.25.1 \
  --upload-app-config
```

Credential resolution used by script:
- URL: `SUPABASE_URL` or `NEXT_PUBLIC_SUPABASE_URL`
- Key: `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_KEY`

If upload is not used, run generated SQL manually in Supabase SQL editor.

## 5) Deploy web app

Deploy so `web/public/mediapipe_signs_db.csv` is live.

## 6) Post-deploy checks

1. Open:
```text
https://<your-domain>/mediapipe_signs_db.csv
```
2. Confirm `/play` loads and recognizer works.
3. Confirm active dataset row:

```sql
select type, version, is_active, priority, created_at, url, checksum
from public.app_config
where type = 'dataset'
order by created_at desc;
```

## Notes

- `/play` cache key is dataset `version` from `app_config`.
- Change `version` every dataset release.
- Keep `sql/dataset_version_commands.sql` as base reference template.
