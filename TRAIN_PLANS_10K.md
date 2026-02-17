# Training Plans for 10,000 Images

This file gives **time-boxed YOLO training commands** for a dataset of about **10,000 images**.

Assumptions:
- Dataset split is roughly 80/20 (`train`/`val`).
- You run from repo root: `/Users/bugatti/Documents/Naruto`
- Script: `src/train.py`

Important:
- These are **target-time plans**, not guaranteed exact times.
- Real time depends on GPU/CPU, thermals, disk speed, and background load.
- If you are CPU-only, multiply expected time by about `3x` to `8x`.

## 10,000 Image Prep Plan (What Pictures to Collect)

### 1) Dataset Composition Target
- Option A total: `10,000` images
- Option B total: `12,000` images (recommended if you want more negatives)
- Positives (valid sign images): `9,360` (same for both options)
- Hard negatives:
  - `640` for Option A (`10,000`)
  - `2,640` for Option B (`12,000`)

This plan assumes exactly:
- `N = 6` for every positive combo
- `5 lighting x 3 distance x 4 angle x 2 motion = 120 combos/sign`
- `120 x 6 = 720` positives per sign
- `720 x 13 signs = 9,360` positives

| Sign | Images |
|---|---:|
| Bird | 720 |
| Boar | 720 |
| Clap | 720 |
| Dog | 720 |
| Dragon | 720 |
| Hare | 720 |
| Horse | 720 |
| Monkey | 720 |
| Ox | 720 |
| Ram | 720 |
| Rat | 720 |
| Snake | 720 |
| Tiger | 720 |
| **Total positives** | **9,360** |
| **Hard negatives (Option A)** | **640** |
| **Grand total (Option A)** | **10,000** |
| **Hard negatives (Option B)** | **2,640** |
| **Grand total (Option B)** | **12,000** |

### 2) Positive Images (9,360) Capture Matrix
This section is the exact combo rule (`sign + lighting + distance + angle + motion -> N`).

Axes per sign:
- Lighting: `normal`, `low`, `high`, `backlit`, `mixed`
- Distance: `close`, `medium`, `far`
- Angle: `frontal`, `yaw`, `pitch`, `roll`
- Motion: `sharp`, `blur`

Total combos per sign:
- `5 x 3 x 4 x 2 = 120` combos

Exact quota rule:
- For every sign and every combo, `N = 6`.
- No exceptions.

Examples (exact):
- `ram normal/close/frontal/sharp -> 6`
- `ram normal/far/frontal/sharp -> 6`
- `ram mixed/far/frontal/sharp -> 6`
- `ram high/far/roll/blur -> 6`
- `bird low/medium/yaw/sharp -> 6`
- `bird mixed/far/frontal/sharp -> 6`

#### 2.1 Exact Category Definitions
Use these definitions consistently.

Lighting:
- `normal`: face/hands clearly lit, no heavy clipping.
- `low`: dim environment, hands still visible, darker image.
- `high`: bright/front light, some highlight clipping acceptable.
- `backlit`: strongest light source behind you.
- `mixed`: uneven shadows or strong warm/cool color cast.

Distance (relative hand size in frame):
- `close`: hand(s) occupy about `45-65%` frame height.
- `medium`: hand(s) occupy about `25-45%`.
- `far`: hand(s) occupy about `12-25%`.

Angle:
- `frontal`: near straight-on (`~0-10°` yaw/pitch).
- `yaw`: left/right turn (`~20-40°`).
- `pitch`: camera up/down or hand vertical tilt (`~20-40°`).
- `roll`: wrist/camera roll (`~15-30°` tilt).

Motion:
- `sharp`: hold sign still for a clean frame.
- `blur`: small intentional movement while capturing.

#### 2.2 Exact Capture Procedure (Do This Literally)
For each sign in:
`Bird, Boar, Clap, Dog, Dragon, Hare, Horse, Monkey, Ox, Ram, Rat, Snake, Tiger`

Run this nested loop:
1. Set lighting = `normal`
2. For distance in `close, medium, far`
3. For angle in `frontal, yaw, pitch, roll`
4. Capture `6 sharp` images
5. Capture `6 blur` images
6. Repeat for lighting = `low, high, backlit, mixed`

Per sign math:
- `5 lightings x 3 distances x 4 angles x 2 motions x 6 = 720`

All signs math:
- `720 x 13 = 9,360` positives

#### 2.3 File Naming (Exact)
Use:
- `<sign>__<lighting>__<distance>__<angle>__<motion>__<idx>.jpg`
- `idx` is `01..06`

Examples:
- `ram__normal__close__frontal__sharp__01.jpg`
- `ram__normal__close__frontal__sharp__02.jpg`
- `ram__normal__far__frontal__sharp__06.jpg`
- `bird__mixed__medium__yaw__blur__03.jpg`

