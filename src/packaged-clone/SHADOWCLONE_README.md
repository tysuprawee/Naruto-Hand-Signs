# Shadow Clone Effect Transfer Guide (Exact + Locked)

This guide is for copying the current Shadow Clone effect into another project with the same output and trigger behavior.

## Fast copy to `packaged-clone` repo (one command)
From this repo root:

```powershell
powershell -ExecutionPolicy Bypass -File .\scripts\export-shadowclone.ps1 -TargetRepo ..\packaged-clone -Clean
```

Then run in target repo:

```powershell
cd ..\packaged-clone
npm install
npm run dev
```

Open:
- `http://localhost:5173/shadowclone.html`

## What "exact effect" means here
- Webcam as base layer (mirrored selfie view).
- Person-only clones generated from segmentation mask.
- Two clones start at center and move outward.
- Fast blinking during entrance, then settle to full opacity at loop boundary.
- Smoke sprite sequence (transparent PNGs) drawn with no color/filter blending.
- Smoke plays once only while clones are entering.

## Required files

### Core pages / code
- `shadowclone.html`
- `src/move.js`
- `src/moves.js`
- `src/settings-panel.js`
- `src/style.css`
- `vite.config.js` (or equivalent multi-page/route setup)

### Required public assets
- `public/smoke/cf7378e5-58a9-4967-af50-904b2d11ecdd-0.png` through `...-55.png`
- `public/red.jpg` (referenced by shared move page markup)

### Also copy these if you use `src/move.js` unchanged
`move.js` preloads shared assets even when Shadow Clone is selected:
- `public/cloud.png`
- `public/fire.png`
- `public/fire2.png`
- `public/crow.png`
- `public/crow2.png`
- `public/eyes.png`
- `public/eyeblood/*`

If you do not copy those, Shadow Clone still works, but you'll get 404 asset requests unless you strip those preload sections.

## Exact move config (must match)
In `src/moves.js`, keep this move definition:

```js
{
  id: 'shadowclone',
  name: 'Shadow Clone',
  description: 'Normal middle webcam with two side foreground clones and particles off.',
  href: '/shadowclone.html',
  preset: SHADOW_CLONE_PRESET,
  lockedBrushIndex: CROW_BRUSH_INDEX,
  triggerMode: 'manual',
  triggerButtonLabel: 'Trigger Shadow Clone',
  disableButtonLabel: 'Disable Shadow Clone',
  particlesEnabled: false,
  useLandmarkers: false,
  shadowClone: {
    offsetRatio: 0.3,
    scale: 1.0,
    opacity: 0.92,
    enterDurationMs: 650,
    blinkSpeed: 24.0,
    blinkDepth: 0.5,
    smokeEnabled: true,
    smokeOpacity: 0.65,
    smokeScale: 1.2,
    smokeRise: 0.14,
    smokeMaskToClone: false
  }
}
```

## Trigger binding behavior (current implementation)
- `triggerMode: 'manual'` creates a top-center button (`#trigger-skill-btn`, class `skill-trigger-btn`).
- First press:
  - sets `manualSkillActive = true`
  - sets `manualTriggerStartTime = performance.now()`
  - starts entrance animation + blink settling
- Second press:
  - disables effect and clears active entrance/blink state.
- Keyboard:
  - `r` resets and disables manual skill
  - `o` toggles settings panel visibility

## Page wiring (must match IDs)
`shadowclone.html` must contain:
- `<video id="webcam" ...>`
- `<img id="bg-image" ...>`
- `<div id="app"></div>`
- `<canvas id="fg-canvas"></canvas>`
- `<body data-move-id="shadowclone">`

And module script:

```html
<script type="module" src="/src/move.js"></script>
```

## Run instructions
1. `npm install`
2. `npm run dev`
3. Open `http://localhost:5173/shadowclone.html`
4. Allow camera permission.

## Make it unchangeable (locked deployment)
If you want no runtime tweaking:
1. Hide/remove the settings panel for `shadowclone` (remove UI access).
2. Remove preset import/export/save/reset buttons for this move.
3. Keep `src/moves.js` values fixed and do not expose them in UI.
4. Keep `triggerMode: 'manual'` and trigger labels fixed.

Recommended quick lock:
- In `src/move.js`, after `createSettingsPanels(...)`, if `moveId === 'shadowclone'`, remove the panel element from DOM.
- Keep only the manual trigger button.
