#!/usr/bin/env python3
"""Release helper for /play MediaPipe CSV.

Pipeline:
1) Read source CSV
2) Optional polish pass (remove one-hand rows)
3) Validate output dataset quality
4) Publish CSV to web/public
5) Emit checksum/manifest
6) Optional Supabase app_config dataset version upload
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import io
import json
import os
import shutil
import tempfile
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any
from urllib.error import HTTPError
from urllib.request import Request, urlopen

from validate_mediapipe_csv import (
    DEFAULT_EXPECTED_LABELS,
    EXPECTED_COLS,
    HAND_FLOATS,
    hand_present,
    inspect_dataset,
    parse_expected_labels,
    row_to_values,
    validate_stats,
)


def resolve_path(raw_path: str, root: Path) -> Path:
    path = Path(raw_path).expanduser()
    if path.is_absolute():
        return path.resolve()
    return (root / path).resolve()


def load_csv(path: Path) -> tuple[list[str], list[list[str]]]:
    if not path.exists():
        raise FileNotFoundError(f"Input not found: {path}")
    with path.open("r", newline="", encoding="utf-8") as file:
        reader = csv.reader(file)
        try:
            header = next(reader)
        except StopIteration as exc:
            raise ValueError("CSV is empty.") from exc
        rows = list(reader)
    return header, rows


def build_csv_bytes(header: list[str], rows: list[list[str]]) -> bytes:
    out = io.StringIO(newline="")
    writer = csv.writer(out)
    writer.writerow(header)
    writer.writerows(rows)
    return out.getvalue().encode("utf-8")


def polish_rows(
    rows: list[list[str]],
    *,
    eps: float,
    min_nonzero_per_hand: int,
) -> tuple[list[list[str]], dict[str, Any]]:
    kept_rows: list[list[str]] = []
    malformed_rows = 0
    removed_rows = 0
    removed_by_label: Counter[str] = Counter()

    for row in rows:
        parsed = row_to_values(row)
        if parsed is None:
            malformed_rows += 1
            continue

        label, values = parsed
        h1 = values[:HAND_FLOATS]
        h2 = values[HAND_FLOATS:]
        h1_ok = hand_present(h1, eps=eps, min_nonzero_per_hand=min_nonzero_per_hand)
        h2_ok = hand_present(h2, eps=eps, min_nonzero_per_hand=min_nonzero_per_hand)
        if not (h1_ok and h2_ok):
            removed_rows += 1
            removed_by_label[label] += 1
            continue
        kept_rows.append(row)

    summary = {
        "removed_rows": removed_rows,
        "malformed_rows": malformed_rows,
        "removed_by_label": dict(sorted(removed_by_label.items(), key=lambda item: item[0])),
    }
    return kept_rows, summary


def write_bytes(path: Path, payload: bytes) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("wb") as file:
        file.write(payload)


def sha256_upper(payload: bytes) -> str:
    return hashlib.sha256(payload).hexdigest().upper()


def parse_env_file(path: Path) -> dict[str, str]:
    result: dict[str, str] = {}
    if not path.exists():
        return result
    for line in path.read_text(encoding="utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        key = key.strip()
        value = value.strip().strip('"').strip("'")
        if key:
            result[key] = value
    return result


def build_dataset_sql(version: str, message: str, priority: int, url: str, checksum: str) -> str:
    safe_message = str(message).replace("'", "''")
    safe_version = str(version).replace("'", "''")
    safe_url = str(url).replace("'", "''")
    safe_checksum = str(checksum).replace("'", "''")
    return (
        "begin;\n\n"
        "update public.app_config\n"
        "set is_active = false\n"
        "where type = 'dataset';\n\n"
        "insert into public.app_config (type, message, version, is_active, priority, created_at, url, checksum)\n"
        "values (\n"
        "  'dataset',\n"
        f"  '{safe_message}',\n"
        f"  '{safe_version}',\n"
        "  true,\n"
        f"  {int(priority)},\n"
        "  now(),\n"
        f"  '{safe_url}',\n"
        f"  '{safe_checksum}'\n"
        ");\n\n"
        "commit;\n"
    )


def rest_json(base_url: str, api_key: str, method: str, endpoint: str, payload: Any | None) -> Any:
    base = str(base_url).rstrip("/")
    url = f"{base}/rest/v1/{endpoint.lstrip('/')}"
    body = None if payload is None else json.dumps(payload).encode("utf-8")
    headers = {
        "apikey": api_key,
        "Authorization": f"Bearer {api_key}",
        "Accept": "application/json",
    }
    if payload is not None:
        headers["Content-Type"] = "application/json"
        headers["Prefer"] = "return=representation"

    request = Request(url=url, data=body, method=method.upper(), headers=headers)
    try:
        with urlopen(request, timeout=30) as response:
            raw = response.read().decode("utf-8", errors="replace").strip()
            if not raw:
                return None
            return json.loads(raw)
    except HTTPError as exc:
        error_body = exc.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"{method.upper()} {url} failed ({exc.code}): {error_body}") from exc


def update_dataset_row_via_supabase(
    *,
    supabase_url: str,
    service_role_key: str,
    version: str,
    message: str,
    priority: int,
    dataset_url: str,
    checksum: str,
) -> dict[str, Any]:
    deactivated = rest_json(
        base_url=supabase_url,
        api_key=service_role_key,
        method="PATCH",
        endpoint="app_config?type=eq.dataset&is_active=eq.true",
        payload={"is_active": False},
    )
    inserted = rest_json(
        base_url=supabase_url,
        api_key=service_role_key,
        method="POST",
        endpoint="app_config",
        payload={
            "type": "dataset",
            "message": message,
            "version": version,
            "is_active": True,
            "priority": int(priority),
            "url": dataset_url,
            "checksum": checksum,
        },
    )
    return {
        "deactivated_rows": 0 if deactivated is None else len(deactivated) if isinstance(deactivated, list) else 1,
        "inserted": inserted,
    }


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Release /play MediaPipe dataset.")
    parser.add_argument("--input", default="src/mediapipe_signs_db.csv", help="Source CSV path.")
    parser.add_argument(
        "--publish-path",
        default="web/public/mediapipe_signs_db.csv",
        help="Published CSV path consumed by web.",
    )
    parser.add_argument("--skip-polish", action="store_true", help="Skip one-hand removal pass.")
    parser.add_argument("--no-write-source", action="store_true", help="Do not overwrite source CSV.")
    parser.add_argument("--no-backup", action="store_true", help="Do not create source backup when overwriting.")
    parser.add_argument("--eps", type=float, default=1e-10, help="Zero threshold for hand-presence checks.")
    parser.add_argument(
        "--min-nonzero-per-hand",
        type=int,
        default=6,
        help="Min non-zero coordinates to treat a hand as present.",
    )
    parser.add_argument(
        "--expected-labels",
        default=",".join(DEFAULT_EXPECTED_LABELS),
        help="Comma-separated labels expected in final dataset.",
    )
    parser.add_argument("--min-total-rows", type=int, default=1000, help="Min valid rows for release.")
    parser.add_argument("--min-rows-per-label", type=int, default=0, help="Min rows per checked label.")
    parser.add_argument("--allow-malformed", action="store_true", help="Allow malformed rows in final dataset.")
    parser.add_argument("--allow-one-hand", action="store_true", help="Allow one-hand rows in final dataset.")
    parser.add_argument("--manifest", default="src/mediapipe_dataset_release.json", help="Output manifest JSON path.")

    parser.add_argument("--version", default="", help="Dataset version for app_config row (e.g. 2026.02.25.1).")
    parser.add_argument("--message", default="Web /play MediaPipe dataset", help="Dataset row message.")
    parser.add_argument("--priority", type=int, default=900, help="Dataset row priority.")
    parser.add_argument("--dataset-url", default="/mediapipe_signs_db.csv", help="Dataset URL in app_config.")
    parser.add_argument("--upload-app-config", action="store_true", help="Upload dataset row to Supabase app_config.")
    parser.add_argument("--supabase-url", default="", help="Override Supabase URL.")
    parser.add_argument(
        "--service-role-key",
        default="",
        help="Override Supabase service-role key (or SUPABASE_SERVICE_ROLE_KEY/SUPABASE_KEY env).",
    )
    parser.add_argument("--sql-out", default="", help="Optional path to write generated SQL.")
    parser.add_argument("--dry-run", action="store_true", help="Validate and print actions without writing/uploading.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    root = Path(__file__).resolve().parent.parent
    input_path = resolve_path(args.input, root)
    publish_path = resolve_path(args.publish_path, root)
    manifest_path = resolve_path(args.manifest, root) if args.manifest else None
    sql_out_path = resolve_path(args.sql_out, root) if args.sql_out else None

    try:
        header, input_rows = load_csv(input_path)
    except Exception as exc:
        print(f"[-] {exc}")
        return 1

    if len(header) != EXPECTED_COLS:
        print(f"[-] Unexpected header columns in source: got {len(header)}, expected {EXPECTED_COLS}.")
        return 1

    final_rows = input_rows
    polish_summary = {
        "removed_rows": 0,
        "malformed_rows": 0,
        "removed_by_label": {},
    }
    if not args.skip_polish:
        final_rows, polish_summary = polish_rows(
            input_rows,
            eps=float(args.eps),
            min_nonzero_per_hand=int(args.min_nonzero_per_hand),
        )

    payload = build_csv_bytes(header, final_rows)
    final_sha = sha256_upper(payload)
    final_size = len(payload)

    with tempfile.NamedTemporaryFile(prefix="mp_dataset_release_", suffix=".csv", delete=False) as tmp:
        tmp_path = Path(tmp.name)
        tmp.write(payload)

    try:
        stats = inspect_dataset(
            input_path=tmp_path,
            eps=float(args.eps),
            min_nonzero_per_hand=int(args.min_nonzero_per_hand),
        )
    finally:
        try:
            tmp_path.unlink(missing_ok=True)
        except Exception:
            pass

    expected_labels = parse_expected_labels(args.expected_labels)
    failures = validate_stats(
        stats,
        expected_labels=expected_labels,
        min_total_rows=int(args.min_total_rows),
        min_rows_per_label=int(args.min_rows_per_label),
        require_two_hands=not bool(args.allow_one_hand),
        allow_malformed=bool(args.allow_malformed),
    )
    if failures:
        print("[-] Validation failed:")
        for failure in failures:
            print(f"    - {failure}")
        return 2

    print("[Release]")
    print(f"  Source: {input_path}")
    print(f"  Publish: {publish_path}")
    print(f"  Rows in source: {len(input_rows)}")
    print(f"  Rows in release: {len(final_rows)}")
    if not args.skip_polish:
        print(
            "  Polish: removed_rows={removed_rows}, malformed_removed={malformed_rows}".format(
                removed_rows=polish_summary["removed_rows"],
                malformed_rows=polish_summary["malformed_rows"],
            )
        )
    else:
        print("  Polish: skipped")
    print(f"  SHA256: {final_sha}")
    print(f"  Bytes: {final_size}")

    backup_path: Path | None = None
    if args.dry_run:
        print("[Dry Run] No files were modified.")
    else:
        if not args.skip_polish and not args.no_write_source:
            if not args.no_backup:
                backup_path = input_path.with_suffix(
                    f"{input_path.suffix}.bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}"
                )
                shutil.copy2(input_path, backup_path)
            write_bytes(input_path, payload)

        write_bytes(publish_path, payload)
        written = inspect_dataset(
            input_path=publish_path,
            eps=float(args.eps),
            min_nonzero_per_hand=int(args.min_nonzero_per_hand),
        )
        if written.sha256 != final_sha:
            print(f"[-] Published hash mismatch: expected {final_sha}, got {written.sha256}")
            return 3

        if backup_path:
            print(f"[+] Source backup: {backup_path}")
        print(f"[+] Published dataset written: {publish_path}")

    manifest = {
        "generated_at": datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z"),
        "source_path": str(input_path),
        "publish_path": str(publish_path),
        "skip_polish": bool(args.skip_polish),
        "polish_summary": polish_summary,
        "release_sha256": final_sha,
        "release_size_bytes": final_size,
        "release_stats": stats.to_dict(),
        "version": args.version.strip(),
        "dataset_url": args.dataset_url,
        "message": args.message,
        "priority": int(args.priority),
        "dry_run": bool(args.dry_run),
    }

    if manifest_path and not args.dry_run:
        manifest_path.parent.mkdir(parents=True, exist_ok=True)
        manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
        print(f"[+] Manifest written: {manifest_path}")
    elif manifest_path:
        print(f"[Dry Run] Manifest target: {manifest_path}")

    sql_version = args.version.strip() or "<SET_VERSION>"
    sql_text = build_dataset_sql(
        version=sql_version,
        message=args.message,
        priority=int(args.priority),
        url=args.dataset_url,
        checksum=final_sha,
    )
    print("\n[SQL]")
    print(sql_text.rstrip())
    if sql_out_path:
        if args.dry_run:
            print(f"[Dry Run] SQL output target: {sql_out_path}")
        else:
            sql_out_path.parent.mkdir(parents=True, exist_ok=True)
            sql_out_path.write_text(sql_text, encoding="utf-8")
            print(f"[+] SQL written: {sql_out_path}")

    if args.upload_app_config:
        version = args.version.strip()
        if not version:
            print("[-] --upload-app-config requires --version.")
            return 4

        env_file = parse_env_file(root / ".env")
        supabase_url = (
            args.supabase_url.strip()
            or os.getenv("SUPABASE_URL", "").strip()
            or os.getenv("NEXT_PUBLIC_SUPABASE_URL", "").strip()
            or env_file.get("SUPABASE_URL", "").strip()
            or env_file.get("NEXT_PUBLIC_SUPABASE_URL", "").strip()
        )
        service_role_key = (
            args.service_role_key.strip()
            or os.getenv("SUPABASE_SERVICE_ROLE_KEY", "").strip()
            or os.getenv("SUPABASE_KEY", "").strip()
            or env_file.get("SUPABASE_SERVICE_ROLE_KEY", "").strip()
            or env_file.get("SUPABASE_KEY", "").strip()
        )

        if not supabase_url or not service_role_key:
            if args.dry_run:
                print("[Dry Run] Upload preview skipped (missing SUPABASE_URL or service-role key).")
            else:
                print("[-] Missing Supabase credentials for upload.")
                print("    Need SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_KEY).")
                return 5

        if args.dry_run and supabase_url and service_role_key:
            print("[Dry Run] Would upload dataset app_config row:")
            print(f"  Supabase URL: {supabase_url}")
            print(f"  Version: {version}")
            print(f"  URL: {args.dataset_url}")
            print(f"  Checksum: {final_sha}")
        elif not args.dry_run:
            try:
                upload_result = update_dataset_row_via_supabase(
                    supabase_url=supabase_url,
                    service_role_key=service_role_key,
                    version=version,
                    message=args.message,
                    priority=int(args.priority),
                    dataset_url=args.dataset_url,
                    checksum=final_sha,
                )
                print(
                    "[+] Supabase dataset row updated "
                    f"(deactivated={upload_result['deactivated_rows']})."
                )
            except Exception as exc:
                print(f"[-] Supabase upload failed: {exc}")
                return 6

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
