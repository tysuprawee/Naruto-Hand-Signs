"""
capture_dataset.py - guided raw capture for YOLO hand-sign datasets.

Features:
- Manual batch capture by class key (1..0,-,=)
- Exact shot-count input
- Guided planner mode:
  - Enter target images per class
  - Existing images are treated as normal baseline positives
  - Generates explicit capture tasks such as:
    ram - dark light - normal - far -> N shots
  - Auto fast-shot capture for exact task counts
"""

import sys
import time
import argparse
import json
from itertools import product
from pathlib import Path
from datetime import datetime
import math
from typing import Optional
import cv2

# Add parent dir to path to use our existing utils
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.utils.paths import (
    get_class_image_dir,
    get_raw_images_dir,
    ensure_directories_exist,
    KEY_CLASS_MAP,
    get_class_names,
)
from src.utils.visualization import draw_label_with_background


LIGHTING_BUCKETS = ["dark_light", "bright_light", "backlit", "mixed_light", "normal_light"]
ANGLE_BUCKETS = ["normal", "yaw", "pitch", "roll"]
DISTANCE_BUCKETS = ["close", "medium", "far"]
BASELINE_COMBO = ("normal_light", "normal", "medium")


def pretty_token(token: str) -> str:
    return token.replace("_", " ")


def describe_task(task: dict) -> str:
    remaining = int(task.get("shots_remaining", task.get("shots", 0)))
    total = int(task.get("shots_total", remaining))
    if remaining == total:
        shot_text = f"{remaining} shots"
    else:
        done = max(0, total - remaining)
        shot_text = f"{remaining} left ({done}/{total} done)"
    return (
        f"{task['class_name']} - {pretty_token(task['lighting'])} - "
        f"{task['angle']} - {task['distance']} -> {shot_text}"
    )


def build_guided_tasks(class_counts: dict[str, int], target_per_class: int, class_names: list[str]) -> list[dict]:
    """
    Build a guided capture plan.

    Assumption:
    - Existing images are baseline "normal_light + normal angle + medium distance".
    - New captures are distributed across non-baseline combos to increase robustness.
    """
    if target_per_class <= 0:
        return []

    combos = [(l, a, d) for l, a, d in product(LIGHTING_BUCKETS, ANGLE_BUCKETS, DISTANCE_BUCKETS)]
    non_baseline = [combo for combo in combos if combo != BASELINE_COMBO]
    if not non_baseline:
        return []

    tasks: list[dict] = []
    for class_name in class_names:
        existing = int(class_counts.get(class_name, 0))
        needed_new = max(0, target_per_class - existing)
        if needed_new == 0:
            continue

        per_combo, remainder = divmod(needed_new, len(non_baseline))
        for idx, (lighting, angle, distance) in enumerate(non_baseline):
            shots = per_combo + (1 if idx < remainder else 0)
            if shots <= 0:
                continue
            tasks.append(
                {
                    "class_name": class_name,
                    "lighting": lighting,
                    "angle": angle,
                    "distance": distance,
                    "shots_total": shots,
                    "shots_remaining": shots,
                    "files": [],
                    "skipped": False,
                }
            )
    return tasks


