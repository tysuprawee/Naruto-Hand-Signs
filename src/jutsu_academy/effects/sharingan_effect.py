import os
import math
import pygame
from src.jutsu_academy.effects.base import BaseEffect, EffectContext

class SharinganEffect(BaseEffect):
    def __init__(self):
        super().__init__()
        self.image = None
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

    def render(self, screen, context: EffectContext):
        if not self.image or not context.left_eye_pos or not context.right_eye_pos:
            return

        # Calculate dynamic size based on interpupillary distance (IPD)
        # Using the scaled coordinates
        lx, ly = context.left_eye_pos
        rx, ry = context.right_eye_pos
        dx = (rx - lx) * context.scale_x
        dy = (ry - ly) * context.scale_y
        ipd = math.hypot(dx, dy)
        
        # Typically the width of one eye is about 30-40% of the IPD. 
        # Make the sharingan slightly larger to cover the iris well
        size = max(15, int(ipd * 0.45))
        
        # We can scale the image using smoothscale
        try:
            scaled_img = pygame.transform.smoothscale(self.image, (size, size))
            scaled_img.set_alpha(190)  # Make it slightly transparent so it blends with the eyes
        except ValueError:
            return
            
        # Draw on both eyes
        for raw_pos in [context.left_eye_pos, context.right_eye_pos]:
            if raw_pos:
                screen_x = context.cam_x + int(raw_pos[0] * context.scale_x)
                screen_y = context.cam_y + int(raw_pos[1] * context.scale_y)
                
                rect = scaled_img.get_rect(center=(screen_x, screen_y))
                screen.blit(scaled_img, rect)
