#!/usr/bin/env python3
"""
Godot Backend Server - MediaPipe + KNN (Pygame-Equivalent Detection Flow)
==========================================================================

This server is for Godot 4.5 camera testing with the same detection
architecture used by the pygame MediaPipe pipeline:
- MediaPipe HandLandmarker (Tasks API, VIDEO mode, up to 2 hands)
- SignRecorder KNN classifier (src/mp_trainer.py)
- Lighting gate (mean/contrast checks)
- Two-hand gate (restricted_signs)
- Temporal voting (5 frame window, 3 hits, confidence threshold)

Usage:
  python src/backend_server_mediapipe.py --host 127.0.0.1 --port 8765 --camera 0
"""

import argparse
import asyncio
import base64
import json
import math
import time
from pathlib import Path
import sys

import cv2
import mediapipe as mp
import numpy as np
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

try:
    import websockets
except ImportError:
    print("[!] Missing dependency: websockets. Install with: pip install websockets")
    raise SystemExit(1)


def resolve_runtime_root() -> Path:
    """Resolve runtime root for dev and packaged execution."""
    if getattr(sys, "frozen", False):
        return Path(sys.executable).resolve().parent
    return Path(__file__).resolve().parent.parent


RUNTIME_ROOT = resolve_runtime_root()
sys.path.insert(0, str(RUNTIME_ROOT))

import src.mp_trainer as mp_trainer

SignRecorder = mp_trainer.SignRecorder


LIGHTING_MIN = 45.0
LIGHTING_MAX = 210.0
LIGHTING_MIN_CONTRAST = 22.0

VOTE_WINDOW_SIZE = 5
VOTE_REQUIRED_HITS = 3
VOTE_MIN_CONFIDENCE = 0.45
VOTE_ENTRY_TTL_S = 0.7

HAND_CONNECTIONS = [
    (0, 1), (1, 2), (2, 3), (3, 4),
    (0, 5), (5, 6), (6, 7), (7, 8),
    (5, 9), (9, 10), (10, 11), (11, 12),
    (9, 13), (13, 14), (14, 15), (15, 16),
    (13, 17), (17, 18), (18, 19), (19, 20),
    (0, 17),
]


def resolve_model_path(runtime_root: Path) -> Path | None:
    candidates = [
        runtime_root / "models" / "hand_landmarker.task",
        runtime_root / "backend" / "models" / "hand_landmarker.task",
        runtime_root.parent / "models" / "hand_landmarker.task",
        Path("models/hand_landmarker.task").resolve(),
    ]
    for path in candidates:
        if path.exists():
            return path
    return None


def resolve_dataset_path(runtime_root: Path) -> Path | None:
    candidates = [
        runtime_root / "data" / "mediapipe_signs_db.csv",
        runtime_root / "mediapipe_signs_db.csv",
        runtime_root.parent / "data" / "mediapipe_signs_db.csv",
        runtime_root / "src" / "mediapipe_signs_db.csv",
        runtime_root.parent / "src" / "mediapipe_signs_db.csv",
        Path("src/mediapipe_signs_db.csv").resolve(),
    ]
    for path in candidates:
        if path.exists():
            return path
    return None


def open_camera(camera_index=0, width=640, height=480):
    """
    Try camera backends in order and verify actual frame delivery.
    Mirrors src/mp_trainer.py behavior.
    """
    backends = [("DSHOW", cv2.CAP_DSHOW), ("DEFAULT", None)]
    if hasattr(cv2, "CAP_MSMF"):
        backends.append(("MSMF", cv2.CAP_MSMF))

    for backend_name, backend in backends:
        cap = cv2.VideoCapture(camera_index) if backend is None else cv2.VideoCapture(camera_index, backend)
        if not cap.isOpened():
            cap.release()
            continue

        cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        cap.set(cv2.CAP_PROP_FPS, 30)

        for _ in range(20):
            ok, _ = cap.read()
            if ok:
                print(f"[+] Camera {camera_index} opened via {backend_name} ({width}x{height}).")
                return cap
            time.sleep(0.03)

        print(f"[!] Camera {camera_index} via {backend_name} returned no frames; trying next backend.")
        cap.release()

    return None


