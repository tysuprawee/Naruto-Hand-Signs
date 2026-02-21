#!/usr/bin/env python3
"""
Jutsu Academy - Full Pygame Edition
====================================
A complete Pygame-based launcher and game for the Jutsu Trainer with:
- Modern menu system
- Settings with volume sliders
- Camera selection
- Practice mode (Free Play, Rank Mode)
- Particle effects and visual polish
- Sound system

Usage:
    python src/jutsu_academy/main_pygame.py
"""

import cv2
import time
import math
import argparse
import socket
from pathlib import Path
import numpy as np
import pygame
import sys
import json
import webbrowser
import threading
import os
import requests
import ast
from io import BytesIO

# Add parent path to import utils
sys.path.insert(0, str(Path(__file__).parent.parent.parent))
from ultralytics import YOLO
import mediapipe as mp

from src.utils.paths import (
    get_class_names,
    get_latest_weights,
    resolve_resource_path,
    get_env_candidate_paths,
)
from src.jutsu_registry import OFFICIAL_JUTSUS
from src.mp_trainer import SignRecorder

# Safe Import NetworkManager
try:
    from src.jutsu_academy.network_manager import NetworkManager
except ImportError:
    print("[!] NetworkManager import failed (missing supabase?). using mock.")
    class NetworkManager:
        def __init__(self): self.client = None
        def get_leaderboard(self, **kwargs): return []
        def submit_score(self, **kwargs): pass
        def issue_run_token(self, **kwargs): return {"ok": False, "token": "offline_mock", "source": "mock"}
        def submit_score_secure(self, **kwargs): return {"ok": False, "reason": "mock"}
        def get_competitive_state_authoritative(self, **kwargs): return {"ok": False, "reason": "mock"}
        def award_jutsu_completion_authoritative(self, **kwargs): return {"ok": False, "reason": "mock"}
        def claim_quest_authoritative(self, **kwargs): return {"ok": False, "reason": "mock"}
        def get_calibration_profile_authoritative(self, **kwargs): return {"ok": False, "reason": "mock"}
        def upsert_calibration_profile_authoritative(self, **kwargs): return {"ok": False, "reason": "mock"}

# Try importing Discord auth and dotenv
try:
    from dotenv import load_dotenv
    _loaded_any_env = False
    for _env_path in get_env_candidate_paths():
        if _env_path.exists():
            try:
                load_dotenv(dotenv_path=str(_env_path), override=False)
                _loaded_any_env = True
            except Exception:
                pass
    if not _loaded_any_env:
        load_dotenv()
except ImportError:
    pass

# Discord credentials from env
DISCORD_CLIENT_ID = os.getenv("DISCORD_CLIENT_ID", "")
DISCORD_CLIENT_SECRET = os.getenv("DISCORD_CLIENT_SECRET", "")

# Advanced Camera Discovery
try:
    from pygrabber.dshow_graph import FilterGraph
except ImportError:
    FilterGraph = None


# ═══════════════════════════════════════════════════════════════════════════
# CONSTANTS
# ═══════════════════════════════════════════════════════════════════════════
APP_VERSION = "1.0.0"
SCREEN_WIDTH = 1024
SCREEN_HEIGHT = 768
FPS = 60

# Resolution presets (label, width, height)
RESOLUTION_OPTIONS = [
    ("1024 × 768",   1024, 768),
    ("1280 × 720",   1280, 720),
    ("1280 × 800",   1280, 800),
    ("1366 × 768",   1366, 768),
    ("1440 × 900",   1440, 900),
    ("1600 × 900",   1600, 900),
    ("1920 × 1080",  1920, 1080),
]

# Social Links
SOCIAL_LINKS = {
    "instagram": "https://www.instagram.com/james.uzumaki_/",
    "youtube": "https://www.youtube.com/@James_Uzumaki",
    "discord": "https://discord.gg/7xBQ22SnN2",
}

# Color Palette (Naruto-themed dark mode)
COLORS = {
    "bg_dark": (15, 15, 20),
    "bg_panel": (25, 25, 35),
    "bg_card": (35, 35, 50),
    "bg_hover": (45, 45, 65),
    "accent": (255, 120, 50),       # Orange (Naruto's color)
    "accent_dark": (200, 90, 30),
    "accent_glow": (255, 150, 80),
    "success": (50, 200, 120),
    "error": (220, 60, 60),
    "text": (240, 240, 245),
    "text_dim": (140, 140, 160),
    "text_muted": (80, 80, 100),
    "border": (60, 60, 80),
    "shadow": (0, 0, 0, 100),
    # Fire colors
    "fire_core": (255, 255, 200),
    "fire_mid": (255, 180, 50),
    "fire_outer": (255, 80, 20),
}


