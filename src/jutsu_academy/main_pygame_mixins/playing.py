from src.jutsu_academy.main_pygame_shared import *
from src.utils.paths import resolve_resource_path
from src.jutsu_academy.effects import EffectContext
import hashlib


class PlayingMixin:
    def _challenge_reset_proof(self):
        self.challenge_run_token = ""
        self.challenge_run_token_source = "none"
        self.challenge_proof_events = []
        self.challenge_run_hash = ""
        self.challenge_started_at_iso = ""
        self.challenge_submission_result = {}
        self.challenge_event_overflow = False

    def _challenge_events_digest(self):
        canonical = json.dumps(self.challenge_proof_events or [], separators=(",", ":"), sort_keys=True)
        return hashlib.sha256(canonical.encode("utf-8")).hexdigest()

    def _challenge_begin_proof(self):
        self._challenge_reset_proof()
        jutsu_name = self.jutsu_names[self.current_jutsu_idx]
        mode = str(jutsu_name).upper()
        self.challenge_started_at_iso = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
        seed = f"{self.username}|{mode}|{self.challenge_started_at_iso}|{time.time():.6f}"
        self.challenge_run_hash = hashlib.sha256(seed.encode("utf-8")).hexdigest()
        self._challenge_append_event(
            "run_start",
            mode=mode,
            expected_signs=len(self.sequence or []),
        )
        try:
            if self.network_manager:
                d_id = None
                if isinstance(getattr(self, "discord_user", None), dict):
                    d_id = str(self.discord_user.get("id") or "").strip() or None
                token_data = self.network_manager.issue_run_token(
                    username=self.username if self.username else "Guest",
                    mode=mode,
                    client_started_at=self.challenge_started_at_iso,
                    discord_id=d_id,
                )
                self.challenge_run_token = str(token_data.get("token") or "")
                self.challenge_run_token_source = str(token_data.get("source") or "none")
        except Exception as exc:
            print(f"[!] issue_run_token failed: {exc}")

    def _challenge_append_event(self, event_type, **extra):
        if self.game_mode != "challenge":
            return
        max_events = 256
        if len(self.challenge_proof_events) >= max_events:
            if not self.challenge_event_overflow:
                self.challenge_event_overflow = True
                # Keep a single overflow marker then ignore additional events.
                overflow_evt = {"t": round(max(0.0, time.time() - self.challenge_start_time), 3), "type": "event_overflow"}
                self.challenge_proof_events.append(overflow_evt)
            return
        rel_t = 0.0
        if self.challenge_start_time:
            rel_t = max(0.0, time.time() - self.challenge_start_time)
        event = {
            "t": round(rel_t, 3),
            "type": str(event_type),
        }
        event.update(extra)
        self.challenge_proof_events.append(event)

        canonical = json.dumps(event, separators=(",", ":"), sort_keys=True)
        prev_hash = self.challenge_run_hash or ""
        self.challenge_run_hash = hashlib.sha256((prev_hash + "|" + canonical).encode("utf-8")).hexdigest()

    def _start_phoenix_fireballs(self):
        self.phoenix_fireballs_active = True
        self.phoenix_fireballs = []
        for sys in getattr(self, "phoenix_fireball_systems", []):
            sys.set_style("fireball")
            sys.emitting = True
            sys.particles.clear()

    def _stop_phoenix_fireballs(self):
        self.phoenix_fireballs_active = False
        self.phoenix_fireballs = []
        for sys in getattr(self, "phoenix_fireball_systems", []):
            sys.emitting = False
            sys.particles.clear()

    def _update_phoenix_fireballs(self, dt, cam_x, cam_y, cam_w, cam_h, mouth_screen_pos):
        if not bool(getattr(self, "phoenix_fireballs_active", False)):
            return
        systems = list(getattr(self, "phoenix_fireball_systems", []) or [])
        if not systems:
            return

        count = min(int(getattr(self, "phoenix_fireball_count", 5) or 5), len(systems))
        if count <= 0:
            return

        min_x = cam_x + 26
        max_x = cam_x + cam_w - 26
        min_y = cam_y + 24
        max_y = cam_y + cam_h - 24

        if not self.phoenix_fireballs:
            if mouth_screen_pos:
                cx, cy = mouth_screen_pos
            else:
                cx = cam_x + cam_w * 0.5
                cy = cam_y + cam_h * 0.68

            spread = np.linspace(-1.15, 1.15, count)
            balls = []
            for ang in spread:
                speed = float(np.random.uniform(330.0, 560.0))
                theta = float(ang + np.random.uniform(-0.24, 0.24))
                vx = speed * math.sin(theta)
                vy = -speed * np.random.uniform(0.72, 1.24)
                balls.append(
                    {
                        "x": float(cx + np.random.uniform(-12.0, 12.0)),
                        "y": float(cy + np.random.uniform(-8.0, 8.0)),
                        "vx": float(vx),
                        "vy": float(vy),
                        "r": float(np.random.uniform(16.0, 22.0)),
                    }
                )
            self.phoenix_fireballs = balls

        wind_bias = -float(getattr(self, "head_yaw", 0.0) or 0.0) * 80.0
        for idx in range(count):
            b = self.phoenix_fireballs[idx]

            swirl_x = math.sin(time.time() * 3.8 + idx * 1.17) * 180.0
            swirl_y = math.cos(time.time() * 4.3 + idx * 0.93) * 140.0
            b["vx"] += (float(np.random.uniform(-270.0, 270.0)) + swirl_x) * dt
            b["vy"] += (float(np.random.uniform(-230.0, 230.0)) + swirl_y) * dt

            # Occasional chaotic kick so paths feel less predictable.
            if np.random.random() < (2.0 * dt):
                impulse = float(np.random.uniform(120.0, 280.0))
                kick_theta = float(np.random.uniform(-math.pi, math.pi))
                b["vx"] += impulse * math.cos(kick_theta)
                b["vy"] += impulse * math.sin(kick_theta)

            speed = math.hypot(b["vx"], b["vy"])
            if speed > 700.0:
                scale = 700.0 / max(1e-6, speed)
                b["vx"] *= scale
                b["vy"] *= scale

            b["x"] += (b["vx"] + wind_bias) * dt
            b["y"] += b["vy"] * dt

            if b["x"] < min_x:
                b["x"] = min_x
                b["vx"] = abs(b["vx"]) * 0.98
            elif b["x"] > max_x:
                b["x"] = max_x
                b["vx"] = -abs(b["vx"]) * 0.98

            if b["y"] < min_y:
                b["y"] = min_y
                b["vy"] = abs(b["vy"]) * 0.98
            elif b["y"] > max_y:
                b["y"] = max_y
                b["vy"] = -abs(b["vy"]) * 0.98

            sys = systems[idx]
            sys.set_style("fireball")
            sys.emitting = True
            sys.set_position(b["x"], b["y"])
            sys.wind_x = b["vx"] * 0.14
            if hasattr(sys, "set_direction"):
                sys.set_direction(float(b["vx"]), float(b["vy"]), smoothing=0.42)
            sys.update(dt)

    def _render_phoenix_fireballs(self):
        if not bool(getattr(self, "phoenix_fireballs_active", False)):
            return
        systems = list(getattr(self, "phoenix_fireball_systems", []) or [])
        count = min(len(self.phoenix_fireballs), len(systems))
        for idx in range(count):
            b = self.phoenix_fireballs[idx]
            r = max(8, int(float(b.get("r", 16.0))))
            x = int(float(b.get("x", 0.0)))
            y = int(float(b.get("y", 0.0)))
            core = pygame.Surface((r * 6, r * 6), pygame.SRCALPHA)
            cx = cy = r * 3
            pygame.draw.circle(core, (255, 255, 220, 145), (cx, cy), int(r * 0.90))
            pygame.draw.circle(core, (255, 175, 70, 165), (cx, cy), int(r * 1.45))
            pygame.draw.circle(core, (255, 90, 35, 125), (cx, cy), int(r * 2.05))
            self.screen.blit(core, (x - cx, y - cy), special_flags=pygame.BLEND_ADD)
            systems[idx].render(self.screen)

    def _trigger_jutsu_payload(self, jutsu_name, effect_name):
        """Trigger sound/effect/video payload for a (sub)jutsu event."""
        # Queue signature sound (supports combo checkpoints without clobbering previous sound).
        sound_name = None
        sound_delay_s = 0.5
        if jutsu_name in self.sounds:
            sound_name = jutsu_name
        elif effect_name == "clone":
            # No dedicated clone clip yet; use a light fallback signature.
            sound_name = "each"
        if effect_name == "reaper":
            # Reaper should ramp with the signature audio immediately.
            sound_delay_s = 0.0

        effect_duration = 0.0
        if effect_name == "reaper" and sound_name in self.sounds:
            try:
                sound_len = float(self.sounds[sound_name].get_length() or 0.0)
                if sound_len > 0.0:
                    # Hold for audio duration, then fade away.
                    effect_duration = sound_len + 0.9
                    self.jutsu_duration = max(float(getattr(self, "jutsu_duration", 0.0)), effect_duration)
            except Exception:
                effect_duration = 0.0

        if sound_name:
            if not hasattr(self, "pending_sounds") or self.pending_sounds is None:
                self.pending_sounds = []
            if jutsu_name == "Phoenix Flower":
                for i in range(5):
                    self.pending_sounds.append({
                        "name": sound_name,
                        "time": time.time() + max(0.0, float(sound_delay_s)) + (i * 0.4),
                    })
            else:
                self.pending_sounds.append({
                    "name": sound_name,
                    "time": time.time() + max(0.0, float(sound_delay_s)),
                })

        if effect_name == "fire":
            jutsu_key = str(jutsu_name or "").strip().lower()
            if "phoenix" in jutsu_key:
                self.fire_particles.emitting = False
                self._start_phoenix_fireballs()
            else:
                self._stop_phoenix_fireballs()
                if hasattr(self.fire_particles, "set_style"):
                    self.fire_particles.set_style("fireball")
                self.fire_particles.emitting = True

        # Delay clone spawn to align better with longer clone signature audio.
        if effect_name == "clone":
            if not hasattr(self, "pending_effects") or self.pending_effects is None:
                self.pending_effects = []
            self.pending_effects.append({
                "effect": effect_name,
                "jutsu_name": jutsu_name,
                "time": time.time() + max(0.0, float(getattr(self, "clone_spawn_delay_s", 0.9))),
            })
        else:
            self.effect_orchestrator.on_jutsu_start(
                effect_name,
                EffectContext(
                    jutsu_name=jutsu_name,
                    effect_duration=effect_duration,
                    mouth_pos=self.mouth_pos,
                    head_yaw=float(getattr(self, "head_yaw", 0.0) or 0.0),
                    head_pitch=float(getattr(self, "head_pitch", 0.0) or 0.0),
                ),
            )

        jutsu_data = self.jutsu_list.get(jutsu_name, {})
        video_path = jutsu_data.get("video_path")
        resolved_video = resolve_resource_path(video_path) if video_path else None
        if resolved_video and resolved_video.exists():
            if self.video_cap:
                self.video_cap.release()
                self.video_cap = None
            self.video_cap = cv2.VideoCapture(str(resolved_video))
            self.current_video = jutsu_name
            print(f"[+] Playing video: {resolved_video}")

    def _render_challenge_lobby(self, cam_x, cam_y, cam_w, cam_h):
        """Draw dimmed lobby with 'Press SPACE to Start'."""
        overlay = pygame.Surface((cam_w, cam_h), pygame.SRCALPHA)
        overlay.fill((0, 0, 0, 160))
        self.screen.blit(overlay, (cam_x, cam_y))
        
        # Text
        txt = self.fonts["title_md"].render("PRESS [SPACE] TO START", True, COLORS["accent_glow"])
        rect = txt.get_rect(center=(cam_x + cam_w // 2, cam_y + cam_h // 2 - 40))
        self.screen.blit(txt, rect)
        
        sub = self.fonts["body"].render("Perform the sequence as FAST as possible!", True, COLORS["text_dim"])
        self.screen.blit(sub, sub.get_rect(center=(cam_x + cam_w // 2, cam_y + cam_h // 2 + 20)))
        rules = [
            "1. Timer starts on 'GO!'",
            "2. Detect all hand signs in order.",
            "3. Timer stops on the final sign."
        ]
        for i, r in enumerate(rules):
            rt = self.fonts["body_sm"].render(r, True, COLORS["text"])
            self.screen.blit(rt, rt.get_rect(center=(cam_x + cam_w // 2, cam_y + cam_h // 2 + 80 + i*25)))

    def _render_challenge_countdown(self, cam_x, cam_y, cam_w, cam_h):
        """Draw big countdown in center."""
        elapsed = time.time() - self.challenge_countdown_start
        remaining = 3 - int(elapsed)
        
        if remaining > 0:
            frac = 1.0 - (elapsed % 1.0) 
            size = int(120 * (1.0 + 0.5 * frac)) 
            font = pygame.font.Font(None, size) 
            
            txt = font.render(str(remaining), True, (255, 255, 0)) 
            rect = txt.get_rect(center=(cam_x + cam_w // 2, cam_y + cam_h // 2))
            self.screen.blit(txt, rect)
        else:
            self.challenge_state = "active"
            self.challenge_start_time = time.time()
            self.last_sign_time = time.time()
            self._challenge_begin_proof()
            self.play_sound("complete")

    def _render_challenge_results(self, cam_x, cam_y, cam_w, cam_h):
        """Draw results overlay with Rank and stats."""
        overlay = pygame.Surface((cam_w, cam_h), pygame.SRCALPHA)
        overlay.fill((10, 10, 15, 200)) 
        self.screen.blit(overlay, (cam_x, cam_y))
        
        # Card style
        card_w, card_h = min(cam_w - 40, 480), min(cam_h - 40, 400)
        card = pygame.Rect(cam_x + (cam_w - card_w) // 2, cam_y + (cam_h - card_h) // 2, card_w, card_h)
        pygame.draw.rect(self.screen, (25, 25, 30), card, border_radius=20)
        pygame.draw.rect(self.screen, COLORS["accent"], card, 2, border_radius=20)
        
        # Title
        t = self.fonts["title_md"].render("RESULTS", True, COLORS["accent"])
        self.screen.blit(t, t.get_rect(center=(card.centerx, card.y + 50)))
        
        # Final Time
        time_str = f"{self.challenge_final_time:.2f}s"
        st = self.fonts["title_lg"].render(time_str, True, COLORS["success"])
        self.screen.blit(st, st.get_rect(center=(card.centerx, card.y + 130)))
        
        # Rank Info
        if self.challenge_submitting:
            info = "Submitting score..."
            color = COLORS["text_dim"]
        elif self.challenge_rank_info:
            info = self.challenge_rank_info
            color = (255, 215, 0) # Gold
        else:
            info = "Awaiting response..."
            color = COLORS["text_dim"]
            
        rt = self.fonts["body"].render(info, True, color)
        self.screen.blit(rt, rt.get_rect(center=(card.centerx, card.y + 200)))
        
        # Help
        h1 = self.fonts["body_sm"].render("Press [SPACE] to Try Again", True, COLORS["text"])
        self.screen.blit(h1, h1.get_rect(center=(card.centerx, card.y + 280)))
        
        h2 = self.fonts["body_sm"].render("Press [ESC] to Exit", True, COLORS["text_dim"])
        self.screen.blit(h2, h2.get_rect(center=(card.centerx, card.y + 310)))
        
        # Trigger submission once
        if not self.challenge_submitting and not self.submission_complete:
            self.challenge_submitting = True
            threading.Thread(target=self._submit_challenge_score, daemon=True).start()

    def _challenge_score_ready_for_submit(self):
        if self.game_mode != "challenge":
            return False
        if self.challenge_submitting or self.submission_complete:
            return False
        try:
            final_time = float(getattr(self, "challenge_final_time", 0.0) or 0.0)
        except Exception:
            final_time = 0.0
        if final_time <= 0.0:
            return False
        state = str(getattr(self, "challenge_state", "waiting") or "waiting")
        return bool(self.jutsu_active) or state in {"active", "results"}

    def _submit_challenge_score_on_exit(self, blocking=False):
        """Submit challenge score when player exits before results auto-submit finishes."""
        if not self._challenge_score_ready_for_submit():
            return False
        self.challenge_state = "results"
        self.challenge_submitting = True
        if blocking:
            self._submit_challenge_score()
        else:
            threading.Thread(target=self._submit_challenge_score, daemon=True).start()
        return True

    def _submit_challenge_score(self):
        """Background thread to submit score and calculate local rank."""
        try:
            jutsu_name = self.jutsu_names[self.current_jutsu_idx]
            username = self.username if self.username else "Guest"
            
            d_id = None
            avatar_url = None
            if self.discord_user:
                d_id = self.discord_user.get("id")
                avatar_hash = self.discord_user.get("avatar")
                if d_id and avatar_hash:
                    avatar_url = f"https://cdn.discordapp.com/avatars/{d_id}/{avatar_hash}.png?size=64"
            
            # 1. Submit using secure RPC (fail closed if unavailable).
            secure_metadata = {
                "expected_signs": len(self.jutsu_list.get(jutsu_name, {}).get("sequence", [])),
                "detected_signs": len([e for e in self.challenge_proof_events if e.get("type") == "sign_ok"]),
                "cooldown_s": float(self.cooldown),
                "client_fps_target": int(FPS),
                "client_version": APP_VERSION,
                "token_source": self.challenge_run_token_source,
                "event_chain_hash": self.challenge_run_hash,
                "event_overflow": bool(self.challenge_event_overflow),
            }
            submit_res = self.network_manager.submit_score_secure(
                username=username,
                score_time=self.challenge_final_time,
                mode=jutsu_name.upper(),
                run_token=self.challenge_run_token,
                events=self.challenge_proof_events,
                run_hash=self._challenge_events_digest(),
                metadata=secure_metadata,
                discord_id=d_id,
                avatar_url=avatar_url,
            )
            self.challenge_submission_result = submit_res if isinstance(submit_res, dict) else {}
            if (not isinstance(submit_res, dict)) or (not submit_res.get("ok", False)):
                reason = "secure_submit_unavailable"
                if isinstance(submit_res, dict):
                    reason = submit_res.get("reason", reason)
                self.challenge_rank_info = f"Submission rejected: {reason}"
                self.challenge_submitting = False
                self.submission_complete = True
                return
            
            # 2. Get Leadboard to find rank (simulated for immediate feedback)
            # Fetch enough to find approximate rank
            data = self.network_manager.get_leaderboard(limit=100, mode=jutsu_name.upper())
            rank = -1
            total = len(data)
            
            if data:
                for i, row in enumerate(data):
                    # Find our score
                    if abs(row.get("score_time", 0) - self.challenge_final_time) < 0.001:
                         rank = i + 1
                         break
                
                if rank > 0:
                    percentile = ((total - rank + 1) / total) * 100
                    self.challenge_rank_info = f"Rank: #{rank} (Top {percentile:.0f}%)"
                else:
                    self.challenge_rank_info = "Rank: Top 100+"
            else:
                 self.challenge_rank_info = "Rank: #1 (First Record!)"
                 
        except Exception as e:
            print(f"[!] Submission Error: {e}")
            self.challenge_rank_info = "Error submitting score."
        
        self.challenge_submitting = False
        self.submission_complete = True

    def render_playing(self, dt):
        """Render game playing state with Challenge Mode support."""
        # 1. Background Logic - Always draw first to clear previous frame
        if hasattr(self, 'bg_image') and self.bg_image:
             if hasattr(self, 'last_screen_w') and self.last_screen_w != SCREEN_WIDTH:
                 # Rescale background if screen size changes (simplified check)
                 self.bg_image = pygame.transform.smoothscale(self.bg_image, (SCREEN_WIDTH, SCREEN_HEIGHT))
                 self.last_screen_w = SCREEN_WIDTH
             self.screen.blit(self.bg_image, (0, 0))
             
             # Professional darken overlay
             overlay = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
             overlay.fill((0, 0, 0, 180)) 
             self.screen.blit(overlay, (0, 0))
        else:
             self.screen.fill(COLORS["bg_dark"])
        
        if self.cap is None or not self.cap.isOpened():
            self._draw_text_center("Camera Disconnected", 0, COLORS["error"])
            return
        
        ret, frame = self.cap.read()
        if not ret:
            self._draw_text_center("Camera blocked! Check OBS/Discord.", 0, COLORS["error"])
            return
        
        # Flip for mirror
        frame = cv2.flip(frame, 1)
        lighting_ok = self._evaluate_lighting(frame)
        
        # Camera position on screen (Centered & Scaled)
        # We want to fill the screen as much as possible while maintaining aspect ratio
        frame_h, frame_w = frame.shape[:2]
        
        # Calculate scaling to fit screen height (Careful with 768p constraint)
        # 768 - 45(HUD) - 50(Title) - 135(Icons) - 60(Margins) = ~478
        target_h = SCREEN_HEIGHT - 300 
        scale = target_h / frame_h
        
        new_w = int(frame_w * scale)
        new_h = int(frame_h * scale)
        
        cam_x = (SCREEN_WIDTH - new_w) // 2
        cam_y = 100 # Moved up slightly to save space
        if hasattr(self, "playing_back_button"):
            self.playing_back_button.rect.width = 120
            self.playing_back_button.rect.height = 42
            # Keep clear of top HUD text and avoid overlapping the camera frame/title.
            self.playing_back_button.rect.x = max(16, cam_x - self.playing_back_button.rect.width - 24)
            self.playing_back_button.rect.y = max(56, cam_y + 6)
        
        # 1. Challenge Mode Visibility
        should_detect = True
        if self.game_mode == "challenge":
            if self.challenge_state in ["waiting", "countdown", "results"]:
                should_detect = False
                
        # 1.5 Locked Check (Shinobi Path)
        current_jutsu_name = self.jutsu_names[self.current_jutsu_idx]
        min_lv = self.jutsu_list[current_jutsu_name].get("min_level", 0)
        is_locked = self.progression.level < min_lv
        if is_locked:
            should_detect = False
        
        # 2. Detection Flow
        detected = "idle"
        run_detection = should_detect or self.calibration_active
        if run_detection:
            if not self.jutsu_active:
                # Sequence Phase: Recognition
                if self.settings.get("use_mediapipe_signs", False):
                    # MediaPipe + quality gate + temporal consensus
                    detected = self.predict_sign_with_filters(frame, lighting_ok)
                else:
                    # YOLO mode: still run temporal vote + lighting gate for stability.
                    frame, yolo_sign, yolo_conf = self.detect_and_process(frame)
                    raw_sign = str(yolo_sign or "idle").strip().lower()
                    raw_conf = float(max(0.0, yolo_conf))
                    allow_detection = bool(lighting_ok) and raw_sign not in ("", "idle")
                    stable_sign, stable_conf = self._apply_temporal_vote(raw_sign, raw_conf, allow_detection)

                    self.raw_detected_sign = raw_sign
                    self.raw_detected_confidence = raw_conf
                    self.detected_sign = stable_sign
                    self.detected_confidence = float(stable_conf)
                    self.last_detected_hands = 1 if raw_sign not in ("", "idle") else 0
                    self._update_calibration_sample(raw_sign, raw_conf, self.last_detected_hands)
                    detected = stable_sign
            else:
                # Effect Phase: switch to MediaPipe for precise tracking
                self.detect_hands(frame)
                self.detect_face(frame)
        else:
            self._apply_temporal_vote("idle", 0.0, False, hard_reset=True)
            self.raw_detected_sign = "idle"
            self.raw_detected_confidence = 0.0
            self.detected_sign = "idle"
            self.detected_confidence = 0.0
            self.last_detected_hands = 0

        # Use smoothed hand anchor for effects/overlays to reduce jitter.
        effect_hand_pos = self.smooth_hand_pos if self.smooth_hand_pos else self.hand_pos

        # 3. Process Sequence
        self.effect_orchestrator.on_sign_detected(
            detected,
            EffectContext(
                frame_bgr=frame,
                frame_shape=frame.shape,
                hand_pos=effect_hand_pos,
                mouth_pos=self.mouth_pos,
                left_eye_pos=self.left_eye_pos,
                right_eye_pos=self.right_eye_pos,
                left_eye_size=self.left_eye_size,
                right_eye_size=self.right_eye_size,
                left_eye_angle=self.left_eye_angle,
                right_eye_angle=self.right_eye_angle,
                head_yaw=float(getattr(self, "head_yaw", 0.0) or 0.0),
                head_pitch=float(getattr(self, "head_pitch", 0.0) or 0.0),
                cam_x=cam_x,
                cam_y=cam_y,
                scale_x=(new_w / max(1, frame_w)),
                scale_y=(new_h / max(1, frame_h)),
            ),
        )

        if not self.jutsu_active and should_detect:
            # Check sequence
            if self.current_step < len(self.sequence):
                target = self.sequence[self.current_step]
                target_norm = self._normalize_sign_token(target)
                if self._signs_match(detected, target):
                    now = time.time()
                    if now - self.last_sign_time > self.cooldown:
                        if self.current_step == 0:
                            self.sequence_run_start = now
                            self.combo_triggered_steps = set()
                            self.combo_clone_hold = False
                            self.combo_chidori_triple = False
                            self.combo_rasengan_triple = False
                            self.current_video = None
                            if getattr(self, "video_cap", None):
                                self.video_cap.release()
                                self.video_cap = None
                        step_completed = self.current_step + 1
                        self.current_step += 1
                        self.last_sign_time = now
                        self.play_sound("each")
                        self._record_sign_progress()
                        if self.game_mode == "challenge":
                            self._challenge_append_event(
                                "sign_ok",
                                step=step_completed,
                                sign=str(target_norm or target),
                            )

                        # Combo checkpoint triggers: allow first jutsu effect to run while continuing signs.
                        jutsu_name = self.jutsu_names[self.current_jutsu_idx]
                        jutsu_data = self.jutsu_list[jutsu_name]
                        combo_parts = jutsu_data.get("combo_parts", [])
                        if combo_parts:
                            if not hasattr(self, "combo_triggered_steps"):
                                self.combo_triggered_steps = set()
                            for part in combo_parts:
                                step_idx = int(part.get("at_step", -1))
                                if self.current_step == step_idx and step_idx not in self.combo_triggered_steps:
                                    self.combo_triggered_steps.add(step_idx)
                                    part_name = part.get("name", jutsu_name)
                                    part_data = self.jutsu_list.get(part_name, {})
                                    part_effect = part.get("effect", part_data.get("effect"))
                                    if part_effect == "clone":
                                        self.combo_clone_hold = True
                                    if part_effect == "lightning" and str(part_name).lower() == "chidori":
                                        self.combo_chidori_triple = True
                                    if part_effect == "rasengan" and str(part_name).lower() == "rasengan":
                                        self.combo_rasengan_triple = True
                                    self.play_sound("complete")
                                    self._trigger_jutsu_payload(part_name, part_effect)

                        if self.current_step >= len(self.sequence):
                            self.jutsu_active = True
                            self.jutsu_start_time = time.time()
                            self.jutsu_duration = float(jutsu_data.get("duration", 5.0))
                            self.current_step = 0
                            clear_time = None
                            if self.game_mode == "challenge":
                                clear_time = self.jutsu_start_time - self.challenge_start_time
                            elif self.sequence_run_start:
                                clear_time = self.jutsu_start_time - self.sequence_run_start
                            self.sequence_run_start = None

                            # Award XP (Robust Progression)
                            seq_len = len(self.jutsu_list[jutsu_name]["sequence"])
                            bonus = seq_len * 10
                            total_xp = 50 + bonus # Base 50 + complexity bonus
                            completion_res = self._record_jutsu_completion(
                                xp_gain=total_xp,
                                is_challenge=(self.game_mode == "challenge"),
                                signs_landed=seq_len,
                                jutsu_name=jutsu_name,
                            )
                            awarded_xp = int(total_xp)
                            if isinstance(completion_res, dict) and completion_res.get("ok", False):
                                self._warned_authoritative_progression_unavailable = False
                                awarded_xp = int(completion_res.get("xp_awarded", total_xp) or 0)
                                prev_level = int(completion_res.get("previous_level", self.progression.level))
                                is_lv_up = bool(completion_res.get("leveled_up", False))

                                if is_lv_up:
                                    self._queue_post_effect_alert(
                                        "level_up",
                                        {"previous_level": prev_level, "source_label": "Jutsu Clear"},
                                        min_delay_s=0.55,
                                    )
                                else:
                                    self._queue_post_effect_alert(
                                        "unlocks",
                                        {"previous_level": prev_level},
                                        min_delay_s=0.55,
                                    )

                                # Add XP popup (Centered on Camera feed)
                                self.xp_popups.append({
                                    "text": f"+{awarded_xp} XP",
                                    "x": cam_x + new_w // 2,
                                    "y": cam_y + new_h // 2,
                                    "timer": 2.0,
                                    "color": COLORS["accent"]
                                })
                                if is_lv_up:
                                    self.xp_popups.append({
                                        "text": f"RANK UP: {self.progression.rank}!",
                                        "x": cam_x + new_w // 2,
                                        "y": cam_y + new_h // 2 + 40,
                                        "timer": 3.0,
                                        "color": COLORS["success"]
                                    })
                            elif self.username != "Guest":
                                reason = "progression_unavailable"
                                if isinstance(completion_res, dict):
                                    reason = str(completion_res.get("reason", reason))
                                if not getattr(self, "_warned_authoritative_progression_unavailable", False):
                                    self.show_alert("Progression Sync", f"XP not awarded: {reason}")
                                    self._warned_authoritative_progression_unavailable = True

                            # STOP TIMER if in challenge
                            if self.game_mode == "challenge":
                                self.challenge_final_time = self.jutsu_start_time - self.challenge_start_time
                                self._challenge_append_event(
                                    "run_finish",
                                    final_time=round(float(self.challenge_final_time), 4),
                                    jutsu=str(jutsu_name).upper(),
                                )

                            mastery_info = self._record_mastery_completion(jutsu_name, clear_time)
                            if isinstance(mastery_info, dict) and mastery_info.get("improved", False):
                                self._queue_post_effect_alert(
                                    "mastery",
                                    {"jutsu_name": jutsu_name, "mastery_info": mastery_info},
                                    min_delay_s=0.7,
                                )

                            # For normal jutsu, fire completion payload here.
                            # Combo jutsus trigger payloads at configured checkpoints.
                            if not combo_parts:
                                self.play_sound("complete")
                                self._trigger_jutsu_payload(jutsu_name, jutsu_data.get("effect"))
                            else:
                                self.combo_triggered_steps = set()
        
        # (Camera dimensions already calculated at the top)
        
        # Update particles with correct screen position based on new scale
        mouth_screen = None
        if self.mouth_pos:
            mouth_screen = (
                cam_x + int(self.mouth_pos[0] * scale),
                cam_y + int(self.mouth_pos[1] * scale),
            )
        if self.fire_particles.emitting and self.mouth_pos:
            # Convert camera frame coords to screen coords
            # Landmark coords are normalized (0-1), multiplied by frame size in detect methods
            # Here self.mouth_pos is likely in frame pixels. 
            # We need to scale it.
            
            # Note: stored self.mouth_pos is raw frame pixels (640x480)
            screen_x, screen_y = mouth_screen
            self.fire_particles.set_position(screen_x, screen_y)
            aim_yaw = float(getattr(self, "head_yaw", 0.0) or 0.0)
            aim_pitch = -float(getattr(self, "head_pitch", 0.0) or 0.0)
            if hasattr(self.fire_particles, "set_aim"):
                self.fire_particles.set_aim(yaw=aim_yaw, pitch=aim_pitch)
            self.fire_particles.wind_x = aim_yaw * 210.0
        self.fire_particles.update(dt)
        self._update_phoenix_fireballs(dt, cam_x, cam_y, new_w, new_h, mouth_screen)
        self.effect_orchestrator.update(
            EffectContext(
                dt=dt,
                frame_bgr=frame,
                frame_shape=frame.shape,
                hand_pos=effect_hand_pos,
                mouth_pos=self.mouth_pos,
                left_eye_pos=self.left_eye_pos,
                right_eye_pos=self.right_eye_pos,
                left_eye_size=self.left_eye_size,
                right_eye_size=self.right_eye_size,
                left_eye_angle=self.left_eye_angle,
                right_eye_angle=self.right_eye_angle,
                head_yaw=float(getattr(self, "head_yaw", 0.0) or 0.0),
                head_pitch=float(getattr(self, "head_pitch", 0.0) or 0.0),
                cam_x=cam_x,
                cam_y=cam_y,
                scale_x=(new_w / max(1, frame_w)),
                scale_y=(new_h / max(1, frame_h)),
            )
        )
        
        # Check jutsu duration
        if self.jutsu_active:
            elapsed = time.time() - self.jutsu_start_time
            if elapsed > self.jutsu_duration:
                self.jutsu_active = False
                self.fire_particles.emitting = False
                self._stop_phoenix_fireballs()
                self.effect_orchestrator.on_jutsu_end(EffectContext())
                if getattr(self, "combo_clone_hold", False):
                    clone_effect = self.effect_orchestrator.effects.get("clone")
                    if clone_effect:
                        clone_effect.on_jutsu_end(EffectContext())
                    self.combo_clone_hold = False
                self.combo_chidori_triple = False
                self.combo_rasengan_triple = False
                self.current_video = None
                if self.video_cap:
                    self.video_cap.release()
                    self.video_cap = None
                
                # Check for results transition
                if self.game_mode == "challenge":
                    self.challenge_state = "results"

        # Delayed gameplay alerts (level up/mastery) should appear after effect ends.
        self._dispatch_post_effect_alerts()

        # Convert and display frame with alpha blending for dimming
        if self.game_mode == "challenge" and self.challenge_state in ["waiting", "countdown", "results"]:
            # Dim the camera frame
            frame = (frame.astype(np.float32) * 0.4).astype(np.uint8)
            
        cam_surface = self.cv2_to_pygame(frame)
        cam_surface = pygame.transform.smoothscale(cam_surface, (new_w, new_h))
        
        # UI Frame for camera feed
        pygame.draw.rect(self.screen, (30, 30, 40), (cam_x - 6, cam_y - 6, new_w + 12, new_h + 12), border_radius=14)
        pygame.draw.rect(self.screen, COLORS["border"], (cam_x - 6, cam_y - 6, new_w + 12, new_h + 12), 2, border_radius=14)
        
        self.screen.blit(cam_surface, (cam_x, cam_y))

        # ── "Show both hands" overlay (MediaPipe only, no effect, 2 s with only 1 hand) ──
        use_mp = bool(self.settings.get("use_mediapipe_signs", False))
        if use_mp and not self.jutsu_active:
            hands_now = int(getattr(self, "last_detected_hands", 0))
            if hands_now != 1:
                # 0 hands (idle) or 2+ hands both reset the timer — only 1 hand triggers it
                self._no_hands_since = time.time()
            else:
                # exactly 1 hand — start / keep the timer
                if not hasattr(self, "_no_hands_since") or self._no_hands_since is None:
                    self._no_hands_since = time.time()

                one_hand_secs = time.time() - self._no_hands_since
                if one_hand_secs >= 2.0:
                    # ── load + cache image at canvas size ──────────────────────
                    need_reload = (
                        not hasattr(self, "_hands_layout_surf")
                        or self._hands_layout_surf is None
                        or getattr(self, "_hands_layout_size", None) != (new_w, new_h)
                    )
                    if need_reload:
                        import os
                        _this_dir = os.path.dirname(os.path.abspath(__file__))
                        _project_root = os.path.normpath(os.path.join(_this_dir, "..", "..", ".."))
                        img_path = os.path.join(_project_root, "src", "pics", "hands_layout.png")
                        try:
                            raw = pygame.image.load(img_path).convert_alpha()
                            self._hands_layout_surf = pygame.transform.smoothscale(raw, (new_w, new_h))
                        except Exception:
                            self._hands_layout_surf = None
                        self._hands_layout_size = (new_w, new_h)

                    # overlay image — no tint, just the guide at ~70 % opacity
                    if self._hands_layout_surf:
                        img_surf = self._hands_layout_surf.copy()
                        img_surf.set_alpha(178)
                        self.screen.blit(img_surf, (cam_x, cam_y))

                    # "Show both hands" label
                    lbl_font = self.fonts.get("body") or self.fonts["title_sm"]
                    lbl = lbl_font.render("👐  Show both hands", True, (255, 235, 100))
                    lbl_bg = pygame.Surface((lbl.get_width() + 28, lbl.get_height() + 14), pygame.SRCALPHA)
                    pygame.draw.rect(lbl_bg, (10, 10, 20, 200), lbl_bg.get_rect(), border_radius=10)
                    pygame.draw.rect(lbl_bg, (200, 170, 30, 180), lbl_bg.get_rect(), 1, border_radius=10)
                    lx = cam_x + (new_w - lbl_bg.get_width()) // 2
                    ly = cam_y + new_h - lbl_bg.get_height() - 18
                    self.screen.blit(lbl_bg, (lx, ly))
                    self.screen.blit(lbl, (lx + 14, ly + 7))
        else:
            # reset timer when effect is playing or model is YOLO
            self._no_hands_since = None
        
        if self.jutsu_active:
            jutsu_name = self.jutsu_names[self.current_jutsu_idx]
            effect_name = str(self.jutsu_list[jutsu_name].get("effect") or "").strip().lower()

            if effect_name == "lightning":
                blue_overlay = pygame.Surface((new_w, new_h), pygame.SRCALPHA)
                blue_overlay.fill((0, 80, 150, 40))
                self.screen.blit(blue_overlay, (cam_x, cam_y))
            elif effect_name == "fire" and "phoenix" not in str(jutsu_name).strip().lower():
                now = time.time()
                pulse = 0.58 + 0.42 * math.sin(now * 15.5)

                heat_overlay = pygame.Surface((new_w, new_h), pygame.SRCALPHA)
                heat_overlay.fill((255, 90, 20, int(28 + 24 * pulse)))
                self.screen.blit(heat_overlay, (cam_x, cam_y))

                if mouth_screen:
                    fx, fy = mouth_screen
                elif self.mouth_pos:
                    fx = cam_x + int(self.mouth_pos[0] * scale)
                    fy = cam_y + int(self.mouth_pos[1] * scale)
                else:
                    fx = cam_x + new_w // 2
                    fy = cam_y + int(new_h * 0.62)

                aim_x = float(np.clip(float(getattr(self, "head_yaw", 0.0) or 0.0), -1.0, 1.0))
                aim_pitch = float(np.clip(-float(getattr(self, "head_pitch", 0.0) or 0.0), -1.0, 1.0))
                aim_y = -0.82 + aim_pitch * 1.05
                aim_norm = math.hypot(aim_x, aim_y)
                if aim_norm > 1e-6:
                    aim_x /= aim_norm
                    aim_y /= aim_norm
                else:
                    aim_x, aim_y = 0.0, -1.0

                breath = 0.68 + 0.32 * math.sin(now * 21.0 + 0.35)
                fx = int(fx + aim_x * 12.0)
                fy = int(fy + aim_y * 8.0 + math.sin(now * 17.0) * 2.0)

                for idx, (radius, alpha, color) in enumerate((
                    (int(78 * breath), 55, (255, 65, 18)),
                    (int(58 * breath), 80, (255, 120, 38)),
                    (int(36 * breath), 105, (255, 195, 88)),
                )):
                    rr = max(8, int(radius))
                    s = pygame.Surface((rr * 2, rr * 2), pygame.SRCALPHA)
                    pygame.draw.circle(s, (*color, alpha), (rr, rr), rr)
                    off_mul = idx * 0.24
                    ox = int(aim_x * rr * off_mul)
                    oy = int(aim_y * rr * off_mul)
                    self.screen.blit(s, (fx + ox - rr, fy + oy - rr), special_flags=pygame.BLEND_ADD)

                # Directional heat streak so the blast follows where the player looks.
                streak_len = int(46 + 36 * breath)
                for i in range(3):
                    t = (i + 1) / 3.0
                    tr = max(5, int(20 * (1.0 - t) + 7 * breath))
                    ta = max(0, min(160, int(120 - i * 28 + pulse * 18)))
                    tx = int(fx + aim_x * (14 + streak_len * t))
                    ty = int(fy + aim_y * (14 + streak_len * t))
                    trail = pygame.Surface((tr * 2, tr * 2), pygame.SRCALPHA)
                    pygame.draw.circle(trail, (255, 118, 34, ta), (tr, tr), tr)
                    self.screen.blit(trail, (tx - tr, ty - tr), special_flags=pygame.BLEND_ADD)

        
        # Fire particles
        self.fire_particles.render(self.screen)
        self._render_phoenix_fireballs()
        self.effect_orchestrator.render(
            self.screen,
            EffectContext(
                frame_bgr=frame,
                frame_shape=frame.shape,
                hand_pos=effect_hand_pos,
                mouth_pos=self.mouth_pos,
                left_eye_pos=self.left_eye_pos,
                right_eye_pos=self.right_eye_pos,
                left_eye_size=self.left_eye_size,
                right_eye_size=self.right_eye_size,
                left_eye_angle=self.left_eye_angle,
                right_eye_angle=self.right_eye_angle,
                head_yaw=float(getattr(self, "head_yaw", 0.0) or 0.0),
                head_pitch=float(getattr(self, "head_pitch", 0.0) or 0.0),
                cam_x=cam_x,
                cam_y=cam_y,
                scale_x=(new_w / max(1, frame_w)),
                scale_y=(new_h / max(1, frame_h)),
                font=self.fonts["tiny"],
                debug=self.settings.get("debug_hands", False),
            ),
        )
        
        # Timer Display (Challenge Mode Active) - Draw on top of frame but under results
        if self.game_mode == "challenge" and self.challenge_state == "active":
            if self.jutsu_active:
                elapsed = self.challenge_final_time
            else:
                elapsed = time.time() - self.challenge_start_time
            
            # Speedrun Style Timer
            time_str = f"{elapsed:.2f}s"
            t_txt = self.fonts["title_sm"].render(f"SPEED: {time_str}", True, (255, 255, 255))
            
            # Simple dark backing
            tw, th = t_txt.get_size()
            t_bg = pygame.Surface((tw + 24, th + 12), pygame.SRCALPHA)
            t_bg.fill((0, 0, 0, 140))
            pygame.draw.rect(t_bg, COLORS["accent"], t_bg.get_rect(), 1, border_radius=6)
            self.screen.blit(t_bg, (cam_x + 15, cam_y + 15))
            self.screen.blit(t_txt, (cam_x + 27, cam_y + 21))

        # --- Static Sign Prediction Label (Fixed Top-Right) ---
        if detected and str(detected).lower() != "idle":
            pred_txt = self.fonts["body"].render(f"SIGN: {detected.upper()}", True, (255, 255, 255))
            tw, th = pred_txt.get_size()
            
            # Label Panel (Top Right of cam)
            lx, ly = cam_x + new_w - tw - 30, cam_y + 15
            lp_rect = pygame.Rect(lx - 12, ly - 6, tw + 24, th + 12)
            
            # Glass effect for label
            lp_surf = pygame.Surface((lp_rect.width, lp_rect.height), pygame.SRCALPHA)
            pygame.draw.rect(lp_surf, (20, 20, 30, 200), (0, 0, lp_rect.width, lp_rect.height), border_radius=8)
            pygame.draw.rect(lp_surf, COLORS["success"], (0, 0, lp_rect.width, lp_rect.height), 1, border_radius=8)
            self.screen.blit(lp_surf, lp_rect)
            self.screen.blit(pred_txt, (lx, ly))

        # Detection diagnostics (quality gate + voting + calibration state)
        using_mp = bool(self.settings.get("use_mediapipe_signs", False))
        detector_name = "MEDIAPIPE" if using_mp else "YOLO"
        mp_backend = str(getattr(self, "hand_detector_backend", "none") or "none").upper().replace("_", " ")
        mp_error = str(getattr(self, "hand_detector_error", "") or "")
        light_color = COLORS["success"] if lighting_ok else COLORS["error"]
        light_text = self.lighting_status.replace("_", " ").upper()
        vote_text = f"VOTE {self.last_vote_hits}/{self.vote_window_size}"
        if self.calibration_active:
            progress = int(
                self._clamp(
                    ((time.time() - self.calibration_started_at) / max(0.001, self.calibration_duration_s)) * 100.0,
                    0.0,
                    100.0,
                )
            )
            calib_text = f"CALIBRATING {progress}%"
        else:
            calib_text = "PRESS C TO CALIBRATE"

        info_lines = [
            f"MODEL: {detector_name}",
            f"HANDS: {int(getattr(self, 'last_detected_hands', 0) or 0)}",
            f"STRICT 2H: {'ON' if self.settings.get('restricted_signs', False) else 'OFF'}",
            f"LIGHT: {light_text}",
            f"{vote_text} • {int(self.detected_confidence * 100)}%",
            calib_text,
        ]
        if using_mp:
            info_lines.insert(1, f"MP BACKEND: {mp_backend}")
            info_lines.append(
                f"RAW: {str(getattr(self, 'raw_detected_sign', 'idle')).upper()} {int(float(getattr(self, 'raw_detected_confidence', 0.0) or 0.0) * 100)}%"
            )
            if mp_error:
                info_lines.append(f"MP ERR: {mp_error[:46]}")
        if self.calibration_message and time.time() <= self.calibration_message_until:
            info_lines.append(self.calibration_message.upper())

        if getattr(self, "show_detection_panel", False):
            info_x = cam_x + 12
            info_y = cam_y + 14
            panel_w = 320
            panel_h = 22 + len(info_lines) * 18
            info_panel = pygame.Surface((panel_w, panel_h), pygame.SRCALPHA)
            pygame.draw.rect(info_panel, (20, 20, 30, 175), (0, 0, panel_w, panel_h), border_radius=10)
            pygame.draw.rect(info_panel, (80, 80, 110, 170), (0, 0, panel_w, panel_h), 1, border_radius=10)
            self.screen.blit(info_panel, (info_x, info_y))

            for idx, line in enumerate(info_lines):
                color = COLORS["text_dim"]
                if line.startswith("LIGHT:"):
                    color = light_color
                elif "CALIBRATING" in line:
                    color = COLORS["accent_glow"]
                elif line.startswith("VOTE"):
                    color = COLORS["text"]
                surf = self.fonts["tiny"].render(line, True, color)
                self.screen.blit(surf, (info_x + 10, info_y + 8 + idx * 17))

        # --- Challenge Overlays (Responsive) ---
        if self.game_mode == "challenge" and not is_locked:
            if self.challenge_state == "waiting":
                self._render_challenge_lobby(cam_x, cam_y, new_w, new_h)
            elif self.challenge_state == "countdown":
                self._render_challenge_countdown(cam_x, cam_y, new_w, new_h)
            elif self.challenge_state == "results":
                self._render_challenge_results(cam_x, cam_y, new_w, new_h)

        # Mastery/level-up panels are rendered at the very end of this method
        # (after all HUD) so the dim correctly covers the bottom bar too.

        # Sound Scheduler
        if hasattr(self, "pending_sounds") and self.pending_sounds:
            now = time.time()
            due = [s for s in self.pending_sounds if now >= s.get("time", now + 999)]
            self.pending_sounds = [s for s in self.pending_sounds if now < s.get("time", now + 999)]
            for s in due:
                self.play_sound(s.get("name", "each"))

        # Delayed effect scheduler (used for clone timing sync).
        if hasattr(self, "pending_effects") and self.pending_effects:
            now = time.time()
            due_fx = [e for e in self.pending_effects if now >= e.get("time", now + 999)]
            self.pending_effects = [e for e in self.pending_effects if now < e.get("time", now + 999)]
            for e in due_fx:
                self.effect_orchestrator.on_jutsu_start(
                    e.get("effect"),
                    EffectContext(
                        jutsu_name=e.get("jutsu_name"),
                        mouth_pos=self.mouth_pos,
                        head_yaw=float(getattr(self, "head_yaw", 0.0) or 0.0),
                        head_pitch=float(getattr(self, "head_pitch", 0.0) or 0.0),
                    ),
                )
        
        # Video overlay (for Chidori, Rasengan, etc.)
        if self.current_video and self.video_cap and self.video_cap.isOpened():
            ret, vid_frame = self.video_cap.read()
            if ret:
                current_video_name = str(self.current_video).lower()
                if current_video_name == "chidori":
                    base_size = 620
                elif current_video_name == "rasengan":
                    base_size = 520
                else:
                    base_size = 560
                scale_x = (new_w / max(1, frame_w))
                scale_y = (new_h / max(1, frame_h))

                # Track Hand
                if effect_hand_pos:
                    hx, hy = effect_hand_pos
                    hx = int(hx)
                    hy = int(hy)
                    dynamic_scale = float(getattr(self, "hand_effect_scale", 1.0) or 1.0)
                    size = int(base_size * dynamic_scale)
                    should_draw_effect = True
                else:
                    # No hand: hide effect until tracking returns.
                    should_draw_effect = False

                if should_draw_effect:
                    size = max(320, min(920, size))
                
                    # Calculate aspect ratio to avoid stretching
                    v_h, v_w = vid_frame.shape[:2]
                    aspect = v_w / v_h
                    
                    if aspect > 1: # Landscape
                        dw, dh = size, int(size / aspect)
                    else: # Portrait/Square
                        dw, dh = int(size * aspect), size
                    
                    # Resize video (Maintaining aspect ratio)
                    vid_frame = cv2.resize(vid_frame, (dw, dh))
                    
                    # Apply Radial Feathering (Removes hard square edges from video frame)
                    # Create coordinate grids
                    Y, X = np.ogrid[:dh, :dw]
                    center_x, center_y = dw // 2, dh // 2
                    # Normalized elliptical distance (0.0 at center, 1.0 at edges)
                    dist = np.sqrt(((X - center_x) / (dw / 2))**2 + ((Y - center_y) / (dh / 2))**2)
                    # Soft fade starting at 65% of the radius
                    mask = np.clip(1.0 - (dist - 0.65) / 0.35, 0, 1)
                    mask = (mask ** 1.5).astype(np.float32) # Smooth falloff
                    # Apply mask to RGB values
                    vid_frame = (vid_frame.astype(np.float32) * mask[:, :, np.newaxis]).astype(np.uint8)
                    
                    vid_frame = cv2.cvtColor(vid_frame, cv2.COLOR_BGR2RGB)
                    vid_frame = np.rot90(vid_frame)
                    vid_frame = np.flipud(vid_frame)
                    vid_surface = pygame.surfarray.make_surface(vid_frame)

                    # Blit centered on hand with additive blending.
                    if (
                        (getattr(self, "combo_chidori_triple", False) and current_video_name == "chidori")
                        or
                        (getattr(self, "combo_rasengan_triple", False) and current_video_name == "rasengan")
                    ):
                        clone_dx_screen = 0
                        clone_effect = self.effect_orchestrator.effects.get("clone")
                        if clone_effect is not None:
                            clone_dx_screen = int(max(0.0, float(getattr(clone_effect, "current_dx_px", 0.0))) * scale_x)
                            if clone_dx_screen <= 0:
                                clone_dx_ratio = float(getattr(clone_effect, "clone_dx_ratio", 0.28))
                                clone_dx_screen = int(max(0.0, clone_dx_ratio) * new_w)
                        if clone_dx_screen <= 0:
                            clone_dx_screen = int(new_w * 0.28)
                        offsets = [(-clone_dx_screen, 0), (0, 0), (clone_dx_screen, 0)]
                    else:
                        offsets = [(0, 0)]
                    # Hand anchors are in camera-frame coordinates; project them to screen-space.
                    hand_screen_x = cam_x + int(hx * scale_x)
                    hand_screen_y = cam_y + int(hy * scale_y)
                    for ox, oy in offsets:
                        self.screen.blit(
                            vid_surface,
                            (hand_screen_x - dw // 2 + ox, hand_screen_y - dh // 2 + oy),
                            special_flags=pygame.BLEND_RGB_ADD,
                        )
            else:
                # Video ended, loop it
                self.video_cap.set(cv2.CAP_PROP_POS_FRAMES, 0)
        
        # Progression HUD (MMO Style Top Bar)
        hud_h = 45
        hud_bg = pygame.Surface((SCREEN_WIDTH, hud_h), pygame.SRCALPHA)
        hud_bg.fill((20, 20, 25, 230))
        self.screen.blit(hud_bg, (0, 0))
        pygame.draw.line(self.screen, COLORS["border"], (0, hud_h), (SCREEN_WIDTH, hud_h), 1)

        # Level Badge
        badge_txt = f"{self.progression.rank} • LV.{self.progression.level}"
        badge_surf = self.fonts["body"].render(badge_txt, True, (255, 255, 255))
        self.screen.blit(badge_surf, (20, (hud_h - badge_surf.get_height()) // 2))

        # XP Bar (Centered Top)
        bar_w = 400
        bar_x = (SCREEN_WIDTH - bar_w) // 2
        bar_y = (hud_h - 12) // 2 + 2
        
        prev_lv_xp = self.progression.get_xp_for_level(self.progression.level)
        next_lv_xp = self.progression.get_xp_for_level(self.progression.level + 1)
        progress = (self.progression.xp - prev_lv_xp) / max(1, (next_lv_xp - prev_lv_xp))
        progress = max(0, min(1, progress))

        pygame.draw.rect(self.screen, (40, 40, 50), (bar_x, bar_y, bar_w, 10), border_radius=5)
        if progress > 0:
            pygame.draw.rect(self.screen, COLORS["accent"], (bar_x, bar_y, bar_w * progress, 10), border_radius=5)
            # Gloss
            pygame.draw.rect(self.screen, (255, 255, 255, 30), (bar_x, bar_y, bar_w * progress, 5), border_radius=5)

        xp_progress = int(self.progression.xp - prev_lv_xp)
        xp_required = int(next_lv_xp - prev_lv_xp)
        xp_txt = f"{xp_progress} / {xp_required} XP"
        xp_surf = self.fonts["tiny"].render(xp_txt, True, COLORS["text_dim"])
        self.screen.blit(xp_surf, (bar_x + bar_w + 10, bar_y - 3))

        # XP Popups
        for popup in self.xp_popups[:]:
            popup["timer"] -= dt
            if popup["timer"] <= 0:
                self.xp_popups.remove(popup)
                continue
            
            # Float up
            popup["y"] -= 40 * dt
            # Fade out
            alpha = int(min(255, popup["timer"] * 255))
            
            p_surf = self.fonts["title_sm"].render(popup["text"], True, popup["color"])
            p_surf.set_alpha(alpha)
            self.screen.blit(p_surf, p_surf.get_rect(center=(popup["x"], popup["y"])))

        # Icon bar
        # If locked, don't show sequence icons but a lock message
        if is_locked:
            lock_msg = self.fonts["body"].render(f"REQUIRED RANK: LV.{min_lv}", True, COLORS["error"])
            self.screen.blit(lock_msg, lock_msg.get_rect(center=(cam_x + new_w // 2, cam_y + new_h + 40)))
        else:
            self._render_icon_bar(cam_x, cam_y + new_h + 10, new_w)
        
        # Move Title (Styled Capsule)
        display_name = current_jutsu_name.upper() if not is_locked else "??????"
        text_color = (255, 255, 255) if not is_locked else (100, 100, 100)
        
        name_surf = self.fonts["title_sm"].render(display_name, True, text_color)
        tw, th = name_surf.get_size()
        
        padding_x, padding_y = 35, 10
        title_rect = pygame.Rect(cam_x + (new_w - tw - padding_x*2)//2, cam_y - 48, tw + padding_x*2, th + padding_y*2)
        
        if not is_locked:
            # Subtle Glow
            glow_rect = title_rect.inflate(6, 6)
            glow_surf = pygame.Surface((glow_rect.width, glow_rect.height), pygame.SRCALPHA)
            pygame.draw.rect(glow_surf, (249, 115, 22, 30), (0, 0, glow_rect.width, glow_rect.height), border_radius=20)
            self.screen.blit(glow_surf, glow_rect)
            
            pygame.draw.rect(self.screen, (20, 20, 25), title_rect, border_radius=18)
            pygame.draw.rect(self.screen, COLORS["accent"], title_rect, 2, border_radius=18)
        else:
            # Grayed out for locked
            pygame.draw.rect(self.screen, (25, 25, 30), title_rect, border_radius=18)
            pygame.draw.rect(self.screen, (60, 60, 70), title_rect, 2, border_radius=18)

        self.screen.blit(name_surf, (title_rect.centerx - tw//2, title_rect.centery - th//2))
        
        # FPS Counter (Styled)
        self.frame_count += 1
        if time.time() - self.fps_timer >= 1.0:
            self.fps = self.frame_count
            self.frame_count = 0
            self.fps_timer = time.time()
        
        fps_txt = f"FPS: {self.fps}"
        fps_surf = self.fonts["tiny"].render(fps_txt, True, COLORS["success"])
        self.screen.blit(fps_surf, (cam_x + new_w - fps_surf.get_width() - 5, cam_y - 18))

        # HUD toggles (outside camera zone): model switch + diagnostics panel.
        top_controls_y = hud_h + 8
        self.model_toggle_rect = pygame.Rect(SCREEN_WIDTH - 334, top_controls_y, 182, 30)
        self.diag_toggle_rect  = pygame.Rect(SCREEN_WIDTH - 142, top_controls_y, 126, 30)
        mouse_pos = pygame.mouse.get_pos()
        model_hover = self.model_toggle_rect.collidepoint(mouse_pos)
        diag_hover  = self.diag_toggle_rect.collidepoint(mouse_pos)

        # [i] info button sits to the LEFT of the model toggle
        info_btn_size = 22
        info_btn_rect = pygame.Rect(
            self.model_toggle_rect.left - info_btn_size - 6,
            top_controls_y + (30 - info_btn_size) // 2,
            info_btn_size, info_btn_size,
        )
        self._model_info_rect = info_btn_rect
        info_hover = info_btn_rect.collidepoint(mouse_pos)

        if model_hover or diag_hover or info_hover:
            pygame.mouse.set_cursor(pygame.SYSTEM_CURSOR_HAND)

        use_mediapipe = bool(self.settings.get("use_mediapipe_signs", False))
        model_btn_col = COLORS["bg_hover"] if model_hover else COLORS["bg_card"]
        model_border  = COLORS["success"] if use_mediapipe else COLORS["accent"]
        pygame.draw.rect(self.screen, model_btn_col, self.model_toggle_rect, border_radius=8)
        pygame.draw.rect(self.screen, model_border,  self.model_toggle_rect, 1, border_radius=8)
        model_text = "MODEL: MEDIAPIPE" if use_mediapipe else "MODEL: YOLO"
        model_surf = self.fonts["small"].render(model_text, True, COLORS["text"])
        self.screen.blit(model_surf, model_surf.get_rect(center=self.model_toggle_rect.center))

        # Draw [i] circle
        i_col  = (100, 160, 255) if info_hover else (70, 110, 200)
        i_bg   = (25, 35, 60)    if info_hover else (18, 24, 45)
        pygame.draw.circle(self.screen, i_bg,  info_btn_rect.center, info_btn_size // 2)
        pygame.draw.circle(self.screen, i_col, info_btn_rect.center, info_btn_size // 2, 1)
        i_surf = self.fonts["tiny"].render("i", True, i_col)
        self.screen.blit(i_surf, i_surf.get_rect(center=info_btn_rect.center))

        btn_col = COLORS["bg_hover"] if diag_hover else COLORS["bg_card"]
        pygame.draw.rect(self.screen, btn_col,         self.diag_toggle_rect, border_radius=8)
        pygame.draw.rect(self.screen, COLORS["border"], self.diag_toggle_rect, 1, border_radius=8)
        diag_text = "DIAG: ON" if getattr(self, "show_detection_panel", False) else "DIAG: OFF"
        diag_surf = self.fonts["small"].render(diag_text, True, COLORS["text"])
        self.screen.blit(diag_surf, diag_surf.get_rect(center=self.diag_toggle_rect.center))
        
        # Navigation arrows - Only show if not active and (if challenge) in waiting room
        show_nav = not self.jutsu_active
        if self.game_mode == "challenge" and self.challenge_state != "waiting":
            show_nav = False
            
        if show_nav:
            mouse_pos = pygame.mouse.get_pos()
            arrow_y = cam_y + new_h // 2 - 30
            
            # MODERN ARROWS: Semi-transparent circular buttons
            # Left Button
            l_btn_rect = pygame.Rect(cam_x - 70, arrow_y, 50, 60)
            self.left_arrow_rect = l_btn_rect
            l_hover = l_btn_rect.collidepoint(mouse_pos)
            
            l_alpha = 200 if l_hover else 120
            l_surf = pygame.Surface((50, 60), pygame.SRCALPHA)
            pygame.draw.rect(l_surf, (20, 20, 25, l_alpha), (0, 0, 50, 60), border_radius=10)
            pygame.draw.rect(l_surf, (*COLORS["accent"], l_alpha), (0, 0, 50, 60), 2, border_radius=10)
            
            # Triangle icon
            p1, p2, p3 = (35, 15), (15, 30), (35, 45)
            pygame.draw.polygon(l_surf, (255, 255, 255, l_alpha), [p1, p2, p3])
            self.screen.blit(l_surf, l_btn_rect)
            if l_hover: pygame.mouse.set_cursor(pygame.SYSTEM_CURSOR_HAND)

            # Right Button
            r_btn_rect = pygame.Rect(cam_x + new_w + 20, arrow_y, 50, 60)
            self.right_arrow_rect = r_btn_rect
            r_hover = r_btn_rect.collidepoint(mouse_pos)
            
            r_alpha = 200 if r_hover else 120
            r_surf = pygame.Surface((50, 60), pygame.SRCALPHA)
            pygame.draw.rect(r_surf, (20, 20, 25, r_alpha), (0, 0, 50, 60), border_radius=10)
            pygame.draw.rect(r_surf, (*COLORS["accent"], r_alpha), (0, 0, 50, 60), 2, border_radius=10)
            
            # Triangle icon
            p1, p2, p3 = (15, 15), (35, 30), (15, 45)
            pygame.draw.polygon(r_surf, (255, 255, 255, r_alpha), [p1, p2, p3])
            self.screen.blit(r_surf, r_btn_rect)
            if r_hover: pygame.mouse.set_cursor(pygame.SYSTEM_CURSOR_HAND)
            

        else:
            if hasattr(self, "left_arrow_rect"): del self.left_arrow_rect
            if hasattr(self, "right_arrow_rect"): del self.right_arrow_rect
        
        # ESC hint + calibrate hint (always visible, bottom bar)
        hint = self.fonts["body_sm"].render("Press ESC to exit", True, COLORS["text_muted"])
        self.screen.blit(hint, (SCREEN_WIDTH // 2 - hint.get_width() // 2, SCREEN_HEIGHT - 30))

        cal_hint = self.fonts["body_sm"].render("[C] Calibrate", True, COLORS["text_muted"])
        self.screen.blit(cal_hint, (SCREEN_WIDTH - cal_hint.get_width() - 16, SCREEN_HEIGHT - 30))

        if hasattr(self, "playing_back_button"):
            self.playing_back_button.render(self.screen)

        # ── Modal overlays drawn LAST so dim covers entire screen including HUD ─
        if getattr(self, "mastery_panel_data", None):
            still_open = self._render_mastery_panel(cam_x, cam_y, new_w, new_h)
            if not still_open:
                self.mastery_panel_data = None

        # Level-up panel shown after mastery clears (or standalone)
        if getattr(self, "level_up_panel_data", None) and not getattr(self, "mastery_panel_data", None):
            still_open = self._render_level_up_panel()
            if not still_open:
                self.level_up_panel_data = None

    def _render_mastery_panel(self, cam_x, cam_y, cam_w, cam_h):
        """Render a rich mastery-unlock modal overlay. Returns True while open."""
        data = getattr(self, "mastery_panel_data", None)
        if not isinstance(data, dict):
            return False

        jutsu_name  = str(data.get("jutsu_name", "Jutsu"))
        info        = data.get("mastery_info", {})
        new_best    = float(info.get("new_best", 0.0))
        prev_best   = info.get("previous_best")
        new_tier    = str(info.get("new_tier",  "none")).lower()
        thresholds  = info.get("thresholds", {})
        first_rec   = bool(info.get("first_record", False))
        tier_changed = str(info.get("new_tier", "none")) != str(info.get("previous_tier", "none"))

        # ── Animation progress (ease-out-cubic) ───────────────────────────────
        ANIM_TIME  = 1.2   # seconds for bar + time fill
        opened_at  = float(data.get("opened_at", time.time()))
        elapsed    = time.time() - opened_at
        t_raw      = min(1.0, elapsed / ANIM_TIME)
        ease       = 1.0 - (1.0 - t_raw) ** 3   # ease-out cubic

        # Animated display time (counts up from 0 → new_best in ANIM_TIME)
        display_time = new_best * ease

        # ── Dim whole screen ───────────────────────────────────────────────────
        dim = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
        dim.fill((0, 0, 0, 170))
        self.screen.blit(dim, (0, 0))

        # ── Card geometry ──────────────────────────────────────────────────────
        CW, CH = min(cam_w - 20, 440), min(cam_h - 40, 420)
        cx = cam_x + (cam_w - CW) // 2
        cy = cam_y + (cam_h - CH) // 2

        card_surf = pygame.Surface((CW, CH), pygame.SRCALPHA)
        pygame.draw.rect(card_surf, (18, 14, 10, 235), (0, 0, CW, CH), border_radius=20)
        self.screen.blit(card_surf, (cx, cy))
        pygame.draw.rect(self.screen, (180, 110, 30), (cx, cy, CW, CH), 2, border_radius=20)
        pygame.draw.rect(self.screen, (255, 200, 80, 40), (cx + 2, cy + 2, CW - 4, CH - 4), 1, border_radius=19)

        y_cur = cy + 20

        # ── Title ──────────────────────────────────────────────────────────────
        title_col  = (255, 220, 80)
        t_font     = self.fonts.get("title_md") or self.fonts["title_sm"]
        title_text = "MASTERY UNLOCKED" if tier_changed or first_rec else "NEW BEST!"
        title_surf = t_font.render(title_text, True, title_col)
        self.screen.blit(title_surf, title_surf.get_rect(centerx=cx + CW // 2, top=y_cur))
        y_cur += title_surf.get_height() + 4

        # ── Jutsu name ─────────────────────────────────────────────────────────
        name_surf = self.fonts["body"].render(jutsu_name, True, (200, 180, 130))
        self.screen.blit(name_surf, name_surf.get_rect(centerx=cx + CW // 2, top=y_cur))
        y_cur += name_surf.get_height() + 8

        # ── Big animated time ──────────────────────────────────────────────────
        big_font  = self.fonts.get("title_lg") or self.fonts["title_md"]
        time_str  = f"{display_time:.2f}s"
        time_surf = big_font.render(time_str, True, (255, 245, 200))
        self.screen.blit(time_surf, time_surf.get_rect(centerx=cx + CW // 2, top=y_cur))
        y_cur += time_surf.get_height() + 2

        sub_text = "New best" if prev_best is not None else "First record!"
        nb_lbl   = self.fonts["body_sm"].render(sub_text, True, (160, 220, 160))
        self.screen.blit(nb_lbl, nb_lbl.get_rect(centerx=cx + CW // 2, top=y_cur))
        y_cur += nb_lbl.get_height() + 10

        # ── Tier badge pill ────────────────────────────────────────────────────
        TIER_COLS  = {"bronze": (196, 128, 60), "silver": (180, 190, 200), "gold": (255, 200, 40), "none": (100, 100, 100)}
        tier_col   = TIER_COLS.get(new_tier, TIER_COLS["none"])
        badge_icon = self.mastery_icons.get(new_tier, self.mastery_icons.get("none"))

        pill_w, pill_h = 240, 38
        pill_x = cx + (CW - pill_w) // 2
        pill_surf = pygame.Surface((pill_w, pill_h), pygame.SRCALPHA)
        pygame.draw.rect(pill_surf, (*tier_col, 40),  (0, 0, pill_w, pill_h), border_radius=19)
        pygame.draw.rect(pill_surf, (*tier_col, 200), (0, 0, pill_w, pill_h), 2, border_radius=19)
        self.screen.blit(pill_surf, (pill_x, y_cur))

        if badge_icon:
            big_badge = pygame.transform.smoothscale(badge_icon, (32, 32))
            self.screen.blit(big_badge, (pill_x + 10, y_cur + 3))

        tier_label = new_tier.upper() if new_tier != "none" else "UNRANKED"
        tier_surf  = self.fonts["title_sm"].render(tier_label, True, tier_col)
        self.screen.blit(tier_surf, tier_surf.get_rect(midleft=(pill_x + 50, y_cur + pill_h // 2)))
        if tier_changed or first_rec:
            unlk = self.fonts["body_sm"].render("Unlocked!", True, (200, 255, 180))
            self.screen.blit(unlk, unlk.get_rect(midright=(pill_x + pill_w - 10, y_cur + pill_h // 2)))
        y_cur += pill_h + 6

        # ── Delta ──────────────────────────────────────────────────────────────
        if prev_best is not None:
            delta     = new_best - prev_best
            delta_col = (100, 230, 120) if delta < 0 else (230, 110, 80)
            
            d_surf = self.fonts["body_sm"].render(f" {abs(delta):.2f}s", True, delta_col)
            d_rect = d_surf.get_rect(centerx=cx + CW // 2, top=y_cur)
            self.screen.blit(d_surf, d_rect)
            
            # Draw triangle manually
            tri_w = 12
            tri_h = 10
            tri_x = d_rect.left - tri_w + 2
            tri_y = d_rect.centery - tri_h // 2
            
            if delta < 0: # Green Up Arrow
                pygame.draw.polygon(self.screen, delta_col, [
                    (tri_x + tri_w // 2, tri_y), 
                    (tri_x + tri_w, tri_y + tri_h), 
                    (tri_x, tri_y + tri_h)
                ])
            else: # Red Down Arrow
                pygame.draw.polygon(self.screen, delta_col, [
                    (tri_x, tri_y), 
                    (tri_x + tri_w, tri_y), 
                    (tri_x + tri_w // 2, tri_y + tri_h)
                ])
                
            y_cur += d_surf.get_height() + 8
        else:
            y_cur += 6

        # ── Progress bar (animated fill from left) ────────────────────────────
        bronze_t = float(thresholds.get("bronze", new_best + 1))
        silver_t = float(thresholds.get("silver", new_best + 0.5))
        gold_t   = float(thresholds.get("gold",   new_best))

        bar_x  = cx + 28
        bar_w  = CW - 56
        bar_y  = y_cur + 22

        lo, hi = gold_t, bronze_t
        span   = max(0.001, hi - lo)

        def t_to_x(t):
            frac = (hi - t) / span   # 0=bronze end, 1=gold end
            return bar_x + int(frac * bar_w)

        target_fill_x = t_to_x(max(gold_t, min(bronze_t, new_best)))
        full_fill_len  = target_fill_x - bar_x
        anim_fill_len  = int(full_fill_len * ease)   # grows from 0 → full_fill_len

        # Track background
        pygame.draw.rect(self.screen, (50, 40, 30), (bar_x, bar_y, bar_w, 8), border_radius=4)
        # Animated coloured fill
        if anim_fill_len > 0:
            pygame.draw.rect(self.screen, tier_col, (bar_x, bar_y, anim_fill_len, 8), border_radius=4)

        # Milestone dots (always visible so you can see targets)
        milestones = [(bronze_t, "bronze"), (silver_t, "silver"), (gold_t, "gold")]
        for mt, ml in milestones:
            mx = t_to_x(mt)
            mc = TIER_COLS.get(ml, (120, 120, 120))
            pygame.draw.circle(self.screen, mc, (mx, bar_y + 4), 7)
            lbl = self.fonts["tiny"].render(f"{mt:.1f}s", True, (180, 160, 120))
            off_y = -16 if ml == "silver" else 12
            self.screen.blit(lbl, lbl.get_rect(centerx=mx, top=bar_y + 4 + off_y))

        # Moving marker dot that travels with the animation
        if anim_fill_len > 0:
            marker_x = bar_x + anim_fill_len
            pygame.draw.circle(self.screen, (255, 160, 40),  (marker_x, bar_y + 4), 9)
            pygame.draw.circle(self.screen, (255, 240, 160), (marker_x, bar_y + 4), 4)

        y_cur = bar_y + 30

        # ── Next tier hint ─────────────────────────────────────────────────────
        next_map = {"none": ("BRONZE", bronze_t), "bronze": ("SILVER", silver_t),
                    "silver": ("GOLD", gold_t), "gold": None}
        nxt = next_map.get(new_tier)
        if nxt:
            nxt_name, nxt_t = nxt
            gap  = new_best - nxt_t
            hint = self.fonts["body_sm"].render(
                f"Next: {nxt_name} ({nxt_t:.2f}s)  ─  {gap:.2f}s to go", True, (180, 160, 110)
            )
            self.screen.blit(hint, hint.get_rect(centerx=cx + CW // 2, top=y_cur))
        y_cur += 22

        # ── Continue button (full-width) ───────────────────────────────────────
        btn_y   = cy + CH - 58
        btn_h   = 44
        cont_rect = pygame.Rect(cx + 30, btn_y, CW - 60, btn_h)

        mouse    = pygame.mouse.get_pos()
        cont_hov = cont_rect.collidepoint(mouse)
        if cont_hov:
            pygame.mouse.set_cursor(pygame.SYSTEM_CURSOR_HAND)

        cont_col = (200, 115, 20) if cont_hov else (170, 90, 15)
        pygame.draw.rect(self.screen, cont_col, cont_rect, border_radius=12)
        pygame.draw.rect(self.screen, (255, 190, 60), cont_rect, 1, border_radius=12)
        ct = self.fonts["body"].render("Continue", True, (255, 255, 255))
        self.screen.blit(ct, ct.get_rect(center=cont_rect.center))

        self._mastery_cont_rect = cont_rect
        if hasattr(self, "_mastery_retry_rect"):
            del self._mastery_retry_rect   # no longer used
        return True  # Panel stays open

    def _render_level_up_panel(self):
        """Render a rich Level Up modal overlay. Returns True while open."""
        data = getattr(self, "level_up_panel_data", None)
        if not isinstance(data, dict):
            return False

        prev_lv      = int(data.get("previous_level", 1))
        new_lv       = int(data.get("new_level", prev_lv + 1))
        rank         = str(data.get("rank", ""))
        unlocked     = list(data.get("newly_unlocked", []))
        source_label = str(data.get("source_label", ""))
        opened_at    = float(data.get("opened_at", time.time()))

        # ── Animation (ease-out cubic, 1.2 s) ─────────────────────────────────
        ANIM_T  = 1.2
        elapsed = time.time() - opened_at
        t_raw   = min(1.0, elapsed / ANIM_T)
        ease    = 1.0 - (1.0 - t_raw) ** 3
        disp_lv = prev_lv + (new_lv - prev_lv) * ease   # counts up

        # ── Full-screen dim (drawn last in render_playing, so it covers HUD) ──
        dim = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
        dim.fill((0, 0, 0, 190))
        self.screen.blit(dim, (0, 0))

        # ── Card ──────────────────────────────────────────────────────────────
        CW = min(460, SCREEN_WIDTH - 80)
        CH = min(480, SCREEN_HEIGHT - 80)
        cx = (SCREEN_WIDTH - CW) // 2
        cy = (SCREEN_HEIGHT - CH) // 2

        card = pygame.Surface((CW, CH), pygame.SRCALPHA)
        pygame.draw.rect(card, (12, 10, 18, 245), (0, 0, CW, CH), border_radius=22)
        self.screen.blit(card, (cx, cy))
        pygame.draw.rect(self.screen, (200, 160, 40), (cx, cy, CW, CH), 2, border_radius=22)
        pygame.draw.rect(self.screen, (255, 220, 80, 30), (cx+2, cy+2, CW-4, CH-4), 1, border_radius=21)

        y_cur = cy + 16

        # ── Star burst decoration ──────────────────────────────────────────────
        star_y = y_cur + 8
        for i in range(7):
            sx = cx + 28 + i * ((CW - 56) // 6)
            r  = 3 if i % 2 == 0 else 5
            pygame.draw.circle(self.screen, (255, 210, 60), (sx, star_y), r)
        y_cur += 12

        # ── "✦  LEVEL UP  ✦" banner ───────────────────────────────────────────
        t_font    = self.fonts.get("title_md") or self.fonts["title_sm"]
        banner    = t_font.render("  LEVEL UP  ", True, (255, 210, 60))
        self.screen.blit(banner, banner.get_rect(centerx=cx + CW // 2, top=y_cur))
        y_cur += banner.get_height() + 4

        # Source sub-label (e.g. "Jutsu Clear")
        if source_label:
            sl = self.fonts["body_sm"].render(source_label, True, (160, 150, 120))
            self.screen.blit(sl, sl.get_rect(centerx=cx + CW // 2, top=y_cur))
            y_cur += sl.get_height() + 2

        # ── Animated giant level number ────────────────────────────────────────
        big_font  = self.fonts.get("title_lg") or self.fonts["title_md"]
        lv_str    = f"LV.{int(disp_lv)}"
        glow_surf = big_font.render(lv_str, True, (160, 100, 10))
        lv_surf   = big_font.render(lv_str, True, (255, 245, 180))
        for dx, dy in [(-2, 2), (2, 2), (0, 3)]:
            self.screen.blit(glow_surf, glow_surf.get_rect(centerx=cx + CW // 2 + dx, top=y_cur + dy))
        self.screen.blit(lv_surf, lv_surf.get_rect(centerx=cx + CW // 2, top=y_cur))
        y_cur += lv_surf.get_height() + 2

        # LV prev → new small label
        arrow_s = self.fonts["body_sm"].render(
            f"LV.{prev_lv}  ->  LV.{new_lv}", True, (180, 165, 120)
        )
        self.screen.blit(arrow_s, arrow_s.get_rect(centerx=cx + CW // 2, top=y_cur))
        y_cur += arrow_s.get_height() + 8

        # ── Rank badge pill — width auto-fitted to text ────────────────────────
        if rank:
            rank_upper = rank.upper()
            # Try title_sm first; if it overflows the card, fall back to body_sm
            r_font = self.fonts["title_sm"]
            r_surf = r_font.render(rank_upper, True, (255, 220, 80))
            if r_surf.get_width() > CW - 80:
                r_font = self.fonts.get("body_sm") or self.fonts["title_sm"]
                r_surf = r_font.render(rank_upper, True, (255, 220, 80))

            pill_pad  = 28                              # horizontal padding inside pill
            pill_h    = 36
            pill_w    = min(CW - 40, r_surf.get_width() + pill_pad * 2)
            pill_x    = cx + (CW - pill_w) // 2
            pill_bg   = pygame.Surface((pill_w, pill_h), pygame.SRCALPHA)
            pygame.draw.rect(pill_bg, (200, 160, 40, 35),  (0, 0, pill_w, pill_h), border_radius=18)
            pygame.draw.rect(pill_bg, (200, 160, 40, 180), (0, 0, pill_w, pill_h), 2, border_radius=18)
            self.screen.blit(pill_bg, (pill_x, y_cur))
            self.screen.blit(r_surf, r_surf.get_rect(center=(pill_x + pill_w // 2, y_cur + pill_h // 2)))
            y_cur += pill_h + 8

        # ── Newly unlocked jutsu chips ─────────────────────────────────────────
        if unlocked:
            # Use a smaller font key for header to avoid wrapping
            hdr_font = self.fonts.get("tiny") or self.fonts["body_sm"]
            hdr = hdr_font.render("- NEW JUTSU UNLOCKED -", True, (140, 215, 155))
            self.screen.blit(hdr, hdr.get_rect(centerx=cx + CW // 2, top=y_cur))
            y_cur += hdr.get_height() + 4

            chip_h   = 26
            chip_gap = 5
            show_chips = unlocked[:3]
            remaining  = len(unlocked) - 3

            for jutsu in show_chips:
                chip_font = self.fonts.get("body_sm") or self.fonts["body"]
                jt_surf   = chip_font.render(jutsu, True, (180, 255, 200))
                chip_w    = min(CW - 40, jt_surf.get_width() + 24)
                chip_x    = cx + (CW - chip_w) // 2
                chip_bg   = pygame.Surface((chip_w, chip_h), pygame.SRCALPHA)
                pygame.draw.rect(chip_bg, (50, 170, 80, 40),  (0, 0, chip_w, chip_h), border_radius=13)
                pygame.draw.rect(chip_bg, (70, 200, 100, 180), (0, 0, chip_w, chip_h), 1, border_radius=13)
                self.screen.blit(chip_bg, (chip_x, y_cur))
                self.screen.blit(jt_surf, jt_surf.get_rect(center=(chip_x + chip_w // 2, y_cur + chip_h // 2)))
                y_cur += chip_h + chip_gap

            if remaining > 0:
                more = self.fonts["tiny"].render(f"+ {remaining} more", True, (140, 160, 140))
                self.screen.blit(more, more.get_rect(centerx=cx + CW // 2, top=y_cur))
                y_cur += more.get_height() + 4

        # ── "AWESOME!" Continue button ─────────────────────────────────────────
        btn_h  = 46
        btn_y  = cy + CH - 62
        cont_rect = pygame.Rect(cx + 30, btn_y, CW - 60, btn_h)
        mouse     = pygame.mouse.get_pos()
        hov       = cont_rect.collidepoint(mouse)
        if hov:
            pygame.mouse.set_cursor(pygame.SYSTEM_CURSOR_HAND)

        col = (215, 125, 20) if hov else (165, 85, 10)
        pygame.draw.rect(self.screen, col,           cont_rect, border_radius=13)
        pygame.draw.rect(self.screen, (255, 200, 60), cont_rect, 1, border_radius=13)
        ct = self.fonts["body"].render("AWESOME!", True, (255, 255, 255))
        self.screen.blit(ct, ct.get_rect(center=cont_rect.center))

        self._level_up_cont_rect = cont_rect
        return True
    def _render_icon_bar(self, x, y, bar_w):
        """Render the jutsu sequence icon bar with dynamic scaling."""
        n = len(self.sequence)
        max_icon_size = 80
        gap = 12
        max_total_w = bar_w - 30 # padding within frame
        
        # Calculate optimal icon size
        icon_size = max_icon_size
        total_w = n * icon_size + (n - 1) * gap
        
        if total_w > max_total_w:
            icon_size = (max_total_w - (n - 1) * gap) // n
            icon_size = max(40, icon_size) 
            total_w = n * icon_size + (n - 1) * gap
            
        start_x = x + (bar_w - total_w) // 2
        
        # Background panel (Responsive)
        panel_h = 135
        panel_rect = pygame.Rect(x, y, bar_w, panel_h)
        # Deep translucent background
        panel_surf = pygame.Surface((bar_w, panel_h), pygame.SRCALPHA)
        pygame.draw.rect(panel_surf, (20, 20, 30, 240), (0, 0, bar_w, panel_h), border_radius=15)
        self.screen.blit(panel_surf, (x, y))
        pygame.draw.rect(self.screen, COLORS["border"], (x, y, bar_w, panel_h), 2, border_radius=15)
        
        # Status text
        icon_y_start = y + 45
        progress_step = n if self.jutsu_active else self.current_step
        if self.jutsu_active:
            display = self.jutsu_list[self.jutsu_names[self.current_jutsu_idx]].get("display_text", "")
            if display:
                status = self.fonts["body"].render(f"CASTING • {display.upper()}", True, COLORS["accent_glow"])
            else:
                status = self.fonts["body"].render("CASTING...", True, COLORS["accent_glow"])
        else:
            target = self.sequence[self.current_step] if self.current_step < len(self.sequence) else ""
            status = self.fonts["body"].render(f"NEXT SIGN: {target.upper()}", True, (255, 255, 255))
        
        status_rect = status.get_rect(center=(x + bar_w // 2, y + 22))
        self.screen.blit(status, status_rect)
        
        # Icons
        for i, sign in enumerate(self.sequence):
            ix = start_x + i * (icon_size + gap)
            
            # Center icons vertically if they are smaller than max
            iy = icon_y_start + (80 - icon_size) // 2
            
            # Border
            if i < progress_step:
                if self.jutsu_active:
                    glow_rect = pygame.Rect(ix - 8, iy - 8, icon_size + 16, icon_size + 16)
                    glow = pygame.Surface((glow_rect.width, glow_rect.height), pygame.SRCALPHA)
                    pygame.draw.rect(glow, (255, 190, 80, 55), glow.get_rect(), border_radius=12)
                    self.screen.blit(glow, glow_rect)
                    pygame.draw.rect(self.screen, (255, 206, 120), (ix - 4, iy - 4, icon_size + 8, icon_size + 8), border_radius=10)
                else:
                    pygame.draw.rect(self.screen, COLORS["success"], (ix - 3, iy - 3, icon_size + 6, icon_size + 6), border_radius=10)
            elif i == self.current_step and not self.jutsu_active:
                pygame.draw.rect(self.screen, COLORS["accent"], (ix - 4, iy - 4, icon_size + 8, icon_size + 8), border_radius=10)
            
            # Icon
            if sign in self.icons:
                icon_surf = self.icons[sign]
                if icon_surf.get_width() != icon_size:
                    icon_surf = pygame.transform.smoothscale(icon_surf, (icon_size, icon_size))
                
                icon = icon_surf.copy()
                if self.jutsu_active and i < progress_step:
                    warm = pygame.Surface((icon_size, icon_size), pygame.SRCALPHA)
                    warm.fill((255, 170, 60, 34))
                    icon.blit(warm, (0, 0), special_flags=pygame.BLEND_RGBA_ADD)
                elif i < progress_step:
                    icon.set_alpha(100)
                self.screen.blit(icon, (ix, iy))
            else:
                pygame.draw.rect(self.screen, COLORS["border"], (ix, iy, icon_size, icon_size), border_radius=8)
