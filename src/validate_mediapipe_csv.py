#!/usr/bin/env python3
"""Validate MediaPipe sign CSV structure and quality metrics.

CSV format expected:
- 127 columns
- col0: label
- col1..126: 126 floats (h1:63 + h2:63)
"""

from __future__ import annotations

import argparse
import csv
import hashlib
import json
from collections import Counter
from dataclasses import dataclass
from pathlib import Path
from typing import Iterable

HAND_FLOATS = 63
TOTAL_FLOATS = HAND_FLOATS * 2
EXPECTED_COLS = 1 + TOTAL_FLOATS

DEFAULT_EXPECTED_LABELS = [
    "idle",
    "tiger",
    "ram",
    "snake",
    "horse",
    "rat",
    "boar",
    "dog",
    "bird",
    "monkey",
    "ox",
    "dragon",
    "hare",
    "clap",
]


@dataclass
class DatasetStats:
    path: str
    sha256: str
    file_size_bytes: int
    header_cols: int
    total_rows: int
    valid_rows: int
    malformed_rows: int
    two_hand_rows: int
    one_hand_rows: int
    zero_hand_rows: int
    label_counts: Counter[str]

    def to_dict(self) -> dict:
        return {
            "path": self.path,
            "sha256": self.sha256,
            "file_size_bytes": self.file_size_bytes,
            "header_cols": self.header_cols,
            "total_rows": self.total_rows,
            "valid_rows": self.valid_rows,
            "malformed_rows": self.malformed_rows,
            "two_hand_rows": self.two_hand_rows,
            "one_hand_rows": self.one_hand_rows,
            "zero_hand_rows": self.zero_hand_rows,
            "label_counts": dict(sorted(self.label_counts.items(), key=lambda item: item[0])),
        }


def normalize_label(value: str) -> str:
    return str(value or "").strip().lower().replace("-", " ").replace("_", " ")


def parse_expected_labels(raw: str) -> list[str]:
    labels: list[str] = []
    seen = set()
    for token in str(raw or "").split(","):
        normalized = normalize_label(token)
        if not normalized or normalized in seen:
            continue
        seen.add(normalized)
        labels.append(normalized)
    return labels


def hand_present(block: Iterable[float], eps: float, min_nonzero_per_hand: int) -> bool:
    nonzero = sum(1 for value in block if abs(float(value)) > eps)
    return nonzero >= int(min_nonzero_per_hand)


def row_to_values(row: list[str]) -> tuple[str, list[float]] | None:
    if len(row) != EXPECTED_COLS:
        return None
    label = normalize_label(row[0])
    if not label:
        return None
    try:
        values = [float(value) for value in row[1:]]
    except ValueError:
        return None
    if len(values) != TOTAL_FLOATS:
        return None
    return label, values


def inspect_dataset(input_path: Path, eps: float, min_nonzero_per_hand: int) -> DatasetStats:
    if not input_path.exists():
        raise FileNotFoundError(f"Input not found: {input_path}")

    data = input_path.read_bytes()
    sha256 = hashlib.sha256(data).hexdigest().upper()
    file_size = input_path.stat().st_size

    with input_path.open("r", newline="", encoding="utf-8") as file:
        reader = csv.reader(file)
        try:
            header = next(reader)
        except StopIteration as exc:
            raise ValueError("CSV is empty.") from exc

        total_rows = 0
        valid_rows = 0
        malformed_rows = 0
        two_hand_rows = 0
        one_hand_rows = 0
        zero_hand_rows = 0
        label_counts: Counter[str] = Counter()

        for row in reader:
            total_rows += 1
            parsed = row_to_values(row)
            if parsed is None:
                malformed_rows += 1
                continue

            label, values = parsed
            valid_rows += 1
            label_counts[label] += 1
            h1 = values[:HAND_FLOATS]
            h2 = values[HAND_FLOATS:]
            h1_ok = hand_present(h1, eps=eps, min_nonzero_per_hand=min_nonzero_per_hand)
            h2_ok = hand_present(h2, eps=eps, min_nonzero_per_hand=min_nonzero_per_hand)
            if h1_ok and h2_ok:
                two_hand_rows += 1
            elif h1_ok or h2_ok:
                one_hand_rows += 1
            else:
                zero_hand_rows += 1

    return DatasetStats(
        path=str(input_path),
        sha256=sha256,
        file_size_bytes=file_size,
        header_cols=len(header),
        total_rows=total_rows,
        valid_rows=valid_rows,
        malformed_rows=malformed_rows,
        two_hand_rows=two_hand_rows,
        one_hand_rows=one_hand_rows,
        zero_hand_rows=zero_hand_rows,
        label_counts=label_counts,
    )


