#!/usr/bin/env python3
"""Polish MediaPipe sign CSV by removing one-hand samples.

Input format:
label + 126 floats (h1:63 + h2:63)

This script removes rows where either hand block looks missing (all/near all zero),
which is useful when gameplay requires two-hand signs only.
"""

from __future__ import annotations

import argparse
import csv
from collections import Counter
from datetime import datetime
from pathlib import Path

HAND_FLOATS = 63
TOTAL_FLOATS = HAND_FLOATS * 2


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        description="Remove one-hand rows from MediaPipe CSV (two-hand-only polish pass).",
    )
    parser.add_argument("--input", default="src/mediapipe_signs_db.csv", help="Input CSV path.")
    parser.add_argument(
        "--output",
        default="",
        help="Output CSV path (default: <input>_polished.csv). Ignored with --inplace.",
    )
    parser.add_argument("--inplace", action="store_true", help="Overwrite input CSV (creates backup).")
    parser.add_argument(
        "--eps",
        type=float,
        default=1e-10,
        help="Absolute threshold for treating a coordinate as zero.",
    )
    parser.add_argument(
        "--min-nonzero-per-hand",
        type=int,
        default=6,
        help="Minimum non-zero coordinates required to consider a hand present.",
    )
    return parser.parse_args()


def row_to_values(row: list[str]) -> tuple[str, list[float]] | None:
    if len(row) != (1 + TOTAL_FLOATS):
        return None
    label = row[0].strip()
    try:
        values = [float(v) for v in row[1:]]
    except ValueError:
        return None
    return label, values


def hand_present(block: list[float], eps: float, min_nonzero: int) -> bool:
    nonzero = sum(1 for v in block if abs(v) > eps)
    return nonzero >= min_nonzero


def main() -> int:
    args = parse_args()
    input_path = Path(args.input)
    if not input_path.exists():
        print(f"[-] Input not found: {input_path}")
        return 1

    if args.inplace:
        output_path = input_path
        backup_path = input_path.with_suffix(f"{input_path.suffix}.bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    else:
        output_path = Path(args.output) if args.output else input_path.with_name(f"{input_path.stem}_polished{input_path.suffix}")
        backup_path = None

    with input_path.open("r", newline="", encoding="utf-8") as f:
        reader = csv.reader(f)
        try:
            header = next(reader)
        except StopIteration:
            print("[-] Empty CSV.")
            return 1
        rows = list(reader)

    expected_cols = 1 + TOTAL_FLOATS
    if len(header) != expected_cols:
        print(f"[-] Unexpected header columns: got {len(header)}, expected {expected_cols}")
        return 1

    kept_rows: list[list[str]] = []
    malformed = 0
    removed_one_hand = 0
    removed_by_label: Counter[str] = Counter()

    for row in rows:
        parsed = row_to_values(row)
        if parsed is None:
            malformed += 1
            continue
        label, values = parsed
        h1 = values[:HAND_FLOATS]
        h2 = values[HAND_FLOATS:]

        h1_ok = hand_present(h1, eps=args.eps, min_nonzero=args.min_nonzero_per_hand)
        h2_ok = hand_present(h2, eps=args.eps, min_nonzero=args.min_nonzero_per_hand)
        if not (h1_ok and h2_ok):
            removed_one_hand += 1
            removed_by_label[label] += 1
            continue
        kept_rows.append(row)

    if backup_path is not None:
        input_path.replace(backup_path)
        print(f"[+] Backup created: {backup_path}")

    with output_path.open("w", newline="", encoding="utf-8") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(kept_rows)

    print(f"[+] Wrote: {output_path}")
    print(f"    Input rows:       {len(rows)}")
    print(f"    Kept rows:        {len(kept_rows)}")
    print(f"    Removed one-hand: {removed_one_hand}")
    print(f"    Malformed skipped:{malformed}")

    if removed_by_label:
        print("    Removed by label:")
        for label, count in removed_by_label.most_common():
            print(f"      - {label}: {count}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
