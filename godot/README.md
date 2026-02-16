# Godot 4.5 MediaPipe Arena

This folder now contains a refactored Godot 4.5 project with:

- menu screen + play screen flow
- backend auto-start + auto-reconnect
- MediaPipe + KNN detection path matching pygame logic
- pygame-style sequence strip under camera
- sign preview card using `godot/assets/pics/png/*.png`
- jutsu video preview card (tries `godot/assets/videos/*.mp4`)
- move particles + step/complete SFX

- MediaPipe HandLandmarker (2 hands, VIDEO mode)
- `SignRecorder` KNN classifier from `src/mp_trainer.py`
- lighting gate
- two-hand gate
- temporal voting

## 1) Start backend

From repo root:

```powershell
python src/backend_server_mediapipe.py --host 127.0.0.1 --port 8765 --camera 0
```

You can still run it manually for development, but the app now tries to auto-start backend if connection fails.

## 2) Open Godot project

Open `godot/project.godot` in Godot 4.5, then run the main scene.

## Auto-start Backend (New)

When the Godot app cannot connect, it will:

1. try starting a sidecar backend executable for distribution
2. fallback to `python` / `python.exe` / `py -3` with `src/backend_server_mediapipe.py` in dev
3. retry connection automatically

Sidecar path expected by the app:

- `backend/backend_server_mediapipe.exe` next to your exported game executable

See `godot/backend/README.md` for expected runtime file layout.

## Reused Pygame Assets (New)

Godot now uses assets copied from pygame sources:

- logo/background textures from `godot/assets/pics`
- sign preview images from `godot/assets/pics/png`
- jutsu preview videos from `godot/assets/videos`
- step/complete SFX from `godot/assets/sounds`

## 3) Validate pipeline parity

On the right panel you should see:

- `Stable` sign (post-vote output)
- `Raw` sign (single-frame classifier output)
- `Hands` count + `2H` mode
- `Light` status/metrics
- `Vote` hits/window/min confidence
- `Display FPS` (actual camera frame refresh in Godot)
- `Engine FPS` (Godot render loop)
- `Detection FPS` (backend processing rate)

## In-game controls

- `Show Skeletons`: draws hand skeletons on the streamed frame (pygame-like debug view)
- `Game Mechanic`: enables simple sequence practice logic like pygame
  - choose a jutsu
  - follow sign order
  - timer + best time + completion count
  - sequence cards show completed/current/upcoming states like pygame

## MP4 preview note

- This build tries to load `.mp4` previews in the right HUD card.
- Current mapping: `Chidori`, `Rasengan`.
- If your Godot runtime cannot decode MP4 directly, the card will show an `unsupported` message and the rest of gameplay still works.

## Visual behavior

- Menu screen for entry flow.
- Play screen with camera feed + HUD.
- Particle bursts on:
  - each correct sign step
  - jutsu completion

This is the same decision flow used by the pygame MediaPipe path.

## Build Sidecar Backend (Windows)

Example command from repo root (Python environment with dependencies installed):

```powershell
pyinstaller --onefile --name backend_server_mediapipe src/backend_server_mediapipe.py --add-data "models\\hand_landmarker.task;models" --add-data "src\\mediapipe_signs_db.csv;data"
```

Then copy:

- `dist/backend_server_mediapipe.exe` -> `backend/backend_server_mediapipe.exe` (next to exported game)
