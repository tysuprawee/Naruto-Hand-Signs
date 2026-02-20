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

from src.utils.paths import get_class_names, get_latest_weights
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
        self.style = "fireball"
        self.phoenix_burst_interval_s = 0.13
        self.phoenix_particles_per_lane = 3
        self.phoenix_lane_angles = (-1.08, -0.62, 0.0, 0.62, 1.08)
        self.phoenix_lane_offsets = (-42.0, -21.0, 0.0, 21.0, 42.0)
        self._phoenix_burst_accum_s = 0.0

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
    
    def _spawn_fireball_particle(self):
        angle = np.random.uniform(-0.5, 0.5)
        speed = np.random.uniform(100, 200)
        vx = speed * math.sin(angle) * 0.3
        vy = -speed

        lifetime = np.random.uniform(0.5, 1.2)
        size = np.random.uniform(8, 25)

        temp = np.random.random()
        if temp > 0.8:
            color = COLORS["fire_core"]
        elif temp > 0.4:
            color = COLORS["fire_mid"]
        else:
            color = COLORS["fire_outer"]

        self.particles.append(
            Particle(
                self.emit_x + np.random.uniform(-15, 15),
                self.emit_y + np.random.uniform(-5, 5),
                vx,
                vy,
                lifetime,
                size,
                color,
                kind="fireball",
                sway_strength=30.0,
                gravity=0.0,
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
                self.emit(8)
    
    def render(self, surface):
        for p in self.particles:
            alpha = p.get_alpha()
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
            
            for i in range(3):
                glow_size = size + i * 4
                glow_alpha = max(0, alpha - i * 60)
                if glow_alpha <= 0:
                    continue
                
                color_with_alpha = (*p.color, glow_alpha)
                temp_surf = pygame.Surface((glow_size * 2, glow_size * 2), pygame.SRCALPHA)
                pygame.draw.circle(temp_surf, color_with_alpha, (glow_size, glow_size), glow_size)
                surface.blit(temp_surf, (int(p.x - glow_size), int(p.y - glow_size)), special_flags=pygame.BLEND_ADD)


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
            down_path = Path("src/pics/down.png")
            up_path = Path("src/pics/up.png")
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
