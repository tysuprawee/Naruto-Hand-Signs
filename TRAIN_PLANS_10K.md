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
- Total: `10,000` images
- Positives (valid sign images): `8,500`
- Hard negatives (non-target/ambiguous): `1,500`

Exact positive allocation for your 13 signs (`8,500` total):

| Sign | Images |
|---|---:|
| Bird | 654 |
| Boar | 654 |
| Clap | 654 |
| Dog | 654 |
| Dragon | 654 |
| Hare | 654 |
| Horse | 654 |
| Monkey | 654 |
| Rat | 654 |
| Snake | 654 |
| Tiger | 654 |
| Ox | 653 |
| Ram | 653 |
| **Total** | **8,500** |

The `1-image` difference is just to hit exactly `8,500`.

### 2) Positive Images (8,500) Capture Matrix
Use this **per-sign template** for every sign:

For signs with `654` images:
- Lighting:
  - Normal/front light: `230`
  - Low light/dim: `131`
  - High light/overexposed: `98`
  - Backlit: `98`
  - Mixed color cast/shadows: `97`
- Distance:
  - Close: `196`
  - Medium: `327`
  - Far: `131`
- Angle:
  - Frontal: `229`
  - Left/right yaw: `196`
  - Up/down pitch: `131`
  - Roll/tilt: `98`
- Motion quality:
  - Sharp/still: `458`
  - Slight motion blur: `131`
  - Transitional/partial occlusion: `65`

For signs with `653` images (`Ox`, `Ram`):
- Lighting:
  - Normal/front light: `229`
  - Low light/dim: `131`
  - High light/overexposed: `98`
  - Backlit: `98`
  - Mixed color cast/shadows: `97`
- Distance:
  - Close: `196`
  - Medium: `326`
  - Far: `131`
- Angle:
  - Frontal: `228`
  - Left/right yaw: `196`
  - Up/down pitch: `131`
  - Roll/tilt: `98`
- Motion quality:
  - Sharp/still: `457`
  - Slight motion blur: `131`
  - Transitional/partial occlusion: `65`

These are exact per-sign quotas. One image belongs to one bucket from each axis (lighting, distance, angle, motion).

### 3) Hard Negatives (1,500)
Include examples that should map to no detection/ignore behavior.

| Negative type | Target count |
|---|---:|
| No hands in frame | 300 |
| One hand only / incomplete pose | 260 |
| Near-miss wrong-sign (26 per sign x 13) | 338 |
| Extra near-miss on confusing pairs (Snake/Ram/Tiger/Boar/Ox/Horse) | 112 |
| Partial hands/out-of-frame | 240 |
| Distractors/background clutter | 150 |
| Heavy motion blur / unusable motion states | 100 |

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

If you still want exactly `10,000` images after adding class 14:
- Positives stay `8,500`, negatives stay `1,500`.
- New per-sign target is `607` for 12 signs and `608` for 2 signs (`8,500` total).

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
