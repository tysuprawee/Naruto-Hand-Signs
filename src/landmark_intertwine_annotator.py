#!/usr/bin/env python3
"""
Manual 2-hand landmark annotator for intertwined/occluded frames.

This tool lets you drag 21 hand keypoints per hand and save annotations to JSONL.
It is designed for correcting difficult frames where MediaPipe drops one hand.

Output schema (one JSON object per line):
{
  "image": "relative/path/to/frame.jpg",
  "label": "Tiger",
  "width": 640,
  "height": 480,
  "hands": [
    {"present": true,  "points": [{"x":0.5,"y":0.7,"z":0.0,"v":1}, ... 21]},
    {"present": false, "points": [{"x":0.5,"y":0.7,"z":0.0,"v":0}, ... 21]}
  ],
  "updated_at": "2026-02-27T12:00:00Z"
}
"""

from __future__ import annotations

import argparse
import json
import math
import time
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

import cv2

try:
    import mediapipe as mp
    from mediapipe.tasks import python
    from mediapipe.tasks.python import vision
except Exception:  # pragma: no cover - optional runtime dependency path
    mp = None
    python = None
    vision = None


POINT_COUNT = 21
SUPPORTED_IMAGE_EXTS = {".jpg", ".jpeg", ".png", ".bmp", ".webp"}
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
HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12),
    (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (17, 18), (18, 19), (19, 20),
    (0, 17),
]
PREVIEW_LEFT_COLOR = (80, 220, 120)
PREVIEW_RIGHT_COLOR = (80, 140, 250)
PREVIEW_UNKNOWN_COLOR = (0, 215, 255)


def clamp01(value: float) -> float:
    return max(0.0, min(1.0, float(value)))


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).replace(microsecond=0).isoformat().replace("+00:00", "Z")


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


def canonical_labels(raw_csv: str) -> list[str]:
    labels: list[str] = []
    seen = set()
    for token in str(raw_csv or "").split(","):
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


def default_hand_template(center_x: float) -> list[dict]:
    """
    Build a rough open-palm template (normalized).
    x is centered around center_x so left/right hands don't overlap at spawn.
    """
    pts = [
        (0.00, 0.00),   # wrist
        (-0.05, -0.08), (-0.09, -0.16), (-0.12, -0.23), (-0.14, -0.28),  # thumb
        (0.02, -0.09), (0.02, -0.20), (0.02, -0.30), (0.02, -0.39),      # index
        (0.09, -0.10), (0.10, -0.22), (0.10, -0.33), (0.10, -0.43),      # middle
        (0.16, -0.08), (0.18, -0.18), (0.19, -0.28), (0.19, -0.37),      # ring
        (0.22, -0.03), (0.25, -0.10), (0.27, -0.17), (0.28, -0.24),      # pinky
    ]
    out = []
    base_y = 0.74
    for x_off, y_off in pts:
        out.append(
            {
                "x": clamp01(center_x + x_off),
                "y": clamp01(base_y + y_off),
                "z": 0.0,
                "v": 1,
            }
        )
    return out


def make_empty_hand(center_x: float) -> dict:
    return {
        "present": False,
        "points": default_hand_template(center_x),
    }


def make_empty_entry(image_rel: str, width: int, height: int, label: str) -> dict:
    return {
        "image": str(image_rel),
        "label": normalize_label(label),
        "width": int(width),
        "height": int(height),
        "hands": [make_empty_hand(0.36), make_empty_hand(0.64)],
        "updated_at": utc_now_iso(),
    }


def sanitize_entry(entry: dict, image_rel: str, width: int, height: int, default_label: str) -> dict:
    out = make_empty_entry(image_rel, width, height, default_label)
    if not isinstance(entry, dict):
        return out

    out["label"] = normalize_label(str(entry.get("label", default_label)))
    out["updated_at"] = str(entry.get("updated_at", utc_now_iso()))
    out["width"] = int(entry.get("width", width) or width)
    out["height"] = int(entry.get("height", height) or height)

    hands = entry.get("hands", [])
    if isinstance(hands, list):
        for hand_idx in range(2):
            if hand_idx >= len(hands) or not isinstance(hands[hand_idx], dict):
                continue
            raw_hand = hands[hand_idx]
            out["hands"][hand_idx]["present"] = bool(raw_hand.get("present", False))
            raw_points = raw_hand.get("points", [])
            if not isinstance(raw_points, list):
                continue
            points = []
            for point_idx in range(POINT_COUNT):
                if point_idx < len(raw_points) and isinstance(raw_points[point_idx], dict):
                    raw_point = raw_points[point_idx]
                    points.append(
                        {
                            "x": clamp01(float(raw_point.get("x", 0.0) or 0.0)),
                            "y": clamp01(float(raw_point.get("y", 0.0) or 0.0)),
                            "z": float(raw_point.get("z", 0.0) or 0.0),
                            "v": int(1 if float(raw_point.get("v", 1) or 0) > 0 else 0),
                        }
                    )
                else:
                    points.append(out["hands"][hand_idx]["points"][point_idx])
            out["hands"][hand_idx]["points"] = points
    return out


def list_images(frames_dir: Path) -> list[Path]:
    files = []
    for path in frames_dir.rglob("*"):
        if path.is_file() and path.suffix.lower() in SUPPORTED_IMAGE_EXTS:
            files.append(path)
    files.sort(key=lambda p: str(p).lower())
    return files


def load_jsonl_map(path: Path) -> dict[str, dict]:
    if not path.exists():
        return {}
    out: dict[str, dict] = {}
    for line in path.read_text(encoding="utf-8").splitlines():
        row = line.strip()
        if not row:
            continue
        try:
            obj = json.loads(row)
        except json.JSONDecodeError:
            continue
        if not isinstance(obj, dict):
            continue
        image = str(obj.get("image", "")).strip()
        if not image:
            continue
        out[image] = obj
    return out


