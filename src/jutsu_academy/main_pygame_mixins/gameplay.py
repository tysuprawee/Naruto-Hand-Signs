from src.jutsu_academy.main_pygame_shared import *
from src.jutsu_academy.effects import EffectContext


class GameplayMixin:
    def _clamp(self, value, low, high):
        return max(float(low), min(float(high), float(value)))

    def _calibration_identity(self):
        if self.discord_user and self.discord_user.get("id"):
            base = f"discord_{self.discord_user.get('id')}"
        else:
            base = (self.username or "guest").strip().lower()
        safe = "".join(ch if ch.isalnum() else "_" for ch in base).strip("_")
        while "__" in safe:
            safe = safe.replace("__", "_")
        return safe or "guest"

    def _calibration_profile_path(self):
        root = Path("src/jutsu_academy/calibration")
        root.mkdir(parents=True, exist_ok=True)
        return root / f"{self._calibration_identity()}.json"

    def _reset_detection_filters(self):
        self.raw_detected_sign = "idle"
        self.raw_detected_confidence = 0.0
        self.detected_sign = "idle"
        self.detected_confidence = 0.0
        self.last_detected_hands = 0
        self.last_vote_hits = 0
        self.sign_vote_window = []

    def toggle_detection_model(self):
        """Switch active sign detector backend."""
        using_mp = bool(self.settings.get("use_mediapipe_signs", False))

        # Safety fallback: if YOLO failed to load, keep MediaPipe selected.
        if using_mp and self.model is None:
            self.settings["use_mediapipe_signs"] = True
            return "mediapipe"

        self.settings["use_mediapipe_signs"] = not using_mp
        self._reset_detection_filters()
        self.last_mp_result = None
        return "mediapipe" if self.settings.get("use_mediapipe_signs", False) else "yolo"

    def _reset_active_effects(self, reset_calibration=True):
        """Reset effect/audio/video runtime state for safe screen transitions."""
        self.fire_particles.emitting = False
        self.jutsu_active = False
        self.sequence_run_start = None
        self.combo_clone_hold = False
        self.combo_chidori_triple = False
        self.combo_rasengan_triple = False
        self.pending_sounds = []
        self.pending_effects = []
        self.current_video = None
        if self.video_cap:
            self.video_cap.release()
            self.video_cap = None

        self.hand_pos = None
        self.mouth_pos = None
        self.smooth_hand_pos = None
        self.smooth_hand_effect_scale = None
        self.hand_effect_scale = 1.0
        if pygame.mixer.get_init():
            pygame.mixer.stop()

        if reset_calibration:
            self.calibration_active = False
        self._reset_detection_filters()

        context = EffectContext()
        try:
            self.effect_orchestrator.on_jutsu_end(context)
        except Exception:
            pass

        for effect in getattr(self.effect_orchestrator, "effects", {}).values():
            try:
                effect.on_jutsu_end(context)
            except Exception:
                pass
        self.effect_orchestrator.reset()

    def _apply_calibration_values(self, profile):
        self.lighting_min = self._clamp(profile.get("lighting_min", 45.0), 25.0, 120.0)
        self.lighting_max = self._clamp(profile.get("lighting_max", 210.0), 120.0, 245.0)
        self.lighting_min_contrast = self._clamp(profile.get("lighting_min_contrast", 22.0), 10.0, 80.0)
        self.vote_min_confidence = self._clamp(profile.get("vote_min_confidence", 0.45), 0.2, 0.9)
        self.vote_required_hits = int(self._clamp(profile.get("vote_required_hits", 3), 2, self.vote_window_size))

    def _load_calibration_profile(self):
        identity = self._calibration_identity()
        if self.calibration_loaded_for == identity:
            return

        self.calibration_loaded_for = identity
        self.calibration_profile = {}

        path = self._calibration_profile_path()
        if not path.exists():
            self._apply_calibration_values({})
            self.calibration_message = "No calibration profile found. Auto-calibration started."
            self.calibration_message_until = time.time() + 6.0
            return

        try:
            with open(path, "r") as f:
                profile = json.load(f)
            if isinstance(profile, dict):
                self.calibration_profile = profile
                self._apply_calibration_values(profile)
                self.calibration_message = "Calibration profile loaded."
                self.calibration_message_until = time.time() + 4.0
            else:
                self._apply_calibration_values({})
        except Exception as e:
            print(f"[!] Calibration profile load failed: {e}")
            self._apply_calibration_values({})

    def _save_calibration_profile(self, profile):
        try:
            path = self._calibration_profile_path()
            with open(path, "w") as f:
                json.dump(profile, f, indent=2)
        except Exception as e:
            print(f"[!] Calibration profile save failed: {e}")

    def start_calibration(self, manual=True):
        self.calibration_active = True
        self.calibration_started_at = time.time()
        self.calibration_samples = []
        self.sign_vote_window = []
        self.last_vote_hits = 0
        if manual:
            self.calibration_message = "Calibrating for 12s... keep hands visible and run signs."
            self.calibration_message_until = time.time() + 12.0
        else:
            self.calibration_message = "Running first-time calibration..."
            self.calibration_message_until = time.time() + 6.0

    def _evaluate_lighting(self, frame):
        gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
        self.lighting_mean = float(np.mean(gray))
        self.lighting_contrast = float(np.std(gray))

        if self.lighting_mean < self.lighting_min:
            self.lighting_status = "low_light"
        elif self.lighting_mean > self.lighting_max:
            self.lighting_status = "overexposed"
        elif self.lighting_contrast < self.lighting_min_contrast:
            self.lighting_status = "low_contrast"
        else:
            self.lighting_status = "good"

        return self.lighting_status == "good"

    def _update_calibration_sample(self, raw_sign, raw_conf, num_hands):
        if not self.calibration_active:
            return

        sample = {
            "brightness": float(self.lighting_mean),
            "contrast": float(self.lighting_contrast),
            "hands": int(num_hands),
        }
        if self.last_palm_spans:
            sample["palm_span"] = float(np.mean(self.last_palm_spans))
        if raw_sign not in ("idle", "unknown"):
            sample["conf"] = float(raw_conf)
        self.calibration_samples.append(sample)

        # Keep memory bounded.
        if len(self.calibration_samples) > 1200:
            self.calibration_samples = self.calibration_samples[-1200:]

        elapsed = time.time() - self.calibration_started_at
        if elapsed >= self.calibration_duration_s and len(self.calibration_samples) >= self.calibration_min_samples:
            self._finalize_calibration()
        elif elapsed >= self.calibration_duration_s * 1.7:
            self._finalize_calibration()

    def _finalize_calibration(self):
        if not self.calibration_samples:
            self.calibration_active = False
            self.calibration_message = "Calibration failed: no samples captured."
            self.calibration_message_until = time.time() + 4.0
            return

        brightness_vals = np.array([s["brightness"] for s in self.calibration_samples], dtype=np.float32)
        contrast_vals = np.array([s["contrast"] for s in self.calibration_samples], dtype=np.float32)
        conf_vals = np.array(
            [s["conf"] for s in self.calibration_samples if "conf" in s and s["conf"] > 0.0],
            dtype=np.float32,
        )

        b_med = float(np.median(brightness_vals)) if brightness_vals.size else 100.0
        c_med = float(np.median(contrast_vals)) if contrast_vals.size else 30.0

        lighting_min = self._clamp(b_med * 0.55, 25.0, 120.0)
        lighting_max = self._clamp(b_med * 1.45, 120.0, 245.0)
        lighting_min_contrast = self._clamp(c_med * 0.65, 10.0, 80.0)

        vote_min_conf = self.vote_min_confidence
        if conf_vals.size:
            vote_min_conf = self._clamp(float(np.percentile(conf_vals, 30)) * 0.9, 0.25, 0.9)

        profile = {
            "version": 1,
            "identity": self._calibration_identity(),
            "updated_at": time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            "samples": int(len(self.calibration_samples)),
            "lighting_min": round(lighting_min, 3),
            "lighting_max": round(lighting_max, 3),
            "lighting_min_contrast": round(lighting_min_contrast, 3),
            "vote_min_confidence": round(vote_min_conf, 3),
            "vote_required_hits": int(self.vote_required_hits),
        }

        self.calibration_profile = profile
        self._apply_calibration_values(profile)
        self._save_calibration_profile(profile)

        self.calibration_active = False
        self.calibration_samples = []
        self.calibration_message = "Calibration saved."
        self.calibration_message_until = time.time() + 5.0

    def _apply_temporal_vote(self, raw_sign, raw_conf, allow_detection):
        now = time.time()
        self.sign_vote_window = [
            item for item in self.sign_vote_window
            if now - item.get("time", 0.0) <= self.vote_entry_ttl_s
        ]

        normalized = str(raw_sign or "idle").strip().lower()
        if (not allow_detection) or normalized in ("idle", "unknown"):
            self.sign_vote_window = []
            self.last_vote_hits = 0
            return "idle", 0.0

        self.sign_vote_window.append({
            "label": normalized,
            "conf": float(max(0.0, raw_conf)),
            "time": now,
        })
        if len(self.sign_vote_window) > self.vote_window_size:
            self.sign_vote_window = self.sign_vote_window[-self.vote_window_size:]

        counts = {}
        conf_sums = {}
        for item in self.sign_vote_window:
            label = item["label"]
            counts[label] = counts.get(label, 0) + 1
            conf_sums[label] = conf_sums.get(label, 0.0) + float(item.get("conf", 0.0))

        if not counts:
            self.last_vote_hits = 0
            return "idle", 0.0

        best_label = max(counts.keys(), key=lambda label: (counts[label], conf_sums.get(label, 0.0)))
        best_hits = int(counts[best_label])
        avg_conf = float(conf_sums.get(best_label, 0.0) / max(1, best_hits))
        self.last_vote_hits = best_hits

        if best_hits >= self.vote_required_hits and avg_conf >= self.vote_min_confidence:
            return best_label, avg_conf
        return "idle", avg_conf

    def predict_sign_with_filters(self, frame, lighting_ok):
        self.last_mp_result = None
        self.detect_hands(frame)

        raw_sign = "idle"
        raw_conf = 0.0
        num_hands = 0

        if self.last_mp_result and self.last_mp_result.hand_landmarks:
            num_hands = len(self.last_mp_result.hand_landmarks)
            features = self.recorder.process_tasks_landmarks(
                self.last_mp_result.hand_landmarks,
                self.last_mp_result.handedness,
            )
            label, raw_conf, _ = self.recorder.predict_with_confidence(features)
            raw_sign = str(label).strip().lower()

        if self.settings.get("restricted_signs", False) and num_hands < 2:
            raw_sign = "idle"
            raw_conf = 0.0

        allow_detection = lighting_ok and num_hands > 0
        if self.settings.get("restricted_signs", False):
            allow_detection = allow_detection and num_hands >= 2

        stable_sign, stable_conf = self._apply_temporal_vote(raw_sign, raw_conf, allow_detection)

        self.raw_detected_sign = raw_sign
        self.raw_detected_confidence = float(raw_conf)
        self.detected_sign = stable_sign
        self.detected_confidence = float(stable_conf)
        self.last_detected_hands = int(num_hands)

        self._update_calibration_sample(raw_sign, raw_conf, num_hands)
        return stable_sign

    def start_game(self, mode, initial_jutsu_idx=0):
        """Start the game with specified mode."""
        if getattr(self, "force_maintenance_required", False):
            self.state = GameState.MAINTENANCE_REQUIRED
            return
        if getattr(self, "force_update_required", False):
            self.state = GameState.UPDATE_REQUIRED
            return

        self.game_mode = mode
        self.loading_message = "Initializing..."
        self.state = GameState.LOADING
        
        # Render loading screen immediately
        self._render_loading()
        pygame.display.flip()
        
        # Load models if not loaded
        self.loading_message = "Loading AI models..."
        self._render_loading()
        pygame.display.flip()
        
        if not self._load_ml_models():
            self.state = GameState.MENU
            return
        
        # Start camera
        self.loading_message = "Starting camera..."
        self._render_loading()
        pygame.display.flip()
        
        if not self._start_camera():
            print("[-] Failed to open camera!")
            # Show dedicated error modal
            self.error_title = "Camera Error"
            self.error_message = "Could not access camera.\nPlease check if OBS, Discord, or another app is using it."
            self.state = GameState.ERROR_MODAL 
            return
        
        # Reset state
        self.loading_message = "Ready!"
        self._render_loading()
        pygame.display.flip()
        
        if len(self.jutsu_names) > 0:
            self.current_jutsu_idx = max(0, min(int(initial_jutsu_idx), len(self.jutsu_names) - 1))
        else:
            self.current_jutsu_idx = 0
        self.sequence = self.jutsu_list[self.jutsu_names[self.current_jutsu_idx]]["sequence"]
        self.current_step = 0
        self.sequence_run_start = None
        self.combo_triggered_steps = set()
        self._reset_active_effects(reset_calibration=True)
        self._load_calibration_profile()
        if not self.calibration_profile:
            self.start_calibration(manual=False)

        # Challenge Mode Init
        self.challenge_state = "waiting"
        self.challenge_start_time = 0
        self.challenge_final_time = 0
        self.challenge_rank_info = ""
        self.challenge_submitting = False
        self.submission_complete = False
        self.challenge_run_token = ""
        self.challenge_run_token_source = "none"
        self.challenge_proof_events = []
        self.challenge_run_hash = ""
        self.challenge_started_at_iso = ""
        self.challenge_submission_result = {}
        self.challenge_event_overflow = False
        
        self.state = GameState.PLAYING

    def _render_loading(self):
        """Render loading screen."""
        if hasattr(self, 'bg_image') and self.bg_image:
             self.screen.blit(self.bg_image, (0, 0))
             # Very dark overlay for loading state
             overlay = pygame.Surface((SCREEN_WIDTH, SCREEN_HEIGHT), pygame.SRCALPHA)
             overlay.fill((0, 0, 0, 220)) 
             self.screen.blit(overlay, (0, 0))
        else:
             self.screen.fill(COLORS["bg_dark"])
        
        # Loading text
        title = self.fonts["title_md"].render("LOADING", True, COLORS["accent"])
        title_rect = title.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 - 40))
        self.screen.blit(title, title_rect)
        
        # Status message
        msg = getattr(self, 'loading_message', 'Please wait...')
        status = self.fonts["body"].render(msg, True, COLORS["text"])
        status_rect = status.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 + 20))
        self.screen.blit(status, status_rect)
        
        # Simple spinner animation (dots)
        dots = "." * (int(time.time() * 2) % 4)
        dots_surf = self.fonts["body"].render(dots, True, COLORS["text_dim"])
        self.screen.blit(dots_surf, (status_rect.right + 5, status_rect.y))

    def _draw_text_center(self, text, y_offset=0, color=(255, 255, 255)):
        """Helper to draw centered text."""
        surf = self.fonts["title_md"].render(text, True, color)
        rect = surf.get_rect(center=(SCREEN_WIDTH // 2, SCREEN_HEIGHT // 2 + y_offset))
        self.screen.blit(surf, rect)

    def stop_game(self, return_to_library=False):
        """Stop the game and return to menu."""
        submitted_on_exit = False
        if hasattr(self, "_submit_challenge_score_on_exit"):
            submitted_on_exit = bool(self._submit_challenge_score_on_exit(blocking=False))
        if hasattr(self, "_challenge_reset_proof") and (not submitted_on_exit):
            self._challenge_reset_proof()
        self._reset_active_effects(reset_calibration=True)
        self._stop_camera()
        if return_to_library:
            self.library_mode = "freeplay" if self.game_mode == "practice" else "challenge"
            self.state = GameState.JUTSU_LIBRARY
        else:
            self.state = GameState.MENU

    def switch_jutsu(self, direction):
        """Switch to next/prev jutsu."""
        if hasattr(self, "_challenge_reset_proof"):
            self._challenge_reset_proof()
        self._reset_active_effects(reset_calibration=False)
        self.current_jutsu_idx = (self.current_jutsu_idx + direction) % len(self.jutsu_names)
        name = self.jutsu_names[self.current_jutsu_idx]
        self.sequence = self.jutsu_list[name]["sequence"]
        self.current_step = 0
        self.sequence_run_start = None
        self.combo_triggered_steps = set()

    def detect_and_process(self, frame):
        """Run detection and check sequence."""
        if self.model is None:
            return frame, None, 0.0
        
        results = self.model(frame, stream=True, verbose=False, imgsz=320)
        detected_class = None
        highest_conf = 0.0
        self.hand_pos = None # Reset
        
        for r in results:
            for box in r.boxes:
                conf = float(box.conf[0])
                cls = int(box.cls[0])
                cls_name = self.class_names[cls]
                
                x1, y1, x2, y2 = map(int, box.xyxy[0])
                
                if conf > 0.5 and conf > highest_conf:
                    highest_conf = conf
                    detected_class = cls_name
                    # Store center
                    self.hand_pos = ((x1 + x2) // 2, (y1 + y2) // 2)
                
                # Draw bbox
                cv2.rectangle(frame, (x1, y1), (x2, y2), (0, 255, 0), 2)
                cv2.putText(frame, f"{cls_name} {conf:.2f}", (x1, y1 - 10),
                           cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 255, 0), 2)
        
        return frame, detected_class, highest_conf

    def detect_hands(self, frame):
        """Detect hand landmarks for skeleton visualization and tracking."""
        if not self.hand_landmarker:
            return
            
        try:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            
            # Using current clock time for timestamp (MS)
            timestamp = int(time.time() * 1000)
            result = self.hand_landmarker.detect_for_video(mp_image, timestamp)
            self.last_mp_result = result
            self.last_palm_spans = []
            
            if result.hand_landmarks:
                self.hand_lost_frames = 0
                h, w = frame.shape[:2]

                # Build candidates for each detected hand, then choose one consistently.
                candidates = []
                indices = [0, 5, 9, 13, 17]

                for hand_idx, landmarks in enumerate(result.hand_landmarks):
                    base_x = sum(landmarks[i].x for i in indices) / len(indices)
                    base_y = sum(landmarks[i].y for i in indices) / len(indices)

                    def to_vec(hand_landmarks, idx):
                        lm = hand_landmarks[idx]
                        return np.array([lm.x, lm.y, lm.z])

                    v1 = to_vec(landmarks, 5) - to_vec(landmarks, 0)
                    v2 = to_vec(landmarks, 17) - to_vec(landmarks, 0)
                    normal = np.cross(v1, v2)
                    mag = np.linalg.norm(normal)
                    if mag > 1e-6:
                        normal /= mag

                    offset_strength = 0.25
                    hand_label = "Unknown"
                    if result.handedness and hand_idx < len(result.handedness):
                        hand_label = result.handedness[hand_idx][0].category_name
                        if hand_label == "Left":
                            offset_strength = -0.25

                    target_x = (base_x + normal[0] * offset_strength) * w
                    target_y = (base_y + normal[1] * offset_strength) * h

                    palm_span = float(np.linalg.norm(
                        np.array([landmarks[5].x, landmarks[5].y]) -
                        np.array([landmarks[17].x, landmarks[17].y])
                    ))
                    self.last_palm_spans.append(palm_span)
                    reference_span = 0.18
                    target_scale = palm_span / reference_span
                    target_scale = max(0.65, min(1.9, target_scale))

                    candidates.append({
                        "x": target_x,
                        "y": target_y,
                        "scale": target_scale,
                        "label": hand_label,
                    })

                if candidates:
                    chosen = None

                    # Prefer the currently tracked hand side to avoid left/right teleporting.
                    if self.tracked_hand_label:
                        same_label = [c for c in candidates if c["label"] == self.tracked_hand_label]
                        if same_label:
                            if self.hand_pos is not None:
                                prev_x, prev_y = self.hand_pos
                                chosen = min(
                                    same_label,
                                    key=lambda c: (c["x"] - prev_x) ** 2 + (c["y"] - prev_y) ** 2
                                )
                            else:
                                chosen = same_label[0]

                    # Bootstrap: default to Right hand first, then Left, then nearest.
                    if chosen is None and self.hand_pos is None:
                        right = [c for c in candidates if c["label"] == "Right"]
                        left = [c for c in candidates if c["label"] == "Left"]
                        chosen = right[0] if right else (left[0] if left else candidates[0])

                    if chosen is None and self.hand_pos is not None:
                        prev_x, prev_y = self.hand_pos
                        chosen = min(
                            candidates,
                            key=lambda c: (c["x"] - prev_x) ** 2 + (c["y"] - prev_y) ** 2
                        )
                    if chosen is None:
                        chosen = candidates[0]

                    target_x = chosen["x"]
                    target_y = chosen["y"]
                    target_scale = chosen["scale"]
                    self.tracked_hand_label = chosen["label"] if chosen["label"] != "Unknown" else self.tracked_hand_label

                    # Jitter filter (no smoothing/lag): ignore micro-movements only.
                    if self.hand_pos is not None:
                        prev_x, prev_y = self.hand_pos
                        jitter_px = 9.0
                        if (target_x - prev_x) ** 2 + (target_y - prev_y) ** 2 < (jitter_px ** 2):
                            target_x, target_y = prev_x, prev_y

                    # Follow selected hand directly for meaningful movement.
                    self.hand_pos = (target_x, target_y)
                    self.smooth_hand_pos = self.hand_pos
                if self.smooth_hand_effect_scale is None:
                    self.smooth_hand_effect_scale = target_scale
                else:
                    alpha_scale = 0.10
                    self.smooth_hand_effect_scale = (
                        self.smooth_hand_effect_scale +
                        (target_scale - self.smooth_hand_effect_scale) * alpha_scale
                    )
                self.hand_effect_scale = self.smooth_hand_effect_scale
                
                # 2. Draw Skeletons for ALL detected hands
                if self.settings.get("debug_hands", False):
                    CONNECTIONS = [
                        (0,1), (1,2), (2,3), (3,4), # Thumb
                        (0,5), (5,6), (6,7), (7,8), # Index
                        (5,9), (9,10), (10,11), (11,12), # Middle
                        (9,13), (13,14), (14,15), (15,16), # Ring
                        (13,17), (17,18), (18,19), (19,20), (0,17) # Pinky + Palm
                    ]
                    
                    for hand_idx, landmarks in enumerate(result.hand_landmarks):
                        # Use different color for second hand if desired (optional)
                        color = (0, 255, 0) # Primary Green
                        
                        for lm in landmarks:
                            cx, cy = int(lm.x * w), int(lm.y * h)
                            cv2.circle(frame, (cx, cy), 4, (0, 0, 255), -1)
                            cv2.circle(frame, (cx, cy), 1, (255, 255, 255), -1)
                        
                        for conn in CONNECTIONS:
                            p1, p2 = landmarks[conn[0]], landmarks[conn[1]]
                            cv2.line(frame, (int(p1.x * w), int(p1.y * h)), 
                                            (int(p2.x * w), int(p2.y * h)), color, 2)
            else:
                self.hand_lost_frames += 1
                self.hand_pos = None
                self.smooth_hand_pos = None
                self.smooth_hand_effect_scale = None
                self.hand_effect_scale = 1.0
        except Exception as e:
            print(f"[!] detect_hands error: {e}")

    def detect_face(self, frame):
        """Detect face landmarks for fire positioning."""
        if not self.face_landmarker:
            return
        
        try:
            rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb)
            result = self.face_landmarker.detect(mp_image)
            
            if result.face_landmarks:
                face = result.face_landmarks[0]
                h, w = frame.shape[:2]
                
                mouth = face[13]
                self.mouth_pos = (int(mouth.x * w), int(mouth.y * h))
                
                nose_x = face[1].x
                left_x = face[234].x
                right_x = face[454].x
                width = right_x - left_x
                if width > 0:
                    rel_nose = (nose_x - left_x) / width
                    self.head_yaw = (rel_nose - 0.5) * 2
        except:
            pass

    def cv2_to_pygame(self, frame):
        """Convert OpenCV frame to Pygame surface."""
        frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        frame = np.rot90(frame)
        frame = np.flipud(frame)
        return pygame.surfarray.make_surface(frame)
