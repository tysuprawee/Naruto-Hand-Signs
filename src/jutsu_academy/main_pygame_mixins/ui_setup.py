from src.jutsu_academy.main_pygame_shared import *


class UISetupMixin:
    def _create_menu_ui(self):
        """Create main menu UI."""
        cx = SCREEN_WIDTH // 2
        btn_w, btn_h = 280, 60
        start_y = 345
        gap = 70
        
        self.menu_buttons = {
            "practice": Button(cx - btn_w // 2, start_y, btn_w, btn_h, "ENTER ACADEMY"),
            "settings": Button(cx - btn_w // 2, start_y + gap, btn_w, btn_h, "SETTINGS"),
            "tutorial": Button(cx - btn_w // 2, start_y + gap * 2, btn_w, btn_h, "TUTORIAL", color=COLORS["bg_card"]),
            "about": Button(cx - btn_w // 2, start_y + gap * 3, btn_w, btn_h, "ABOUT", color=COLORS["bg_card"]),
        }
        
        # Mute button position (top right)
        self.mute_button_rect = pygame.Rect(SCREEN_WIDTH - 60, 20, 40, 40)

    def _create_settings_ui(self):
        
        # Settings Page UI
        cx = 290
        cy = 170
        camera_idx = self.settings["camera_idx"]
        if len(self.cameras) == 0:
            camera_idx = 0
            self.settings["camera_idx"] = 0
        elif camera_idx < 0 or camera_idx >= len(self.cameras):
            camera_idx = 0
            self.settings["camera_idx"] = 0
        
        self.settings_sliders = {
            "music": Slider(cx - 150, cy + 40, 300, "Music Volume", self.settings["music_vol"]),
            "sfx": Slider(cx - 150, cy + 120, 300, "SFX Volume", self.settings["sfx_vol"]),
        }
        
        self.camera_dropdown = Dropdown(cx - 60, cy + 210, 230, self.cameras, camera_idx)
        
        self.settings_checkboxes = {
            "debug_hands": Checkbox(cx - 150, cy + 290, 24, "Show Hand Skeleton", self.settings["debug_hands"]),
            "restricted": Checkbox(cx - 150, cy + 330, 24, "Restricted Signs (Require 2 Hands) - Always On", True),
            "fullscreen": Checkbox(cx - 150, cy + 370, 24, "Fullscreen", self.settings.get("fullscreen", False)),
        }

        # Resolution dropdown
        res_labels = [r[0] for r in RESOLUTION_OPTIONS]
        res_idx = self.settings.get("resolution_idx", 0)
        if res_idx < 0 or res_idx >= len(res_labels):
            res_idx = 0
        self.resolution_dropdown = Dropdown(cx - 60, cy + 410, 230, res_labels, res_idx)
        
        self.settings_buttons = {
            "preview_toggle": Button(cx - 100, cy + 395, 220, 44, "ENABLE PREVIEW", color=COLORS["bg_card"]),
            "scan_cameras": Button(cx - 100, cy + 350, 220, 40, "SCAN CAMERAS", color=COLORS["bg_card"]),
            "back": Button(cx - 100, cy + 500, 220, 52, "SAVE & BACK"),
        }

    def _refresh_settings_camera_options(self, force=False):
        """Probe and refresh camera dropdown options for settings."""
        now = time.time()
        if not force and self.cameras and (now - self.camera_scan_last_at) < 30.0:
            return

        detected = self._scan_cameras(probe=True)
        self.cameras = detected
        self.camera_scan_last_at = now

        if not hasattr(self, "camera_dropdown"):
            return

        self.camera_dropdown.options = list(self.cameras)
        if len(self.cameras) == 0:
            self.camera_dropdown.selected_idx = 0
            self.camera_dropdown.is_open = False
            self.settings["camera_idx"] = 0
        elif self.camera_dropdown.selected_idx >= len(self.cameras):
            self.camera_dropdown.selected_idx = 0
            self.settings["camera_idx"] = 0

    def _start_settings_camera_preview(self, camera_idx=None):
        """Start camera preview used only in settings screen."""
        if len(self.cameras) == 0:
            self._refresh_settings_camera_options(force=True)
        if len(self.cameras) == 0:
            self._stop_settings_camera_preview()
            return False

        idx = self.settings["camera_idx"] if camera_idx is None else int(camera_idx)
        idx = max(0, min(idx, len(self.cameras) - 1))
        if self.settings_preview_cap is not None and self.settings_preview_idx == idx:
            return True

        self._stop_settings_camera_preview()
        capture_idx = self._resolve_camera_capture_index(idx)

        if os.name == "nt":
            cap = cv2.VideoCapture(capture_idx, cv2.CAP_DSHOW)
        else:
            cap = cv2.VideoCapture(capture_idx)
        cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        cap.set(cv2.CAP_PROP_FPS, 30)

        if not cap.isOpened():
            cap.release()
            self.settings_preview_cap = None
            self.settings_preview_idx = None
            return False

        self.settings_preview_cap = cap
        self.settings_preview_idx = idx
        return True

    def _stop_settings_camera_preview(self):
        """Stop settings camera preview stream."""
        if self.settings_preview_cap is not None:
            self.settings_preview_cap.release()
            self.settings_preview_cap = None
            self.settings_preview_idx = None

    def _get_settings_preview_surface(self):
        """Read preview frame and convert to pygame surface."""
        if self.settings_preview_cap is None:
            return None
        ret, frame = self.settings_preview_cap.read()
        if not ret:
            return None
        frame = cv2.flip(frame, 1)
        return self.cv2_to_pygame(frame)

    def _create_practice_select_ui(self):
        """Create practice mode selection UI."""
        cx = SCREEN_WIDTH // 2
        
        self.practice_buttons = {
            "freeplay": Button(cx - 150, 250, 300, 60, "FREE PLAY"),
            "challenge": Button(cx - 150, 330, 300, 60, "RANK MODE"),
            "library": Button(cx - 150, 410, 300, 60, "JUTSU LIBRARY", color=(58, 92, 162)),
            "multiplayer": Button(cx - 150, 490, 300, 60, "MULTIPLAYER (LOCKED)", color=(40, 40, 40)),
            "quests": Button(cx - 150, 570, 300, 50, "QUEST BOARD", color=(80, 140, 110)),
            "leaderboard": Button(cx - 150, 635, 300, 50, "LEADERBOARD", color=(218, 165, 32)), # Gold
            "back": Button(cx - 100, 620, 200, 50, "BACK"),
        }
        self.practice_buttons["multiplayer"].enabled = False

    def _create_calibration_gate_ui(self):
        """Create first-time calibration gate UI."""
        cx = SCREEN_WIDTH // 2
        cam_idx = self.settings.get("camera_idx", 0)
        if len(self.cameras) == 0:
            cam_idx = 0
        elif cam_idx < 0 or cam_idx >= len(self.cameras):
            cam_idx = 0
            self.settings["camera_idx"] = 0
        self.calibration_camera_dropdown = Dropdown(cx - 120, SCREEN_HEIGHT - 220, 260, self.cameras, cam_idx)
        self.calibration_camera_dropdown.force_open_upward = True
        self.calibration_gate_buttons = {
            "scan": Button(cx + 146, SCREEN_HEIGHT - 220, 96, 40, "SCAN", font_size=24, color=COLORS["bg_card"]),
            "start": Button(cx - 170, SCREEN_HEIGHT - 160, 340, 58, "START CALIBRATION"),
            "settings": Button(cx + 20, SCREEN_HEIGHT - 90, 240, 48, "SETTINGS", color=(58, 92, 162)),
            "back": Button(cx - 120, SCREEN_HEIGHT - 90, 240, 48, "BACK", color=COLORS["bg_card"]),
        }

    def _create_about_ui(self):
        """Create about page UI."""
        cx = SCREEN_WIDTH // 2
        
        self.about_buttons = {
            "back": Button(cx - 100, 650, 200, 50, "BACK"),
        }

    def _create_leaderboard_ui(self):
        """Create leaderboard UI."""
        self.leaderboard_buttons = {
            "back": Button(50, 50, 100, 40, "< Back", font_size=20),
            "refresh": Button(SCREEN_WIDTH - 150, 50, 100, 40, "Refresh", font_size=20, color=COLORS["success"])
        }

    def _create_library_ui(self):
        """Create jutsu library UI."""
        self.library_buttons = {
            "back": Button(50, 50, 100, 40, "< Back", font_size=20),
        }

    def _create_quest_ui(self):
        """Create quest board UI."""
        self.quest_buttons = {
            "back": Button(40, 40, 120, 44, "< BACK", font_size=22, color=COLORS["bg_card"]),
        }

    def _create_tutorial_ui(self):
        """Create tutorial navigation buttons."""
        cx = SCREEN_WIDTH // 2
        self.tutorial_buttons = {
            "back": Button(cx - 260, SCREEN_HEIGHT - 110, 160, 52, "BACK", color=COLORS["bg_card"]),
            "next": Button(cx + 100, SCREEN_HEIGHT - 110, 160, 52, "NEXT"),
            "skip": Button(cx - 80, SCREEN_HEIGHT - 110, 160, 52, "SKIP", color=COLORS["bg_card"]),
        }

    def _load_ml_models(self):
        """Load ML models (called when starting game)."""
        if self.model is not None:
            return True
        
        weights = get_latest_weights()
        if not weights:
            print("[!] No YOLO weights found (YOLO path is locked anyway). Continuing with MediaPipe only.")
        
        print("[*] YOLO mapping verified. Loading skipped (model locked).")
        self.model = None
        self.class_names = get_class_names()
        
        self.hand_landmarker = None
        self.hand_landmarker_image = None
        self.legacy_hands = None
        self.hand_detector_backend = "none"
        self.hand_detector_error = ""

        try:
            from mediapipe.tasks import python
            from mediapipe.tasks.python import vision
        except Exception as e:
            python = None
            vision = None
            self.hand_detector_error = f"tasks_import_failed: {e}"
            print(f"[!] MediaPipe Tasks import failed: {e}")

        if python is not None and vision is not None:
            face_path = resolve_resource_path("models/face_landmarker.task")
            if face_path.exists():
                try:
                    base_options = python.BaseOptions(model_asset_path=str(face_path))
                    options = vision.FaceLandmarkerOptions(base_options=base_options, num_faces=1)
                    self.face_landmarker = vision.FaceLandmarker.create_from_options(options)
                    print(f"[+] Face detection loaded: {face_path}")
                except Exception as e:
                    print(f"[!] Face detection failed: {e}")
            else:
                print(f"[!] Face model not found: {face_path}")

            hand_path = resolve_resource_path("models/hand_landmarker.task")
            self.hand_model_path = str(hand_path)
            self.hand_model_exists = bool(hand_path.exists())
            if hand_path.exists():
                errors = []
                try:
                    base_options = python.BaseOptions(model_asset_path=str(hand_path))
                    options = vision.HandLandmarkerOptions(
                        base_options=base_options,
                        num_hands=2,
                        running_mode=vision.RunningMode.VIDEO,
                        min_hand_detection_confidence=0.25,
                        min_hand_presence_confidence=0.25,
                        min_tracking_confidence=0.25,
                    )
                    self.hand_landmarker = vision.HandLandmarker.create_from_options(options)
                    self.hand_detector_backend = "tasks_video"
                    print(f"[+] Hand tracking loaded (VIDEO): {hand_path}")
                except Exception as e:
                    errors.append(f"tasks_video_failed: {e}")
                    print(f"[!] Hand tracking VIDEO failed: {e}")

                if self.hand_landmarker is None:
                    try:
                        base_options = python.BaseOptions(model_asset_path=str(hand_path))
                        options = vision.HandLandmarkerOptions(
                            base_options=base_options,
                            num_hands=2,
                            running_mode=vision.RunningMode.IMAGE,
                            min_hand_detection_confidence=0.25,
                            min_hand_presence_confidence=0.25,
                            min_tracking_confidence=0.25,
                        )
                        self.hand_landmarker_image = vision.HandLandmarker.create_from_options(options)
                        self.hand_detector_backend = "tasks_image"
                        print(f"[+] Hand tracking loaded (IMAGE fallback): {hand_path}")
                    except Exception as e:
                        errors.append(f"tasks_image_failed: {e}")
                        print(f"[!] Hand tracking IMAGE fallback failed: {e}")

                if errors and self.hand_detector_backend == "none":
                    self.hand_detector_error = " | ".join(errors)
            else:
                self.hand_model_exists = False
                self.hand_detector_error = f"hand_model_missing: {hand_path}"
                print(f"[!] Hand model not found: {hand_path}")

        if self.hand_detector_backend == "none":
            try:
                self.legacy_hands = mp.solutions.hands.Hands(
                    static_image_mode=False,
                    max_num_hands=2,
                    min_detection_confidence=0.25,
                    min_tracking_confidence=0.25,
                )
                self.hand_detector_backend = "legacy_solutions"
                print("[+] Hand tracking loaded (legacy solutions fallback)")
            except Exception as e:
                if self.hand_detector_error:
                    self.hand_detector_error = f"{self.hand_detector_error} | legacy_failed: {e}"
                else:
                    self.hand_detector_error = f"legacy_failed: {e}"
                print(f"[!] Legacy hand tracking failed: {e}")

        if self.hand_detector_backend == "none":
            print("[-] Hand tracker unavailable; sign detection will be disabled.")
            print(f"[!] Hand detector error: {self.hand_detector_error}")
            return False
        return True

    def _start_camera(self):
        """Start camera capture."""
        if self.cap is not None:
            self.cap.release()
        
        cam_idx = self.settings["camera_idx"]
        cam_idx = self._resolve_camera_capture_index(cam_idx)
        # Use DirectShow on Windows for better compatibility
        if os.name == 'nt':
            self.cap = cv2.VideoCapture(cam_idx, cv2.CAP_DSHOW)
        else:
            self.cap = cv2.VideoCapture(cam_idx)
            
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, 640)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, 480)
        self.cap.set(cv2.CAP_PROP_FPS, 30)
        
        return self.cap.isOpened()

    def _stop_camera(self):
        """Stop camera capture."""
        if self.cap is not None:
            self.cap.release()
            self.cap = None

    def play_sound(self, name):
        """Play a sound effect."""
        if name in self.sounds:
            vol = self._effective_sfx_volume(self.settings["sfx_vol"])
            self.sounds[name].set_volume(vol)
            self.sounds[name].play()
