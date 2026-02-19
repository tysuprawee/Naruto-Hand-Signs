# 🥷 Jutsu Academy — Naruto Hand-Sign Recognition

> *Train real Naruto hand signs with your webcam. Rank up from Academy Student to Hokage.*

A multi-platform project combining **computer vision**, **machine learning**, and **game design** to recognise Naruto hand signs in real time. Built with MediaPipe + KNN for skin-tone-inclusive detection.

| Desktop (Pygame) | Web (Next.js) |
|:---:|:---:|
| <img src="https://github.com/user-attachments/assets/76461e53-4c9e-4124-bd58-9d2b47caccdf" width="420"> | <img src="https://github.com/user-attachments/assets/875e8229-59b6-4af2-bef4-2477125515f0" width="420"> |

---

## ✨ Features

### 🎮 Gameplay
- **Free Play** — Practice any jutsu at your own pace
- **Rank Mode** — Speed-run jutsu sequences and submit scores to the global leaderboard
- **Jutsu Library** — Browse all jutsus, preview sign sequences, and view mastery tiers
- **Quest System** — Daily & weekly quests (e.g. "Land 25 correct signs", "Complete 3 jutsu runs") that award XP
- **Mastery Tiers** — Achieve Bronze / Silver / Gold mastery per jutsu based on clear time
- **Progression** — Rank up from *Academy Student* → *Genin* → *Chūnin* → *Jōnin* → *Hokage*

### 🧠 Detection
- **MediaPipe + KNN** — Converts hand landmarks to 126-D feature vectors; works for **all skin tones**
- **YOLO (Legacy)** — Original YOLOv8 pixel-based detector kept for backward compatibility
- **Temporal Vote Filter** — Smooths noisy frames with a configurable vote window + confidence gate
- **Lighting Quality Gate** — Warns users about low light / overexposure before gameplay

### 🌐 Web App (`web/`)
- Built with **Next.js** + Tailwind CSS, deployed on **Vercel**
- **Landing page** with release countdown, download CTA, and social links
- **`/challenge`** — Full browser-based hand-sign challenge using MediaPipe WASM + KNN (no install required)
- **`/leaderboard`** — Global leaderboard powered by Supabase

### 🖥️ Desktop App (Pygame)
- Mixin-based architecture (`core`, `rendering`, `runtime`, `gameplay`, `ui_setup`, `assets`, `auth`, `playing`, `leaderboard`)
- **Discord OAuth** login with cloud save sync
- **Resolution settings** — 7 presets from 1024×768 to 1920×1080
- **Fullscreen toggle** with automatic UI rebuild
- **Camera preview** in settings with live scan
- **Effects engine** — Shadow Clone particles, Water Dragon, Reaper Death Seal, and an `EffectOrchestrator` for sequencing

### 🎮 Godot Prototype (`godot/`)
- Experimental Godot 4 port with GDScript
- Communicates with a Python MediaPipe backend server over WebSocket

---

## 🐯 Supported Hand Signs (13 Classes)

| # | Sign | Key | # | Sign | Key |
|---|------|-----|---|------|-----|
| 1 | 🐯 Tiger | `1` | 8 | � Rat | `8` |
| 2 | 🐗 Boar | `2` | 9 | � Horse | `9` |
| 3 | 🐍 Snake | `3` | 10 | � Monkey | `0` |
| 4 | 🐏 Ram | `4` | 11 | � Ox | `-` |
| 5 | 🐦 Bird | `5` | 12 | � Hare | `=` |
| 6 | 🐲 Dragon | `6` | 13 | � Clap | `/` |
| 7 | � Dog | `7` | | | |

---

## 📁 Project Structure