# ═══════════════════════════════════════════════════════════════════════════
# PARTICLE SYSTEM
# ═══════════════════════════════════════════════════════════════════════════
class Particle:
    def __init__(
        self,
        x,
        y,
        vx,
        vy,
        lifetime,
        size,
        color,
        kind="fireball",
        sway_strength=30.0,
        gravity=0.0,
    ):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.lifetime = lifetime
        self.max_lifetime = lifetime
        self.size = size
        self.color = color
        self.kind = str(kind or "fireball")
        self.sway_strength = float(sway_strength)
        self.gravity = float(gravity)
    
    def update(self, dt, wind_x=0):
        self.x += (self.vx + wind_x) * dt
        self.y += self.vy * dt
        self.vy += self.gravity * dt
        self.lifetime -= dt
        self.x += math.sin(time.time() * 5 + self.y * 0.05) * self.sway_strength * dt
    
    def is_alive(self):
        return self.lifetime > 0
    
    def get_alpha(self):
        return max(0, min(255, int(255 * (self.lifetime / self.max_lifetime))))


class FireParticleSystem:
    def __init__(self, max_particles=150):
        self.particles = []
        self.max_particles = max_particles
        self.emitting = False
        self.emit_x = 0
        self.emit_y = 0
        self.wind_x = 0
        self.aim_dx = 0.0
        self.aim_dy = -1.0
        self.style = "fireball"
        self.phoenix_burst_interval_s = 0.13
        self.phoenix_particles_per_lane = 3
        self.phoenix_lane_angles = (-1.08, -0.62, 0.0, 0.62, 1.08)
        self.phoenix_lane_offsets = (-42.0, -21.0, 0.0, 21.0, 42.0)
        self._phoenix_burst_accum_s = 0.0
        self._muzzle_pulse = 0.0

    def set_style(self, style):
        style_norm = str(style or "fireball").strip().lower()
        if style_norm not in ("fireball", "phoenix"):
            style_norm = "fireball"
        if self.style != style_norm:
            self._phoenix_burst_accum_s = 0.0
        self.style = style_norm
        if self.style == "phoenix":
            # Fire an immediate multi-shot burst on the next update tick.
            self._phoenix_burst_accum_s = self.phoenix_burst_interval_s
    
    def set_position(self, x, y):
        self.emit_x = x
        self.emit_y = y

    def set_direction(self, dx, dy, smoothing=0.35):
        tx = float(dx)
        ty = float(dy)
        mag = math.hypot(tx, ty)
        if mag <= 1e-6:
            return
        tx /= mag
        ty /= mag

        alpha = float(np.clip(smoothing, 0.0, 1.0))
        self.aim_dx = self.aim_dx + (tx - self.aim_dx) * alpha
        self.aim_dy = self.aim_dy + (ty - self.aim_dy) * alpha

        norm = math.hypot(self.aim_dx, self.aim_dy)
        if norm > 1e-6:
            self.aim_dx /= norm
            self.aim_dy /= norm

    def set_aim(self, yaw=0.0, pitch=0.0):
        yaw_n = float(np.clip(yaw, -1.0, 1.0))
        pitch_n = float(np.clip(pitch, -1.0, 1.0))
        dir_x = yaw_n * 0.95
        dir_y = -0.82 + pitch_n * 1.05
        self.set_direction(dir_x, dir_y, smoothing=0.32)
    
    def _spawn_fireball_particle(self):
        wind_n = float(np.clip(self.wind_x / 320.0, -1.0, 1.0))
        base_dx = float(self.aim_dx)
        base_dy = float(self.aim_dy)
        perp_x = -base_dy
        perp_y = base_dx
        spread = float(np.random.uniform(-0.42, 0.42))
        dir_x = base_dx + perp_x * spread + wind_n * 0.16
        dir_y = base_dy + perp_y * spread * 0.72
        dir_n = math.hypot(dir_x, dir_y)
        if dir_n > 1e-6:
            dir_x /= dir_n
            dir_y /= dir_n
        else:
            dir_x, dir_y = 0.0, -1.0

        speed = float(np.random.uniform(240.0, 520.0))
        speed *= float(np.random.uniform(0.84, 1.16))
        vx = dir_x * speed + wind_n * 75.0
        vy = dir_y * speed

        roll = float(np.random.random())
        if roll < 0.44:
            kind = "fireball_core"
            lifetime = float(np.random.uniform(0.28, 0.64))
            size = float(np.random.uniform(14.0, 34.0))
            color = COLORS["fire_core"] if np.random.random() > 0.35 else COLORS["fire_mid"]
            sway_strength = 10.0
            gravity = 64.0
        elif roll < 0.82:
            kind = "fireball_ember"
            lifetime = float(np.random.uniform(0.52, 1.35))
            size = float(np.random.uniform(5.0, 16.0))
            color = COLORS["fire_mid"] if np.random.random() > 0.40 else COLORS["fire_outer"]
            sway_strength = 33.0
            gravity = 130.0
        elif roll < 0.93:
            kind = "fireball_spark"
            lifetime = float(np.random.uniform(0.18, 0.44))
            size = float(np.random.uniform(2.0, 5.8))
            color = COLORS["fire_core"]
            sway_strength = 6.0
            gravity = 190.0
        else:
            kind = "fireball_smoke"
            lifetime = float(np.random.uniform(0.85, 1.95))
            size = float(np.random.uniform(16.0, 40.0))
            color = (72, 46, 34)
            sway_strength = 16.0
            gravity = -16.0
            vx *= 0.48
            vy *= 0.38

        self.particles.append(
            Particle(
                self.emit_x + np.random.uniform(-16, 16),
                self.emit_y + np.random.uniform(-10, 10),
                vx,
                vy,
                lifetime,
                size,
                color,
                kind=kind,
                sway_strength=sway_strength,
                gravity=gravity,
            )
        )

    def _spawn_phoenix_particle(self, lane_angle, lane_offset_x, lane_offset_y):
        angle = float(lane_angle) + np.random.uniform(-0.07, 0.07)

        speed = np.random.uniform(165, 290)
        vx = speed * math.sin(angle)
        vy = -speed * np.random.uniform(0.82, 1.16)

        lifetime = np.random.uniform(0.34, 0.74)
        size = np.random.uniform(7, 16)

        heat = np.random.random()
        if heat > 0.86:
            color = (255, 255, 220)
        elif heat > 0.48:
            color = (255, 170, 55)
        else:
            color = (255, 85, 28)

        self.particles.append(
            Particle(
                self.emit_x + float(lane_offset_x) + np.random.uniform(-4, 4),
                self.emit_y + float(lane_offset_y) + np.random.uniform(-3, 3),
                vx,
                vy,
                lifetime,
                size,
                color,
                kind="phoenix",
                sway_strength=9.0,
                gravity=145.0,
            )
        )

    def emit(self, count=5):
        if not self.emitting:
            return

        if self.style == "phoenix":
            for lane_angle, lane_offset_x in zip(self.phoenix_lane_angles, self.phoenix_lane_offsets):
                lane_offset_y = -abs(lane_offset_x) * 0.11
                for _ in range(max(1, int(self.phoenix_particles_per_lane))):
                    if len(self.particles) >= self.max_particles:
                        return
                    self._spawn_phoenix_particle(lane_angle, lane_offset_x, lane_offset_y)
            return

        for _ in range(count):
            if len(self.particles) >= self.max_particles:
                break
            self._spawn_fireball_particle()
    
    def update(self, dt):
        for p in self.particles:
            p.update(dt, self.wind_x)
        self.particles = [p for p in self.particles if p.is_alive()]
        if self.emitting:
            if self.style == "phoenix":
                self._phoenix_burst_accum_s += max(0.0, float(dt))
                while self._phoenix_burst_accum_s >= self.phoenix_burst_interval_s:
                    self._phoenix_burst_accum_s -= self.phoenix_burst_interval_s
                    self.emit()
            else:
                if int(self.max_particles) >= 180:
                    emit_n = 18
                elif int(self.max_particles) >= 120:
                    emit_n = 14
                else:
                    emit_n = 7
                self.emit(emit_n)
                self._muzzle_pulse = min(1.0, self._muzzle_pulse + dt * 7.5)
        else:
            self._muzzle_pulse = max(0.0, self._muzzle_pulse - dt * 4.5)
    
    def render(self, surface):
        if self.style == "fireball" and (self.emitting or self._muzzle_pulse > 0.02):
            now = time.time()
            pulse = 0.72 + 0.28 * math.sin(now * 13.0)
            pwr = max(0.0, min(1.0, self._muzzle_pulse)) * pulse
            aim_dx = float(self.aim_dx)
            aim_dy = float(self.aim_dy)

            jitter_x = int(math.sin(now * 19.0) * 2.0)
            jitter_y = int(math.cos(now * 17.0) * 2.0)
            dir_push_x = int(aim_dx * 14.0 * pwr)
            dir_push_y = int(aim_dy * 14.0 * pwr)
            base_x = int(self.emit_x + jitter_x + dir_push_x)
            base_y = int(self.emit_y + jitter_y + dir_push_y)
            wind_push = int(np.clip(self.wind_x, -260.0, 260.0) * 0.11)

            for radius_mul, alpha_mul, color, ox, oy in (
                (2.55, 0.28, (255, 70, 20), -2, 2),
                (1.95, 0.42, (255, 112, 36), 0, 0),
                (1.38, 0.58, (255, 170, 58), 1, -1),
                (0.90, 0.74, (255, 235, 175), 0, -1),
            ):
                r = int(max(6, 20 * radius_mul))
                a = int(max(0, min(255, 255 * pwr * alpha_mul)))
                s = pygame.Surface((r * 2, r * 2), pygame.SRCALPHA)
                pygame.draw.circle(s, (*color, a), (r, r), r)
                surface.blit(
                    s,
                    (base_x + ox + wind_push - r, base_y + oy - r),
                    special_flags=pygame.BLEND_ADD,
                )

            flare_w = int(max(24, 72 * (0.45 + pwr)))
            flare_h = int(max(10, 19 * (0.45 + pwr)))
            flare_alpha = int(max(0, min(220, 190 * pwr)))
            flare = pygame.Surface((flare_w * 2, flare_h * 2), pygame.SRCALPHA)
            pygame.draw.ellipse(flare, (255, 120, 32, flare_alpha), (0, 0, flare_w * 2, flare_h * 2))
            flare_angle = -math.degrees(math.atan2(aim_dy, aim_dx))
            flare = pygame.transform.rotate(flare, flare_angle)
            flare_center_x = base_x + wind_push + int(aim_dx * flare_w * 0.62)
            flare_center_y = base_y + int(aim_dy * flare_w * 0.62)
            flare_rect = flare.get_rect(center=(flare_center_x, flare_center_y))
            surface.blit(
                flare,
                flare_rect,
                special_flags=pygame.BLEND_ADD,
            )

        particle_t = time.time()
        for p in self.particles:
            flicker = 0.88 + 0.12 * math.sin(particle_t * 26.0 + p.x * 0.07 + p.y * 0.05)
            alpha = int(p.get_alpha() * flicker)
            life_ratio = p.lifetime / p.max_lifetime
            size = int(p.size * life_ratio)
            
            if size < 2:
                continue

            if p.kind == "phoenix":
                trail_size = max(2, int(size * 0.62))
                trail_alpha = max(0, int(alpha * 0.58))
                if trail_alpha > 0:
                    tx = int(p.x - p.vx * 0.018)
                    ty = int(p.y - p.vy * 0.018)
                    trail_color = (255, 130, 40, trail_alpha)
                    trail_surf = pygame.Surface((trail_size * 4, trail_size * 4), pygame.SRCALPHA)
                    pygame.draw.circle(trail_surf, trail_color, (trail_size * 2, trail_size * 2), trail_size)
                    surface.blit(
                        trail_surf,
                        (tx - trail_size * 2, ty - trail_size * 2),
                        special_flags=pygame.BLEND_ADD,
                    )
            elif p.kind == "fireball_smoke":
                smoke_a = max(0, int(alpha * 0.34))
                if smoke_a > 0:
                    smoke_r = max(4, int(size * 1.20))
                    smoke = pygame.Surface((smoke_r * 2, smoke_r * 2), pygame.SRCALPHA)
                    pygame.draw.circle(smoke, (*p.color, smoke_a), (smoke_r, smoke_r), smoke_r)
                    inner_r = max(2, int(smoke_r * 0.70))
                    inner_col = (95, 64, 44, max(0, int(smoke_a * 0.72)))
                    pygame.draw.circle(smoke, inner_col, (smoke_r, smoke_r), inner_r)
                    surface.blit(smoke, (int(p.x - smoke_r), int(p.y - smoke_r)))
                continue
            else:
                speed = math.hypot(p.vx, p.vy)
                inv_speed = 1.0 / max(1e-4, speed)
                dir_x = p.vx * inv_speed
                dir_y = p.vy * inv_speed

                if p.kind == "fireball_core":
                    trail_len = 5
                    trail_decay = 0.11
                    trail_alpha_base = 0.54
                    spacing = 4.2
                elif p.kind == "fireball_spark":
                    trail_len = 6
                    trail_decay = 0.14
                    trail_alpha_base = 0.68
                    spacing = 3.1
                else:
                    trail_len = 3
                    trail_decay = 0.13
                    trail_alpha_base = 0.46
                    spacing = 3.8

                for t in range(trail_len):
                    back = (t + 1) * (spacing + size * 0.22)
                    tx = int(p.x - dir_x * back)
                    ty = int(p.y - dir_y * back)
                    trail_size = max(1, int(size * (0.70 - t * trail_decay)))
                    trail_alpha = max(0, int(alpha * (trail_alpha_base - t * 0.11)))
                    if trail_alpha <= 0:
                        continue
                    trail_color = (*p.color, trail_alpha)
                    trail_surf = pygame.Surface((trail_size * 4, trail_size * 4), pygame.SRCALPHA)
                    pygame.draw.circle(trail_surf, trail_color, (trail_size * 2, trail_size * 2), trail_size)
                    surface.blit(
                        trail_surf,
                        (tx - trail_size * 2, ty - trail_size * 2),
                        special_flags=pygame.BLEND_ADD,
                    )
            
            if p.kind == "fireball_core":
                glow_steps = (
                    (1.85, 0.28, COLORS["fire_outer"]),
                    (1.35, 0.42, COLORS["fire_mid"]),
                    (0.92, 0.64, COLORS["fire_core"]),
                )
            elif p.kind == "fireball_spark":
                glow_steps = (
                    (1.40, 0.22, COLORS["fire_mid"]),
                    (0.95, 0.50, COLORS["fire_core"]),
                )
            else:
                glow_steps = (
                    (1.55, 0.24, COLORS["fire_outer"]),
                    (1.10, 0.44, COLORS["fire_mid"]),
                    (0.80, 0.60, p.color),
                )

            for glow_mul, alpha_mul, glow_color in glow_steps:
                glow_size = max(1, int(size * glow_mul))
                glow_alpha = max(0, int(alpha * alpha_mul))
                if glow_alpha <= 0:
                    continue
                
                color_with_alpha = (*glow_color, glow_alpha)
                temp_surf = pygame.Surface((glow_size * 2, glow_size * 2), pygame.SRCALPHA)
                pygame.draw.circle(temp_surf, color_with_alpha, (glow_size, glow_size), glow_size)
                surface.blit(temp_surf, (int(p.x - glow_size), int(p.y - glow_size)), special_flags=pygame.BLEND_ADD)

            if p.kind == "fireball_core":
                core_r = max(1, int(size * 0.40))
                core_a = max(0, min(255, int(alpha * 0.96)))
                if core_a > 0:
                    core = pygame.Surface((core_r * 2, core_r * 2), pygame.SRCALPHA)
                    pygame.draw.circle(core, (255, 250, 215, core_a), (core_r, core_r), core_r)
                    surface.blit(core, (int(p.x - core_r), int(p.y - core_r)), special_flags=pygame.BLEND_ADD)


