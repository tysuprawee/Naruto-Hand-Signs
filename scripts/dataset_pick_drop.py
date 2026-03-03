#!/usr/bin/env python3
"""
Interactive dataset picker/dropper for MediaPipe hand-sign CSVs.

Usage examples:
  python3 scripts/dataset_pick_drop.py
  python3 scripts/dataset_pick_drop.py --input src/mediapipe_signs_db.csv --output dataset_pick_and_drop.csv
  python3 scripts/dataset_pick_drop.py --label Horse --label Snake --max-rows 200

Controls:
  k = keep current row and move next
  d = drop current row and move next
  u = clear decision for current row
  m = toggle mirror-x view
  w = toggle hand1/hand2 swap in view
  right / n = next row
  left / p / b = previous row
  s = save now
  q = save and quit
"""

from __future__ import annotations

import argparse
import csv
import json
import random
import sys
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Tuple

try:
    import matplotlib.pyplot as plt
except Exception as exc:  # pragma: no cover - runtime guard
    print("matplotlib is required for visualization.")
    print(f"Import error: {exc}")
    sys.exit(1)


HAND_CONNECTIONS: List[Tuple[int, int]] = [
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12),
    (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (17, 18), (18, 19), (19, 20),
    (0, 17),
]


@dataclass
class SampleRow:
    original_index: int
    row: Dict[str, str]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Visual keep/drop tool for hand-sign datasets.")
    parser.add_argument(
        "--input",
        type=Path,
        default=None,
        help="Input CSV path (default: auto-detect web/public or src mediapipe_signs_db.csv).",
    )
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("dataset_pick_and_drop.csv"),
        help="Output CSV path for kept rows.",
    )
    parser.add_argument(
        "--state",
        type=Path,
        default=Path("dataset_pick_and_drop_state.json"),
        help="State JSON path for decisions/resume.",
    )
    parser.add_argument(
        "--label",
        action="append",
        default=[],
        help="Filter by label (repeat for multiple labels).",
    )
    parser.add_argument(
        "--max-rows",
        type=int,
        default=0,
        help="If > 0, only review this many rows.",
    )
    parser.add_argument(
        "--shuffle",
        action="store_true",
        help="Shuffle review order (output stays sorted by original row index).",
    )
    parser.add_argument(
        "--seed",
        type=int,
        default=7,
        help="Random seed used when --shuffle is enabled.",
    )
    parser.add_argument(
        "--start-index",
        type=int,
        default=0,
        help="Initial index in the reviewed subset.",
    )
    parser.add_argument(
        "--undecided-policy",
        choices=["keep", "drop"],
        default="keep",
        help="How to handle undecided rows when saving.",
    )
    parser.add_argument(
        "--no-mirror-x",
        action="store_true",
        help="Disable mirrored x-view at startup (default startup is mirrored).",
    )
    parser.add_argument(
        "--swap-hands",
        action="store_true",
        help="Swap hand1 and hand2 in viewer at startup.",
    )
    return parser.parse_args()


def detect_default_input() -> Path:
    candidates = [
        Path("web/public/mediapipe_signs_db.csv"),
        Path("src/mediapipe_signs_db.csv"),
    ]
    for candidate in candidates:
        if candidate.exists():
            return candidate
    raise FileNotFoundError(
        "Could not auto-detect input CSV. Use --input to provide a dataset path."
    )


def load_rows(path: Path) -> Tuple[List[str], List[SampleRow]]:
    with path.open("r", newline="", encoding="utf-8") as handle:
        reader = csv.DictReader(handle)
        if not reader.fieldnames:
            raise ValueError(f"CSV has no header: {path}")
        header = list(reader.fieldnames)
        rows: List[SampleRow] = []
        for idx, row in enumerate(reader):
            rows.append(SampleRow(original_index=idx, row=row))
    return header, rows


def filter_rows(rows: List[SampleRow], labels: List[str]) -> List[SampleRow]:
    if not labels:
        return rows
    wanted = {label.strip().lower() for label in labels if label.strip()}
    if not wanted:
        return rows
    return [item for item in rows if str(item.row.get("label", "")).strip().lower() in wanted]


def load_state(path: Path, size: int) -> List[int]:
    if not path.exists():
        return [-1] * size
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except Exception:
        return [-1] * size
    decisions = data.get("decisions", [])
    if not isinstance(decisions, list):
        return [-1] * size
    out = [-1] * size
    for i in range(min(size, len(decisions))):
        value = decisions[i]
        out[i] = int(value) if value in (-1, 0, 1) else -1
    return out