```
├── src/
│   ├── jutsu_academy/
│   │   ├── main_pygame.py              # Desktop launcher
│   │   ├── main_pygame_app.py          # Application class (mixin composition)
│   │   ├── main_pygame_shared.py       # Constants, UI widgets, colors
│   │   ├── main_pygame_mixins/         # Modular game logic
│   │   │   ├── core.py                 # Init, display mode, progression
│   │   │   ├── rendering.py            # All screen rendering
│   │   │   ├── runtime.py              # Event loop & state transitions
│   │   │   ├── gameplay.py             # Detection loop, vote filter
│   │   │   ├── playing.py              # In-game HUD & sign matching
│   │   │   ├── ui_setup.py             # UI element creation
│   │   │   ├── assets.py               # Asset loading, settings I/O
│   │   │   ├── auth.py                 # Discord OAuth flow
│   │   │   └── leaderboard.py          # Leaderboard UI & data
│   │   ├── effects/                    # Visual effects engine
│   │   │   ├── shadow_clone_effect.py
│   │   │   ├── water_dragon_effect.py
│   │   │   ├── reaper_death_seal_effect.py
│   │   │   └── orchestrator.py
│   │   ├── discord_auth.py             # OAuth callback server (Flask)
│   │   └── settings.json               # User preferences
│   ├── jutsu_registry.py               # Jutsu definitions & sequences
│   ├── mp_trainer.py                   # MediaPipe KNN trainer
│   ├── capture_dataset.py              # Dataset capture tool
│   └── utils/paths.py                  # Asset path resolver
├── web/                                # Next.js web application
│   ├── app/
│   │   ├── page.tsx                    # Landing page
│   │   ├── challenge/page.tsx          # Browser hand-sign challenge
│   │   └── leaderboard/page.tsx        # Global leaderboard
│   └── utils/
│       ├── knn.ts                      # KNN classifier (TypeScript)
│       ├── supabase.ts                 # Supabase client
│       └── detection-filters.ts        # Temporal vote / lighting filters
├── godot/                              # Godot 4 prototype
│   ├── scripts/Main.gd                 # GDScript game logic
│   ├── scenes/Main.tscn                # Main scene
│   └── backend/                        # Python WebSocket bridge
├── models/                             # ML model weights
├── dataset/                            # Training data
└── requirements.txt                    # Python dependencies
```

---

## 🚀 Getting Started

### Desktop App (Pygame)

#### 1. Create & activate a virtual environment

**macOS / Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

**Windows:**
```bash
python -m venv venv
venv\Scripts\activate
```

#### 2. Install dependencies
```bash
pip install -r requirements.txt
```

#### 3. Launch
```bash
python src/jutsu_academy/main_pygame.py
```

### Web App (Next.js)

```bash
cd web
npm install
npm run dev        # Development
npm run build      # Production
```

### Godot Prototype

1. Open `godot/project.godot` in Godot 4
2. Start the Python backend: `python src/backend_server_mediapipe.py`
3. Run the scene from the Godot editor

---

## ⚙️ Settings

The desktop app saves user preferences to `src/jutsu_academy/settings.json`:

| Setting | Description | Default |
|---------|-------------|---------|
| `music_vol` | Background music volume (0.0–1.0) | `0.5` |
| `sfx_vol` | Sound effects volume (0.0–1.0) | `0.7` |
| `camera_idx` | Webcam index | `0` |
| `debug_hands` | Show hand skeleton overlay | `false` |
| `resolution_idx` | Display resolution preset (0–6) | `0` |
| `fullscreen` | Fullscreen mode | `false` |

---

## 🐛 Troubleshooting

| Problem | Fix |
|---------|-----|
| **Vercel 404** | Set **Root Directory** to `web` in Vercel project settings |
| **`supabaseUrl is required`** | Add `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` to Vercel env vars |
| **SDL library conflict (Mac)** | Harmless warning from dual `libSDL2` in cv2 + pygame; runs fine |
| **Port 5000 blocked (Mac)** | AirPlay Receiver uses port 5000 on macOS Monterey+; Discord auth uses port 5050 to avoid this |
| **Camera not detected** | Try a different camera index in Settings, or click "SCAN" to re-detect |
| **Discord login fails** | Ensure `http://localhost:5050/callback` is added as a redirect URI in your Discord Developer Portal |

---

## 📚 Resources

- [MediaPipe Hand Landmarker](https://developers.google.com/mediapipe/solutions/vision/hand_landmarker)
- [Ultralytics YOLO Docs](https://docs.ultralytics.com/)
- [Pygame Documentation](https://www.pygame.org/docs/)
- [Next.js Documentation](https://nextjs.org/docs)

---

## 📄 License

This project is provided as-is for educational purposes. *Naruto* and all related characters are trademarks of Masashi Kishimoto / Shueisha / VIZ Media.
