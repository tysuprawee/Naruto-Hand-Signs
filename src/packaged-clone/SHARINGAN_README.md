# Sharingan Effect Transfer Guide (Exact + Locked)

This guide is for copying the current Sharingan move into another repo with the same output and trigger behavior.

## Fast copy command
From this repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\export-sharingan.ps1 -TargetRepo ..\packaged-clone -Clean
```

Then in target repo:

```powershell
cd ..\packaged-clone
npm install
npm run dev
```

Open:
- `http://localhost:5173/charingane.html`

## Exact behavior
- Crow brush locked.
- Webcam mirrored selfie view.
- Charged trigger only (no manual trigger button):
  - close both eyes for > 1.5s to activate.
  - on activation: video fades out, red background + eye/blood FX + particles become active.
- `r` resets/deactivates and returns to normal webcam.

## Required files

### Core pages / code
- `charingane.html`
- `src/move.js`
- `src/moves.js`
- `src/settings-panel.js`
- `src/style.css`
- `vite.config.js`
- `package.json`
- `package-lock.json`

### Required public assets
- `public/red.jpg`
- `public/eyes.png`
- `public/crow.png`
- `public/crow2.png`
- `public/cloud.png`
- `public/fire.png`
- `public/fire2.png`
- `public/eyeblood/*` (frame sequence used by blood FX)

## Exact move config (must match)
In `src/moves.js`, keep this move entry exactly:

```js
{
  id: 'charingane',
  name: 'Charingan Move',
  description: 'Locked crow brush with your provided sharingan-style preset.',
  href: '/charingane.html',
  preset: SHARINGAN_PRESET,
  lockedBrushIndex: CROW_BRUSH_INDEX,
  triggerMode: 'charged',
  particlesEnabled: true,
  useLandmarkers: true,
  shadowClone: null
}
```

And keep `SHARINGAN_PRESET` values as your approved baseline.

## Trigger binding details
- Activation condition in runtime:
  - both `eyeBlinkLeft` and `eyeBlinkRight` blendshape scores > `0.4`
  - closed duration > `1.5` seconds
- No manual on-screen trigger for Sharingan.
- Keybinds:
  - `r`: reset all active states
  - `o`: hide/show settings panel
  - `e`: toggle particle visibility
  - `f`, `m`: debug toggles

## Page wiring (must match IDs)
`charingane.html` must include:
- `<body data-move-id="charingane">`
- `<video id="webcam" autoplay playsinline></video>`
- `<img id="bg-image" src="/red.jpg" ...>`
- `<div id="app"></div>`
- `<canvas id="fg-canvas"></canvas>`
- `<script type="module" src="/src/move.js"></script>`

## Make it unchangeable (locked deployment)
If you want the exact approved look with no runtime changes:
1. Remove/hide settings panel for `charingane`.
2. Disable preset save/import/export/reset controls.
3. Keep `SHARINGAN_PRESET` fixed and do not load user overrides from localStorage.
4. Keep `lockedBrushIndex: CROW_BRUSH_INDEX`.