def save_state(path: Path, decisions: List[int], cursor: int) -> None:
    payload = {
        "cursor": int(max(0, cursor)),
        "decisions": decisions,
    }
    path.write_text(json.dumps(payload, indent=2), encoding="utf-8")


def hand_points(row: Dict[str, str], hand_idx: int) -> List[Tuple[float, float, float]]:
    points: List[Tuple[float, float, float]] = []
    for i in range(21):
        x = float(row.get(f"h{hand_idx}_{i}_x", "0") or 0)
        y = float(row.get(f"h{hand_idx}_{i}_y", "0") or 0)
        z = float(row.get(f"h{hand_idx}_{i}_z", "0") or 0)
        points.append((x, y, z))
    return points


def hand_is_present(points: List[Tuple[float, float, float]]) -> bool:
    energy = 0.0
    for x, y, z in points:
        energy += abs(x) + abs(y) + abs(z)
    return energy > 1e-6


def draw_hand(ax, points: List[Tuple[float, float, float]], color: str, name: str) -> None:
    xs = [p[0] for p in points]
    ys = [p[1] for p in points]
    ax.scatter(xs, ys, c=color, s=22, alpha=0.9, label=name)
    for a, b in HAND_CONNECTIONS:
        ax.plot(
            [points[a][0], points[b][0]],
            [points[a][1], points[b][1]],
            color=color,
            linewidth=1.6,
            alpha=0.9,
        )


def transform_points(
    points: List[Tuple[float, float, float]],
    mirror_x: bool,
) -> List[Tuple[float, float, float]]:
    if not mirror_x:
        return points
    return [(-x, y, z) for x, y, z in points]


def decision_to_text(value: int) -> str:
    if value == 1:
        return "KEEP"
    if value == 0:
        return "DROP"
    return "UNDECIDED"