def validate_stats(
    stats: DatasetStats,
    *,
    expected_labels: list[str],
    min_total_rows: int,
    min_rows_per_label: int,
    require_two_hands: bool,
    allow_malformed: bool,
) -> list[str]:
    failures: list[str] = []

    if stats.header_cols != EXPECTED_COLS:
        failures.append(f"Header column count is {stats.header_cols}, expected {EXPECTED_COLS}.")

    if stats.valid_rows < int(min_total_rows):
        failures.append(f"Valid rows {stats.valid_rows} < min_total_rows {int(min_total_rows)}.")

    if not allow_malformed and stats.malformed_rows > 0:
        failures.append(f"Malformed rows found: {stats.malformed_rows}.")

    if require_two_hands and (stats.one_hand_rows > 0 or stats.zero_hand_rows > 0):
        failures.append(
            f"Expected two-hand-only dataset but found one_hand={stats.one_hand_rows}, "
            f"zero_hand={stats.zero_hand_rows}."
        )

    if expected_labels:
        missing = [label for label in expected_labels if stats.label_counts.get(label, 0) <= 0]
        if missing:
            failures.append(f"Missing expected labels: {', '.join(missing)}.")

    if int(min_rows_per_label) > 0:
        label_scope = expected_labels if expected_labels else sorted(stats.label_counts.keys())
        sparse = [
            f"{label}={stats.label_counts.get(label, 0)}"
            for label in label_scope
            if stats.label_counts.get(label, 0) < int(min_rows_per_label)
        ]
        if sparse:
            failures.append(
                f"Labels under min_rows_per_label ({int(min_rows_per_label)}): {', '.join(sparse)}."
            )

    return failures


def print_summary(stats: DatasetStats) -> None:
    print("[Dataset]")
    print(f"  Path: {stats.path}")
    print(f"  SHA256: {stats.sha256}")
    print(f"  Size: {stats.file_size_bytes} bytes")
    print(f"  Header cols: {stats.header_cols}")
    print(f"  Total rows: {stats.total_rows}")
    print(f"  Valid rows: {stats.valid_rows}")
    print(f"  Malformed rows: {stats.malformed_rows}")
    print(f"  Two-hand rows: {stats.two_hand_rows}")
    print(f"  One-hand rows: {stats.one_hand_rows}")
    print(f"  Zero-hand rows: {stats.zero_hand_rows}")
    print(f"  Labels ({len(stats.label_counts)}):")
    for label, count in sorted(stats.label_counts.items(), key=lambda item: item[0]):
        print(f"    - {label}: {count}")


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Validate MediaPipe sign CSV.")
    parser.add_argument("--input", default="src/mediapipe_signs_db.csv", help="Input CSV path.")
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
    parser.add_argument(
        "--expected-labels",
        default="",
        help="Comma-separated required labels (leave empty to disable check).",
    )
    parser.add_argument(
        "--min-total-rows",
        type=int,
        default=1,
        help="Minimum required valid rows.",
    )
    parser.add_argument(
        "--min-rows-per-label",
        type=int,
        default=0,
        help="Minimum rows required per label in checked scope.",
    )
    parser.add_argument(
        "--require-two-hands",
        action="store_true",
        help="Fail if any one-hand/zero-hand rows are present.",
    )
    parser.add_argument(
        "--allow-malformed",
        action="store_true",
        help="Do not fail on malformed rows.",
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Print JSON summary to stdout.",
    )
    parser.add_argument(
        "--json-out",
        default="",
        help="Optional path to write JSON summary.",
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    input_path = Path(args.input).expanduser().resolve()

    try:
        stats = inspect_dataset(
            input_path=input_path,
            eps=float(args.eps),
            min_nonzero_per_hand=int(args.min_nonzero_per_hand),
        )
    except Exception as exc:
        print(f"[-] {exc}")
        return 1

    expected_labels = parse_expected_labels(args.expected_labels)
    failures = validate_stats(
        stats,
        expected_labels=expected_labels,
        min_total_rows=int(args.min_total_rows),
        min_rows_per_label=int(args.min_rows_per_label),
        require_two_hands=bool(args.require_two_hands),
        allow_malformed=bool(args.allow_malformed),
    )

    payload = {
        "stats": stats.to_dict(),
        "failures": failures,
        "ok": len(failures) == 0,
    }

    if args.json:
        print(json.dumps(payload, indent=2, ensure_ascii=True))
    else:
        print_summary(stats)
        if failures:
            print("[Validation]")
            for failure in failures:
                print(f"  - {failure}")
        else:
            print("[Validation]\n  - OK")

    if args.json_out:
        json_out_path = Path(args.json_out).expanduser().resolve()
        json_out_path.parent.mkdir(parents=True, exist_ok=True)
        json_out_path.write_text(json.dumps(payload, indent=2, ensure_ascii=True) + "\n", encoding="utf-8")
        print(f"[+] Wrote JSON report: {json_out_path}")

    return 0 if not failures else 2


if __name__ == "__main__":
    raise SystemExit(main())