class GodotMediaPipeServer:
    def __init__(self, camera_index=0):
        print("[*] Initializing Godot MediaPipe backend...")
        print(f"[*] Runtime root: {RUNTIME_ROOT}")

        self.camera_index = int(camera_index)
        self.cap = open_camera(self.camera_index, width=640, height=480)
        if self.cap is None:
            raise RuntimeError(f"Could not open camera {self.camera_index}.")

        model_path = resolve_model_path(RUNTIME_ROOT)
        if model_path is None:
            raise RuntimeError("Missing model file: hand_landmarker.task (looked in runtime/model paths)")
        print(f"[+] Using hand model: {model_path}")

        dataset_path = resolve_dataset_path(RUNTIME_ROOT)
        if dataset_path is not None:
            mp_trainer.DATA_FILE = str(dataset_path)
            print(f"[+] Using dataset: {dataset_path}")
        else:
            print(f"[!] Dataset not found in runtime candidates; using default path: {mp_trainer.DATA_FILE}")

        base_options = python.BaseOptions(model_asset_path=str(model_path))
        options = vision.HandLandmarkerOptions(
            base_options=base_options,
            num_hands=2,
            running_mode=vision.RunningMode.VIDEO,
            min_hand_detection_confidence=0.3,
            min_hand_presence_confidence=0.3,
            min_tracking_confidence=0.3,
        )
        self.hand_landmarker = vision.HandLandmarker.create_from_options(options)
        self.last_mp_timestamp_ms = 0
        print("[+] Hand tracking: MediaPipe Tasks (VIDEO mode)")

        self.recorder = SignRecorder()

        self.settings = {
            "send_frames": True,
            "frame_quality": 45,
            "target_fps": 24,
            "send_landmarks": False,
            "restricted_signs": True,
            "debug_hands": False,
        }

        self.vote_window_size = VOTE_WINDOW_SIZE
        self.vote_required_hits = VOTE_REQUIRED_HITS
        self.vote_min_confidence = VOTE_MIN_CONFIDENCE
        self.vote_entry_ttl_s = VOTE_ENTRY_TTL_S
        self.sign_vote_window = []
        self.last_vote_hits = 0

        self.fps_counter = 0
        self.fps_start_time = time.time()
        self.current_fps = 0.0

        print("[+] Backend initialized.")

    def _next_timestamp_ms(self):
        now_ms = int(time.time() * 1000)
        if now_ms <= self.last_mp_timestamp_ms:
            now_ms = self.last_mp_timestamp_ms + 1
        self.last_mp_timestamp_ms = now_ms
        return now_ms

    def _evaluate_lighting(self, frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        mean = float(np.mean(gray))
        contrast = float(np.std(gray))

        if mean < LIGHTING_MIN:
            status = "low_light"
        elif mean > LIGHTING_MAX:
            status = "overexposed"
        elif contrast < LIGHTING_MIN_CONTRAST:
            status = "low_contrast"
        else:
            status = "good"

        return status, mean, contrast, status == "good"

    def _apply_temporal_vote(self, raw_sign, raw_conf, allow_detection):
        now = time.time()
        self.sign_vote_window = [
            item for item in self.sign_vote_window if now - float(item.get("time", 0.0)) <= self.vote_entry_ttl_s
        ]

        normalized = str(raw_sign or "idle").strip().lower()
        if (not allow_detection) or normalized in ("idle", "unknown"):
            self.sign_vote_window = []
            self.last_vote_hits = 0
            return "idle", 0.0

        self.sign_vote_window.append(
            {
                "label": normalized,
                "conf": float(max(0.0, raw_conf)),
                "time": now,
            }
        )
        if len(self.sign_vote_window) > self.vote_window_size:
            self.sign_vote_window = self.sign_vote_window[-self.vote_window_size:]

        counts = {}
        conf_sums = {}
        for item in self.sign_vote_window:
            label = str(item.get("label", "idle"))
            counts[label] = counts.get(label, 0) + 1
            conf_sums[label] = conf_sums.get(label, 0.0) + float(item.get("conf", 0.0))

        if not counts:
            self.last_vote_hits = 0
            return "idle", 0.0

        best_label = max(counts.keys(), key=lambda lbl: (counts[lbl], conf_sums.get(lbl, 0.0)))
        best_hits = int(counts[best_label])
        avg_conf = float(conf_sums.get(best_label, 0.0) / max(1, best_hits))
        self.last_vote_hits = best_hits

        if best_hits >= self.vote_required_hits and avg_conf >= self.vote_min_confidence:
            return best_label, avg_conf
        return "idle", avg_conf

    def _extract_hand_payload(self, mp_result, frame_shape):
        if not mp_result or not mp_result.hand_landmarks:
            return []

        h, w = frame_shape[:2]
        payload = []
        indices = [0, 5, 9, 13, 17]

        for hand_idx, landmarks in enumerate(mp_result.hand_landmarks):
            palm_x = sum(landmarks[i].x for i in indices) / len(indices)
            palm_y = sum(landmarks[i].y for i in indices) / len(indices)

            handedness = "Unknown"
            if mp_result.handedness and hand_idx < len(mp_result.handedness):
                handedness = mp_result.handedness[hand_idx][0].category_name

            hand_entry = {
                "handedness": handedness,
                "palm_center": [round(palm_x, 4), round(palm_y, 4)],
                "palm_center_px": [int(palm_x * w), int(palm_y * h)],
            }

            if self.settings.get("send_landmarks", False):
                hand_entry["landmarks"] = [[round(lm.x, 4), round(lm.y, 4), round(lm.z, 4)] for lm in landmarks]

            payload.append(hand_entry)

        return payload

    def _encode_frame(self, frame):
        quality = int(self.settings.get("frame_quality", 45))
        quality = max(10, min(95, quality))
        ok, buffer = cv2.imencode(".jpg", frame, [cv2.IMWRITE_JPEG_QUALITY, quality])
        if not ok:
            return ""
        return base64.b64encode(buffer).decode("utf-8")

    def _draw_hand_skeletons(self, frame, mp_result):
        if not mp_result or not mp_result.hand_landmarks:
            return

        h, w = frame.shape[:2]

        for landmarks in mp_result.hand_landmarks:
            for start_idx, end_idx in HAND_CONNECTIONS:
                p1 = landmarks[start_idx]
                p2 = landmarks[end_idx]
                x1 = int(p1.x * w)
                y1 = int(p1.y * h)
                x2 = int(p2.x * w)
                y2 = int(p2.y * h)
                cv2.line(frame, (x1, y1), (x2, y2), (0, 220, 80), 2)

            for lm in landmarks:
                cx = int(lm.x * w)
                cy = int(lm.y * h)
                cv2.circle(frame, (cx, cy), 4, (0, 80, 255), -1)
                cv2.circle(frame, (cx, cy), 1, (255, 255, 255), -1)

    async def _process_frame(self):
        ok, frame = self.cap.read()
        if not ok:
            return {"type": "error", "message": "Camera read failed"}

        frame = cv2.flip(frame, 1)

        lighting_status, lighting_mean, lighting_contrast, lighting_ok = self._evaluate_lighting(frame)

        rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
        mp_result = self.hand_landmarker.detect_for_video(mp_image, self._next_timestamp_ms())

        num_hands = len(mp_result.hand_landmarks) if mp_result and mp_result.hand_landmarks else 0

        raw_sign = "idle"
        raw_conf = 0.0
        min_dist = float("inf")

        if num_hands > 0:
            features = self.recorder.process_tasks_landmarks(
                mp_result.hand_landmarks,
                mp_result.handedness or [],
            )
            label, raw_conf, min_dist = self.recorder.predict_with_confidence(features)
            raw_sign = str(label or "idle").strip().lower()

        restricted_signs = bool(self.settings.get("restricted_signs", True))
        if restricted_signs and num_hands < 2:
            raw_sign = "idle"
            raw_conf = 0.0

        allow_detection = lighting_ok and num_hands > 0
        if restricted_signs:
            allow_detection = allow_detection and num_hands >= 2

        stable_sign, stable_conf = self._apply_temporal_vote(raw_sign, raw_conf, allow_detection)
        dist_value = None if not math.isfinite(min_dist) else round(float(min_dist), 4)

        response = {
            "type": "frame_data",
            "timestamp": time.time(),
            "fps": round(self.current_fps, 1),
            "frame_size": [int(frame.shape[1]), int(frame.shape[0])],
            "hands": self._extract_hand_payload(mp_result, frame.shape),
            "detection": {
                "architecture": "mediapipe_knn_pygame_v1",
                "raw_sign": raw_sign,
                "raw_confidence": round(float(raw_conf), 3),
                "stable_sign": stable_sign,
                "stable_confidence": round(float(stable_conf), 3),
                "distance": dist_value,
                "hands": int(num_hands),
                "restricted_signs": restricted_signs,
                "lighting_status": lighting_status,
                "lighting_mean": round(float(lighting_mean), 2),
                "lighting_contrast": round(float(lighting_contrast), 2),
                "vote_hits": int(self.last_vote_hits),
                "vote_window_size": int(self.vote_window_size),
                "vote_required_hits": int(self.vote_required_hits),
                "vote_min_confidence": round(float(self.vote_min_confidence), 3),
                "debug_hands": bool(self.settings.get("debug_hands", False)),
            },
        }

        if self.settings.get("send_frames", True):
            if self.settings.get("debug_hands", False):
                self._draw_hand_skeletons(frame, mp_result)
            response["frame_base64"] = self._encode_frame(frame)

        return response

    def _apply_settings_patch(self, patch):
        if "send_frames" in patch:
            self.settings["send_frames"] = bool(patch["send_frames"])
        if "send_landmarks" in patch:
            self.settings["send_landmarks"] = bool(patch["send_landmarks"])
        if "restricted_signs" in patch:
            self.settings["restricted_signs"] = bool(patch["restricted_signs"])
        if "debug_hands" in patch:
            self.settings["debug_hands"] = bool(patch["debug_hands"])
        if "frame_quality" in patch:
            self.settings["frame_quality"] = max(10, min(95, int(patch["frame_quality"])))
        if "target_fps" in patch:
            self.settings["target_fps"] = max(5, min(60, int(patch["target_fps"])))

        if "vote_required_hits" in patch:
            self.vote_required_hits = max(2, min(self.vote_window_size, int(patch["vote_required_hits"])))
        if "vote_min_confidence" in patch:
            self.vote_min_confidence = max(0.2, min(0.9, float(patch["vote_min_confidence"])))

    async def _handle_client_message(self, message):
        try:
            data = json.loads(message)
        except json.JSONDecodeError:
            return None

        msg_type = str(data.get("type", ""))
        if msg_type == "ping":
            return json.dumps({"type": "pong", "timestamp": time.time()})
        if msg_type == "settings":
            self._apply_settings_patch(data)
            return json.dumps(
                {
                    "type": "settings_ack",
                    "settings": {
                        **self.settings,
                        "vote_required_hits": self.vote_required_hits,
                        "vote_min_confidence": self.vote_min_confidence,
                    },
                }
            )
        return None

    def _update_fps(self):
        self.fps_counter += 1
        elapsed = time.time() - self.fps_start_time
        if elapsed >= 1.0:
            self.current_fps = float(self.fps_counter / elapsed)
            self.fps_counter = 0
            self.fps_start_time = time.time()

    async def _client_handler(self, websocket):
        client_id = id(websocket)
        print(f"[+] Client connected: {client_id}")
        try:
            await websocket.send(
                json.dumps(
                    {
                        "type": "connected",
                        "server_version": "godot-mp-1.0.0",
                        "architecture": "mediapipe_knn_pygame_v1",
                        "settings": {
                            **self.settings,
                            "vote_required_hits": self.vote_required_hits,
                            "vote_min_confidence": self.vote_min_confidence,
                        },
                    }
                )
            )

            while True:
                tick_start = time.perf_counter()

                try:
                    incoming = await asyncio.wait_for(websocket.recv(), timeout=0.001)
                    response = await self._handle_client_message(incoming)
                    if response:
                        await websocket.send(response)
                except asyncio.TimeoutError:
                    pass

                frame_payload = await self._process_frame()
                await websocket.send(json.dumps(frame_payload))
                self._update_fps()

                target_fps = int(self.settings.get("target_fps", 24))
                target_interval = 1.0 / max(5, min(60, target_fps))
                elapsed = time.perf_counter() - tick_start
                sleep_s = max(0.0, target_interval - elapsed)
                if sleep_s > 0:
                    await asyncio.sleep(sleep_s)
                else:
                    await asyncio.sleep(0.001)

        except websockets.ConnectionClosed:
            pass
        except Exception as exc:
            print(f"[!] Client loop error: {exc}")
        finally:
            print(f"[-] Client disconnected: {client_id}")

    async def start(self, host="127.0.0.1", port=8765):
        print("=" * 56)
        print("Godot MediaPipe Backend Server")
        print("=" * 56)
        print(f"WebSocket: ws://{host}:{port}")
        print(f"Camera: {self.camera_index}")
        print("Architecture: mediapipe_knn_pygame_v1")
        print("Press Ctrl+C to stop.")
        print("=" * 56)
        async with websockets.serve(self._client_handler, host, port):
            await asyncio.Future()

    def cleanup(self):
        if self.cap is not None:
            self.cap.release()
        if self.hand_landmarker is not None and hasattr(self.hand_landmarker, "close"):
            self.hand_landmarker.close()
        print("[*] Backend stopped.")


async def main():
    parser = argparse.ArgumentParser(description="Godot MediaPipe backend server (pygame-equivalent detection flow)")
    parser.add_argument("--host", type=str, default="127.0.0.1", help="Host to bind (default: 127.0.0.1)")
    parser.add_argument("--port", type=int, default=8765, help="WebSocket port (default: 8765)")
    parser.add_argument("--camera", type=int, default=0, help="Camera index (default: 0)")
    args = parser.parse_args()

    server = None
    try:
        server = GodotMediaPipeServer(camera_index=args.camera)
        await server.start(host=args.host, port=args.port)
    except KeyboardInterrupt:
        print("\n[*] Shutting down...")
    finally:
        if server is not None:
            server.cleanup()


if __name__ == "__main__":
    asyncio.run(main())