class Reviewer:
    def __init__(
        self,
        rows: List[SampleRow],
        header: List[str],
        decisions: List[int],
        args: argparse.Namespace,
    ) -> None:
        self.rows = rows
        self.header = header
        self.decisions = decisions
        self.args = args
        self.cursor = max(0, min(len(rows) - 1, int(args.start_index))) if rows else 0
        self.mirror_x = not bool(args.no_mirror_x)
        self.swap_hands = bool(args.swap_hands)
        self.fig, self.ax = plt.subplots(figsize=(8.6, 7.2))
        self.help_text = (
            "k keep | d drop | u undecide | m mirror | w swap hands | left/right (or p/n) navigate | s save | q save+quit"
        )
        self.help_artist = self.fig.text(0.02, 0.01, self.help_text, fontsize=9, family="monospace")
        self.cid = self.fig.canvas.mpl_connect("key_press_event", self.on_key)
        try:
            self.fig.canvas.manager.set_window_title("Dataset Pick/Drop")
        except Exception:
            pass
        self.redraw()

    def save_outputs(self) -> None:
        policy_keep_undecided = self.args.undecided_policy == "keep"
        selected: List[SampleRow] = []
        for idx, item in enumerate(self.rows):
            decision = self.decisions[idx]
            if decision == 1 or (decision == -1 and policy_keep_undecided):
                selected.append(item)

        selected.sort(key=lambda item: item.original_index)
        self.args.output.parent.mkdir(parents=True, exist_ok=True)
        with self.args.output.open("w", newline="", encoding="utf-8") as handle:
            writer = csv.DictWriter(handle, fieldnames=self.header)
            writer.writeheader()
            for item in selected:
                writer.writerow(item.row)

        save_state(self.args.state, self.decisions, self.cursor)
        keep_count = sum(1 for d in self.decisions if d == 1)
        drop_count = sum(1 for d in self.decisions if d == 0)
        undecided_count = sum(1 for d in self.decisions if d == -1)
        print(
            f"Saved {len(selected)} rows -> {self.args.output} "
            f"(keep={keep_count}, drop={drop_count}, undecided={undecided_count}, policy={self.args.undecided_policy})"
        )

    def move(self, step: int) -> None:
        if not self.rows:
            return
        self.cursor = max(0, min(len(self.rows) - 1, self.cursor + step))
        self.redraw()

    def set_decision(self, value: int, auto_next: bool = False) -> None:
        if not self.rows:
            return
        self.decisions[self.cursor] = value
        if auto_next:
            self.move(1)
        else:
            self.redraw()

    def on_key(self, event) -> None:
        key = (event.key or "").lower()
        if key in ("k",):
            self.set_decision(1, auto_next=True)
            return
        if key in ("d",):
            self.set_decision(0, auto_next=True)
            return
        if key in ("u",):
            self.set_decision(-1, auto_next=False)
            return
        if key in ("m",):
            self.mirror_x = not self.mirror_x
            self.redraw()
            return
        if key in ("w",):
            self.swap_hands = not self.swap_hands
            self.redraw()
            return
        if key in ("right", "n"):
            self.move(1)
            return
        if key in ("left", "p", "b"):
            self.move(-1)
            return
        if key == "s":
            self.save_outputs()
            return
        if key == "q":
            self.save_outputs()
            plt.close(self.fig)
            return

    def redraw(self) -> None:
        self.ax.clear()
        if not self.rows:
            self.ax.text(0.5, 0.5, "No rows to review.", ha="center", va="center")
            self.ax.set_axis_off()
            self.fig.canvas.draw_idle()
            return

        item = self.rows[self.cursor]
        row = item.row
        label = str(row.get("label", "Unknown"))

        h1 = hand_points(row, 1)
        h2 = hand_points(row, 2)
        if self.swap_hands:
            h1, h2 = h2, h1
        h1 = transform_points(h1, mirror_x=self.mirror_x)
        h2 = transform_points(h2, mirror_x=self.mirror_x)
        h1_present = hand_is_present(h1)
        h2_present = hand_is_present(h2)

        if h1_present:
            draw_hand(self.ax, h1, color="#F97316", name="hand1")
        if h2_present:
            draw_hand(self.ax, h2, color="#06B6D4", name="hand2")

        all_xy: List[Tuple[float, float]] = []
        if h1_present:
            all_xy.extend((x, y) for x, y, _ in h1)
        if h2_present:
            all_xy.extend((x, y) for x, y, _ in h2)
        if all_xy:
            xs = [p[0] for p in all_xy]
            ys = [p[1] for p in all_xy]
            min_x, max_x = min(xs), max(xs)
            min_y, max_y = min(ys), max(ys)
            pad_x = max(0.15, (max_x - min_x) * 0.35)
            pad_y = max(0.15, (max_y - min_y) * 0.35)
            self.ax.set_xlim(min_x - pad_x, max_x + pad_x)
            self.ax.set_ylim(max_y + pad_y, min_y - pad_y)  # invert y-like image space
            self.ax.set_aspect("equal", adjustable="box")
        else:
            self.ax.set_xlim(-1.2, 1.2)
            self.ax.set_ylim(1.2, -1.2)
            self.ax.set_aspect("equal", adjustable="box")
            self.ax.text(0, 0, "No hand points", ha="center", va="center", fontsize=12)

        keep_count = sum(1 for d in self.decisions if d == 1)
        drop_count = sum(1 for d in self.decisions if d == 0)
        undecided_count = sum(1 for d in self.decisions if d == -1)
        decision = decision_to_text(self.decisions[self.cursor])
        title = (
            f"Label: {label} | Review {self.cursor + 1}/{len(self.rows)} "
            f"(orig row {item.original_index + 1}) | Decision: {decision}"
        )
        subtitle = (
            f"keep={keep_count} drop={drop_count} undecided={undecided_count} "
            f"| output={self.args.output.name} | undecided-policy={self.args.undecided_policy} "
            f"| mirror={'ON' if self.mirror_x else 'OFF'} swap={'ON' if self.swap_hands else 'OFF'}"
        )
        self.ax.set_title(f"{title}\n{subtitle}", fontsize=10)
        handles, labels = self.ax.get_legend_handles_labels()
        if handles:
            self.ax.legend(loc="upper right")
        self.ax.grid(True, alpha=0.15)
        self.fig.tight_layout(rect=(0, 0.04, 1, 1))
        self.fig.canvas.draw_idle()


def main() -> int:
    args = parse_args()
    input_path = args.input or detect_default_input()
    if not input_path.exists():
        print(f"Input file not found: {input_path}")
        return 1

    header, rows = load_rows(input_path)
    rows = filter_rows(rows, args.label)
    if args.shuffle:
        random.seed(args.seed)
        random.shuffle(rows)
    if args.max_rows > 0:
        rows = rows[: args.max_rows]

    if not rows:
        print("No rows matched the selected filters.")
        return 1

    decisions = load_state(args.state, len(rows))

    print(f"Loaded {len(rows)} rows from {input_path}")
    print(f"Output file: {args.output}")
    print(f"State file:  {args.state}")
    print("Open the plot window and use keyboard controls.")

    reviewer = Reviewer(rows=rows, header=header, decisions=decisions, args=args)
    plt.show()

    # Save once more when the window closes, so progress is not lost.
    reviewer.save_outputs()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