# ═══════════════════════════════════════════════════════════════════════════
# UI COMPONENTS
# ═══════════════════════════════════════════════════════════════════════════
class Button:
    def __init__(self, x, y, width, height, text, font_size=28, color=None):
        self.rect = pygame.Rect(x, y, width, height)
        self.text = text
        self.font_size = font_size
        self.color = color or COLORS["accent"]
        self.hovered = False
        self.pressed = False
        self.press_started = False  # Track if press started on this button
        self.font = None
        self.enabled = True
    
    def update(self, mouse_pos, mouse_click, mouse_down, play_sound=None):
        if not self.enabled:
            self.hovered = False
            self.pressed = False
            self.press_started = False
            return False
        
        prev_hover = self.hovered
        self.hovered = self.rect.collidepoint(mouse_pos)
        
        # Hover Sound
        if self.hovered and not prev_hover and play_sound:
            play_sound("hover")
        
        # Track if mouse press started on this button
        if mouse_click and self.hovered:
            self.press_started = True
        
        # Visual pressed state (for rendering)
        self.pressed = self.hovered and mouse_down and self.press_started
        
        # Check for complete click (press started here AND released here)
        clicked = False
        if not mouse_down and self.press_started:
            # Mouse was released
            if self.hovered:
                # Released on the button - valid click!
                clicked = True
                if play_sound:
                    play_sound("click")
                    
            # Reset press tracking
            self.press_started = False
        
        return clicked
    
    def render(self, surface):
        if self.font is None:
            self.font = pygame.font.Font(None, self.font_size)
        
        # Background
        if not self.enabled:
            color = COLORS["text_muted"]
        elif self.pressed:
            color = COLORS["accent_dark"]
        elif self.hovered:
            color = COLORS["accent_glow"]
        else:
            color = self.color
        
        # Shadow
        shadow_rect = self.rect.copy()
        shadow_rect.y += 3
        pygame.draw.rect(surface, (0, 0, 0, 50), shadow_rect, border_radius=12)
        
        # Button
        pygame.draw.rect(surface, color, self.rect, border_radius=12)
        
        # Border glow on hover
        if self.hovered and self.enabled:
            pygame.draw.rect(surface, COLORS["text"], self.rect, 2, border_radius=12)
        
        # Text
        text_color = COLORS["text"] if self.enabled else COLORS["text_dim"]
        text_surf = self.font.render(self.text, True, text_color)
        text_rect = text_surf.get_rect(center=self.rect.center)
        surface.blit(text_surf, text_rect)
        