def write_jsonl(path: Path, records: dict[str, dict], image_order: list[str]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    with path.open("w", encoding="utf-8") as file:
        for image_rel in image_order:
            entry = records.get(image_rel)
            if not isinstance(entry, dict):
                continue
            file.write(json.dumps(entry, ensure_ascii=True) + "\n")


def key_is_left(key_code: int) -> bool:
    return key_code in (ord("a"), ord("A"), 81, 2424832, 65361)


def key_is_right(key_code: int) -> bool:
    return key_code in (ord("d"), ord("D"), 83, 2555904, 65363)


def denorm_to_display_xy(point: dict, width: int, height: int, mirror_view: bool) -> tuple[int, int]:
    x = float(point.get("x", 0.0))
    y = float(point.get("y", 0.0))
    if mirror_view:
        x = 1.0 - x
    return int(round(x * width)), int(round(y * height))


def display_to_norm_xy(x_px: int, y_px: int, width: int, height: int, mirror_view: bool) -> tuple[float, float]:
    x = clamp01(float(x_px) / max(1.0, float(width)))
    y = clamp01(float(y_px) / max(1.0, float(height)))
    if mirror_view:
        x = 1.0 - x
    return x, y


def open_camera(camera_index: int, width: int, height: int):
    backends = [("DEFAULT", None)]
    if hasattr(cv2, "CAP_DSHOW"):
        backends.insert(0, ("DSHOW", cv2.CAP_DSHOW))
    if hasattr(cv2, "CAP_MSMF"):
        backends.append(("MSMF", cv2.CAP_MSMF))

    for backend_name, backend in backends:
        cap = cv2.VideoCapture(camera_index) if backend is None else cv2.VideoCapture(camera_index, backend)
        if not cap.isOpened():
            cap.release()
            continue
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        for _ in range(18):
            ok, _ = cap.read()
            if ok:
                print(f"[+] Camera {camera_index} opened via {backend_name}.")
                return cap
            time.sleep(0.02)
        cap.release()
    return None


def draw_recording_preview(frame_bgr, result) -> None:
    if result is None or not getattr(result, "hand_landmarks", None):
        return

    h, w = frame_bgr.shape[:2]
    side_map: dict[int, str] = {}
    wrist_positions: list[tuple[int, float]] = []
    for hand_idx, landmarks in enumerate(result.hand_landmarks[:2]):
        if not landmarks:
            continue
        wrist_x = clamp01(float(getattr(landmarks[0], "x", 0.5)))
        wrist_positions.append((hand_idx, wrist_x))

    if len(wrist_positions) == 1:
        idx, x = wrist_positions[0]
        side_map[idx] = "left" if x < 0.5 else "right"
    elif len(wrist_positions) >= 2:
        wrist_positions.sort(key=lambda item: item[1])
        side_map[wrist_positions[0][0]] = "left"
        side_map[wrist_positions[1][0]] = "right"

    for hand_idx, landmarks in enumerate(result.hand_landmarks[:2]):
        side = side_map.get(hand_idx, "unknown")
        if side == "left":
            color = PREVIEW_LEFT_COLOR
            side_tag = "Left"
        elif side == "right":
            color = PREVIEW_RIGHT_COLOR
            side_tag = "Right"
        else:
            color = PREVIEW_UNKNOWN_COLOR
            side_tag = f"H{hand_idx + 1}"

        for start, end in HAND_CONNECTIONS:
            if start >= len(landmarks) or end >= len(landmarks):
                continue
            p1 = landmarks[start]
            p2 = landmarks[end]
            x1 = int(round(clamp01(float(getattr(p1, "x", 0.0))) * (w - 1)))
            y1 = int(round(clamp01(float(getattr(p1, "y", 0.0))) * (h - 1)))
            x2 = int(round(clamp01(float(getattr(p2, "x", 0.0))) * (w - 1)))
            y2 = int(round(clamp01(float(getattr(p2, "y", 0.0))) * (h - 1)))
            cv2.line(frame_bgr, (x1, y1), (x2, y2), color, 2, lineType=cv2.LINE_AA)

        for point_idx, point in enumerate(landmarks[:POINT_COUNT]):
            x = int(round(clamp01(float(getattr(point, "x", 0.0))) * (w - 1)))
            y = int(round(clamp01(float(getattr(point, "y", 0.0))) * (h - 1)))
            radius = 6 if point_idx == 0 else 4
            cv2.circle(frame_bgr, (x, y), radius, color, -1, lineType=cv2.LINE_AA)
            cv2.circle(frame_bgr, (x, y), radius, (255, 255, 255), 1, lineType=cv2.LINE_AA)
            label_text = str(point_idx)
            cv2.putText(
                frame_bgr,
                label_text,
                (x + 6, y - 6),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.40,
                (0, 0, 0),
                3,
                lineType=cv2.LINE_AA,
            )
            cv2.putText(
                frame_bgr,
                label_text,
                (x + 6, y - 6),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.40,
                (255, 255, 255),
                1,
                lineType=cv2.LINE_AA,
            )

        wrist = landmarks[0] if landmarks else None
        if wrist is not None:
            wx = int(round(clamp01(float(getattr(wrist, "x", 0.0))) * (w - 1)))
            wy = int(round(clamp01(float(getattr(wrist, "y", 0.0))) * (h - 1)))
            cv2.putText(
                frame_bgr,
                side_tag,
                (wx + 8, wy - 8),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.52,
                (0, 0, 0),
                3,
                lineType=cv2.LINE_AA,
            )
            cv2.putText(
                frame_bgr,
                side_tag,
                (wx + 8, wy - 8),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.52,
                (235, 235, 235),
                1,
                lineType=cv2.LINE_AA,
            )


def record_frames_from_camera(
    frames_dir: Path,
    camera_index: int,
    width: int,
    height: int,
    interval_s: float,
    max_frames: int,
    mirror_view: bool,
    model_path: Path | None = None,
    show_preview_skeleton: bool = True,
    finish_action: str = "label",
) -> tuple[int, str]:
    frames_dir.mkdir(parents=True, exist_ok=True)
    cap = open_camera(camera_index=camera_index, width=width, height=height)
    if cap is None:
        print(f"[-] Could not open camera {camera_index} for recording.")
        return 0

    window_name = "Intertwine Recorder"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)
    recording = False
    countdown_active = False
    countdown_started_at = 0.0
    countdown_seconds = 3.0
    saved = 0
    last_capture_at = 0.0
    saved_files: list[Path] = []
    preview_detector = None
    preview_enabled = bool(show_preview_skeleton)

    if preview_enabled:
        preview_detector = create_bootstrap_detector(model_path or Path("models/hand_landmarker.task"))
        if preview_detector is None:
            preview_enabled = False
            print("[!] Skeleton preview disabled (MediaPipe model not available).")

    existing = sorted(frames_dir.glob("frame_*.jpg"))
    next_index = 1
    if existing:
        try:
            next_index = int(existing[-1].stem.split("_")[-1]) + 1
        except Exception:
            next_index = len(existing) + 1

    print("[*] Recorder controls:")
    print("    R: start/stop auto capture")
    print("    S: save one frame now")
    print("    X: drop last saved frame")
    print("    P: toggle skeleton preview")
    print("    TAB: switch to label mode")
    print("    Q: quit app")
    if mirror_view:
        print("    (mirror view only affects preview; saved frames are not mirrored)")
    print(f"[*] Saving into: {frames_dir}")
    next_action = finish_action

    def save_frame(frame_bgr) -> None:
        nonlocal next_index, saved
        out_name = f"frame_{next_index:06d}.jpg"
        out_path = frames_dir / out_name
        ok_write = cv2.imwrite(str(out_path), frame_bgr)
        next_index += 1
        if ok_write:
            saved += 1
            saved_files.append(out_path)
        else:
            print(f"[-] Failed to save frame: {out_path}")

    def drop_last_saved() -> None:
        nonlocal saved
        if not saved_files:
            print("[!] No saved frame to drop.")
            return
        out_path = saved_files.pop()
        try:
            if out_path.exists():
                out_path.unlink()
            saved = max(0, saved - 1)
            print(f"[+] Dropped frame: {out_path.name}")
        except OSError as exc:
            print(f"[-] Failed to drop frame: {out_path.name} ({exc})")
            saved_files.append(out_path)

    try:
        while True:
            ok, frame_raw = cap.read()
            if not ok:
                time.sleep(0.01)
                continue
            frame_view = cv2.flip(frame_raw, 1) if mirror_view else frame_raw

            now = time.time()
            if countdown_active:
                elapsed = max(0.0, now - countdown_started_at)
                if elapsed >= countdown_seconds:
                    countdown_active = False
                    recording = True
                    last_capture_at = 0.0

            preview_result = None
            if preview_enabled and preview_detector is not None:
                try:
                    rgb = cv2.cvtColor(frame_view, cv2.COLOR_BGR2RGB)
                    mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                    preview_result = preview_detector.detect(mp_image)
                except Exception:
                    preview_result = None

            if recording and (now - last_capture_at) >= interval_s:
                save_frame(frame_raw)
                last_capture_at = now
                if max_frames > 0 and saved >= max_frames:
                    print(f"[+] Reached --record-max ({max_frames}).")
                    break

            panel_h = 150
            view = frame_view.copy()
            if preview_enabled:
                draw_recording_preview(view, preview_result)
            cv2.rectangle(view, (0, 0), (view.shape[1], panel_h), (10, 10, 10), -1)
            if countdown_active:
                remaining = max(0, int(math.ceil(countdown_seconds - (now - countdown_started_at))))
                status = f"COUNTDOWN {remaining}"
            else:
                status = "REC" if recording else "PAUSED"
            cv2.putText(
                view,
                f"Recorder [{status}]  saved={saved}  interval={interval_s:.2f}s  cam={camera_index}",
                (10, 24),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.62,
                (230, 230, 230),
                1,
                lineType=cv2.LINE_AA,
            )
            cv2.putText(
                view,
                f"Skeleton preview: {'ON' if preview_enabled else 'OFF'}",
                (10, 50),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.53,
                (190, 190, 190),
                1,
                lineType=cv2.LINE_AA,
            )
            cv2.putText(
                view,
                "R auto | S single-shot | X drop-last | P preview | TAB label | Q quit",
                (10, 76),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.52,
                (190, 190, 190),
                1,
                lineType=cv2.LINE_AA,
            )
            last_name = saved_files[-1].name if saved_files else "-"
            cv2.putText(
                view,
                f"Last kept: {last_name}",
                (10, 100),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.50,
                (190, 190, 190),
                1,
                lineType=cv2.LINE_AA,
            )
            legend_y = 125
            cv2.circle(view, (18, legend_y), 6, PREVIEW_LEFT_COLOR, -1, lineType=cv2.LINE_AA)
            cv2.putText(
                view,
                "Left",
                (30, legend_y + 4),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.48,
                (215, 215, 215),
                1,
                lineType=cv2.LINE_AA,
            )
            cv2.circle(view, (88, legend_y), 6, PREVIEW_RIGHT_COLOR, -1, lineType=cv2.LINE_AA)
            cv2.putText(
                view,
                "Right",
                (100, legend_y + 4),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.48,
                (215, 215, 215),
                1,
                lineType=cv2.LINE_AA,
            )
            cv2.circle(view, (168, legend_y), 6, PREVIEW_UNKNOWN_COLOR, -1, lineType=cv2.LINE_AA)
            cv2.putText(
                view,
                "Unknown",
                (180, legend_y + 4),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.48,
                (215, 215, 215),
                1,
                lineType=cv2.LINE_AA,
            )
            cv2.putText(
                view,
                "Point 0 = wrist",
                (285, legend_y + 4),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.48,
                (215, 215, 215),
                1,
                lineType=cv2.LINE_AA,
            )
            if countdown_active:
                remaining = max(1, int(math.ceil(countdown_seconds - (now - countdown_started_at))))
                cv2.putText(
                    view,
                    str(remaining),
                    (int(view.shape[1] * 0.48), int(view.shape[0] * 0.52)),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    5.0,
                    (0, 165, 255),
                    10,
                    lineType=cv2.LINE_AA,
                )
            cv2.imshow(window_name, view)

            key = cv2.waitKeyEx(1)
            if key < 0:
                continue
            if key in (ord("q"), ord("Q")):
                next_action = "quit"
                break
            if key in (9,):
                next_action = "label"
                break
            if key in (ord("r"), ord("R")):
                if recording:
                    recording = False
                    countdown_active = False
                elif countdown_active:
                    countdown_active = False
                else:
                    countdown_active = True
                    countdown_started_at = now
                continue
            if key in (ord("p"), ord("P")):
                if preview_enabled:
                    preview_enabled = False
                else:
                    if preview_detector is None:
                        preview_detector = create_bootstrap_detector(model_path or Path("models/hand_landmarker.task"))
                    preview_enabled = preview_detector is not None
                continue
            if key in (ord("x"), ord("X"), 8, 127):
                drop_last_saved()
                continue
            if key in (ord("s"), ord("S")):
                save_frame(frame_raw)
                continue
    finally:
        cap.release()
        try:
            if preview_detector is not None and hasattr(preview_detector, "close"):
                preview_detector.close()
        except Exception:
            pass
        cv2.destroyWindow(window_name)

    print(f"[+] Recorder saved {saved} frame(s).")
    return saved, next_action