#### 2.4 Train/Val Split (Exact)
For each positive combo of 6 images:
- `5` images -> train
- `1` image -> val

Positive split totals:
- Train positives: `120 combos/sign x 5 x 13 = 7,800`
- Val positives: `120 combos/sign x 1 x 13 = 1,560`

Recommended tracker columns:
- `sign,lighting,distance,angle,motion,target_n,captured_n,train_count,val_count`

### 3) Hard Negatives
Include examples that should map to no detection/ignore behavior.

#### Option A (Total 640 negatives, for 10,000 dataset)

| Negative type | Target count |
|---|---:|
| No hands in frame | 150 |
| One hand only / incomplete pose | 120 |
| Near-miss wrong-sign (`16 x 13`) | 208 |
| Extra near-miss on confusing pairs | 52 |
| Partial hands/out-of-frame | 60 |
| Distractors/background clutter | 40 |
| Heavy motion blur / unusable states | 10 |
| **Total** | **640** |

Negative split (exact):
- Train negatives: `512`
- Val negatives: `128`

Overall split with Option A:
- Train total: `7,800 + 512 = 8,312`
- Val total: `1,560 + 128 = 1,688`

#### Option B (Total 2,640 negatives, for 12,000 dataset)

| Negative type | Target count |
|---|---:|
| No hands in frame | 550 |
| One hand only / incomplete pose | 500 |
| Near-miss wrong-sign | 900 |
| Extra near-miss on confusing pairs | 260 |
| Partial hands/out-of-frame | 240 |
| Distractors/background clutter | 140 |
| Heavy motion blur / unusable states | 50 |
| **Total** | **2,640** |

Negative split (exact):
- Train negatives: `2,112`
- Val negatives: `528`

Overall split with Option B:
- Train total: `7,800 + 2,112 = 9,912`
- Val total: `1,560 + 528 = 2,088`

### 4) Image Quality / Capture Rules
- Keep capture resolution consistent (e.g., `640x480` or `1280x720`), then train at `--img-size 640`.
- Use multiple devices/cameras if possible (webcam + laptop cam + phone cam).
- Keep both clean and noisy backgrounds.
- Include different sleeves/skin-background contrasts.
- Avoid heavily compressed screenshots; use original camera frames.

### 5) Labeling Rules (Critical)
- Use one consistent box policy for all classes.
- Keep boxes tight around relevant hand region(s), with small margin.
- Don’t mix inconsistent label styles between sessions.
- Drop very ambiguous frames instead of forcing incorrect labels.
- Manually QA at least `5-10%` of labels before long training runs.

### 6) Train/Val Split Rules
- Split by **capture session**, not random adjacent frames (avoid leakage).
- For one-person datasets: put unseen sessions/lighting setups into `val`.
- Ensure each class appears in `val` under low-light and angle variation.

### 7) If You Only Have One Person
- You can still build a strong model by maximizing variation in:
  - lighting,
  - camera angle,
  - distance,
  - background,
  - clothing/sleeves.
- But cross-skin-tone robustness remains unproven until you validate on other people.

### 8) If You Add One More Sign Later (14th Class)
Short answer: train on top, but with old data included.

- You do **not** need to start from random weights.
- You should fine-tune from your current best model, but include:
  - all old 13 classes,
  - plus the new class,
  - plus hard negatives.
- Do **not** use `--resume` when class count changes; use `--model <old_best.pt>` instead.

Recommended command pattern:

```bash
python3 /Users/bugatti/Documents/Naruto/src/train.py \
  --model /Users/bugatti/Documents/Naruto/models/runs/<old_run>/weights/best.pt \
  --epochs 60 --img-size 640 --batch 16 \
  --hsv-h 0.02 --hsv-s 0.6 --hsv-v 0.55 \
  --degrees 25 --translate 0.20 --scale 0.35 --perspective 0.001 \
  --mosaic 0.7 --mixup 0.15 --name add_sign_finetune
```

If you add class 14 and keep `N = 6` for all positive combos:
- Positives become `14 x 120 x 6 = 10,080`.
- If you keep current negatives (`640`), total dataset becomes `10,720`.
- If you must stay exactly `10,000`, reduce either:
  - positive N (for example, mix of `N=5` and `N=6`), or
  - negative count.

### 9) Train With New Data (Incremental Updates)
Use this when you collect fresh images after your first model is already good.

#### Case A: New images for the same 13 signs (no new class)
Goal: improve robustness without changing class count.

Data rule:
- Keep old data + new data together.
- Good mix target each update: about `70% old` + `30% new` in the train set.
- Keep validation mostly stable (old sessions) and add a small new-data slice to val.

Command (fine-tune from old best):

