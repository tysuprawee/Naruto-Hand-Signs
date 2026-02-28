#!/usr/bin/env python3
"""
Train/update MediaPipe sign classifier data from manual intertwined-landmark annotations.

Inputs:
- JSONL annotations created by src/landmark_intertwine_annotator.py

Outputs:
- CSV in standard format: label + 126 floats (h1:63 + h2:63)
- Optional merge into src/mediapipe_signs_db.csv
- Optional KNN model file (.yml) for standalone evaluation
"""

from __future__ import annotations

import argparse
import csv
import json
import math
import random
import shutil
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np


HAND_FLOATS = 63
TOTAL_FLOATS = HAND_FLOATS * 2
POINT_COUNT = 21
DEFAULT_LABELS = [
    "Idle",
    "Tiger",
    "Ram",
    "Snake",
    "Horse",
    "Rat",
    "Boar",
    "Dog",
    "Bird",
    "Monkey",
    "Ox",
    "Dragon",
    "Hare",
    "Clap",
]


def normalize_label(raw: str) -> str:
    token = str(raw or "").strip().lower().replace("-", " ").replace("_", " ")
    token = " ".join(token.split())
    aliases = {
        "none": "idle",
        "unknown": "idle",
        "pig": "boar",
        "sheep": "ram",
        "bull": "ox",
        "rabbit": "hare",
        "hand clap": "clap",
        "hands clap": "clap",
        "handclap": "clap",
    }
    token = aliases.get(token, token)
    if not token:
        return "Idle"
    return token[:1].upper() + token[1:]


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def parse_labels(raw: str) -> list[str]:
    labels = []
    seen = set()
    for token in str(raw or "").split(","):
        label = normalize_label(token)
        if label in seen:
            continue
        seen.add(label)
        labels.append(label)
    if not labels:
        return list(DEFAULT_LABELS)
    if "Idle" not in seen:
        labels.insert(0, "Idle")
    return labels


def canonical_header() -> list[str]:
    return ["label"] + [f"h1_{i}_{ax}" for i in range(POINT_COUNT) for ax in "xyz"] + [
        f"h2_{i}_{ax}" for i in range(POINT_COUNT) for ax in "xyz"
    ]


def hand_visible_count(hand: dict) -> int:
    count = 0
    for point in (hand.get("points", []) or [])[:POINT_COUNT]:
        try:
            if float(point.get("v", 1) or 0) > 0:
                count += 1
        except Exception:
            continue
    return count