def create_bootstrap_detector(model_path: Path):
    if mp is None or python is None or vision is None:
        return None
    if not model_path.exists():
        return None
    try:
        options = vision.HandLandmarkerOptions(
            base_options=python.BaseOptions(model_asset_path=str(model_path)),
            running_mode=vision.RunningMode.IMAGE,
            num_hands=2,
            min_hand_detection_confidence=0.2,
            min_hand_presence_confidence=0.2,
            min_tracking_confidence=0.2,
        )
        return vision.HandLandmarker.create_from_options(options)
    except Exception:
        return None


def bootstrap_from_mediapipe(image_bgr, detector, default_label: str, image_rel: str) -> dict:
    h, w = image_bgr.shape[:2]
    entry = make_empty_entry(image_rel=image_rel, width=w, height=h, label=default_label)
    if detector is None:
        return entry
    try:
        rgb = cv2.cvtColor(image_bgr, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        result = detector.detect(mp_image)
    except Exception:
        return entry

    if not result or not result.hand_landmarks:
        return entry

    candidates = []
    for hand_idx, landmarks in enumerate(result.hand_landmarks[:2]):
        if not landmarks:
            continue
        wrist_x = clamp01(float(getattr(landmarks[0], "x", 0.5)))
        candidates.append((hand_idx, wrist_x, landmarks))

    if not candidates:
        return entry

    # Use image-side position for slot assignment; handedness labels often flip in occlusions.
    if len(candidates) == 1:
        _, wrist_x, landmarks = candidates[0]
        slot_assignments = [(0 if wrist_x < 0.5 else 1, landmarks)]
    else:
        candidates.sort(key=lambda row: row[1])  # left-most then right-most in image space
        slot_assignments = [(0, candidates[0][2]), (1, candidates[1][2])]

    for slot, landmarks in slot_assignments:
        hand = entry["hands"][slot]
        hand["present"] = True
        points = []
        for lm in landmarks[:POINT_COUNT]:
            points.append(
                {
                    "x": clamp01(float(getattr(lm, "x", 0.0))),
                    "y": clamp01(float(getattr(lm, "y", 0.0))),
                    "z": float(getattr(lm, "z", 0.0)),
                    "v": 1,
                }
            )
        while len(points) < POINT_COUNT:
            points.append({"x": 0.5, "y": 0.5, "z": 0.0, "v": 0})
        hand["points"] = points
    return entry


@dataclass
class EditorState:
    current_entry: dict
    image_w: int
    image_h: int
    mirror_view: bool
    active_hand_idx: int = 0
    active_point_idx: int = 0
    dragging: bool = False
    panning: bool = False
    pan_anchor_x: int = 0
    pan_anchor_y: int = 0
    pan_anchor_cx: float = 0.5
    pan_anchor_cy: float = 0.5
    zoom: float = 1.0
    view_cx: float = 0.5
    view_cy: float = 0.5
    show_invisible_points: bool = False


def clamp_value(value: float, low: float, high: float) -> float:
    return max(low, min(high, float(value)))


def constrain_view(state: EditorState) -> None:
    state.zoom = clamp_value(state.zoom, 1.0, 8.0)
    if state.zoom <= 1.0001:
        state.view_cx = 0.5
        state.view_cy = 0.5
        return
    half_w = 0.5 / state.zoom
    half_h = 0.5 / state.zoom
    state.view_cx = clamp_value(state.view_cx, half_w, 1.0 - half_w)
    state.view_cy = clamp_value(state.view_cy, half_h, 1.0 - half_h)


def zoom_viewport(state: EditorState) -> tuple[int, int, int, int]:
    constrain_view(state)
    crop_w = max(1, int(round(float(state.image_w) / state.zoom)))
    crop_h = max(1, int(round(float(state.image_h) / state.zoom)))
    cx_px = float(state.view_cx) * float(state.image_w)
    cy_px = float(state.view_cy) * float(state.image_h)
    x0 = int(round(cx_px - (crop_w / 2.0)))
    y0 = int(round(cy_px - (crop_h / 2.0)))
    x0 = int(clamp_value(x0, 0, max(0, state.image_w - crop_w)))
    y0 = int(clamp_value(y0, 0, max(0, state.image_h - crop_h)))
    return x0, y0, crop_w, crop_h


def window_to_canvas_xy(state: EditorState, x_px: int, y_px: int) -> tuple[int, int]:
    x_win = int(clamp_value(x_px, 0, max(0, state.image_w - 1)))
    y_win = int(clamp_value(y_px, 0, max(0, state.image_h - 1)))
    if state.zoom <= 1.0001:
        return x_win, y_win

    x0, y0, crop_w, crop_h = zoom_viewport(state)
    win_w = max(1.0, float(state.image_w - 1))
    win_h = max(1.0, float(state.image_h - 1))
    crop_wm1 = max(1.0, float(crop_w - 1))
    crop_hm1 = max(1.0, float(crop_h - 1))
    x_canvas = x0 + int(round((float(x_win) / win_w) * crop_wm1))
    y_canvas = y0 + int(round((float(y_win) / win_h) * crop_hm1))
    x_canvas = int(clamp_value(x_canvas, 0, max(0, state.image_w - 1)))
    y_canvas = int(clamp_value(y_canvas, 0, max(0, state.image_h - 1)))
    return x_canvas, y_canvas


def apply_zoom_to_canvas(canvas, state: EditorState):
    if state.zoom <= 1.0001:
        return canvas
    x0, y0, crop_w, crop_h = zoom_viewport(state)
    crop = canvas[y0:y0 + crop_h, x0:x0 + crop_w]
    if crop is None or crop.size == 0:
        return canvas
    return cv2.resize(crop, (state.image_w, state.image_h), interpolation=cv2.INTER_LINEAR)


def adjust_zoom(state: EditorState, factor: float, anchor_x: int | None = None, anchor_y: int | None = None) -> None:
    old_zoom = float(state.zoom)
    new_zoom = clamp_value(old_zoom * float(factor), 1.0, 8.0)
    if abs(new_zoom - old_zoom) < 1e-6:
        return

    if anchor_x is None or anchor_y is None:
        state.zoom = new_zoom
        constrain_view(state)
        return

    before_x, before_y = window_to_canvas_xy(state, anchor_x, anchor_y)
    state.zoom = new_zoom
    constrain_view(state)
    after_x, after_y = window_to_canvas_xy(state, anchor_x, anchor_y)
    dx = float(before_x - after_x)
    dy = float(before_y - after_y)
    state.view_cx += dx / max(1.0, float(state.image_w))
    state.view_cy += dy / max(1.0, float(state.image_h))
    constrain_view(state)


def nudge_view(state: EditorState, dx_px: float, dy_px: float) -> None:
    state.view_cx += float(dx_px) / max(1.0, float(state.image_w))
    state.view_cy += float(dy_px) / max(1.0, float(state.image_h))
    constrain_view(state)


def reset_zoom(state: EditorState) -> None:
    state.zoom = 1.0
    state.view_cx = 0.5
    state.view_cy = 0.5


def finger_indices_for_point(point_idx: int) -> list[int]:
    idx = int(point_idx)
    if idx <= 0:
        return [0]
    if idx <= 4:
        return [1, 2, 3, 4]
    if idx <= 8:
        return [5, 6, 7, 8]
    if idx <= 12:
        return [9, 10, 11, 12]
    if idx <= 16:
        return [13, 14, 15, 16]
    return [17, 18, 19, 20]


def update_active_point_from_mouse(state: EditorState, x_px: int, y_px: int) -> None:
    x_canvas, y_canvas = window_to_canvas_xy(state, x_px, y_px)
    x_norm, y_norm = display_to_norm_xy(
        x_px=x_canvas,
        y_px=y_canvas,
        width=state.image_w,
        height=state.image_h,
        mirror_view=state.mirror_view,
    )
    hand = state.current_entry["hands"][state.active_hand_idx]
    point = hand["points"][state.active_point_idx]
    point["x"] = x_norm
    point["y"] = y_norm
    if not hand.get("present", False):
        hand["present"] = True


def find_nearest_point(state: EditorState, x_px: int, y_px: int, max_radius_px: float = 18.0) -> tuple[int, int] | None:
    x_canvas, y_canvas = window_to_canvas_xy(state, x_px, y_px)
    radius_scale = max(1.0, state.zoom)
    scaled_radius = float(max_radius_px) / radius_scale
    best = None
    best_d2 = (scaled_radius ** 2)
    for hand_idx in range(2):
        hand = state.current_entry["hands"][hand_idx]
        if not hand.get("present", False):
            continue
        points = hand.get("points", [])
        for point_idx, point in enumerate(points[:POINT_COUNT]):
            px, py = denorm_to_display_xy(
                point=point,
                width=state.image_w,
                height=state.image_h,
                mirror_view=state.mirror_view,
            )
            dx = float(px - x_canvas)
            dy = float(py - y_canvas)
            d2 = (dx * dx) + (dy * dy)
            if d2 < best_d2:
                best = (hand_idx, point_idx)
                best_d2 = d2
    return best


def draw_editor_overlay(frame_bgr, state: EditorState, image_rel: str, index: int, total: int, labels: list[str], dirty: bool):
    canvas = frame_bgr.copy()
    if state.mirror_view:
        canvas = cv2.flip(canvas, 1)

    # Draw connections + points
    visible_counts = [0, 0]
    for hand_idx in range(2):
        hand = state.current_entry["hands"][hand_idx]
        if not hand.get("present", False):
            continue
        color = (80, 220, 120) if hand_idx == 0 else (80, 140, 250)
        points = hand.get("points", [])

        for start, end in HAND_CONNECTIONS:
            if start >= len(points) or end >= len(points):
                continue
            p1 = points[start]
            p2 = points[end]
            v1 = int(p1.get("v", 1)) > 0
            v2 = int(p2.get("v", 1)) > 0
            if not state.show_invisible_points and (not v1 or not v2):
                continue
            x1, y1 = denorm_to_display_xy(p1, state.image_w, state.image_h, state.mirror_view)
            x2, y2 = denorm_to_display_xy(p2, state.image_w, state.image_h, state.mirror_view)
            cv2.line(canvas, (x1, y1), (x2, y2), color, 2)

        for point_idx, point in enumerate(points[:POINT_COUNT]):
            x, y = denorm_to_display_xy(point, state.image_w, state.image_h, state.mirror_view)
            visible = int(point.get("v", 1)) > 0
            if visible:
                visible_counts[hand_idx] += 1

            is_active = hand_idx == state.active_hand_idx and point_idx == state.active_point_idx
            if (not visible) and (not state.show_invisible_points) and (not is_active):
                continue

            if visible:
                radius = 6
                cv2.circle(canvas, (x, y), radius, color, -1, lineType=cv2.LINE_AA)
                cv2.circle(canvas, (x, y), radius, (255, 255, 255), 1, lineType=cv2.LINE_AA)
            else:
                # Hidden landmark style (or selected hidden point anchor)
                if state.show_invisible_points:
                    radius = 4
                    cv2.circle(canvas, (x, y), radius, (170, 170, 170), 1, lineType=cv2.LINE_AA)
                cv2.line(canvas, (x - 4, y - 4), (x + 4, y + 4), (0, 220, 255), 1, lineType=cv2.LINE_AA)
                cv2.line(canvas, (x - 4, y + 4), (x + 4, y - 4), (0, 220, 255), 1, lineType=cv2.LINE_AA)

            if is_active:
                cv2.circle(canvas, (x, y), 10, (0, 255, 255), 2, lineType=cv2.LINE_AA)
            cv2.putText(
                canvas,
                str(point_idx),
                (x + 5, y - 5),
                cv2.FONT_HERSHEY_SIMPLEX,
                0.35,
                (255, 255, 255),
                1,
                lineType=cv2.LINE_AA,
            )

    label = str(state.current_entry.get("label", "Idle"))
    dirty_tag = " *UNSAVED*" if dirty else ""
    zoom_text = f"{state.zoom:.2f}x"
    selected_visible = "ON" if int(
        state.current_entry["hands"][state.active_hand_idx]["points"][state.active_point_idx].get("v", 1)
    ) > 0 else "OFF"
    hidden_preview = "SHOW" if state.show_invisible_points else "HIDE"
    top_lines = [
        f"{index + 1}/{total}  {image_rel}{dirty_tag}",
        f"Label: {label} ({labels.index(label) + 1 if label in labels else '?'}/{len(labels)})",
        (
            f"Hand: {state.active_hand_idx + 1}  Point: {state.active_point_idx} (V:{selected_visible})  "
            f"H1 vis:{visible_counts[0]}/21  H2 vis:{visible_counts[1]}/21  Zoom:{zoom_text}  Hidden:{hidden_preview}"
        ),
    ]
    help_line = (
        "Mouse drag point | 1/2 hand | [/ ] point | V visibility | F finger vis | H toggle hand | "
        ",/. label | S save+next | A/D prev/next | M bootstrap | R recorder | "
        "T reset hand | C clear hand | O hidden preview | X drop frame | Wheel/+/- zoom | 0 reset | RMB hold+drag pan | Q quit"
    )

    canvas = apply_zoom_to_canvas(canvas, state)
    panel_h = 86
    cv2.rectangle(canvas, (0, 0), (state.image_w, panel_h), (10, 10, 10), -1)
    for i, line in enumerate(top_lines):
        cv2.putText(
            canvas,
            line,
            (10, 22 + (i * 21)),
            cv2.FONT_HERSHEY_SIMPLEX,
            0.57,
            (230, 230, 230),
            1,
            lineType=cv2.LINE_AA,
        )
    cv2.putText(
        canvas,
        help_line,
        (10, panel_h - 6),
        cv2.FONT_HERSHEY_SIMPLEX,
        0.39,
        (190, 190, 190),
        1,
        lineType=cv2.LINE_AA,
    )
    return canvas


def main() -> int:
    parser = argparse.ArgumentParser(description="Manual intertwined hand-landmark annotator (OpenCV).")
    parser.add_argument(
        "--frames-dir",
        default="dataset/intertwine_frames",
        help="Directory of image frames to annotate.",
    )
    parser.add_argument(
        "--output",
        default="dataset/intertwine_annotations.jsonl",
        help="Output JSONL annotations file.",
    )
    parser.add_argument(
        "--labels",
        default=",".join(DEFAULT_LABELS),
        help="Comma-separated labels to cycle through.",
    )
    parser.add_argument(
        "--default-label",
        default="Idle",
        help="Default label for new entries.",
    )
    parser.add_argument(
        "--start-index",
        type=int,
        default=0,
        help="Start image index.",
    )
    parser.add_argument(
        "--model-path",
        default="models/hand_landmarker.task",
        help="MediaPipe hand_landmarker.task path for bootstrap.",
    )
    parser.add_argument(
        "--no-bootstrap",
        action="store_true",
        help="Disable MediaPipe bootstrap for new frames.",
    )
    parser.add_argument(
        "--mirror-view",
        action="store_true",
        help="Mirror display horizontally while editing.",
    )
    parser.add_argument(
        "--mode",
        choices=("label", "record", "both"),
        default=None,
        help="Workflow mode: label existing frames, record only, or record then label.",
    )
    parser.add_argument(
        "--record-camera",
        action="store_true",
        help="Legacy alias for --mode both.",
    )
    parser.add_argument(
        "--camera",
        type=int,
        default=0,
        help="Camera index for recorder mode.",
    )
    parser.add_argument(
        "--record-width",
        type=int,
        default=960,
        help="Capture width for recorder mode.",
    )
    parser.add_argument(
        "--record-height",
        type=int,
        default=720,
        help="Capture height for recorder mode.",
    )
    parser.add_argument(
        "--record-interval",
        type=float,
        default=0.18,
        help="Seconds between auto-captured frames in recorder mode.",
    )
    parser.add_argument(
        "--record-max",
        type=int,
        default=0,
        help="Stop after N recorded frames (0 = unlimited).",
    )
    parser.add_argument(
        "--no-record-preview",
        action="store_true",
        help="Disable live hand-skeleton preview while recording.",
    )
    args = parser.parse_args()

    frames_dir = Path(args.frames_dir).expanduser().resolve()
    output_path = Path(args.output).expanduser().resolve()
    labels = canonical_labels(args.labels)
    default_label = normalize_label(args.default_label)
    selected_mode = str(args.mode or ("both" if args.record_camera else "label"))
    model_path = Path(args.model_path).expanduser().resolve()
    print(f"[*] Mode: {selected_mode}")

    def run_recorder(finish_action: str) -> tuple[int, str]:
        if args.record_interval <= 0:
            print("[-] --record-interval must be > 0")
            return 0, "quit"
        return record_frames_from_camera(
            frames_dir=frames_dir,
            camera_index=int(args.camera),
            width=max(320, int(args.record_width)),
            height=max(240, int(args.record_height)),
            interval_s=float(args.record_interval),
            max_frames=max(0, int(args.record_max)),
            mirror_view=bool(args.mirror_view),
            model_path=model_path,
            show_preview_skeleton=not bool(args.no_record_preview),
            finish_action=finish_action,
        )

    if selected_mode in ("record", "both"):
        default_finish = "quit" if selected_mode == "record" else "label"
        saved, next_action = run_recorder(finish_action=default_finish)
        if next_action == "quit":
            print(f"[+] Recording complete. Frames directory: {frames_dir}")
            return 0
        if saved <= 0:
            print("[!] No new frames were recorded. Continuing with label mode.")
        selected_mode = "label"

    if not frames_dir.exists():
        print(f"[-] Frames directory not found: {frames_dir}")
        return 1

    images = list_images(frames_dir)
    if not images:
        print(f"[!] No images found in {frames_dir}. Opening recorder...")
        saved, next_action = run_recorder(finish_action="label")
        if next_action == "quit":
            return 0
        if saved <= 0:
            print("[!] No frames were recorded.")
        images = list_images(frames_dir)
        if not images:
            print(f"[-] No images found in {frames_dir}")
            return 1

    entries_map = load_jsonl_map(output_path)
    image_keys = [str(path.relative_to(frames_dir)).replace("\\", "/") for path in images]

    detector = None
    if not args.no_bootstrap:
        detector = create_bootstrap_detector(model_path)
        if detector is None:
            print("[!] MediaPipe bootstrap unavailable. Continuing in manual-only mode.")

    current_idx = max(0, min(int(args.start_index), len(images) - 1))
    window_name = "Intertwine Landmark Annotator"
    cv2.namedWindow(window_name, cv2.WINDOW_NORMAL)

    state = None
    dirty = False

    def load_current_entry(force_bootstrap: bool = False):
        nonlocal state, dirty
        image_path = images[current_idx]
        image_rel = str(image_path.relative_to(frames_dir)).replace("\\", "/")
        frame = cv2.imread(str(image_path))
        if frame is None:
            raise RuntimeError(f"Failed to read image: {image_path}")
        h, w = frame.shape[:2]

        existing = entries_map.get(image_rel)
        if existing and not force_bootstrap:
            entry = sanitize_entry(existing, image_rel=image_rel, width=w, height=h, default_label=default_label)
        else:
            entry = bootstrap_from_mediapipe(
                image_bgr=frame,
                detector=detector,
                default_label=default_label,
                image_rel=image_rel,
            )
            entry["width"] = int(w)
            entry["height"] = int(h)

        prev_zoom = state.zoom if state is not None else 1.0
        prev_view_cx = state.view_cx if state is not None else 0.5
        prev_view_cy = state.view_cy if state is not None else 0.5
        prev_show_invisible = state.show_invisible_points if state is not None else False
        active_hand = state.active_hand_idx if state is not None else 0
        active_point = state.active_point_idx if state is not None else 0
        state = EditorState(
            current_entry=entry,
            image_w=w,
            image_h=h,
            mirror_view=bool(args.mirror_view),
            active_hand_idx=active_hand,
            active_point_idx=active_point,
            dragging=False,
            zoom=prev_zoom,
            view_cx=prev_view_cx,
            view_cy=prev_view_cy,
            show_invisible_points=prev_show_invisible,
        )
        constrain_view(state)
        dirty = False
        return frame, image_rel

    def reload_images(preferred_rel: str | None = None):
        nonlocal images, image_keys, current_idx
        images = list_images(frames_dir)
        if not images:
            image_keys = []
            return None
        image_keys = [str(path.relative_to(frames_dir)).replace("\\", "/") for path in images]
        if preferred_rel and preferred_rel in image_keys:
            current_idx = image_keys.index(preferred_rel)
        else:
            current_idx = max(0, min(current_idx, len(images) - 1))
        return load_current_entry(force_bootstrap=False)

    loaded = reload_images(preferred_rel=None)
    if loaded is None:
        print(f"[-] No images found in {frames_dir}")
        return 1
    frame_cache, image_rel_cache = loaded

    def drop_current_image() -> bool:
        nonlocal images, image_keys, current_idx, frame_cache, image_rel_cache, dirty, state
        if not images:
            return False

        image_path = images[current_idx]
        image_rel = str(image_path.relative_to(frames_dir)).replace("\\", "/")
        try:
            image_path.unlink()
        except OSError as exc:
            print(f"[-] Failed to drop frame {image_rel}: {exc}")
            return False

        entries_map.pop(image_rel, None)
        del images[current_idx]
        image_keys = [str(path.relative_to(frames_dir)).replace("\\", "/") for path in images]
        write_jsonl(output_path, entries_map, image_keys)
        dirty = False

        if not images:
            print(f"[+] Dropped frame: {image_rel}. No frames left.")
            return True

        if current_idx >= len(images):
            current_idx = len(images) - 1
        frame_cache, image_rel_cache = load_current_entry(force_bootstrap=False)
        print(f"[+] Dropped frame: {image_rel}. Remaining: {len(images)}")
        return True

    def mouse_callback(event, x, y, flags, _param):
        nonlocal dirty, state
        if state is None:
            return

        if event == cv2.EVENT_MOUSEWHEEL:
            if int(flags) > 0:
                adjust_zoom(state, factor=1.15, anchor_x=x, anchor_y=y)
            else:
                adjust_zoom(state, factor=(1.0 / 1.15), anchor_x=x, anchor_y=y)
            return

        if event == cv2.EVENT_RBUTTONDOWN:
            state.panning = True
            state.pan_anchor_x = int(x)
            state.pan_anchor_y = int(y)
            state.pan_anchor_cx = float(state.view_cx)
            state.pan_anchor_cy = float(state.view_cy)
            return

        if event == cv2.EVENT_MOUSEMOVE and state.panning:
            dx = float(x - state.pan_anchor_x)
            dy = float(y - state.pan_anchor_y)
            if state.zoom > 1.0001:
                crop_w = max(1.0, float(state.image_w) / state.zoom)
                crop_h = max(1.0, float(state.image_h) / state.zoom)
                scaled_dx = dx * (crop_w / max(1.0, float(state.image_w)))
                scaled_dy = dy * (crop_h / max(1.0, float(state.image_h)))
                state.view_cx = state.pan_anchor_cx - (scaled_dx / max(1.0, float(state.image_w)))
                state.view_cy = state.pan_anchor_cy - (scaled_dy / max(1.0, float(state.image_h)))
                constrain_view(state)
            return

        if event == cv2.EVENT_RBUTTONUP and state.panning:
            state.panning = False
            return

        if event == cv2.EVENT_LBUTTONDOWN:
            nearest = find_nearest_point(state, x_px=x, y_px=y)
            if nearest is not None:
                state.active_hand_idx, state.active_point_idx = nearest
            state.dragging = True
            update_active_point_from_mouse(state, x_px=x, y_px=y)
            dirty = True
            return

        if event == cv2.EVENT_MOUSEMOVE and state.dragging:
            update_active_point_from_mouse(state, x_px=x, y_px=y)
            dirty = True
            return

        if event == cv2.EVENT_LBUTTONUP:
            state.dragging = False

    cv2.setMouseCallback(window_name, mouse_callback)

    print("[*] Intertwine Landmark Annotator")
    print(f"[*] Frames: {len(images)}")
    print(f"[*] Output: {output_path}")
    print("[*] Controls:")
    print("    Mouse drag point  |  1/2 select hand  |  [/ ] select point")
    print("    V toggle point visibility  |  F toggle selected finger visibility  |  O show/hide invisible points  |  H toggle hand presence")
    print("    ,/. previous/next label")
    print("    S save+next  |  A/D previous/next  |  M bootstrap current frame  |  R recorder mode")
    print("    Wheel/+/- zoom  |  0 reset zoom  |  RMB hold + drag pan (or I/J/K/L)")
    print("    T reset selected hand  |  C clear selected hand  |  X drop current frame  |  Q quit")

    while True:
        display = draw_editor_overlay(
            frame_bgr=frame_cache,
            state=state,
            image_rel=image_rel_cache,
            index=current_idx,
            total=len(images),
            labels=labels,
            dirty=dirty,
        )
        cv2.imshow(window_name, display)
        key = cv2.waitKeyEx(16)
        if key < 0:
            continue

        if key in (ord("q"), ord("Q")):
            if dirty and state is not None:
                state.current_entry["updated_at"] = utc_now_iso()
                entries_map[image_rel_cache] = state.current_entry
            write_jsonl(output_path, entries_map, image_keys)
            print(f"[+] Saved annotations to {output_path}")
            break

        if key in (ord("+"), ord("="), 171, 107):
            adjust_zoom(state, factor=1.15)
            continue
        if key in (ord("-"), ord("_"), 173, 109):
            adjust_zoom(state, factor=(1.0 / 1.15))
            continue
        if key in (ord("0"),):
            reset_zoom(state)
            continue
        if key in (ord("j"), ord("J")):
            nudge_view(state, dx_px=-28.0 / max(1.0, state.zoom), dy_px=0.0)
            continue
        if key in (ord("l"), ord("L")):
            nudge_view(state, dx_px=28.0 / max(1.0, state.zoom), dy_px=0.0)
            continue
        if key in (ord("i"), ord("I")):
            nudge_view(state, dx_px=0.0, dy_px=-28.0 / max(1.0, state.zoom))
            continue
        if key in (ord("k"), ord("K")):
            nudge_view(state, dx_px=0.0, dy_px=28.0 / max(1.0, state.zoom))
            continue

        if key in (ord("r"), ord("R"), 9):
            if dirty and state is not None:
                state.current_entry["updated_at"] = utc_now_iso()
                entries_map[image_rel_cache] = state.current_entry
                write_jsonl(output_path, entries_map, image_keys)
                dirty = False
            preferred_rel = image_rel_cache
            _saved, next_action = run_recorder(finish_action="label")
            if next_action == "quit":
                write_jsonl(output_path, entries_map, image_keys)
                print(f"[+] Saved annotations to {output_path}")
                break
            loaded = reload_images(preferred_rel=preferred_rel)
            if loaded is None:
                print(f"[!] No frames available in {frames_dir}.")
                continue
            frame_cache, image_rel_cache = loaded
            continue

        if key in (ord("1"),):
            state.active_hand_idx = 0
            continue
        if key in (ord("2"),):
            state.active_hand_idx = 1
            continue

        if key in (ord("v"), ord("V")):
            hand = state.current_entry["hands"][state.active_hand_idx]
            point = hand["points"][state.active_point_idx]
            point["v"] = 0 if int(point.get("v", 1)) > 0 else 1
            dirty = True
            continue

        if key in (ord("f"), ord("F")):
            hand = state.current_entry["hands"][state.active_hand_idx]
            group = finger_indices_for_point(state.active_point_idx)
            any_visible = any(int(hand["points"][idx].get("v", 1)) > 0 for idx in group if idx < POINT_COUNT)
            target_v = 0 if any_visible else 1
            for idx in group:
                if idx >= POINT_COUNT:
                    continue
                hand["points"][idx]["v"] = target_v
            if target_v > 0:
                hand["present"] = True
            dirty = True
            continue

        if key in (ord("o"), ord("O")):
            state.show_invisible_points = not bool(state.show_invisible_points)
            continue

        if key in (ord("h"), ord("H")):
            hand = state.current_entry["hands"][state.active_hand_idx]
            hand["present"] = not bool(hand.get("present", False))
            dirty = True
            continue

        if key in (ord("t"), ord("T")):
            cx = 0.36 if state.active_hand_idx == 0 else 0.64
            hand = state.current_entry["hands"][state.active_hand_idx]
            hand["points"] = default_hand_template(cx)
            hand["present"] = True
            dirty = True
            continue

        if key in (ord("c"), ord("C")):
            hand = state.current_entry["hands"][state.active_hand_idx]
            hand["present"] = False
            for point in hand["points"][:POINT_COUNT]:
                point["v"] = 0
            dirty = True
            continue

        if key in (ord("x"), ord("X"), 8, 127):
            removed = drop_current_image()
            if removed and not images:
                _saved, next_action = run_recorder(finish_action="label")
                if next_action == "quit":
                    print(f"[+] Saved annotations to {output_path}")
                    break
                loaded = reload_images(preferred_rel=None)
                if loaded is None:
                    print(f"[+] Saved annotations to {output_path}")
                    break
                frame_cache, image_rel_cache = loaded
            continue

        if key in (ord("["),):
            state.active_point_idx = (state.active_point_idx - 1) % POINT_COUNT
            continue
        if key in (ord("]"),):
            state.active_point_idx = (state.active_point_idx + 1) % POINT_COUNT
            continue

        if key in (ord(","), ord("<")):
            current = normalize_label(state.current_entry.get("label", default_label))
            idx = labels.index(current) if current in labels else 0
            state.current_entry["label"] = labels[(idx - 1) % len(labels)]
            dirty = True
            continue

        if key in (ord("."), ord(">")):
            current = normalize_label(state.current_entry.get("label", default_label))
            idx = labels.index(current) if current in labels else 0
            state.current_entry["label"] = labels[(idx + 1) % len(labels)]
            dirty = True
            continue

        if key in (ord("m"), ord("M")):
            frame_cache, image_rel_cache = load_current_entry(force_bootstrap=True)
            dirty = True
            continue

        # Save + next
        if key in (ord("s"), ord("S"), 13):
            state.current_entry["updated_at"] = utc_now_iso()
            entries_map[image_rel_cache] = state.current_entry
            write_jsonl(output_path, entries_map, image_keys)
            dirty = False
            if current_idx < len(images) - 1:
                current_idx += 1
                frame_cache, image_rel_cache = load_current_entry(force_bootstrap=False)
            continue

        if key_is_left(key):
            if dirty and state is not None:
                state.current_entry["updated_at"] = utc_now_iso()
                entries_map[image_rel_cache] = state.current_entry
                write_jsonl(output_path, entries_map, image_keys)
                dirty = False
            if current_idx > 0:
                current_idx -= 1
                frame_cache, image_rel_cache = load_current_entry(force_bootstrap=False)
            continue

        if key_is_right(key):
            if dirty and state is not None:
                state.current_entry["updated_at"] = utc_now_iso()
                entries_map[image_rel_cache] = state.current_entry
                write_jsonl(output_path, entries_map, image_keys)
                dirty = False
            if current_idx < len(images) - 1:
                current_idx += 1
                frame_cache, image_rel_cache = load_current_entry(force_bootstrap=False)
            continue

    cv2.destroyAllWindows()
    try:
        if detector is not None and hasattr(detector, "close"):
            detector.close()
    except Exception:
        pass
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