```bash
python3 /Users/bugatti/Documents/Naruto/src/train.py \
  --model /Users/bugatti/Documents/Naruto/models/runs/<old_run>/weights/best.pt \
  --epochs 30 --img-size 640 --batch 16 --patience 12 \
  --hsv-h 0.02 --hsv-s 0.6 --hsv-v 0.55 \
  --degrees 25 --translate 0.20 --scale 0.35 --perspective 0.001 \
  --mosaic 0.7 --mixup 0.15 --name finetune_newdata_same13
```

#### Case B: Add a new class (14th sign)
Goal: include a brand-new sign while keeping old 13 performance.

Data rule:
- Train on full combined dataset: old 13 + new class + hard negatives.
- Minimum recommended for new class: `500-800` clean positives before serious rollout.
- Keep old classes in training to avoid catastrophic forgetting.

Command (warm-start from old best, class count changed):

```bash
python3 /Users/bugatti/Documents/Naruto/src/train.py \
  --model /Users/bugatti/Documents/Naruto/models/runs/<old_run>/weights/best.pt \
  --epochs 60 --img-size 640 --batch 16 --patience 20 \
  --hsv-h 0.02 --hsv-s 0.6 --hsv-v 0.55 \
  --degrees 25 --translate 0.20 --scale 0.35 --perspective 0.001 \
  --mosaic 0.7 --mixup 0.15 --name finetune_add_class14
```

Important:
- Prefer `--model <old_best.pt>` for incremental training.
- Do not train only on the new class data; old classes will regress.
- Re-check per-class confusion matrix after every incremental run.

## 45 Minutes Plan (Fast Smoke Test)
Use this when you need a quick baseline check.

```bash
python3 /Users/bugatti/Documents/Naruto/src/train.py \
  --model yolov8n.pt --epochs 8 --img-size 416 --batch 24 --patience 6 \
  --hsv-h 0.02 --hsv-s 0.6 --hsv-v 0.55 \
  --degrees 20 --translate 0.18 --scale 0.30 --perspective 0.001 \
  --mosaic 0.6 --mixup 0.10 --name 10k_45min
```

## 1 Hour Plan
Use this for a better quick model while keeping runtime tight.

```bash
python3 /Users/bugatti/Documents/Naruto/src/train.py \
  --model yolov8n.pt --epochs 12 --img-size 480 --batch 20 --patience 8 \
  --hsv-h 0.02 --hsv-s 0.6 --hsv-v 0.55 \
  --degrees 22 --translate 0.20 --scale 0.32 --perspective 0.001 \
  --mosaic 0.7 --mixup 0.12 --name 10k_1hour
```

## 2 Hours Plan
Use this when you want stronger accuracy but still short turnaround.

```bash
python3 /Users/bugatti/Documents/Naruto/src/train.py \
  --model yolov8n.pt --epochs 24 --img-size 512 --batch 16 --patience 12 \
  --hsv-h 0.02 --hsv-s 0.6 --hsv-v 0.55 \
  --degrees 25 --translate 0.20 --scale 0.35 --perspective 0.001 \
  --mosaic 0.7 --mixup 0.15 --name 10k_2hour
```

## 4 Hours Plan
Use this for a stronger checkpoint before long runs.

```bash
python3 /Users/bugatti/Documents/Naruto/src/train.py \
  --model yolov8s.pt --epochs 40 --img-size 640 --batch 16 --patience 16 \
  --hsv-h 0.02 --hsv-s 0.6 --hsv-v 0.55 \
  --degrees 25 --translate 0.20 --scale 0.35 --perspective 0.001 \
  --mosaic 0.7 --mixup 0.15 --name 10k_4hour
```

## 8+ Hours Plan (Higher Quality)
Use this for production-grade training.

```bash
python3 /Users/bugatti/Documents/Naruto/src/train.py \
  --model yolov8s.pt --epochs 90 --img-size 640 --batch 16 --patience 25 \
  --hsv-h 0.02 --hsv-s 0.6 --hsv-v 0.55 \
  --degrees 25 --translate 0.20 --scale 0.35 --perspective 0.001 \
  --mosaic 0.7 --mixup 0.15 --name 10k_8hour_plus
```

## Your Original Long Plan (Reference)
This is your heavier setup:

```bash
python3 /Users/bugatti/Documents/Naruto/src/train.py \
  --model yolov8s.pt --epochs 180 --img-size 640 --batch 16 \
  --hsv-h 0.02 --hsv-s 0.6 --hsv-v 0.55 \
  --degrees 25 --translate 0.2 --scale 0.35 --perspective 0.001 \
  --mosaic 0.7 --mixup 0.15
```

## How to Hit Time Budget More Precisely
1. Run a short benchmark:
```bash
python3 /Users/bugatti/Documents/Naruto/src/train.py \
  --model yolov8n.pt --epochs 3 --img-size 512 --batch 16 --name bench_3ep
```
2. Measure `minutes_per_epoch` from logs.
3. Set:
- `target_epochs = floor(target_minutes / minutes_per_epoch * 0.9)`
4. Re-run with your full augment settings and that epoch value.