class Slider:
    def __init__(self, x, y, width, label, initial=0.7):
        self.x = x
        self.y = y
        self.width = width
        self.label = label
        self.value = initial
        self.height = 10
        # Larger hit area that covers the knob (extends 15px above and below)
        self.rect = pygame.Rect(x - 15, y - 15, width + 30, 40)
        self.dragging = False
        self.font = None
    
    def update(self, mouse_pos, mouse_down, mouse_click):
        # Track area for clicking
        track_rect = pygame.Rect(self.x, self.y - 10, self.width, 30)
        knob_x = self.x + int(self.width * self.value)
        knob_rect = pygame.Rect(knob_x - 15, self.y - 15, 30, 30)
        
        # Start dragging on click (on knob or track)
        if mouse_click:
            if track_rect.collidepoint(mouse_pos) or knob_rect.collidepoint(mouse_pos):
                self.dragging = True
                # Immediately update value on click
                new_value = (mouse_pos[0] - self.x) / self.width
                self.value = max(0.0, min(1.0, new_value))
        
        # Continue dragging while mouse is held
        if self.dragging:
            if mouse_down:
                new_value = (mouse_pos[0] - self.x) / self.width
                self.value = max(0.0, min(1.0, new_value))
            else:
                # Mouse released
                self.dragging = False
        
        return self.dragging
    
    def render(self, surface):
        if self.font is None:
            self.font = pygame.font.Font(None, 24)
        
        # Label
        label_surf = self.font.render(f"{self.label}: {int(self.value * 100)}%", True, COLORS["text"])
        surface.blit(label_surf, (self.x, self.y - 25))
        
        # Track
        track_rect = pygame.Rect(self.x, self.y, self.width, self.height)
        pygame.draw.rect(surface, COLORS["border"], track_rect, border_radius=5)
        
        # Fill
        fill_width = int(self.width * self.value)
        fill_rect = pygame.Rect(self.x, self.y, fill_width, self.height)
        pygame.draw.rect(surface, COLORS["accent"], fill_rect, border_radius=5)
        
        # Knob
        knob_x = self.x + fill_width
        pygame.draw.circle(surface, COLORS["text"], (knob_x, self.y + 5), 12)
        pygame.draw.circle(surface, COLORS["accent"], (knob_x, self.y + 5), 8)
        



