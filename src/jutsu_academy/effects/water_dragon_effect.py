"""
Water Dragon Jutsu Effect
==========================
Suiton: Suiryuudan no Jutsu — Water Dragon Bullet Technique

Multi-phase particle animation:
  Phase 1 (0.0-0.6s) : Water vortex gathers at origin (hand or mouth).
  Phase 2 (0.6s+)    : Serpentine dragon body launches outward along wind direction.
  Phase 3 (continuous): Ambient mist, splash, and droplet particles around dragon body.
  Phase 4 (overlay)   : Full-screen water-blue tint on the camera feed.

Integrates with the existing BaseEffect / EffectOrchestrator system.
"""

import math
import time
import random

import numpy as np
import pygame

from src.jutsu_academy.effects.base import BaseEffect, EffectContext


# ─── Color palette ───────────────────────────────────────────────────────────
WATER_COLORS = {
    "core":       (180, 230, 255),   # brightest inner glow (near-white ice-blue)
    "bright":     (100, 200, 255),   # vivid water blue
    "mid":        (40,  140, 220),   # mid-tone ocean
    "deep":       (20,  80,  180),   # darker undertone
    "dark":       (10,  40,  100),   # deepest shadow
    "mist":       (160, 210, 240),   # translucent mist / spray
    "eye_glow":   (220, 255, 255),   # dragon eye highlight
}


# ─── Tiny particle helper (reusable across phases) ──────────────────────────
class _WaterParticle:
    __slots__ = ("x", "y", "vx", "vy", "lifetime", "max_lifetime",
                 "size", "color", "gravity", "drag")

    def __init__(self, x, y, vx, vy, lifetime, size, color,
                 gravity=0.0, drag=0.98):
        self.x = x
        self.y = y
        self.vx = vx
        self.vy = vy
        self.lifetime = lifetime
        self.max_lifetime = lifetime
        self.size = size
        self.color = color
        self.gravity = gravity
        self.drag = drag

    def update(self, dt):
        self.vx *= self.drag
        self.vy *= self.drag
        self.vy += self.gravity * dt
        self.x += self.vx * dt
        self.y += self.vy * dt
        self.lifetime -= dt

    @property
    def alive(self):
        return self.lifetime > 0

    @property
    def alpha(self):
        ratio = max(0.0, min(1.0, self.lifetime / self.max_lifetime))
        return int(255 * ratio)

    @property
    def current_size(self):
        ratio = max(0.0, min(1.0, self.lifetime / self.max_lifetime))
        return max(1, int(self.size * ratio))