def save_guided_tasks_markdown(
    out_path: Path,
    tasks: list[dict],
    class_counts: dict[str, int],
    target_per_class: int,
) -> None:
    out_path.parent.mkdir(parents=True, exist_ok=True)
    total_planned = sum(int(task.get("shots_total", 0)) for task in tasks)
    total_remaining = sum(int(task.get("shots_remaining", 0)) for task in tasks)
    remaining_by_class: dict[str, int] = {}
    done_by_class: dict[str, int] = {}
    for task in tasks:
        task_class = task["class_name"]
        total = int(task.get("shots_total", 0))
        rem = int(task.get("shots_remaining", 0))
        remaining_by_class[task_class] = remaining_by_class.get(task_class, 0) + rem
        done_by_class[task_class] = done_by_class.get(task_class, 0) + max(0, total - rem)

    lines = []
    lines.append("# Guided Capture Tasks")
    lines.append("")
    lines.append(f"- Target per class: `{target_per_class}`")
    lines.append(f"- Planned shots: `{total_planned}`")
    lines.append(f"- Remaining shots: `{total_remaining}`")
    lines.append(f"- Completed shots: `{max(0, total_planned - total_remaining)}`")
    lines.append("")
    lines.append("## Per-Class Summary")
    for class_name in get_class_names():
        existing = int(class_counts.get(class_name, 0))
        remaining = int(remaining_by_class.get(class_name, 0))
        done = int(done_by_class.get(class_name, 0))
        lines.append(
            f"- {class_name}: existing `{existing}`, guided done `{done}`, "
            f"guided remaining `{remaining}`, projected total `{existing + remaining}`"
        )

    lines.append("")
    lines.append("## Task List")
    if not tasks:
        lines.append("- No tasks needed.")
    else:
        for idx, task in enumerate(tasks, start=1):
            total = int(task.get("shots_total", 0))
            rem = int(task.get("shots_remaining", 0))
            done = max(0, total - rem)
            lines.append(
                f"{idx}. {task['class_name']} - {pretty_token(task['lighting'])} - "
                f"{task['angle']} - {task['distance']} -> `{rem}` left / `{total}` total (`{done}` done)"
            )

    out_path.write_text("\n".join(lines) + "\n", encoding="utf-8")


