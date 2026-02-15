# Dataset Version Runbook

Use this every time you update the challenge dataset to keep caching and DB versioning consistent.

## 1. Record Dataset (same process as before)

Run recorder and capture samples as usual:

```powershell
python src\mp_trainer.py --camera 0
```

The recorder writes to:

```text
src/mediapipe_signs_db.csv
```

## 2. Publish CSV for web

Copy recorder output to the deployed static file path:

```powershell
Copy-Item src\mediapipe_signs_db.csv web\public\mediapipe_signs_db.csv -Force
```

## 3. Verify both files are identical

```powershell
Get-FileHash src\mediapipe_signs_db.csv -Algorithm SHA256
Get-FileHash web\public\mediapipe_signs_db.csv -Algorithm SHA256
```

Hashes must match.

## 4. Get checksum for DB row

```powershell
(Get-FileHash web\public\mediapipe_signs_db.csv -Algorithm SHA256).Hash
```

Use this exact hash in SQL.

## 5. Bump dataset version in Supabase

Run this SQL (transaction recommended):

```sql
begin;

update public.app_config
set is_active = false
where type = 'dataset';

insert into public.app_config (type, message, version, is_active, priority, created_at, url, checksum)
values (
  'dataset',
  'Web challenge MediaPipe dataset',
  'YYYY.MM.DD.N',
  true,
  900,
  now(),
  '/mediapipe_signs_db.csv',
  '<SHA256_OF_WEB_PUBLIC_FILE>'
);

commit;
```

Version format recommendation:

```text
YYYY.MM.DD.N
```

Example:

```text
2026.02.16.1
```

## 6. Verify active DB row

```sql
select type, version, is_active, priority, created_at, url, checksum
from public.app_config
where type = 'dataset'
order by created_at desc;
```

Expected:

- latest row has `is_active = true`
- `url = '/mediapipe_signs_db.csv'`
- `checksum` matches Step 4

## 7. Deploy web app

Deploy so `web/public/mediapipe_signs_db.csv` is live.

## 8. Post-deploy quick check

Open:

```text
https://<your-domain>/mediapipe_signs_db.csv
```

Confirm file downloads and challenge page loads normally.

## Notes

- The challenge client now caches dataset by `dataset` version from `app_config`.
- Browser should re-use cached CSV until version changes.
- Keep `sql/dataset_version_commands.sql` as your SQL reference template.