class Dropdown:
    def __init__(self, x, y, width, options, default_idx=0):
        self.x = x
        self.y = y
        self.width = width
        self.height = 40
        self.options = options
        self.selected_idx = default_idx
        self.is_open = False
        self.rect = pygame.Rect(x, y, width, self.height)
        self.font = None
        self.open_upward = False
        self.force_open_upward = None
        self.icon_down = None
        self.icon_up = None
        self._icons_loaded = False

    def _load_icons(self):
        if self._icons_loaded:
            return
        self._icons_loaded = True
        try:
            down_path = resolve_resource_path("src/pics/down.png")
            up_path = resolve_resource_path("src/pics/up.png")
            if down_path.exists():
                img = pygame.image.load(str(down_path))
                self.icon_down = pygame.transform.smoothscale(img, (18, 18))
            if up_path.exists():
                img = pygame.image.load(str(up_path))
                self.icon_up = pygame.transform.smoothscale(img, (18, 18))
        except Exception:
            self.icon_down = None
            self.icon_up = None

    def _option_rect(self, i):
        if self.open_upward:
            return pygame.Rect(self.x, self.y - (i + 1) * self.height, self.width, self.height)
        return pygame.Rect(self.x, self.y + (i + 1) * self.height, self.width, self.height)

    def _compute_open_direction(self):
        if isinstance(self.force_open_upward, bool):
            self.open_upward = self.force_open_upward
            return
        screen = pygame.display.get_surface()
        if not screen:
            self.open_upward = False
            return
        total_h = len(self.options) * self.height
        space_below = screen.get_height() - (self.y + self.height)
        space_above = self.y
        self.open_upward = space_below < total_h and space_above > space_below
    
    def update(self, mouse_pos, mouse_click, play_sound=None):
        if not self.options:
            self.is_open = False
            return False
        if mouse_click:
            if self.is_open:
                # Check if clicked on an option
                for i, _ in enumerate(self.options):
                    opt_rect = self._option_rect(i)
                    if opt_rect.collidepoint(mouse_pos):
                        if play_sound: play_sound("click")
                        self.selected_idx = i
                        self.is_open = False
                        return True
                # Click outside closes
                if self.is_open: # Only if it was open
                     self.is_open = False
                     # Optional: Click outside close sound? No.
            elif self.rect.collidepoint(mouse_pos):
                if play_sound: play_sound("click")
                self._compute_open_direction()
                self.is_open = True
        return False
    
    def render(self, surface):
        if self.font is None:
            self.font = pygame.font.Font(None, 26)
        self._load_icons()
        
        # Main box
        pygame.draw.rect(surface, COLORS["bg_card"], self.rect, border_radius=8)
        pygame.draw.rect(surface, COLORS["border"], self.rect, 2, border_radius=8)
        
        # Selected text
        if self.options:
            selected = self.options[self.selected_idx]
            max_w = self.width - 52
            while self.font.size(selected)[0] > max_w and len(selected) > 1:
                selected = selected[:-2].rstrip() + "…"
            text = self.font.render(selected, True, COLORS["text"])
            surface.blit(text, (self.x + 15, self.y + 10))
        else:
            text = self.font.render("No camera", True, COLORS["text_dim"])
            surface.blit(text, (self.x + 15, self.y + 10))
        
        # Arrow icon
        arrow_x = self.x + self.width - 30
        arrow_y = self.y + 11
        icon = self.icon_up if self.is_open else self.icon_down
        if icon is not None:
            surface.blit(icon, (arrow_x, arrow_y))
        else:
            arrow = "▲" if self.is_open else "▼"
            arrow_surf = self.font.render(arrow, True, COLORS["text_dim"])
            surface.blit(arrow_surf, (arrow_x, self.y + 10))
        
        # Dropdown options
        if self.is_open:
            for i, opt in enumerate(self.options):
                opt_rect = self._option_rect(i)
                hovered = opt_rect.collidepoint(pygame.mouse.get_pos())
                
                color = COLORS["bg_hover"] if hovered else COLORS["bg_card"]
                pygame.draw.rect(surface, color, opt_rect)
                pygame.draw.rect(surface, COLORS["border"], opt_rect, 1)
                
                label = opt
                max_w = self.width - 22
                while self.font.size(label)[0] > max_w and len(label) > 1:
                    label = label[:-2].rstrip() + "…"
                text = self.font.render(label, True, COLORS["text"])
                surface.blit(text, (self.x + 15, opt_rect.y + 10))

