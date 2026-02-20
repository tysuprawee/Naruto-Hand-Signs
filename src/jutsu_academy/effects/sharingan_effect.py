import os
import math
import pygame
import numpy as np
from src.jutsu_academy.effects.base import BaseEffect, EffectContext

class SharinganEffect(BaseEffect):
    def __init__(self):
        super().__init__()
        self.image = None
        self._sprite_cache = {}
        self._feather_cache = {}
        self._base_alpha = 0.84
        self._load_image()

    def _load_image(self):
        try:
            # We assume src/jutsu_academy/effects/sharingan_effect.py
            # Image is at src/sharingan/sharingan.png
            img_path = os.path.join(
                os.path.dirname(os.path.abspath(__file__)), 
                "..", "..", "sharingan", "sharingan.png"
            )
            img_path = os.path.normpath(img_path)
            raw = pygame.image.load(img_path).convert_alpha()
            self.image = raw
        except Exception as e:
            print(f"[!] Sharingan effect image failed to load: {e}")
            self.image = None
            self._sprite_cache = {}
            self._feather_cache = {}

    def _get_feather_mask(self, width, height):
        key = (int(width), int(height))
        cached = self._feather_cache.get(key)
        if cached is not None:
            return cached

        w = max(1, int(width))
        h = max(1, int(height))

        x = np.linspace(-1.0, 1.0, w, dtype=np.float32)[:, None]
        y = np.linspace(-1.0, 1.0, h, dtype=np.float32)[None, :]
        dist = np.sqrt(x * x + y * y)

        inner = 0.54
        outer = 1.0
        falloff = np.clip((outer - dist) / max(1e-6, outer - inner), 0.0, 1.0)
        mask = np.where(dist <= inner, 1.0, falloff).astype(np.float32)
        mask = np.power(mask, 1.7)
        self._feather_cache[key] = mask
        return mask

    def _build_eye_sprite(self, width, height, angle_deg):
        quantized_angle = int(round(float(angle_deg) / 5.0) * 5)
        cache_key = (int(width), int(height), quantized_angle)
        cached = self._sprite_cache.get(cache_key)
        if cached is not None:
            return cached

        w = max(8, int(width))
        h = max(8, int(height))

        try:
            surf = pygame.transform.smoothscale(self.image, (w, h))
        except Exception:
            return None

        try:
            mask = self._get_feather_mask(w, h)
            alpha = pygame.surfarray.pixels_alpha(surf)
            blended = (alpha.astype(np.float32) * mask * float(self._base_alpha))
            alpha[:] = np.clip(blended, 0.0, 255.0).astype(np.uint8)
            del alpha
        except Exception:
            pass

        if quantized_angle != 0:
            surf = pygame.transform.rotozoom(surf, -quantized_angle, 1.0)

        self._sprite_cache[cache_key] = surf
        return surf

    def render(self, screen, context: EffectContext):
        if not self.image:
            return

        eye_entries = [
            (context.left_eye_pos, context.left_eye_size, context.left_eye_angle),
            (context.right_eye_pos, context.right_eye_size, context.right_eye_angle),
        ]

        fallback_size = 22
        if context.left_eye_pos and context.right_eye_pos:
            lx, ly = context.left_eye_pos
            rx, ry = context.right_eye_pos
            dx = (rx - lx) * context.scale_x
            dy = (ry - ly) * context.scale_y
            ipd = math.hypot(dx, dy)
            fallback_size = max(16, int(ipd * 0.32))

        for eye_pos, eye_size, eye_angle in eye_entries:
            if not eye_pos:
                continue

            if eye_size:
                target_w = max(14, int(float(eye_size[0]) * context.scale_x))
                target_h = max(12, int(float(eye_size[1]) * context.scale_y))
            else:
                target_w = fallback_size
                target_h = max(12, int(fallback_size * 0.96))

            screen_x = context.cam_x + int(eye_pos[0] * context.scale_x)
            screen_y = context.cam_y + int(eye_pos[1] * context.scale_y)
            sprite = self._build_eye_sprite(target_w, target_h, eye_angle or 0.0)
            if sprite is None:
                continue
            rect = sprite.get_rect(center=(screen_x, screen_y))
            screen.blit(sprite, rect)
