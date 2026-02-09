#!/usr/bin/env python3
"""Augment MediaPipe sign CSV with left-right mirrored samples.

For each row:
- Mirror horizontally by negating every x coordinate in both hands
- Swap hand blocks (h1 <-> h2) to reflect handedness after mirroring

Input format expected:
label + 126 floats (h1: 63, h2: 63)
"""

from __future__ import annotations

import argparse
import csv
from datetime import datetime
from pathlib import Path

HAND_FLOATS = 63
TOTAL_FLOATS = HAND_FLOATS * 2
X_OFFSET = 0
STRIDE = 3


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Augment MediaPipe CSV with L/R mirrored rows")
    parser.add_argument("--input", default="src/mediapipe_signs_db.csv", help="Input CSV path")
    parser.add_argument("--output", default="", help="Output CSV path (default: <input>_flipped.csv)")
    parser.add_argument("--inplace", action="store_true", help="Write back to input path")
    parser.add_argument("--no-swap-hands", action="store_true", help="Only mirror x, do not swap h1/h2")
    return parser.parse_args()


def mirror_hand_block(block: list[float]) -> list[float]:
    mirrored = block[:]
    for i in range(X_OFFSET, len(mirrored), STRIDE):
        mirrored[i] = -mirrored[i]
    return mirrored


def parse_row(row: list[str], expected_cols: int) -> tuple[str, list[float]] | None:
    if len(row) != expected_cols:
        return None
    label = row[0]
    try:
        values = [float(v) for v in row[1:]]
    except ValueError:
        return None
    if len(values) != TOTAL_FLOATS:
        return None
    return label, values


def augment_rows(rows: list[list[str]], expected_cols: int, swap_hands: bool) -> list[list[str]]:
    out = []
    skipped = 0
    for row in rows:
        parsed = parse_row(row, expected_cols)
        if parsed is None:
            skipped += 1
            continue
        label, values = parsed

        h1 = values[:HAND_FLOATS]
        h2 = values[HAND_FLOATS:]

        h1_m = mirror_hand_block(h1)
        h2_m = mirror_hand_block(h2)

        if swap_hands:
            aug = h2_m + h1_m
        else:
            aug = h1_m + h2_m

        out.append([label] + [f"{v:.10g}" for v in values])
        out.append([label] + [f"{v:.10g}" for v in aug])

    if skipped:
        print(f"[!] Skipped malformed rows: {skipped}")
    return out


def main() -> int:
    args = parse_args()

    input_path = Path(args.input)
    if not input_path.exists():
        print(f"[-] Input not found: {input_path}")
        return 1

    if args.inplace:
        output_path = input_path
        backup_path = input_path.with_suffix(input_path.suffix + f".bak.{datetime.now().strftime('%Y%m%d_%H%M%S')}")
    else:
        output_path = Path(args.output) if args.output else input_path.with_name(f"{input_path.stem}_flipped{input_path.suffix}")
        backup_path = None

    with input_path.open("r", newline="") as f:
        reader = csv.reader(f)
        try:
            header = next(reader)
        except StopIteration:
            print("[-] Empty CSV")
            return 1
        rows = list(reader)

    expected_cols = 1 + TOTAL_FLOATS
    if len(header) != expected_cols:
        # Repair known malformed export where first data row is concatenated to header.
        # Example: final header token becomes "h2_20_zHorse", followed by 126 floats.
        if len(header) == expected_cols + TOTAL_FLOATS and header[126].startswith("h2_20_z"):
            suffix_label = header[126][len("h2_20_z"):]
            repaired_header = header[:expected_cols]
            repaired_header[126] = "h2_20_z"
            first_row = [suffix_label] + header[expected_cols:]
            header = repaired_header
            rows = [first_row] + rows
            print("[!] Repaired malformed header and recovered first data row.")
        else:
            print(f"[-] Unexpected header columns: got {len(header)}, expected {expected_cols}")
            return 1

    augmented = augment_rows(rows, expected_cols, swap_hands=not args.no_swap_hands)

    if backup_path is not None:
        input_path.replace(backup_path)
        print(f"[+] Backup created: {backup_path}")

    with output_path.open("w", newline="") as f:
        writer = csv.writer(f)
        writer.writerow(header)
        writer.writerows(augmented)

    print(f"[+] Wrote: {output_path}")
    print(f"    Original rows: {len(rows)}")
    print(f"    Augmented rows: {len(augmented)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
