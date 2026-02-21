from src.jutsu_academy.main_pygame_shared import *
import subprocess
import sys
from src.utils.paths import resolve_resource_path


class AssetsMixin:
    def _resolve_asset_path(self, path_like):
        return resolve_resource_path(path_like)

    def _load_ui_image(self, path, size=None):
        p = self._resolve_asset_path(path)
        if not p.exists():
            p = self._resolve_asset_path("src/pics/placeholder.png")
        try:
            img = pygame.image.load(str(p)).convert_alpha()
            if size:
                img = pygame.transform.smoothscale(img, size)
            return img
        except Exception:
            return None

    def _load_card_texture_image(self, path):
        """Load card texture image; fallback to OpenCV decode when pygame decoder fails."""
        p = self._resolve_asset_path(path)
        if not p.exists():
            return None
        try:
            return pygame.image.load(str(p)).convert_alpha()
        except Exception:
            pass
        try:
            frame = cv2.imread(str(p), cv2.IMREAD_COLOR)
            if frame is None:
                return None
            frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
            frame = np.transpose(frame, (1, 0, 2))
            return pygame.surfarray.make_surface(frame).convert_alpha()
        except Exception:
            return None

    def _load_feature_icons(self):
        """Load tutorial, mastery, quest and shared UI icons."""
        self.tutorial_icons = {
            "camera": self._load_ui_image("src/pics/tutorial/step_camera.png"),
            "signs": self._load_ui_image("src/pics/tutorial/step_signs.png"),
            "execute": self._load_ui_image("src/pics/tutorial/step_execute.png"),
            "challenge": self._load_ui_image("src/pics/tutorial/step_challenge.png"),
            "panel_bg": self._load_ui_image("src/pics/tutorial/panel_bg.png"),
        }
        self.mastery_icons = {
            "none": self._load_ui_image("src/pics/ui/reward_xp.png", (28, 28)),
            "bronze": self._load_ui_image("src/pics/ui/reward_xp.png", (28, 28)),
            "silver": self._load_ui_image("src/pics/ui/reward_xp.png", (28, 28)),
            "gold": self._load_ui_image("src/pics/ui/reward_xp.png", (28, 28)),
        }
        self.quest_icons = {
            "daily": self._load_ui_image("src/pics/quests/daily_icon.png", (48, 48)),
            "weekly": self._load_ui_image("src/pics/quests/weekly_icon.png", (48, 48)),
            "card_bg": self._load_ui_image("src/pics/quests/quest_card_bg.png"),
            "progress_fill": self._load_ui_image("src/pics/quests/progress_fill.png"),
            "progress_track": self._load_ui_image("src/pics/quests/progress_track.png"),
            "claim_btn": self._load_ui_image("src/pics/quests/claim_btn.png"),
            "claimed_stamp": self._load_ui_image("src/pics/quests/claimed_stamp.png"),
            "refresh": self._load_ui_image("src/pics/quests/refresh_timer.png", (20, 20)),
        }
        self.ui_icons = {
            "info": self._load_ui_image("src/pics/ui/info.png", (20, 20)),
            "check": self._load_ui_image("src/pics/ui/check.png", (20, 20)),
            "lock": self._load_ui_image("src/pics/ui/lock.png", (20, 20)),
            "reward_xp": self._load_ui_image("src/pics/ui/reward_xp.png", (20, 20)),
        }
        self.jutsu_card_textures = {}
        self.jutsu_card_texture_cache = {}
        texture_map = {
            "Shadow Clone": "shadow_clone.jpg",
            "Rasengan": "rasengan.jpg",
            "Fireball": "fireball.jpg",
            "Phoenix Flower": "phoenix_flowers.jpg",
            "Shadow Clone + Chidori Combo": "shadow_clone_chidori.jpg",
            "Shadow Clone + Rasengan Combo": "shadow_clone_rasengan.jpg",
            "Chidori": "chidori.jpg",
            "Water Dragon": "water_dragon.jpg",
            "Reaper Death Seal": "reaper_death.jpg",
            "Sharingan": "sharingan.jpg",
        }
        texture_dir = Path("src/pics/textured_buttons")
        for jutsu_name, filename in texture_map.items():
            texture_path = self._resolve_asset_path(texture_dir / filename)
            texture = self._load_card_texture_image(texture_path)
            if texture is not None:
                self.jutsu_card_textures[jutsu_name] = texture
        if self.jutsu_card_textures:
            print(f"[+] Loaded {len(self.jutsu_card_textures)} jutsu card textures")
        else:
            print("[!] No jutsu card textures loaded from src/pics/textured_buttons")

    def _macos_camera_names(self):
        """Best-effort camera names on macOS via system_profiler."""
        try:
            out = subprocess.check_output(
                ["system_profiler", "SPCameraDataType"],
                text=True,
                stderr=subprocess.DEVNULL,
            )
        except Exception:
            return []

        ignored = {
            "camera",
            "model id",
            "unique id",
            "serial number",
            "vendor id",
            "product id",
            "version",
        }
        names = []
        for line in out.splitlines():
            s = line.strip()
            if not s.endswith(":"):
                continue
            key = s[:-1].strip()
            low = key.lower()
            if not key:
                continue
            if low in ignored:
                continue
            if low.startswith("spcamera"):
                continue
            if low.startswith("usb") or low.startswith("built-in"):
                continue
            # Device groups are usually plain names with title case
            if len(key) > 1 and any(c.isalpha() for c in key):
                names.append(key)
        return names

    def _resolve_camera_capture_index(self, selected_idx):
        if hasattr(self, "camera_device_indices") and self.camera_device_indices:
            if 0 <= selected_idx < len(self.camera_device_indices):
                return self.camera_device_indices[selected_idx]
        return selected_idx

    def _scan_cameras(self, probe=False):
        """Get camera list. By default do not probe hardware to avoid startup camera access."""
        cameras = []
        indices = []
        
        # 1. Try PyGrabber (Best for Windows Names)
        if FilterGraph:
            try:
                graph = FilterGraph()
                devices = graph.get_input_devices()
                if devices:
                    self.camera_device_indices = list(range(len(devices)))
                    return devices
            except:
                pass
        
        # 2. Non-probing fallback (startup-safe)
        if not probe:
            self.camera_device_indices = []
            return []

        # 3. Fallback to OpenCV probing
        for i in range(8):
            cap = cv2.VideoCapture(i)
            if cap.isOpened():
                indices.append(i)
            cap.release()

        if not indices:
            self.camera_device_indices = []
            return []

        # Use real camera names where possible
        if sys.platform == "darwin":
            names = self._macos_camera_names()
            for pos, idx in enumerate(indices):
                cameras.append(names[pos] if pos < len(names) else f"Camera {idx}")
        else:
            cameras = [f"Camera {idx}" for idx in indices]

        self.camera_device_indices = indices
        return cameras

    def _effective_music_volume(self, ui_value):
        """Map slider [0..1] to practical music gain."""
        v = max(0.0, min(1.0, float(ui_value)))
        return min(0.45, v ** 2.6)

    def _effective_sfx_volume(self, ui_value):
        """Map slider [0..1] to practical SFX gain."""
        v = max(0.0, min(1.0, float(ui_value)))
        return min(0.5, v ** 2.4)

    def _load_sounds(self):
        """Load sound effects."""
        sounds_dir = self._resolve_asset_path("src/sounds")
        
        for name in ["each", "complete", "hover", "click", "reward", "level"]:
            for ext in [".mp3", ".wav"]:
                path = sounds_dir / f"{name}{ext}"
                if path.exists():
                    try:
                        self.sounds[name] = pygame.mixer.Sound(str(path))
                        print(f"[+] Sound loaded: {name}")
                        break
                    except Exception as e:
                        print(f"[!] Sound load error ({name}): {e}")
        
        # Load jutsu-specific sounds
        for name, data in self.jutsu_list.items():
            sound_path = data.get("sound_path")
            resolved_sound = self._resolve_asset_path(sound_path) if sound_path else None
            if resolved_sound and resolved_sound.exists():
                try:
                    self.sounds[name] = pygame.mixer.Sound(str(resolved_sound))
                    if str(name).lower() == "chidori":
                        self.sounds[name].set_volume(0.3)
                    print(f"[+] Jutsu sound loaded: {name}")
                except Exception as e:
                    print(f"[!] Jutsu sound error ({name}): {e}")

    def _try_play_music(self):
        """Try to play background music."""
        music_paths = [
            self._resolve_asset_path("src/sounds/music2.mp3"),
            self._resolve_asset_path("src/sounds/music1.mp3"),
            self._resolve_asset_path("src/sounds/bgm.mp3"),
            self._resolve_asset_path("src/sounds/background.mp3"),
        ]
        
        for path in music_paths:
            if path.exists():
                try:
                    pygame.mixer.music.load(str(path))
                    pygame.mixer.music.set_volume(self._effective_music_volume(self.settings["music_vol"]))
                    pygame.mixer.music.play(-1)  # Loop
                    self.music_playing = True
                    print(f"[+] Music playing: {path}")
                    break
                except Exception as e:
                    print(f"[!] Music error: {e}")

    def _load_icons(self):
        """Load hand sign icons."""
        pics_dir = self._resolve_asset_path("src/pics")
        class_names = get_class_names()
        sequence_signs = set()
        for jutsu_data in getattr(self, "jutsu_list", {}).values():
            for sign in jutsu_data.get("sequence", []):
                sequence_signs.add(str(sign).strip().lower())

        all_sign_names = sorted(set(class_names) | sequence_signs)
        for name in all_sign_names:
            for ext in [".jpeg", ".jpg", ".png"]:
                path = pics_dir / f"{name}{ext}"
                if path.exists():
                    try:
                        img = pygame.image.load(str(path))
                        self.icons[name] = pygame.transform.smoothscale(img, (80, 80))
                        break
                    except:
                        pass

    def _load_logo(self):
        """Load logo image with proper aspect ratio."""
        logo_paths = [
            self._resolve_asset_path("src/pics/logo.png"),
            self._resolve_asset_path("src/pics/logo2.png"),
        ]
        for path in logo_paths:
            if path.exists():
                try:
                    img = pygame.image.load(str(path))
                    # Maintain aspect ratio - fit to max width 380, max height 200
                    w, h = img.get_size()
                    aspect = w / h
                    target_w = 380
                    target_h = int(target_w / aspect)
                    if target_h > 200:
                        target_h = 200
                        target_w = int(target_h * aspect)
                    self.logo = pygame.transform.smoothscale(img, (target_w, target_h))
                    break
                except:
                    pass

    def _load_background(self):
        """Load background image with proper aspect ratio (cover)."""
        bg_paths = [
            self._resolve_asset_path("src/socials/vl2.png"),
            self._resolve_asset_path("src/pics/bg.png"),
        ]
        for path in bg_paths:
            if path.exists():
                try:
                    img = pygame.image.load(str(path))
                    # Scale to cover (maintain aspect ratio, crop if needed)
                    img_w, img_h = img.get_size()
                    aspect = img_w / img_h
                    screen_aspect = SCREEN_WIDTH / SCREEN_HEIGHT
                    
                    if aspect > screen_aspect:
                        # Image is wider - scale by height
                        new_h = SCREEN_HEIGHT
                        new_w = int(new_h * aspect)
                    else:
                        # Image is taller - scale by width
                        new_w = SCREEN_WIDTH
                        new_h = int(new_w / aspect)
                    
                    scaled = pygame.transform.smoothscale(img, (new_w, new_h))
                    # Crop to center
                    x = (new_w - SCREEN_WIDTH) // 2
                    y = (new_h - SCREEN_HEIGHT) // 2
                    self.bg_image = scaled.subsurface((x, y, SCREEN_WIDTH, SCREEN_HEIGHT)).copy()
                    print(f"[+] Background loaded: {path}")
                    break
                except Exception as e:
                    print(f"[!] Background load error: {e}")
                    pass

    def _load_social_icons(self):
        """Load social media icons."""
        socials_dir = self._resolve_asset_path("src/socials")
        icon_names = ["ig", "yt", "discord"]
        
        for name in icon_names:
            for ext in [".png", ".jpg"]:
                path = socials_dir / f"{name}{ext}"
                if path.exists():
                    try:
                        img = pygame.image.load(str(path))
                        self.social_icons[name] = pygame.transform.smoothscale(img, (32, 32))
                        break
                    except:
                        pass

    def _load_mute_icons(self):
        """Load mute/unmute icons."""
        pics_dir = self._resolve_asset_path("src/pics")
        
        mute_path = pics_dir / "mute.png"
        unmute_path = pics_dir / "unmute.png"
        
        if mute_path.exists():
            try:
                img = pygame.image.load(str(mute_path))
                self.mute_icons["mute"] = pygame.transform.smoothscale(img, (32, 32))
            except:
                pass
        
        if unmute_path.exists():
            try:
                img = pygame.image.load(str(unmute_path))
                self.mute_icons["unmute"] = pygame.transform.smoothscale(img, (32, 32))
            except:
                pass

    def _load_arrow_icons(self):
        """Load arrow icons for navigation."""
        arrow_path = self._resolve_asset_path("src/pics/left-arrow.png")
        if arrow_path.exists():
            try:
                img = pygame.image.load(str(arrow_path))
                self.arrow_icons["left"] = pygame.transform.smoothscale(img, (50, 50))
                # Flip horizontally for right arrow
                self.arrow_icons["right"] = pygame.transform.flip(self.arrow_icons["left"], True, False)
                print("[+] Arrow icons loaded")
            except Exception as e:
                print(f"[!] Arrow icon error: {e}")

    def _load_jutsu_videos(self):
        """Load video paths for jutsu effects."""
        for name, data in self.jutsu_list.items():
            video_path = data.get("video_path")
            resolved_video = self._resolve_asset_path(video_path) if video_path else None
            if resolved_video and resolved_video.exists():
                self.jutsu_videos[name] = str(resolved_video)
                print(f"[+] Jutsu video found: {name}")

    def toggle_mute(self):
        """Toggle music mute."""
        self.is_muted = not self.is_muted
        if self.is_muted:
            pygame.mixer.music.set_volume(0)
        else:
            pygame.mixer.music.set_volume(self._effective_music_volume(self.settings["music_vol"]))

    def _default_persisted_settings(self):
        return {
            "music_vol": 0.5,
            "sfx_vol": 0.7,
            "camera_idx": 0,
            "debug_hands": False,
            "resolution_idx": 0,
            "fullscreen": False,
        }

    def _sanitize_persisted_settings(self, raw):
        base = self._default_persisted_settings()
        if not isinstance(raw, dict):
            return dict(base)

        out = dict(base)
        try:
            out["music_vol"] = max(0.0, min(1.0, float(raw.get("music_vol", base["music_vol"]))))
        except Exception:
            pass
        try:
            out["sfx_vol"] = max(0.0, min(1.0, float(raw.get("sfx_vol", base["sfx_vol"]))))
        except Exception:
            pass
        try:
            out["camera_idx"] = max(0, int(raw.get("camera_idx", base["camera_idx"])))
        except Exception:
            pass
        out["debug_hands"] = bool(raw.get("debug_hands", base["debug_hands"]))
        try:
            max_idx = max(0, len(RESOLUTION_OPTIONS) - 1)
            out["resolution_idx"] = min(max_idx, max(0, int(raw.get("resolution_idx", base["resolution_idx"]))))
        except Exception:
            pass
        out["fullscreen"] = bool(raw.get("fullscreen", base["fullscreen"]))
        return out

    def _persisted_settings_payload(self):
        source = {
            "music_vol": self.settings.get("music_vol", 0.5),
            "sfx_vol": self.settings.get("sfx_vol", 0.7),
            "camera_idx": self.settings.get("camera_idx", 0),
            "debug_hands": self.settings.get("debug_hands", False),
            "resolution_idx": self.settings.get("resolution_idx", 0),
            "fullscreen": self.settings.get("fullscreen", False),
        }
        return self._sanitize_persisted_settings(source)

    def _apply_runtime_setting_overrides(self):
        # Runtime-only detector policy.
        self.settings["use_mediapipe_signs"] = True
        self.settings["restricted_signs"] = True

    def load_settings(self):
        """
        Initialize settings from defaults only.
        Logged-in users are loaded from cloud via load_settings_from_cloud().
        """
        persisted = self._sanitize_persisted_settings(self.settings if isinstance(getattr(self, "settings", None), dict) else {})
        self.settings.update(persisted)
        self._apply_runtime_setting_overrides()

    def apply_settings_runtime(self):
        """Apply already-loaded settings to runtime/display (main thread only)."""
        res_idx = int(self.settings.get("resolution_idx", 0) or 0)
        if 0 <= res_idx < len(RESOLUTION_OPTIONS):
            _, rw, rh = RESOLUTION_OPTIONS[res_idx]
        else:
            _, rw, rh = RESOLUTION_OPTIONS[0]
            self.settings["resolution_idx"] = 0
        self.screen_w = rw
        self.screen_h = rh
        self.fullscreen = bool(self.settings.get("fullscreen", False))
        if hasattr(self, "_apply_display_mode"):
            self._apply_display_mode()
        if (not getattr(self, "is_muted", False)) and pygame.mixer.get_init():
            pygame.mixer.music.set_volume(self._effective_music_volume(self.settings.get("music_vol", 0.5)))
        return {"ok": True}

    def load_settings_from_cloud(self, apply_runtime=True):
        """Best-effort cloud sync of persisted user settings for authenticated users."""
        if getattr(self, "username", "Guest") == "Guest":
            return {"ok": False, "reason": "guest"}
        nm = getattr(self, "network_manager", None)
        if (not nm) or (not nm.client):
            return {"ok": False, "reason": "offline"}

        discord_id = ""
        if hasattr(self, "_active_discord_id"):
            discord_id = str(self._active_discord_id() or "")
        if not discord_id and isinstance(getattr(self, "discord_user", None), dict):
            discord_id = str(self.discord_user.get("id") or "")

        res = nm.get_profile_settings_authoritative(
            username=str(self.username or ""),
            discord_id=discord_id,
        )
        if not isinstance(res, dict) or (not res.get("ok", False)):
            return res if isinstance(res, dict) else {"ok": False, "reason": "settings_unavailable"}

        cloud_settings = self._sanitize_persisted_settings(res.get("settings", {}))
        self.settings.update(cloud_settings)
        self._apply_runtime_setting_overrides()

        if not apply_runtime:
            return {"ok": True}

        return self.apply_settings_runtime()

    def save_settings(self):
        """Persist settings to cloud only (no local settings file)."""
        persisted = self._persisted_settings_payload()
        self.settings.update(persisted)
        self._apply_runtime_setting_overrides()

        if getattr(self, "username", "Guest") == "Guest":
            return {"ok": True, "reason": "guest_no_persist"}
        nm = getattr(self, "network_manager", None)
        if (not nm) or (not nm.client):
            return {"ok": False, "reason": "offline"}

        discord_id = ""
        if hasattr(self, "_active_discord_id"):
            discord_id = str(self._active_discord_id() or "")
        if not discord_id and isinstance(getattr(self, "discord_user", None), dict):
            discord_id = str(self.discord_user.get("id") or "")

        res = nm.upsert_profile_settings_authoritative(
            username=str(self.username or ""),
            user_settings=persisted,
            discord_id=discord_id,
        )
        if isinstance(res, dict) and res.get("ok", False):
            return res
        reason = res.get("reason", "settings_sync_failed") if isinstance(res, dict) else "settings_sync_failed"
        print(f"[!] Settings cloud sync failed: {reason}")
        return res if isinstance(res, dict) else {"ok": False, "reason": reason}