def main():
    parser = argparse.ArgumentParser(description="Guided Raw Capture Tool")
    parser.add_argument("--camera", type=int, default=0, help="Camera index")
    parser.add_argument("--width", type=int, default=640, help="Frame width")
    parser.add_argument("--height", type=int, default=480, help="Frame height")
    parser.add_argument(
        "--batch-shots",
        type=int,
        default=6,
        help="Manual mode shots per class key press (default: 6)",
    )
    parser.add_argument(
        "--initial-delay",
        type=float,
        default=3.0,
        help="Manual mode initial countdown before first capture (seconds, default: 3.0)",
    )
    parser.add_argument(
        "--rapid-delay",
        type=float,
        default=1.0,
        help="Manual mode delay between captures after first frame (seconds, default: 1.0)",
    )
    parser.add_argument(
        "--target-per-class",
        type=int,
        default=0,
        help="Guided plan target total images per class (existing + new).",
    )
    parser.add_argument(
        "--guided-delay",
        type=float,
        default=0.22,
        help="Guided auto-shot delay per frame (seconds, default: 0.22)",
    )
    args = parser.parse_args()

    if args.batch_shots <= 0:
        print("[-] --batch-shots must be > 0")
        return
    if args.initial_delay <= 0 or args.rapid_delay <= 0 or args.guided_delay <= 0:
        print("[-] --initial-delay, --rapid-delay, and --guided-delay must be > 0")
        return
    if args.target_per_class < 0:
        print("[-] --target-per-class must be >= 0")
        return

    print(f"[*] Opening camera {args.camera} in RAW mode...")
    if sys.platform.startswith("win"):
        cap = cv2.VideoCapture(args.camera, cv2.CAP_DSHOW)
    else:
        cap = cv2.VideoCapture(args.camera)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)

    if not cap.isOpened():
        print("[-] Error: Could not open camera.")
        return

    ensure_directories_exist()
    class_names = get_class_names()
    class_counts: dict[str, int] = {}
    class_dirs: dict[str, Path] = {}

    for name in class_names:
        directory = get_class_image_dir(name)
        directory.mkdir(parents=True, exist_ok=True)
        class_dirs[name] = directory

        count = len(list(directory.glob("*.jpg"))) + len(list(directory.glob("*.png")))
        class_counts[name] = count
        print(f"    {name}: {count} existing images")

    batch_shots = int(args.batch_shots)
    initial_duration = float(args.initial_delay)
    rapid_duration = float(args.rapid_delay)
    guided_duration = float(args.guided_delay)
    guided_start_countdown = 3.0
    target_per_class = int(args.target_per_class)

    print("[*] Controls:")
    print("    q: quit")
    print("    n: set manual batch shots")
    print("    [ / ]: decrease/increase manual batch shots")
    print("    c: toggle manual continuous mode")
    print("    t: set guided target per class")
    print("    g: rebuild guided tasks from scratch (resets guided progress)")
    print("    u: toggle guided mode on/off")
    print("    s: start current guided task (3-2-1 then auto fast-shot)")
    print("    a / d: previous / next unfinished guided task")
    print("    x: mark current guided task as skipped (0 remaining)")
    print("    r: redo current task (delete task files and recapture)")
    print("    z: redo last completed task")
    print("    v: print next guided tasks in terminal")
    print("    space: stop active capture")
    print("[*] Manual capture uses class keys (1..0,-,=,/).")

    flash_timer = 0.0
    saved_message = ""

    countdown_active = False
    countdown_start = 0.0
    countdown_class = None
    continuous_mode = False

    current_duration = initial_duration
    batch_target_shots = 0
    batch_captured = 0
    active_guided_capture = False

    input_mode = None  # None | "batch" | "target"
    input_buffer = ""

    guided_tasks: list[dict] = []
    guided_idx = 0
    guided_mode = False
    last_completed_task_idx: Optional[int] = None
    guided_root_dir = get_raw_images_dir()
    guided_plan_path = guided_root_dir / "guided_capture_tasks.md"
    guided_state_path = guided_root_dir / "guided_capture_state.json"
    guided_state_version = 1

    def task_capture_prefix(task: dict) -> str:
        return (
            f"{task['class_name']}__{task['lighting']}__{task['distance']}__"
            f"{task['angle']}__sharp__"
        )

    def normalize_task(task: dict) -> dict:
        normalized = {
            "class_name": str(task.get("class_name", "")),
            "lighting": str(task.get("lighting", "")),
            "angle": str(task.get("angle", "")),
            "distance": str(task.get("distance", "")),
            "shots_total": max(0, int(task.get("shots_total", 0))),
            "shots_remaining": max(0, int(task.get("shots_remaining", 0))),
            "files": [str(Path(p)) for p in task.get("files", []) if p],
            "skipped": bool(task.get("skipped", False)),
        }

        cleaned_files: list[str] = []
        seen_files = set()
        for rel in normalized["files"]:
            rel_norm = str(Path(rel))
            file_path = guided_root_dir / rel_norm
            if file_path.exists() and file_path.is_file() and rel_norm not in seen_files:
                cleaned_files.append(rel_norm)
                seen_files.add(rel_norm)
        normalized["files"] = cleaned_files

        if normalized["skipped"]:
            normalized["shots_remaining"] = 0
        else:
            normalized["shots_remaining"] = max(0, normalized["shots_total"] - len(cleaned_files))

        return normalized

    def persist_guided_state() -> None:
        try:
            payload = {
                "version": guided_state_version,
                "target_per_class": int(target_per_class),
                "class_names": class_names,
                "guided_idx": int(guided_idx),
                "last_completed_task_idx": (
                    int(last_completed_task_idx) if last_completed_task_idx is not None else None
                ),
                "tasks": [normalize_task(task) for task in guided_tasks],
            }
            temp_path = guided_state_path.with_suffix(".tmp")
            temp_path.write_text(json.dumps(payload, indent=2), encoding="utf-8")
            temp_path.replace(guided_state_path)
        except Exception as exc:
            print(f"[!] Failed to save guided state: {exc}")

    def load_guided_state_if_compatible(enable_mode: bool = True) -> bool:
        nonlocal guided_tasks, guided_idx, guided_mode, last_completed_task_idx
        if not guided_state_path.exists():
            return False

        try:
            payload = json.loads(guided_state_path.read_text(encoding="utf-8"))
        except Exception as exc:
            print(f"[!] Failed to read guided state ({exc}). Rebuilding.")
            return False

        if int(payload.get("target_per_class", -1)) != int(target_per_class):
            return False
        if list(payload.get("class_names", [])) != class_names:
            return False
        raw_tasks = payload.get("tasks", [])
        if not isinstance(raw_tasks, list) or not raw_tasks:
            return False

        loaded_tasks: list[dict] = []
        try:
            for raw_task in raw_tasks:
                task = normalize_task(raw_task)
                if task["class_name"] not in class_names:
                    raise ValueError(f"Unknown class in state: {task['class_name']}")
                loaded_tasks.append(task)
        except Exception as exc:
            print(f"[!] Guided state incompatible ({exc}). Rebuilding.")
            return False

        guided_tasks = loaded_tasks
        guided_idx = int(payload.get("guided_idx", 0))
        if guided_idx < 0 or guided_idx >= len(guided_tasks):
            guided_idx = 0

        raw_last_completed = payload.get("last_completed_task_idx")
        if raw_last_completed is None:
            last_completed_task_idx = None
        else:
            try:
                parsed_idx = int(raw_last_completed)
                last_completed_task_idx = parsed_idx if 0 <= parsed_idx < len(guided_tasks) else None
            except Exception:
                last_completed_task_idx = None

        has_pending = any(int(task.get("shots_remaining", 0)) > 0 for task in guided_tasks)
        guided_mode = bool(enable_mode and has_pending)
        save_guided_tasks_markdown(guided_plan_path, guided_tasks, class_counts, target_per_class)
        persist_guided_state()
        print(f"[+] Resumed guided state from: {guided_state_path}")
        return True

    def redo_task(task_idx: int) -> None:
        nonlocal guided_idx, guided_mode, last_completed_task_idx
        if task_idx < 0 or task_idx >= len(guided_tasks):
            print("[-] Invalid task index for redo.")
            return

        task = guided_tasks[task_idx]
        class_name = task["class_name"]
        class_dir = class_dirs[class_name]
        prefix = task_capture_prefix(task)

        files_to_remove: set[Path] = set()
        for rel in task.get("files", []):
            file_path = guided_root_dir / rel
            if file_path.exists() and file_path.is_file():
                files_to_remove.add(file_path)

        files_to_remove.update(class_dir.glob(f"{prefix}*.jpg"))
        files_to_remove.update(class_dir.glob(f"{prefix}*.png"))

        deleted = 0
        for file_path in files_to_remove:
            try:
                file_path.unlink(missing_ok=True)
                deleted += 1
            except Exception as exc:
                print(f"[!] Failed to delete {file_path}: {exc}")

            label_path = file_path.with_suffix(".txt")
            if label_path.exists():
                try:
                    label_path.unlink(missing_ok=True)
                except Exception as exc:
                    print(f"[!] Failed to delete {label_path}: {exc}")

        class_counts[class_name] = max(0, class_counts[class_name] - deleted)
        task["files"] = []
        task["skipped"] = False
        task["shots_remaining"] = int(task.get("shots_total", 0))
        guided_idx = task_idx
        guided_mode = True
        if last_completed_task_idx == task_idx:
            last_completed_task_idx = None
        save_guided_tasks_markdown(guided_plan_path, guided_tasks, class_counts, target_per_class)
        persist_guided_state()
        print(
            f"[+] Redo reset: {describe_task(task)} | deleted `{deleted}` old file(s). "
            "Task is now ready to recapture."
        )

    def pending_indices() -> list[int]:
        return [i for i, task in enumerate(guided_tasks) if int(task.get("shots_remaining", 0)) > 0]

    def pending_stats() -> tuple[int, int]:
        idxs = pending_indices()
        remaining_shots = sum(int(guided_tasks[i].get("shots_remaining", 0)) for i in idxs)
        return len(idxs), remaining_shots

    def ensure_guided_cursor() -> bool:
        nonlocal guided_idx, guided_mode
        idxs = pending_indices()
        if not idxs:
            guided_mode = False
            return False
        if guided_idx not in idxs:
            guided_idx = idxs[0]
        return True

    def move_guided_cursor(direction: int, start_idx: Optional[int] = None) -> None:
        nonlocal guided_idx, guided_mode
        if direction not in (-1, 1):
            return
        idxs = pending_indices()
        if not idxs:
            guided_mode = False
            print("[*] No unfinished guided tasks.")
            return

        start = guided_idx if start_idx is None else start_idx
        if start < 0 or start >= len(guided_tasks):
            start = idxs[0]
        n = len(guided_tasks)
        for step in range(1, n + 1):
            idx = (start + direction * step) % n
            if int(guided_tasks[idx].get("shots_remaining", 0)) > 0:
                guided_idx = idx
                persist_guided_state()
                print_next_task_preview()
                return

        guided_idx = idxs[0]
        persist_guided_state()
        print_next_task_preview()

    def print_next_task_preview() -> None:
        nonlocal guided_idx, guided_tasks
        if not ensure_guided_cursor():
            print("[*] No remaining guided tasks.")
            return

        task = guided_tasks[guided_idx]
        remaining_tasks, remaining_shots = pending_stats()
        current_remaining = int(task.get("shots_remaining", 0))
        current_total = int(task.get("shots_total", current_remaining))
        done = max(0, current_total - current_remaining)
        print(
            f"[*] Current task ({guided_idx + 1}/{len(guided_tasks)}): {describe_task(task)} "
            f"| this task done: {done}/{current_total} | pending tasks: {remaining_tasks} "
            f"| remaining shots: {remaining_shots}"
        )

    def rebuild_guided_tasks(enable_mode: bool = True) -> None:
        nonlocal guided_tasks, guided_idx, guided_mode, last_completed_task_idx
        if target_per_class <= 0:
            print("[-] Set target per class first (press 't').")
            return
        guided_tasks = build_guided_tasks(class_counts, target_per_class, class_names)
        guided_idx = 0
        last_completed_task_idx = None
        guided_mode = enable_mode and len(guided_tasks) > 0
        ensure_guided_cursor()
        save_guided_tasks_markdown(guided_plan_path, guided_tasks, class_counts, target_per_class)
        persist_guided_state()

        total_new = sum(int(task.get("shots_remaining", 0)) for task in guided_tasks)
        print(
            f"[+] Guided plan built: target/class={target_per_class}, "
            f"tasks={len(guided_tasks)}, new_shots={total_new}"
        )
        print(f"[*] Saved plan to: {guided_plan_path}")
        print(f"[*] Saved state to: {guided_state_path}")
        if guided_tasks:
            print_next_task_preview()
        else:
            print("[*] No guided tasks needed. Every class already meets target.")

    def start_guided_capture(now_ts: float) -> None:
        nonlocal countdown_active, countdown_start, countdown_class
        nonlocal current_duration, batch_target_shots, batch_captured
        nonlocal continuous_mode, active_guided_capture, guided_idx, guided_mode

        if not guided_mode:
            print("[-] Guided mode is OFF.")
            return
        if not ensure_guided_cursor():
            print("[*] Guided plan already complete.")
            return
        if countdown_active:
            print("[-] Capture already active.")
            return

        task = guided_tasks[guided_idx]
        task_remaining = int(task.get("shots_remaining", 0))
        if task_remaining <= 0:
            print("[*] This task is already completed.")
            return

        countdown_class = task["class_name"]
        countdown_start = now_ts
        countdown_active = True
        continuous_mode = False
        active_guided_capture = True
        current_duration = guided_start_countdown
        batch_captured = 0
        batch_target_shots = task_remaining

        print(
            f"[*] Guided START: {describe_task(task)} "
            f"(countdown 3-2-1, then {guided_duration:.2f}s fast shots)"
        )

    if target_per_class > 0:
        resumed = load_guided_state_if_compatible(enable_mode=True)
        if not resumed:
            rebuild_guided_tasks(enable_mode=True)

    while True:
        ret, frame = cap.read()
        if not ret:
            break

        now = time.time()

        frame = cv2.flip(frame, 1)
        original_frame = frame.copy()
        display = frame.copy()

        key = cv2.waitKey(1) & 0xFF

        if input_mode is not None:
            if key in (27,):  # ESC
                print("[*] Numeric input cancelled.")
                input_mode = None
                input_buffer = ""
            elif key in (8, 127):  # backspace
                input_buffer = input_buffer[:-1]
            elif key == 13:  # ENTER
                if not input_buffer:
                    print("[-] No number entered.")
                else:
                    entered_value = int(input_buffer)
                    if input_mode == "batch":
                        if entered_value <= 0:
                            print("[-] Batch shots must be > 0.")
                        else:
                            batch_shots = entered_value
                            print(f"[+] Manual batch shots set to {batch_shots}.")
                    elif input_mode == "target":
                        if entered_value < 0:
                            print("[-] Target per class must be >= 0.")
                        else:
                            target_per_class = entered_value
                            print(f"[+] Guided target per class set to {target_per_class}.")
                            rebuild_guided_tasks(enable_mode=True)
                input_mode = None
                input_buffer = ""
            elif ord("0") <= key <= ord("9"):
                if len(input_buffer) < 6:
                    input_buffer += chr(key)
        else:
            if key == ord("q"):
                break

            elif key in (ord("n"), ord("N")):
                input_mode = "batch"
                input_buffer = ""
                print("[*] Enter manual batch shots, then press Enter.")

            elif key in (ord("t"), ord("T")):
                input_mode = "target"
                input_buffer = ""
                print("[*] Enter guided target PER CLASS, then press Enter.")

            elif key == ord("]"):
                batch_shots += 1
                print(f"[*] Manual batch shots: {batch_shots}")

            elif key == ord("["):
                batch_shots = max(1, batch_shots - 1)
                print(f"[*] Manual batch shots: {batch_shots}")

            elif key in (ord("c"), ord("C")):
                if guided_mode:
                    print("[-] Continuous mode disabled in guided mode. Toggle guided off with 'u' first.")
                else:
                    continuous_mode = not continuous_mode
                    state = "ON" if continuous_mode else "OFF"
                    print(f"[*] Manual continuous mode: {state}")

            elif key in (ord("g"), ord("G")):
                rebuild_guided_tasks(enable_mode=True)

            elif key in (ord("u"), ord("U")):
                if not guided_tasks:
                    print("[-] No guided tasks built yet. Press 't' then 'g'.")
                else:
                    if not guided_mode:
                        if not ensure_guided_cursor():
                            print("[*] No unfinished guided tasks.")
                            continue
                    guided_mode = not guided_mode
                    print(f"[*] Guided mode: {'ON' if guided_mode else 'OFF'}")
                    persist_guided_state()
                    if guided_mode:
                        print_next_task_preview()

            elif key in (ord("s"), ord("S")):
                start_guided_capture(now)

            elif key in (ord("a"), ord("A")):
                if guided_mode and not countdown_active:
                    move_guided_cursor(-1)

            elif key in (ord("d"), ord("D")):
                if guided_mode and not countdown_active:
                    move_guided_cursor(1)

            elif key in (ord("x"), ord("X")):
                if guided_mode and not countdown_active and ensure_guided_cursor():
                    skipped = guided_tasks[guided_idx]
                    skipped["shots_remaining"] = 0
                    skipped["skipped"] = True
                    print(f"[!] Marked skipped: {describe_task(skipped)}")
                    save_guided_tasks_markdown(guided_plan_path, guided_tasks, class_counts, target_per_class)
                    persist_guided_state()
                    if ensure_guided_cursor():
                        print_next_task_preview()
                    else:
                        print("[+] Guided plan complete.")

            elif key in (ord("r"), ord("R")):
                if guided_mode and not countdown_active and ensure_guided_cursor():
                    redo_task(guided_idx)
                    print_next_task_preview()

            elif key in (ord("z"), ord("Z")):
                if guided_mode and not countdown_active:
                    if last_completed_task_idx is None:
                        print("[*] No completed guided task to redo yet.")
                    else:
                        redo_task(last_completed_task_idx)
                        print_next_task_preview()

            elif key in (ord("v"), ord("V")):
                if not guided_tasks:
                    print("[*] No guided tasks to show.")
                else:
                    idxs = pending_indices()
                    if not idxs:
                        print("[*] No unfinished guided tasks.")
                    else:
                        print("[*] Unfinished guided tasks:")
                        for idx in idxs[:12]:
                            print(f"    {idx + 1}. {describe_task(guided_tasks[idx])}")

            elif key == 32:  # SPACE
                if countdown_active:
                    if active_guided_capture and guided_mode and 0 <= guided_idx < len(guided_tasks):
                        print(
                            f"[*] Guided task paused at {batch_captured}/{batch_target_shots}. "
                            f"Current: {describe_task(guided_tasks[guided_idx])}"
                        )
                    countdown_active = False
                    countdown_class = None
                    batch_target_shots = 0
                    batch_captured = 0
                    active_guided_capture = False
                    print("[*] Active capture stopped.")

        if (input_mode is None) and (not guided_mode) and key in KEY_CLASS_MAP:
            if not countdown_active:
                countdown_class = KEY_CLASS_MAP[key]
                countdown_start = now
                countdown_active = True
                active_guided_capture = False

                current_duration = initial_duration
                batch_captured = 0
                batch_target_shots = 0 if continuous_mode else batch_shots

                if continuous_mode:
                    print(f"[*] Manual START: {countdown_class} (continuous)")
                else:
                    print(f"[*] Manual START: {countdown_class} (target {batch_target_shots})")

        current_countdown = None
        if countdown_active:
            elapsed = now - countdown_start
            remaining = current_duration - elapsed

            if remaining <= 0:
                class_name = countdown_class
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")

                if active_guided_capture and guided_mode and guided_idx < len(guided_tasks):
                    task = guided_tasks[guided_idx]
                    filename = (
                        f"{class_name}__{task['lighting']}__{task['distance']}__"
                        f"{task['angle']}__sharp__{timestamp}.jpg"
                    )
                else:
                    filename = f"{class_name}_{timestamp}.jpg"

                filepath = class_dirs[class_name] / filename

                if cv2.imwrite(str(filepath), original_frame):
                    class_counts[class_name] += 1
                    flash_timer = now + 0.2
                    batch_captured += 1
                    if active_guided_capture and guided_mode and 0 <= guided_idx < len(guided_tasks):
                        task = guided_tasks[guided_idx]
                        try:
                            rel_path = str(filepath.relative_to(guided_root_dir))
                        except ValueError:
                            rel_path = str(filepath)
                        if rel_path not in task.get("files", []):
                            task.setdefault("files", []).append(rel_path)
                        task["skipped"] = False
                        task["shots_remaining"] = max(0, int(task.get("shots_remaining", 0)) - 1)
                        persist_guided_state()
                    if batch_target_shots > 0:
                        saved_message = (
                            f"Saved: {class_name} ({class_counts[class_name]}) "
                            f"[{batch_captured}/{batch_target_shots}]"
                        )
                    else:
                        saved_message = f"Saved: {class_name} ({class_counts[class_name]})"
                    print(f"[+] {saved_message}")
                else:
                    print(f"[-] Failed to save to {filepath}")

                if continuous_mode:
                    countdown_start = now
                    current_duration = rapid_duration
                else:
                    if batch_captured >= batch_target_shots:
                        countdown_active = False
                        countdown_class = None
                        batch_target_shots = 0
                        print(f"[+] Batch complete ({batch_captured} shots).")
                        batch_captured = 0

                        if active_guided_capture:
                            active_guided_capture = False
                            completed_idx = guided_idx
                            last_completed_task_idx = completed_idx
                            if guided_idx < len(guided_tasks):
                                done_task = guided_tasks[guided_idx]
                                print(f"[+] Guided done: {describe_task(done_task)}")
                            save_guided_tasks_markdown(guided_plan_path, guided_tasks, class_counts, target_per_class)
                            persist_guided_state()
                            if not ensure_guided_cursor():
                                print("[+] Guided plan complete.")
                            else:
                                move_guided_cursor(1, start_idx=completed_idx)
                    else:
                        countdown_start = now
                        current_duration = guided_duration if active_guided_capture else rapid_duration
            else:
                current_countdown = remaining

        h, w = display.shape[:2]

        if guided_mode:
            mode_str = "Guided Auto"
            color_mode = (0, 255, 255)
        else:
            mode_str = "Manual Continuous" if continuous_mode else "Manual Batch"
            color_mode = (0, 255, 0) if continuous_mode else (255, 255, 255)

        draw_label_with_background(
            display,
            f"Hand Signs Capture | Mode: {mode_str}",
            (10, 30),
            text_color=color_mode,
        )
        draw_label_with_background(
            display,
            (
                f"Timer: {current_duration:.2f}s | Batch: {batch_shots} | "
                "N=set batch | T=set target | G=build plan | S=start task"
            ),
            (10, 60),
            text_color=(220, 220, 220),
            font_scale=0.4,
        )

        if input_mode is not None:
            label = "Set manual batch shots" if input_mode == "batch" else "Set target per class"
            draw_label_with_background(
                display,
                f"{label}: {input_buffer or '_'} (Enter confirm, Esc cancel)",
                (10, 85),
                text_color=(0, 255, 255),
                font_scale=0.5,
                padding=2,
            )

        y = 110 if input_mode is None else 135
        for k, name in sorted(KEY_CLASS_MAP.items()):
            count = class_counts[name]
            col = (0, 255, 0) if name == countdown_class else (255, 255, 255)
            pre = ">> " if name == countdown_class else ""
            text = f"{pre}[{chr(k)}] {name}: {count}"
            draw_label_with_background(
                display,
                text,
                (10, y),
                text_color=col,
                font_scale=0.5,
                padding=2,
            )
            y += 22

        if guided_mode:
            remaining_tasks, remaining_shots = pending_stats()
            draw_label_with_background(
                display,
                (
                    f"Guided target/class: {target_per_class} | "
                    f"remaining tasks: {remaining_tasks} | remaining shots: {remaining_shots}"
                ),
                (10, y + 6),
                text_color=(0, 255, 255),
                font_scale=0.45,
                padding=2,
            )
            if ensure_guided_cursor():
                task = guided_tasks[guided_idx]
                draw_label_with_background(
                    display,
                    f"Task {guided_idx + 1}/{len(guided_tasks)}: {describe_task(task)}",
                    (10, y + 30),
                    text_color=(255, 255, 0),
                    font_scale=0.45,
                    padding=2,
                )
                draw_label_with_background(
                    display,
                    "S start | A prev | D next | X skip | R redo | Z redo last | U toggle",
                    (10, y + 54),
                    text_color=(200, 200, 200),
                    font_scale=0.4,
                    padding=2,
                )
            else:
                draw_label_with_background(
                    display,
                    "Guided plan completed. Press T then G to build a new plan.",
                    (10, y + 30),
                    text_color=(0, 255, 0),
                    font_scale=0.45,
                    padding=2,
                )

        if countdown_active and batch_target_shots > 0:
            draw_label_with_background(
                display,
                f"Capture progress: {batch_captured}/{batch_target_shots}",
                (10, h - 20),
                text_color=(255, 255, 0),
                font_scale=0.5,
                padding=2,
            )

        if current_countdown is not None and current_duration >= 1.0:
            countdown_text = str(max(1, int(math.ceil(current_countdown))))
            cv2.putText(
                display,
                countdown_text,
                (w // 2 - 20, h // 2 + 20),
                cv2.FONT_HERSHEY_SIMPLEX,
                5,
                (0, 255, 255),
                8,
            )

        if now < flash_timer:
            overlay = display.copy()
            cv2.rectangle(overlay, (0, 0), (w, h), (255, 255, 255), -1)
            cv2.addWeighted(overlay, 0.5, display, 0.5, 0, display)
            draw_label_with_background(
                display,
                "CAPTURED!",
                (w // 2 - 50, h // 2),
                text_color=(0, 255, 0),
                bg_color=(0, 0, 0),
                font_scale=1.0,
            )

        cv2.imshow("Hand Signs Capture | Mode: Raw", display)

    if guided_tasks and target_per_class > 0:
        save_guided_tasks_markdown(guided_plan_path, guided_tasks, class_counts, target_per_class)
        persist_guided_state()

    cap.release()
    cv2.destroyAllWindows()


if __name__ == "__main__":
    main()