def normalize_hand(points: list[dict]) -> list[float]:
    if len(points) < POINT_COUNT:
        return [0.0] * HAND_FLOATS

    wrist = points[0]
    wx = float(wrist.get("x", 0.0) or 0.0)
    wy = float(wrist.get("y", 0.0) or 0.0)
    wz = float(wrist.get("z", 0.0) or 0.0)
    visible_dists: list[float] = []
    for idx, point in enumerate(points[:POINT_COUNT]):
        if idx == 0:
            continue
        v = float(point.get("v", 1) or 0)
        if v <= 0:
            continue
        px = float(point.get("x", 0.0) or 0.0)
        py = float(point.get("y", 0.0) or 0.0)
        pz = float(point.get("z", 0.0) or 0.0)
        d = math.sqrt((px - wx) ** 2 + (py - wy) ** 2 + (pz - wz) ** 2)
        if d > 1e-6:
            visible_dists.append(d)
    if visible_dists:
        visible_dists.sort()
        dist = visible_dists[len(visible_dists) // 2]
    else:
        dist = 1.0

    out = []
    for point in points[:POINT_COUNT]:
        if float(point.get("v", 1) or 0) <= 0:
            out.extend([0.0, 0.0, 0.0])
            continue
        px = float(point.get("x", 0.0) or 0.0)
        py = float(point.get("y", 0.0) or 0.0)
        pz = float(point.get("z", 0.0) or 0.0)
        out.extend([(px - wx) / dist, (py - wy) / dist, (pz - wz) / dist])
    if len(out) != HAND_FLOATS:
        return [0.0] * HAND_FLOATS
    return out


def mirror_features(values: list[float]) -> list[float]:
    h1 = list(values[:HAND_FLOATS])
    h2 = list(values[HAND_FLOATS:])

    def mirror_block(block: list[float]) -> list[float]:
        out = block[:]
        for i in range(0, len(out), 3):
            out[i] = -out[i]
        return out

    return mirror_block(h2) + mirror_block(h1)


def read_annotations(path: Path) -> list[dict]:
    if not path.exists():
        raise FileNotFoundError(f"Annotations not found: {path}")
    rows = []
    for line_idx, line in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        row = line.strip()
        if not row:
            continue
        try:
            obj = json.loads(row)
        except json.JSONDecodeError:
            print(f"[!] Skipping malformed JSON line {line_idx}")
            continue
        if not isinstance(obj, dict):
            continue
        rows.append(obj)
    return rows


def extract_training_rows(
    annotations: list[dict],
    allowed_labels: set[str],
    min_visible_per_hand: int,
) -> tuple[list[list[str]], dict[str, int]]:
    out_rows: list[list[str]] = []
    stats = {
        "accepted": 0,
        "skipped_label": 0,
        "skipped_structure": 0,
    }

    for ann in annotations:
        label = normalize_label(str(ann.get("label", "")))
        if label not in allowed_labels:
            stats["skipped_label"] += 1
            continue

        hands = ann.get("hands", [])
        if not isinstance(hands, list) or len(hands) < 2:
            stats["skipped_structure"] += 1
            continue

        features: list[float] = []
        for hand_idx in range(2):
            hand = hands[hand_idx]
            if not isinstance(hand, dict):
                features.extend([0.0] * HAND_FLOATS)
                continue

            present = bool(hand.get("present", False))
            visible = hand_visible_count(hand)
            points = hand.get("points", [])
            if (
                present
                and isinstance(points, list)
                and len(points) >= POINT_COUNT
                and visible >= int(min_visible_per_hand)
            ):
                features.extend(normalize_hand(points))
            else:
                features.extend([0.0] * HAND_FLOATS)

        if len(features) != TOTAL_FLOATS:
            stats["skipped_structure"] += 1
            continue
        out_rows.append([label] + [f"{v:.10g}" for v in features])
        stats["accepted"] += 1
    return out_rows, stats


def augment_rows(
    rows: list[list[str]],
    mirror: bool,
    dropout_copies: int,
    dropout_probability: float,
    jitter_sigma: float,
    rng: random.Random,
) -> list[list[str]]:
    augmented = []
    for row in rows:
        label = normalize_label(row[0])
        values = [float(v) for v in row[1:1 + TOTAL_FLOATS]]

        def append_feature_vec(vec: list[float]):
            augmented.append([label] + [f"{v:.10g}" for v in vec])

        append_feature_vec(values)

        if mirror:
            append_feature_vec(mirror_features(values))

        # Add synthetic one-hand dropouts + jitter to improve occlusion robustness.
        for _ in range(max(0, int(dropout_copies))):
            if rng.random() > float(dropout_probability):
                continue
            vec = list(values)
            hand_to_drop = 0 if rng.random() < 0.5 else 1
            start = hand_to_drop * HAND_FLOATS
            end = start + HAND_FLOATS
            for idx in range(start, end):
                vec[idx] = 0.0
            if jitter_sigma > 0:
                for idx in range(TOTAL_FLOATS):
                    vec[idx] += rng.gauss(0.0, float(jitter_sigma))
            append_feature_vec(vec)
    return augmented


def write_csv(path: Path, rows: list[list[str]]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerow(canonical_header())
        writer.writerows(rows)


def backup_path(path: Path) -> Path:
    stamp = datetime.now().strftime("%Y%m%d_%H%M%S")
    return path.with_suffix(path.suffix + f".bak.{stamp}")


def merge_into_dataset(source_rows: list[list[str]], target_path: Path) -> tuple[int, int]:
    target_path.parent.mkdir(parents=True, exist_ok=True)
    if not target_path.exists():
        with target_path.open("w", newline="", encoding="utf-8") as file:
            writer = csv.writer(file)
            writer.writerow(canonical_header())

    # Backup existing file before mutation.
    backup = backup_path(target_path)
    shutil.copy2(target_path, backup)
    print(f"[+] Backup created: {backup}")

    existing = 0
    with target_path.open("r", newline="", encoding="utf-8") as file:
        reader = csv.reader(file)
        next(reader, None)
        for _ in reader:
            existing += 1

    with target_path.open("a", newline="", encoding="utf-8") as file:
        writer = csv.writer(file)
        writer.writerows(source_rows)

    return existing, len(source_rows)


def evaluate_knn(rows: list[list[str]], k: int, threshold: float, seed: int) -> tuple[float, int]:
    if len(rows) < 20:
        return 0.0, 0

    rng = random.Random(seed)
    shuffled = list(rows)
    rng.shuffle(shuffled)
    split = int(len(shuffled) * 0.8)
    train_rows = shuffled[:split]
    test_rows = shuffled[split:]
    if len(train_rows) < 5 or len(test_rows) < 5:
        return 0.0, 0

    X_train = np.asarray([[float(v) for v in row[1:1 + TOTAL_FLOATS]] for row in train_rows], dtype=np.float32)
    y_train = [normalize_label(row[0]) for row in train_rows]
    labels = sorted(set(y_train))
    label_to_idx = {label: idx for idx, label in enumerate(labels)}
    y_int = np.asarray([label_to_idx[label] for label in y_train], dtype=np.int32)

    knn = cv2.ml.KNearest_create()
    knn.train(X_train, cv2.ml.ROW_SAMPLE, y_int)

    correct = 0
    for row in test_rows:
        target = normalize_label(row[0])
        sample = np.asarray([[float(v) for v in row[1:1 + TOTAL_FLOATS]]], dtype=np.float32)
        _, result, _, dist = knn.findNearest(sample, k=max(1, int(k)))
        min_dist = float(dist[0][0]) if dist is not None else float("inf")
        if min_dist > float(max(0.1, threshold)):
            pred = "Idle"
        else:
            idx = int(result[0][0])
            pred = labels[idx] if 0 <= idx < len(labels) else "Unknown"
        if normalize_label(pred) == target:
            correct += 1

    acc = float(correct) / max(1, len(test_rows))
    return acc, len(test_rows)


def save_knn_model(rows: list[list[str]], out_path: Path, k: int) -> None:
    X = np.asarray([[float(v) for v in row[1:1 + TOTAL_FLOATS]] for row in rows], dtype=np.float32)
    y = [normalize_label(row[0]) for row in rows]
    labels = sorted(set(y))
    label_to_idx = {label: idx for idx, label in enumerate(labels)}
    y_int = np.asarray([label_to_idx[label] for label in y], dtype=np.int32)

    knn = cv2.ml.KNearest_create()
    knn.train(X, cv2.ml.ROW_SAMPLE, y_int)
    out_path.parent.mkdir(parents=True, exist_ok=True)
    knn.save(str(out_path))

    labels_path = out_path.with_suffix(out_path.suffix + ".labels.json")
    labels_path.write_text(json.dumps({"labels": labels, "k": int(k)}, indent=2), encoding="utf-8")
    print(f"[+] KNN model saved: {out_path}")
    print(f"[+] Label map saved: {labels_path}")


def main() -> int:
    parser = argparse.ArgumentParser(description="Train intertwined-hand classifier data from manual landmarks.")
    parser.add_argument(
        "--annotations",
        default="dataset/intertwine_annotations.jsonl",
        help="Input JSONL annotations path.",
    )
    parser.add_argument(
        "--output-csv",
        default="src/intertwine_signs_db.csv",
        help="Output CSV path (label + 126 floats).",
    )
    parser.add_argument(
        "--labels",
        default=",".join(DEFAULT_LABELS),
        help="Comma-separated allowed labels.",
    )
    parser.add_argument(
        "--min-visible-per-hand",
        type=int,
        default=6,
        help="Minimum visible points to consider a hand present.",
    )
    parser.add_argument("--mirror", action="store_true", help="Include mirrored samples.")
    parser.add_argument(
        "--dropout-copies",
        type=int,
        default=1,
        help="How many one-hand-dropout variants to attempt per row.",
    )
    parser.add_argument(
        "--dropout-probability",
        type=float,
        default=0.65,
        help="Probability of applying dropout copy.",
    )
    parser.add_argument(
        "--jitter-sigma",
        type=float,
        default=0.0,
        help="Optional gaussian jitter sigma for augmented copies.",
    )
    parser.add_argument("--seed", type=int, default=1337, help="Random seed.")
    parser.add_argument(
        "--merge-into",
        default="",
        help="Optional path to append generated rows into an existing CSV (e.g. src/mediapipe_signs_db.csv).",
    )
    parser.add_argument("--eval-k", type=int, default=3, help="K for evaluation KNN.")
    parser.add_argument(
        "--eval-threshold",
        type=float,
        default=1.8,
        help="Distance threshold for evaluation KNN (Idle fallback above threshold).",
    )
    parser.add_argument(
        "--save-knn-model",
        default="",
        help="Optional output path to save OpenCV KNN model .yml.",
    )
    args = parser.parse_args()

    annotations_path = Path(args.annotations).expanduser().resolve()
    output_csv = Path(args.output_csv).expanduser().resolve()
    labels = parse_labels(args.labels)
    allowed_labels = set(labels)

    annotations = read_annotations(annotations_path)
    base_rows, stats = extract_training_rows(
        annotations=annotations,
        allowed_labels=allowed_labels,
        min_visible_per_hand=max(1, int(args.min_visible_per_hand)),
    )
    if not base_rows:
        print("[-] No training rows extracted. Check labels/annotations.")
        return 1

    rng = random.Random(int(args.seed))
    augmented_rows = augment_rows(
        rows=base_rows,
        mirror=bool(args.mirror),
        dropout_copies=max(0, int(args.dropout_copies)),
        dropout_probability=clamp01(float(args.dropout_probability)),
        jitter_sigma=max(0.0, float(args.jitter_sigma)),
        rng=rng,
    )
    write_csv(output_csv, augmented_rows)

    print("[Training Data]")
    print(f"  Annotations read: {len(annotations)}")
    print(f"  Accepted base rows: {stats['accepted']}")
    print(f"  Skipped (label): {stats['skipped_label']}")
    print(f"  Skipped (structure): {stats['skipped_structure']}")
    print(f"  Augmented rows written: {len(augmented_rows)}")
    print(f"  Output CSV: {output_csv}")

    eval_acc, eval_count = evaluate_knn(
        rows=augmented_rows,
        k=max(1, int(args.eval_k)),
        threshold=float(args.eval_threshold),
        seed=int(args.seed),
    )
    if eval_count > 0:
        print(f"[Eval] holdout_acc={eval_acc * 100:.2f}% on {eval_count} samples")

    if args.save_knn_model:
        model_path = Path(args.save_knn_model).expanduser().resolve()
        save_knn_model(rows=augmented_rows, out_path=model_path, k=max(1, int(args.eval_k)))

    if str(args.merge_into or "").strip():
        merge_path = Path(args.merge_into).expanduser().resolve()
        existing_count, appended = merge_into_dataset(source_rows=augmented_rows, target_path=merge_path)
        print(f"[Merge] Existing rows: {existing_count}")
        print(f"[Merge] Appended rows: {appended}")
        print(f"[Merge] Target CSV: {merge_path}")

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