# ─── Main effect class ──────────────────────────────────────────────────────
class WaterDragonEffect(BaseEffect):
    """
    Registers under effect key ``"water_dragon"`` in the orchestrator.
    Triggered when the Water Dragon jutsu completes.
    """

    SIGN_ALIASES = {
        "water dragon",
        "water_dragon",
        "water dragon bullet",
        "water_dragon_bullet",
        "suiryuudan",
        "suiton",
    }

    # Timing
    GATHER_PHASE_DURATION = 0.6     # seconds — vortex gathering
    DRAGON_RAMP_DURATION  = 0.8     # seconds — body extends to full length
    TOTAL_DURATION_DEFAULT = 6.0    # seconds — entire effect lifetime

    # Dragon body geometry
    DRAGON_SEGMENTS       = 48      # how many body nodes
    DRAGON_LENGTH_PX      = 300     # max extend distance in screen px
    DRAGON_AMPLITUDE      = 35      # sine amplitude (px) for serpentine
    DRAGON_FREQUENCY      = 3.0     # sine cycles along the body
    DRAGON_HEAD_SIZE      = 22      # radius of head glow
    DRAGON_BODY_BASE_SIZE = 14      # body segment radius at head
    DRAGON_BODY_TIP_SIZE  = 3       # body segment radius at tail

    # Wandering orbit parameters — keeps dragon inside camera area
    ORBIT_RADIUS_X        = 180     # horizontal wander radius (px)
    ORBIT_RADIUS_Y        = 100     # vertical wander radius (px) — kept small
    ORBIT_SPEED           = 0.6     # full orbits per second
    ORBIT_CENTER_Y_OFFSET = -120    # orbit center sits slightly above origin (negative = up)

    # Particles
    MAX_PARTICLES         = 350
    MIST_EMIT_RATE        = 6       # per frame
    SPLASH_EMIT_RATE      = 3       # per frame
    DROPLET_EMIT_RATE     = 4       # per frame

    def __init__(self):
        self.active = False
        self.effect_started_at = 0.0
        self.total_duration = self.TOTAL_DURATION_DEFAULT

        # Origin in *screen* coords (set during update from context).
        self.origin_x = 0
        self.origin_y = 0
        self.wind_x = 0.0    # head yaw mapped to horizontal bias

        self.particles: list[_WaterParticle] = []
        self._phase_time = 0.0       # elapsed since start

        # Pre-allocate a small surface for glow circles (avoids per-frame alloc).
        self._glow_surf_cache: dict[int, pygame.Surface] = {}

    # ── helpers ──────────────────────────────────────────────────────────
    @staticmethod
    def _smoothstep(t: float) -> float:
        t = max(0.0, min(1.0, t))
        return t * t * (3.0 - 2.0 * t)

    @staticmethod
    def _normalize_name(name: str) -> str:
        if not name:
            return ""
        s = str(name).strip().lower().replace("-", " ").replace("_", " ")
        return " ".join(s.split())

    def _pick_water_color(self) -> tuple:
        r = random.random()
        if r > 0.80:
            return WATER_COLORS["core"]
        elif r > 0.55:
            return WATER_COLORS["bright"]
        elif r > 0.30:
            return WATER_COLORS["mid"]
        elif r > 0.10:
            return WATER_COLORS["deep"]
        else:
            return WATER_COLORS["dark"]

    def _glow_surface(self, radius: int, color: tuple, alpha: int) -> pygame.Surface:
        """Return a cached SRCALPHA surface with a soft glow circle."""
        key = (radius, color, alpha)
        cached = self._glow_surf_cache.get(key)
        if cached is not None:
            return cached
        # Limit cache size
        if len(self._glow_surf_cache) > 512:
            self._glow_surf_cache.clear()
        size = radius * 2
        surf = pygame.Surface((size, size), pygame.SRCALPHA)
        pygame.draw.circle(surf, (*color, alpha), (radius, radius), radius)
        self._glow_surf_cache[key] = surf
        return surf

    # ── BaseEffect interface ─────────────────────────────────────────────
    def on_jutsu_start(self, context: EffectContext):
        normalized = self._normalize_name(context.jutsu_name)
        if normalized in self.SIGN_ALIASES or "water" in normalized:
            self.active = True
            self.effect_started_at = time.perf_counter()
            self.particles.clear()
            self._glow_surf_cache.clear()
            # Use provided duration or default.
            dur = getattr(context, "effect_duration", 0.0)
            self.total_duration = max(2.0, float(dur)) if dur else self.TOTAL_DURATION_DEFAULT

    def on_jutsu_end(self, context: EffectContext):
        self.active = False
        self.particles.clear()
        self._glow_surf_cache.clear()

    # ── update (called every frame from orchestrator) ────────────────────
    def update(self, context: EffectContext):
        if not self.active:
            return

        dt = context.dt if context.dt > 0 else 1 / 60.0
        self._phase_time = time.perf_counter() - self.effect_started_at

        if self._phase_time >= self.total_duration:
            self.active = False
            self.particles.clear()
            return

        # Origin: bottom-center of camera feed — dragon rises upward
        # like it's erupting from water beneath the player.
        if context.frame_shape is not None:
            h, w = context.frame_shape[:2]
            cam_w = int(w * context.scale_x)
            cam_h = int(h * context.scale_y)
            self.origin_x = context.cam_x + cam_w // 2
            self.origin_y = context.cam_y + cam_h + 20  # slightly below cam edge

        # ── Emit particles ───────────────────────────────────────────────
        if self._phase_time < self.GATHER_PHASE_DURATION:
            self._emit_gather_vortex(dt)
        else:
            self._emit_mist(dt)
            self._emit_droplets(dt)
            self._emit_splash(dt)

        # ── Update all living particles ──────────────────────────────────
        for p in self.particles:
            p.update(dt)
        self.particles = [p for p in self.particles if p.alive]

        # Hard cap
        if len(self.particles) > self.MAX_PARTICLES:
            self.particles = self.particles[-self.MAX_PARTICLES:]

    # ── Particle emitters ────────────────────────────────────────────────
    def _emit_gather_vortex(self, dt):
        """Phase 1: swirling water particles converge on origin."""
        count = 12
        for _ in range(count):
            if len(self.particles) >= self.MAX_PARTICLES:
                break
            angle = random.uniform(0, math.tau)
            dist = random.uniform(80, 180)
            sx = self.origin_x + math.cos(angle) * dist
            sy = self.origin_y + math.sin(angle) * dist
            # Velocity points inward toward origin
            speed = random.uniform(200, 400)
            vx = (self.origin_x - sx) / max(1, dist) * speed
            vy = (self.origin_y - sy) / max(1, dist) * speed
            lt = random.uniform(0.3, 0.6)
            size = random.uniform(3, 8)
            self.particles.append(
                _WaterParticle(sx, sy, vx, vy, lt, size,
                               self._pick_water_color(), gravity=0, drag=0.95)
            )

    def _emit_mist(self, dt):
        """Subtle mist cloud trailing behind the dragon head."""
        for _ in range(self.MIST_EMIT_RATE):
            if len(self.particles) >= self.MAX_PARTICLES:
                break
            offset_x = random.gauss(0, 40)
            offset_y = random.gauss(0, 40)
            vx = random.gauss(0, 30)
            vy = random.gauss(-20, 30)
            lt = random.uniform(0.6, 1.2)
            size = random.uniform(10, 22)
            self.particles.append(
                _WaterParticle(self.origin_x + offset_x,
                               self.origin_y + offset_y,
                               vx, vy, lt, size,
                               WATER_COLORS["mist"], gravity=15, drag=0.97)
            )

    def _emit_droplets(self, dt):
        """Small fast droplets spraying outward from body."""
        dragon_progress = self._smoothstep(
            (self._phase_time - self.GATHER_PHASE_DURATION) / self.DRAGON_RAMP_DURATION
        )
        if dragon_progress < 0.1:
            return
        for _ in range(self.DROPLET_EMIT_RATE):
            if len(self.particles) >= self.MAX_PARTICLES:
                break
            # Spawn along the dragon body
            t_body = random.uniform(0.0, dragon_progress)
            bx, by = self._dragon_body_pos(t_body)
            speed = random.uniform(60, 160)
            angle = random.uniform(0, math.tau)
            vx = math.cos(angle) * speed
            vy = math.sin(angle) * speed
            lt = random.uniform(0.2, 0.5)
            size = random.uniform(2, 5)
            self.particles.append(
                _WaterParticle(bx, by, vx, vy, lt, size,
                               self._pick_water_color(), gravity=200, drag=0.96)
            )

    def _emit_splash(self, dt):
        """Bigger splash bursts around the dragon head."""
        dragon_progress = self._smoothstep(
            (self._phase_time - self.GATHER_PHASE_DURATION) / self.DRAGON_RAMP_DURATION
        )
        if dragon_progress < 0.15:
            return
        head_x, head_y = self._dragon_body_pos(dragon_progress)
        for _ in range(self.SPLASH_EMIT_RATE):
            if len(self.particles) >= self.MAX_PARTICLES:
                break
            angle = random.uniform(0, math.tau)
            speed = random.uniform(30, 100)
            vx = math.cos(angle) * speed
            vy = math.sin(angle) * speed
            lt = random.uniform(0.4, 0.8)
            size = random.uniform(5, 12)
            self.particles.append(
                _WaterParticle(head_x + random.gauss(0, 8),
                               head_y + random.gauss(0, 8),
                               vx, vy, lt, size,
                               WATER_COLORS["bright"], gravity=60, drag=0.97)
            )

    # ── Dragon body geometry ─────────────────────────────────────────────
    def _dragon_body_pos(self, t: float) -> tuple[float, float]:
        """
        Return (x, y) screen position for a point at normalized distance *t*
        (0 = origin/tail, 1 = head) along the dragon body.

        The head follows a smooth wandering orbit around the origin so the
        dragon swims/loops within the camera area without flying off the top.
        Each body segment trails behind using a time-delayed version of the
        same orbit path, producing a natural serpentine look.
        """
        t = max(0.0, min(1.0, t))

        # Each body segment uses a time-delayed angle so segments trail
        # behind the head, creating the serpentine body shape.
        trail_delay = (1.0 - t) * 1.8  # seconds of delay for tail end
        effective_time = max(0.0, self._phase_time - trail_delay)

        # Orbit angle — figure-eight-ish (Lissajous) path
        theta = effective_time * self.ORBIT_SPEED * math.tau
        orbit_x = math.sin(theta) * self.ORBIT_RADIUS_X
        orbit_y = math.sin(theta * 2.0) * self.ORBIT_RADIUS_Y  # double freq → figure-8

        # Add higher-frequency sine wiggle along the body for liveliness
        phase_shift = self._phase_time * 4.0
        wiggle = math.sin(t * self.DRAGON_FREQUENCY * math.tau + phase_shift) * self.DRAGON_AMPLITUDE * t

        # Orbit center is above origin so dragon swims in the camera area
        center_x = self.origin_x
        center_y = self.origin_y + self.ORBIT_CENTER_Y_OFFSET

        # Lerp tail toward origin so it connects to the "eruption" point
        anchor_blend = self._smoothstep(t)  # 0→at origin, 1→on orbit
        base_x = self.origin_x * (1.0 - anchor_blend) + (center_x + orbit_x) * anchor_blend
        base_y = self.origin_y * (1.0 - anchor_blend) + (center_y + orbit_y) * anchor_blend

        x = base_x + wiggle
        y = base_y
        return x, y

    # ── render (called every frame from orchestrator) ────────────────────
    def render(self, screen: pygame.Surface, context: EffectContext):
        if not self.active:
            return

        # Compute dragon extend progress
        after_gather = self._phase_time - self.GATHER_PHASE_DURATION
        dragon_progress = self._smoothstep(after_gather / self.DRAGON_RAMP_DURATION) if after_gather > 0 else 0.0

        # Fade-in / fade-out alpha for the entire effect
        fade_in_duration = 0.4
        fade_out_start = max(1.0, self.total_duration - 1.0)
        if self._phase_time < fade_in_duration:
            global_alpha = self._smoothstep(self._phase_time / fade_in_duration)
        elif self._phase_time > fade_out_start:
            remaining = self.total_duration - self._phase_time
            global_alpha = self._smoothstep(remaining / (self.total_duration - fade_out_start))
        else:
            global_alpha = 1.0

        # 1. Water tint overlay on camera region ──────────────────────────
        if context.frame_shape is not None and global_alpha > 0.05:
            cam_w = int(context.frame_shape[1] * context.scale_x)
            cam_h = int(context.frame_shape[0] * context.scale_y)
            tint_alpha = int(35 * global_alpha * min(1.0, dragon_progress * 2))
            if tint_alpha > 2:
                tint = pygame.Surface((cam_w, cam_h), pygame.SRCALPHA)
                tint.fill((20, 60, 140, tint_alpha))
                screen.blit(tint, (context.cam_x, context.cam_y))

        # 2. Render loose particles (mist, droplets, splash) ──────────────
        for p in self.particles:
            sz = p.current_size
            if sz < 1:
                continue
            a = int(p.alpha * global_alpha)
            if a < 4:
                continue
            # Two-layer glow: outer soft + inner bright
            for layer, (extra, a_factor) in enumerate([(4, 0.4), (0, 1.0)]):
                r = sz + extra
                la = max(0, min(255, int(a * a_factor)))
                if la < 2 or r < 1:
                    continue
                glow = self._glow_surface(r, p.color, la)
                screen.blit(glow, (int(p.x - r), int(p.y - r)),
                            special_flags=pygame.BLEND_RGB_ADD)

        # 3. Dragon body ──────────────────────────────────────────────────
        if dragon_progress > 0.01:
            self._render_dragon_body(screen, dragon_progress, global_alpha)

    def _render_dragon_body(self, screen: pygame.Surface,
                            progress: float, global_alpha: float):
        """Draw the serpentine dragon body as a chain of glowing circles."""
        segments = self.DRAGON_SEGMENTS
        points: list[tuple[float, float, float]] = []  # (x, y, radius)

        for i in range(segments + 1):
            t = (i / segments) * progress
            x, y = self._dragon_body_pos(t)
            # Radius tapers: thick at head, thin at tail
            ratio = i / segments  # 0 = tail, 1 = head
            radius = self.DRAGON_BODY_TIP_SIZE + (self.DRAGON_BODY_BASE_SIZE - self.DRAGON_BODY_TIP_SIZE) * ratio
            points.append((x, y, radius))

        # Draw from tail to head so head is on top
        for i, (x, y, radius) in enumerate(points):
            ratio = i / max(1, len(points) - 1)
            # Color shifts from deep at tail to bright at head
            if ratio > 0.85:
                color = WATER_COLORS["core"]
            elif ratio > 0.6:
                color = WATER_COLORS["bright"]
            elif ratio > 0.3:
                color = WATER_COLORS["mid"]
            else:
                color = WATER_COLORS["deep"]

            a = int(220 * global_alpha * max(0.3, ratio))
            r = max(1, int(radius))

            # Outer glow layer
            outer_r = r + 6
            outer_a = max(0, min(255, int(a * 0.3)))
            if outer_a > 2:
                glow = self._glow_surface(outer_r, color, outer_a)
                screen.blit(glow, (int(x - outer_r), int(y - outer_r)),
                            special_flags=pygame.BLEND_RGB_ADD)

            # Core body
            if a > 2:
                core = self._glow_surface(r, color, min(255, a))
                screen.blit(core, (int(x - r), int(y - r)),
                            special_flags=pygame.BLEND_RGB_ADD)

        # Dragon head highlight (last point = head)
        if points:
            hx, hy, _ = points[-1]
            head_r = self.DRAGON_HEAD_SIZE
            # Pulsating glow
            pulse = 0.8 + 0.2 * math.sin(self._phase_time * 8.0)
            head_a = int(255 * global_alpha * pulse)

            # Large outer aura
            aura_r = head_r + 12
            aura_a = max(0, min(255, int(head_a * 0.25)))
            if aura_r > 0 and aura_a > 2:
                aura = self._glow_surface(aura_r, WATER_COLORS["bright"], aura_a)
                screen.blit(aura, (int(hx - aura_r), int(hy - aura_r)),
                            special_flags=pygame.BLEND_RGB_ADD)

            # Bright core
            if head_a > 2:
                head_surf = self._glow_surface(head_r, WATER_COLORS["core"], min(255, head_a))
                screen.blit(head_surf, (int(hx - head_r), int(hy - head_r)),
                            special_flags=pygame.BLEND_RGB_ADD)

            # Tiny "eye" dot
            eye_r = max(2, head_r // 3)
            eye_a = min(255, int(head_a * 1.2))
            eye = self._glow_surface(eye_r, WATER_COLORS["eye_glow"], min(255, eye_a))
            screen.blit(eye, (int(hx - eye_r), int(hy - eye_r)),
                        special_flags=pygame.BLEND_RGB_ADD)
