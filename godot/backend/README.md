# Backend Sidecar Layout (For Distribution)

The Godot app auto-starts the backend if available in this location:

- `backend/backend_server_mediapipe.exe` (relative to the exported game `.exe`)

Recommended sidecar files:

- `backend/backend_server_mediapipe.exe`
- `backend/models/hand_landmarker.task`
- `backend/data/mediapipe_signs_db.csv`

The backend now searches these runtime paths automatically.
