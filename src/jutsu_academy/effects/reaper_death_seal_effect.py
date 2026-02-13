from pathlib import Path

import cv2
import mediapipe as mp
import numpy as np
import pygame
import time
from mediapipe.tasks import python
from mediapipe.tasks.python import vision

from src.jutsu_academy.effects.base import BaseEffect, EffectContext


class ReaperDeathSealEffect(BaseEffect):
    """
    Reaper Death Seal effect:
    - Uses selfie segmentation (same model family as shadow clone effect).
    - Replaces camera background with death.jpg.
    - Keeps player cutout at original position (no background capture required).
    """

    def __init__(self):
        self.sign_aliases = {
            "reaper death seal",
            "reaper_death_seal",
            "reaper",
            "shiki fujin",
            "shiki_fujin",
        }

        self.segment_width = 384
        self.mask_every_n_frames = 2
        self.alpha_thresh = 0.35
        self.edge_blur_sigma = 2.0
        self.person_brightness_scale = 0.82
        self.person_darkness_scale = 0.78
        self.background_darkness_scale = 0.58
        self.background_keep_ratio = 0.40
        self.bg_base_scale = 1.03
        self.bg_zoom_amp = 0.08
        self.bg_zoom_hz = 0.22
        self.bg_float_x_amp = 14.0
        self.bg_float_y_amp = 20.0
        self.bg_float_hz = 0.16
        self.bg_y_offset = -30

        self.enabled = False
        self.active = False
        self.segmenter = None
        self.frame_count = 0
        self.last_alpha_full = None
        self.prepared_surface = None
        self.effect_alpha = 0.0
        self.effect_started_at = 0.0
        self.fade_in_sec = 0.9
        self.fade_out_sec = 0.9
        self.total_duration_sec = 7.0

        self.bg_image_bgr = None
        self.bg_cache_size = None
        self.bg_cache_base = None

        self.enabled = self._init_assets_and_segmenter()

    def _init_assets_and_segmenter(self):
        try:
            root = Path(__file__).resolve().parents[3]
            bg_path = root / "src" / "pics" / "death.jpg"
            self.bg_image_bgr = cv2.imread(str(bg_path), cv2.IMREAD_COLOR)
            if self.bg_image_bgr is None:
                raise RuntimeError(f"Missing or unreadable background image: {bg_path}")

            model_path = root / "models" / "selfie_segmenter.tflite"
            base_options = python.BaseOptions(
                model_asset_path=str(model_path),
                delegate=python.BaseOptions.Delegate.CPU,
            )
            options = vision.ImageSegmenterOptions(
                base_options=base_options,
                output_category_mask=True,
                output_confidence_masks=True,
            )
            self.segmenter = vision.ImageSegmenter.create_from_options(options)
            return True
        except Exception as e:
            print(f"[!] ReaperDeathSealEffect disabled (init failed): {e}")
            self.bg_image_bgr = None
            self.segmenter = None
            return False

    def _normalize_name(self, name):
        if not name:
            return ""
        s = str(name).strip().lower().replace("-", " ").replace("_", " ")
        return " ".join(s.split())

    def _get_alpha_from_result(self, segmentation_result):
        confs = getattr(segmentation_result, "confidence_masks", None)
        if confs and len(confs) >= 2:
            person_conf = confs[1].numpy_view().astype(np.float32)
            return np.clip(person_conf, 0.0, 1.0)

        category_mask = segmentation_result.category_mask
        mask = category_mask.numpy_view()
        if mask.ndim == 3:
            mask = mask[:, :, 0]
        vals, counts = np.unique(mask, return_counts=True)
        bg_val = vals[np.argmax(counts)]
        return (mask != bg_val).astype(np.float32)

    def _get_animated_bg(self, w, h):
        if self.bg_image_bgr is None:
            return None
        if self.bg_cache_base is None or self.bg_cache_size != (w, h):
            self.bg_cache_size = (w, h)
            self.bg_cache_base = self.bg_image_bgr.copy()

        # Keep source aspect ratio (no stretching).
        src_h, src_w = self.bg_image_bgr.shape[:2]
        if src_h <= 0 or src_w <= 0:
            return None
        elapsed = max(0.0, time.perf_counter() - self.effect_started_at)

        zoom_wave = np.sin(2.0 * np.pi * self.bg_zoom_hz * elapsed)
        dyn_zoom = self.bg_base_scale + (zoom_wave * self.bg_zoom_amp)
        dyn_zoom = max(1.0, dyn_zoom)

        scale = max(w / float(src_w), h / float(src_h)) * dyn_zoom
        fit_w = max(1, int(round(src_w * scale)))
        fit_h = max(1, int(round(src_h * scale)))
        fitted = cv2.resize(self.bg_image_bgr, (fit_w, fit_h), interpolation=cv2.INTER_CUBIC)

        float_wave_x = np.sin(2.0 * np.pi * self.bg_float_hz * elapsed)
        float_wave_y = np.cos(2.0 * np.pi * self.bg_float_hz * elapsed * 0.86)
        center_x = (fit_w // 2) + int(float_wave_x * self.bg_float_x_amp)
        center_y = (fit_h // 2) + int(float_wave_y * self.bg_float_y_amp) + int(self.bg_y_offset)

        x1 = int(center_x - (w // 2))
        y1 = int(center_y - (h // 2))
        x1 = max(0, min(x1, fit_w - w))
        y1 = max(0, min(y1, fit_h - h))
        x2 = x1 + w
        y2 = y1 + h
        return fitted[y1:y2, x1:x2].copy()

    def on_jutsu_start(self, context: EffectContext):
        normalized = self._normalize_name(context.jutsu_name)
        if normalized in self.sign_aliases or ("reaper" in normalized and "seal" in normalized):
            self.active = True
            self.prepared_surface = None
            self.effect_alpha = 0.0
            self.effect_started_at = time.perf_counter()
            if getattr(context, "effect_duration", 0.0):
                try:
                    self.total_duration_sec = max(1.0, float(context.effect_duration))
                except Exception:
                    self.total_duration_sec = 7.0

    def on_jutsu_end(self, context: EffectContext):
        self.active = False
        self.prepared_surface = None
        self.effect_alpha = 0.0

    def _update_alpha_curve(self):
        if not self.active:
            self.effect_alpha = 0.0
            return

        if self.effect_started_at <= 0.0:
            self.effect_started_at = time.perf_counter()

        elapsed = max(0.0, time.perf_counter() - self.effect_started_at)
        total = max(1.0, float(self.total_duration_sec))
        fade_in = max(0.05, min(self.fade_in_sec, total * 0.5))
        fade_out = max(0.05, min(self.fade_out_sec, total * 0.5))

        if elapsed >= total:
            self.active = False
            self.effect_alpha = 0.0
            return

        if elapsed < fade_in:
            self.effect_alpha = max(0.0, min(1.0, elapsed / fade_in))
            return

        fade_out_start = max(fade_in, total - fade_out)
        if elapsed >= fade_out_start:
            rem = max(0.0, total - elapsed)
            self.effect_alpha = max(0.0, min(1.0, rem / fade_out))
        else:
            self.effect_alpha = 1.0

    def update(self, context: EffectContext):
        self.prepared_surface = None
        if not self.enabled or not self.active or context.frame_bgr is None:
            return
        self._update_alpha_curve()
        if not self.active or self.effect_alpha <= 0.0:
            return

        frame = context.frame_bgr
        h, w = frame.shape[:2]
        self.frame_count += 1

        run_seg = (self.frame_count % self.mask_every_n_frames == 0) or (self.last_alpha_full is None)
        if run_seg:
            if self.segment_width and 0 < self.segment_width < w:
                scale = self.segment_width / float(w)
                seg_w = self.segment_width
                seg_h = max(1, int(h * scale))
                small = cv2.resize(frame, (seg_w, seg_h), interpolation=cv2.INTER_LINEAR)
                rgb_small = cv2.cvtColor(small, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_small)
                result = self.segmenter.segment(mp_image)
                alpha_small = self._get_alpha_from_result(result)
                alpha_full = cv2.resize(alpha_small, (w, h), interpolation=cv2.INTER_LINEAR).astype(np.float32)
            else:
                rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
                mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
                result = self.segmenter.segment(mp_image)
                alpha_full = self._get_alpha_from_result(result).astype(np.float32)

            if self.edge_blur_sigma and self.edge_blur_sigma > 0:
                alpha_full = cv2.GaussianBlur(alpha_full, (0, 0), self.edge_blur_sigma)
            alpha_full = np.clip(alpha_full, 0.0, 1.0)
            self.last_alpha_full = alpha_full
        else:
            alpha_full = self.last_alpha_full

        if alpha_full is None:
            return

        # Keep only confident person pixels to avoid ghost halos.
        alpha_full = np.where(alpha_full >= self.alpha_thresh, alpha_full, 0.0).astype(np.float32)
        alpha3 = alpha_full[:, :, None]

        bg = self._get_animated_bg(w, h)
        if bg is None:
            return

        # Blend a touch of original frame into background to keep natural lighting.
        bg_mix = cv2.addWeighted(bg, 1.0 - self.background_keep_ratio, frame, self.background_keep_ratio, 0.0)
        bg_mix = np.clip(bg_mix.astype(np.float32) * self.background_darkness_scale, 0, 255).astype(np.uint8)

        # Keep player foreground a bit darker as requested.
        fg = np.clip(frame.astype(np.float32) * self.person_brightness_scale, 0, 255)
        fg = np.clip(fg * self.person_darkness_scale, 0, 255)
        composite = fg * alpha3 + bg_mix.astype(np.float32) * (1.0 - alpha3)
        composite = np.clip(composite, 0, 255).astype(np.uint8)

        rgb = cv2.cvtColor(composite, cv2.COLOR_BGR2RGB)
        self.prepared_surface = pygame.image.frombuffer(rgb.tobytes(), (w, h), "RGB")

    def render(self, screen, context: EffectContext):
        if not self.active or self.prepared_surface is None:
            return
        dst_w = max(1, int(self.prepared_surface.get_width() * context.scale_x))
        dst_h = max(1, int(self.prepared_surface.get_height() * context.scale_y))
        scaled = pygame.transform.smoothscale(self.prepared_surface, (dst_w, dst_h))
        scaled.set_alpha(int(max(0.0, min(1.0, self.effect_alpha)) * 255))
        screen.blit(scaled, (context.cam_x, context.cam_y))