class Checkbox:
    def __init__(self, x, y, size, label, initial=False):
        self.rect = pygame.Rect(x, y, size, size)
        self.size = size
        self.label = label
        self.checked = initial
        self.font = None
    
    def update(self, mouse_pos, mouse_click, play_sound=None):
        if mouse_click and self.rect.collidepoint(mouse_pos):
            self.checked = not self.checked
            if play_sound: play_sound("click")
            return True
        return False
    
    def render(self, surface):
        if self.font is None:
            self.font = pygame.font.Font(None, 24)
            
        # Box
        pygame.draw.rect(surface, COLORS["bg_card"], self.rect, border_radius=4)
        pygame.draw.rect(surface, COLORS["border"], self.rect, 2, border_radius=4)
        
        # Check
        if self.checked:
            inner = self.rect.inflate(-8, -8)
            pygame.draw.rect(surface, COLORS["accent"], inner, border_radius=2)
            
        # Label
        label_surf = self.font.render(self.label, True, COLORS["text"])
        surface.blit(label_surf, (self.rect.right + 10, self.rect.y + (self.size - 24)//2 + 4))
        


    def get_selected(self):
        if self.options and 0 <= self.selected_idx < len(self.options):
            return self.options[self.selected_idx]
        return None

class ProgressionManager:
    """Handles the 'Shinobi Path' progression system including XP, Levels, and Ranks."""
    def __init__(self, username="Guest", network_manager=None):
        self.username = username
        self.network_manager = network_manager
        # Unique file per user if logged in
        safe_name = "".join(x for x in username if x.isalnum())
        self.file_path = Path(f"user_progression_{safe_name}.json")
        
        self.xp = 0
        self.level = 0
        self.rank = "Academy Student"
        self.stats = {
            "total_signs": 0,
            "total_jutsus": 0,
            "fastest_combo": 99.0
        }
        self.synced = False # Track if we have finished initial sync
        self._warned_sync_to_cloud_disabled = False
        
        # Level requirements and Rank names
        self.RANKS = [
            (0, "Academy Student"),
            (5, "Genin Candidate"),
            (10, "Genin"),
            (25, "Chunin Candidate"),
            (50, "Chunin"),
            (100, "Special Jonin"),
            (250, "Jonin"),
            (500, "ANBU Black Ops"),
            (1000, "S-Rank Shinobi"),
            (2500, "Sanin"),
            (5000, "Hokage Candidate"),
            (10000, "HOKAGE")
        ]
        
        if self.username != "Guest" and self.network_manager:
            # Mandate Cloud-Only for authenticated users to prevent local cheating
            threading.Thread(target=self.sync_from_cloud, daemon=True).start()
        else:
            self.load() # Guest mode can still use local persistence
            self.synced = True

    def sync_from_cloud(self):
        """Fetch latest XP and Level from Supabase."""
        if not self.network_manager: return
        profile = self.network_manager.get_profile(self.username)
        
        # Handle network/fetch errors gracefully
        if profile is None:
            print(f"[!] Cloud Sync Error: Could not fetch profile for {self.username}. Skipping sync to avoid overwrite.")
            self.synced = True # Allow UI to show (even if 0) to avoid infinite loading
            return

        if profile: # User exists (non-empty dict)
            self.apply_authoritative_profile(profile)
            print(f"[*] Cloud Sync Success: Retrieved Lv.{self.level} for {self.username}")
        else: # User not found (empty dict)
            # No cloud profile found -> This is a new user (or offline progress to sync up)
            print(f"[*] New cloud user: Creating profile for {self.username}")
            # We call the internal DB function directly to avoid spawning another thread from within this thread
            data = {
                "username": self.username,
                "xp": self.xp,
                "level": self.level,
                "rank": self.rank,
                "total_signs": self.stats["total_signs"],
                "total_jutsus": self.stats["total_jutsus"]
            }
            self.network_manager.upsert_profile(data)
        
        self.synced = True # Sync complete

    def sync_to_cloud(self):
        """Legacy path kept for guest/offline only; authenticated users are server authoritative."""
        if self.username == "Guest":
            return
        if not self._warned_sync_to_cloud_disabled:
            print("[!] sync_to_cloud disabled for authenticated users. Use server-authoritative RPC flows.")
            self._warned_sync_to_cloud_disabled = True

    def apply_authoritative_profile(self, profile):
        """
        Apply server-authoritative profile fields and return level-up status.
        Expected keys: xp, level, rank, total_signs, total_jutsus, fastest_combo.
        """
        if not isinstance(profile, dict):
            return False
        old_level = int(self.level)
        try:
            if "xp" in profile and profile.get("xp") is not None:
                self.xp = int(profile.get("xp", self.xp) or 0)
            if "level" in profile and profile.get("level") is not None:
                self.level = int(profile.get("level", self.level) or 0)
            if "rank" in profile and profile.get("rank"):
                self.rank = str(profile.get("rank"))
            else:
                self.update_rank()

            if "total_signs" in profile and profile.get("total_signs") is not None:
                self.stats["total_signs"] = int(profile.get("total_signs") or 0)
            if "total_jutsus" in profile and profile.get("total_jutsus") is not None:
                self.stats["total_jutsus"] = int(profile.get("total_jutsus") or 0)
            if "fastest_combo" in profile and profile.get("fastest_combo") is not None:
                self.stats["fastest_combo"] = float(profile.get("fastest_combo") or self.stats.get("fastest_combo", 99.0))
        except Exception:
            return False

        return int(self.level) > old_level

    def get_xp_for_level(self, level):
        """Standard quadratic scaling."""
        if level <= 0: return 0
        return int(pow(level, 1.8) * 150) # Scale: L1=150, L5=2715...

    def get_next_level_xp(self):
        return self.get_xp_for_level(self.level + 1)

    def add_xp(self, amount):
        if self.username != "Guest":
            print("[!] Local add_xp disabled for authenticated users. Award XP through server-authoritative RPC.")
            return False
        old_level = self.level
        self.xp += amount
        self.stats["total_jutsus"] += 1
        
        # Level up check
        while self.xp >= self.get_xp_for_level(self.level + 1):
            self.level += 1
            self.update_rank()
            
        is_level_up = self.level > old_level
        if is_level_up:
             print(f"[!] SHINOBI RANK UP: Level {self.level} - {self.rank}")
             
        self.save()
        self.sync_to_cloud() # Push update to DB
        return is_level_up

    def update_rank(self):
        for lv, name in reversed(self.RANKS):
            if self.level >= lv:
                self.rank = name
                break

    def save(self):
        """Saves progression to local JSON (Guest only)."""
        if self.username != "Guest":
             return # Logged in users use Cloud Sync only
        
        try:
            data = {
                "xp": self.xp,
                "level": self.level,
                "rank": self.rank,
                "stats": self.stats
            }
            with open(self.file_path, "w") as f:
                json.dump(data, f, indent=4)
        except: pass

    def load(self):
        """Loads progression from local JSON (Guest only)."""
        if self.username != "Guest":
            return # Authenticated users load from sync_from_cloud()
            
        if self.file_path.exists():
            try:
                with open(self.file_path, "r") as f:
                    data = json.load(f)
                    self.xp = data.get("xp", 0)
                    self.level = data.get("level", 0)
                    self.rank = data.get("rank", "Academy Student")
                    self.stats = data.get("stats", self.stats)
                    self.update_rank()
            except: pass


# ═══════════════════════════════════════════════════════════════════════════
# GAME STATES
# ═══════════════════════════════════════════════════════════════════════════
class GameState:
    MENU = "menu"
    MAINTENANCE_REQUIRED = "maintenance_required"
    UPDATE_REQUIRED = "update_required"
    CALIBRATION_GATE = "calibration_gate"
    JUTSU_LIBRARY = "jutsu_library"
    QUESTS = "quests"
    TUTORIAL = "tutorial"
    SETTINGS = "settings"
    PRACTICE_SELECT = "practice_select"
    LOADING = "loading"  # Loading screen while camera/models init
    PLAYING = "playing"
    PAUSED = "paused"
    ABOUT = "about"
    LOGIN_MODAL = "login_modal"  # Modal overlay for login prompt
    QUIT_CONFIRM = "quit_confirm" # Modal to confirm exit
    WELCOME_MODAL = "welcome_modal" # Modal to show after login success
    LOGOUT_CONFIRM = "logout_confirm" # Modal to confirm logout
    LOGOUT_CONFIRM = "logout_confirm" # Modal to confirm logout
    CONNECTION_LOST = "connection_lost" # Modal when internet drops
    LEADERBOARD = "leaderboard" # Leaderboard screen
    ERROR_MODAL = "error_modal" # Generic error modal (e.g. Camera fail)


# ═══════════════════════════════════════════════════════════════════════════
# MAIN APPLICATION
