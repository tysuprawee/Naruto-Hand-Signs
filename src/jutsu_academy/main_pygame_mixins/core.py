from src.jutsu_academy.main_pygame_shared import *
import datetime


class CoreMixin:
    def _active_discord_id(self):
        user = getattr(self, "discord_user", None)
        if isinstance(user, dict):
            return str(user.get("id") or "").strip()
        return ""

    def _sync_network_identity(self):
        nm = getattr(self, "network_manager", None)
        if not nm:
            return
        try:
            nm.set_active_identity(
                username=str(getattr(self, "username", "") or ""),
                discord_id=self._active_discord_id(),
            )
        except Exception:
            pass

    def _is_authoritative_competitive_user(self):
        return bool(
            self.username != "Guest"
            and self._active_discord_id()
            and self.network_manager
            and self.network_manager.client
        )

    def _quest_now_utc(self):
        nm = getattr(self, "network_manager", None)
        if nm:
            try:
                return nm.get_authoritative_utc_now()
            except Exception:
                pass
        return datetime.datetime.now(datetime.timezone.utc)

    def _daily_period_id(self):
        return self._quest_now_utc().strftime("%Y-%m-%d")

    def _weekly_period_id(self):
        y, w, _ = self._quest_now_utc().date().isocalendar()
        return f"{y}-W{w:02d}"

    def _default_quest_state(self):
        return {
            "daily": {
                "period": self._daily_period_id(),
                "quests": {
                    "d_signs": {"progress": 0, "claimed": False},
                    "d_jutsus": {"progress": 0, "claimed": False},
                    "d_xp": {"progress": 0, "claimed": False},
                },
            },
            "weekly": {
                "period": self._weekly_period_id(),
                "quests": {
                    "w_jutsus": {"progress": 0, "claimed": False},
                    "w_challenges": {"progress": 0, "claimed": False},
                    "w_xp": {"progress": 0, "claimed": False},
                },
            },
        }

    def _apply_competitive_state(self, payload):
        """
        Apply authoritative competitive payload to local runtime state.
        Expected shape: {profile:{...}, quests:{...}} (or flat profile).
        """
        if not isinstance(payload, dict):
            return {"ok": False, "reason": "invalid_payload"}

        prev_level = int(self.progression.level)
        profile_payload = payload.get("profile")
        if not isinstance(profile_payload, dict):
            profile_payload = payload

        leveled = self.progression.apply_authoritative_profile(profile_payload)
        quests_payload = payload.get("quests")
        if isinstance(quests_payload, dict):
            self.quest_state = quests_payload

        return {
            "ok": True,
            "leveled_up": bool(leveled),
            "previous_level": prev_level,
            "weak": bool(payload.get("weak", False)),
        }

    def _sync_competitive_state(self, force=False):
        """Best-effort refresh of authoritative progression/quest state."""
        if not self._is_authoritative_competitive_user():
            return {"ok": False, "reason": "not_authoritative_user"}
        if getattr(self, "_quest_sync_inflight", False):
            return {"ok": False, "reason": "inflight"}

        now = time.time()
        last = float(getattr(self, "_quest_state_last_sync_at", 0.0) or 0.0)
        interval = float(getattr(self, "_quest_state_sync_interval_s", 20.0) or 20.0)
        if (not force) and ((now - last) < interval):
            return {"ok": False, "reason": "throttled"}

        self._quest_sync_inflight = True
        try:
            res = self.network_manager.get_competitive_state_authoritative(
                self.username,
                discord_id=self._active_discord_id(),
            )
            if isinstance(res, dict) and res.get("ok", False):
                self._apply_competitive_state(res)
                self._quest_state_last_sync_at = now
                return {"ok": True, "weak": bool(res.get("weak", False))}
            self._quest_state_last_sync_at = now
            return res if isinstance(res, dict) else {"ok": False, "reason": "state_unavailable"}
        finally:
            self._quest_sync_inflight = False

    def _queue_post_effect_alert(self, alert_type, payload=None, min_delay_s=0.45, wait_for_effect_end=True):
        """Queue an alert to appear after jutsu effect playback (plus optional delay)."""
        if not hasattr(self, "post_effect_alerts") or self.post_effect_alerts is None:
            self.post_effect_alerts = []
        now = time.time()
        base = now
        if getattr(self, "jutsu_active", False):
            if wait_for_effect_end:
                jutsu_start = float(getattr(self, "jutsu_start_time", now) or now)
                jutsu_duration = float(getattr(self, "jutsu_duration", 0.0) or 0.0)
                base = max(base, jutsu_start + max(0.0, jutsu_duration))
            else:
                base = max(base, float(getattr(self, "jutsu_start_time", now) or now))
        self.post_effect_alerts.append({
            "type": str(alert_type),
            "payload": payload if isinstance(payload, dict) else {},
            "ready_at": float(base + max(0.0, float(min_delay_s))),
            "wait_for_effect_end": bool(wait_for_effect_end),
        })

    def _dispatch_post_effect_alerts(self):
        """Dispatch due post-effect alerts into the modal alert queue."""
        queue = getattr(self, "post_effect_alerts", None)
        if not queue:
            return

        now = time.time()
        remaining = []
        for item in queue:
            ready_at = float(item.get("ready_at", now))
            if bool(item.get("wait_for_effect_end", False)) and bool(getattr(self, "jutsu_active", False)):
                remaining.append(item)
                continue
            if now < ready_at:
                remaining.append(item)
                continue

            kind = str(item.get("type", "") or "")
            payload = item.get("payload") if isinstance(item.get("payload"), dict) else {}
            if kind == "level_up":
                prev = int(payload.get("previous_level", self.progression.level))
                source = str(payload.get("source_label", ""))
                self._notify_level_up(previous_level=prev, source_label=source)
            elif kind == "mastery":
                self._notify_mastery_update(
                    jutsu_name=str(payload.get("jutsu_name", "")),
                    mastery_info=payload.get("mastery_info"),
                )
            elif kind == "unlocks":
                prev = int(payload.get("previous_level", self.progression.level))
                self.process_unlock_alerts(previous_level=prev)

        self.post_effect_alerts = remaining

    def _reset_daily_quests(self):
        self.quest_state["daily"] = {
            "period": self._daily_period_id(),
            "quests": {
                "d_signs": {"progress": 0, "claimed": False},
                "d_jutsus": {"progress": 0, "claimed": False},
                "d_xp": {"progress": 0, "claimed": False},
            },
        }

    def _reset_weekly_quests(self):
        self.quest_state["weekly"] = {
            "period": self._weekly_period_id(),
            "quests": {
                "w_jutsus": {"progress": 0, "claimed": False},
                "w_challenges": {"progress": 0, "claimed": False},
                "w_xp": {"progress": 0, "claimed": False},
            },
        }

    def _refresh_quest_periods(self):
        if self._is_authoritative_competitive_user():
            # Server is authority for quest period/reset; periodic refresh only.
            now = time.time()
            last = float(getattr(self, "_quest_state_last_sync_at", 0.0) or 0.0)
            interval = float(getattr(self, "_quest_state_sync_interval_s", 20.0) or 20.0)
            if (now - last) >= interval and (not getattr(self, "_quest_sync_inflight", False)):
                threading.Thread(target=self._sync_competitive_state, kwargs={"force": True}, daemon=True).start()
            return

        changed = False
        if self.quest_state.get("daily", {}).get("period") != self._daily_period_id():
            self._reset_daily_quests()
            changed = True
        if self.quest_state.get("weekly", {}).get("period") != self._weekly_period_id():
            self._reset_weekly_quests()
            changed = True
        if changed:
            self._save_player_meta()

    def _inc_quest_progress(self, quest_id, amount=1):
        for scope in ("daily", "weekly"):
            q = self.quest_state.get(scope, {}).get("quests", {}).get(quest_id)
            if q and not q.get("claimed", False):
                q["progress"] = int(q.get("progress", 0)) + int(amount)

    def _record_sign_progress(self):
        if self._is_authoritative_competitive_user():
            return
        self._inc_quest_progress("d_signs", 1)

    def _record_jutsu_completion(self, xp_gain, is_challenge, signs_landed=0, jutsu_name=""):
        if self._is_authoritative_competitive_user():
            res = self.network_manager.award_jutsu_completion_authoritative(
                username=self.username,
                xp_gain=int(xp_gain),
                signs_landed=int(max(0, signs_landed)),
                is_challenge=bool(is_challenge),
                mode=str(jutsu_name).upper(),
                discord_id=self._active_discord_id(),
            )
            if not isinstance(res, dict) or (not res.get("ok", False)):
                return {
                    "ok": False,
                    "reason": res.get("reason", "award_rejected") if isinstance(res, dict) else "award_rejected",
                }
            applied = self._apply_competitive_state(res)
            if isinstance(res.get("quests"), dict):
                self.quest_state = res.get("quests")
            return {
                "ok": True,
                "source": "rpc",
                "xp_awarded": int(res.get("xp_awarded", xp_gain) or 0),
                "leveled_up": bool(applied.get("leveled_up", False)),
                "previous_level": int(applied.get("previous_level", self.progression.level)),
            }

        self._inc_quest_progress("d_jutsus", 1)
        self._inc_quest_progress("w_jutsus", 1)
        self._inc_quest_progress("d_xp", int(xp_gain))
        self._inc_quest_progress("w_xp", int(xp_gain))
        if is_challenge:
            self._inc_quest_progress("w_challenges", 1)
        prev_level = self.progression.level
        leveled = self.progression.add_xp(int(xp_gain))
        self._save_player_meta()
        return {
            "ok": True,
            "source": "local_guest",
            "xp_awarded": int(xp_gain),
            "leveled_up": bool(leveled),
            "previous_level": int(prev_level),
        }

    def _quest_definitions(self):
        return [
            ("daily", "d_signs", "Land 25 correct signs", 25, 120),
            ("daily", "d_jutsus", "Complete 5 jutsu runs", 5, 180),
            ("daily", "d_xp", "Earn 450 XP", 450, 250),
            ("weekly", "w_jutsus", "Complete 30 jutsu runs", 30, 700),
            ("weekly", "w_challenges", "Finish 12 rank mode runs", 12, 900),
            ("weekly", "w_xp", "Earn 4000 XP", 4000, 1200),
        ]

    def _claim_quest(self, scope, quest_id):
        defs = {f"{s}:{qid}": (target, reward, title) for s, qid, title, target, reward in self._quest_definitions()}
        key = f"{scope}:{quest_id}"
        if key not in defs:
            return False
        target, reward, title = defs[key]

        if self._is_authoritative_competitive_user():
            if getattr(self, "_quest_claim_inflight", False):
                return False
            self._quest_claim_inflight = True
            try:
                res = self.network_manager.claim_quest_authoritative(
                    username=self.username,
                    scope=scope,
                    quest_id=quest_id,
                    discord_id=self._active_discord_id(),
                )
                if not isinstance(res, dict) or (not res.get("ok", False)):
                    reason = "claim_rejected"
                    detail = ""
                    rpc_name = "claim_quest_authoritative"
                    if isinstance(res, dict):
                        reason = str(res.get("reason", reason))
                        detail = str(res.get("detail", "") or "")
                        rpc_name = str(res.get("rpc", rpc_name) or rpc_name)

                    if reason in {"rpc_missing", "rpc_unavailable", "rpc_forbidden"}:
                        self.show_alert(
                            "Quest Reward",
                            "Claim service unavailable.\n"
                            "Deploy server RPCs via sql/competitive_state_rpcs.sql, then retry.",
                        )
                    elif reason in {"rpc_timeout", "offline"}:
                        self.show_alert("Quest Reward", "Server timeout/offline. Please retry in a moment.")
                    else:
                        msg = f"Claim failed: {reason}"
                        if detail:
                            msg += f"\n{detail}"
                        self.show_alert("Quest Reward", msg)
                    print(f"[!] Quest claim failed ({rpc_name}): reason={reason} detail={detail}")
                    return False

                applied = self._apply_competitive_state(res)
                reward_xp = int(res.get("reward_xp", reward) or 0)
                reward_title = str(res.get("title", title) or title)
                self.play_sound("reward")
                self.show_alert("Quest Reward", f"{reward_title}\nReward claimed: +{reward_xp} XP", "CLAIMED")

                if applied.get("leveled_up", False):
                    self._notify_level_up(previous_level=int(applied.get("previous_level", self.progression.level)), source_label="Quest Reward")
                    self.xp_popups.append({
                        "text": f"RANK UP: {self.progression.rank}!",
                        "x": SCREEN_WIDTH // 2,
                        "y": SCREEN_HEIGHT // 2,
                        "timer": 2.8,
                        "color": COLORS["success"],
                    })
                else:
                    self.process_unlock_alerts(previous_level=int(applied.get("previous_level", self.progression.level)))
                return True
            finally:
                self._quest_claim_inflight = False

        q = self.quest_state.get(scope, {}).get("quests", {}).get(quest_id)
        if not q or q.get("claimed", False) or int(q.get("progress", 0)) < int(target):
            return False
        q["claimed"] = True
        self.play_sound("reward")
        prev_level = self.progression.level
        leveled = self.progression.add_xp(reward)
        self.show_alert("Quest Reward", f"{title}\nReward claimed: +{reward} XP", "CLAIMED")
        if leveled:
            self._notify_level_up(previous_level=prev_level, source_label="Quest Reward")
            self.xp_popups.append({
                "text": f"RANK UP: {self.progression.rank}!",
                "x": SCREEN_WIDTH // 2,
                "y": SCREEN_HEIGHT // 2,
                "timer": 2.8,
                "color": COLORS["success"],
            })
        else:
            self.process_unlock_alerts(previous_level=prev_level)
        self._save_player_meta()
        return True

    def _mastery_thresholds(self, jutsu_name):
        seq_len = max(1, len(self.jutsu_list.get(jutsu_name, {}).get("sequence", [])))
        return {
            "bronze": seq_len * 4.0,
            "silver": seq_len * 2.8,
            "gold": seq_len * 2.0,
        }

    def _get_mastery_tier(self, jutsu_name):
        best = self.mastery_data.get(jutsu_name, {}).get("best_time")
        if best is None:
            return "none"
        t = self._mastery_thresholds(jutsu_name)
        if best <= t["gold"]:
            return "gold"
        if best <= t["silver"]:
            return "silver"
        if best <= t["bronze"]:
            return "bronze"
        return "none"

    def _record_mastery_completion(self, jutsu_name, clear_time):
        if clear_time is None or clear_time <= 0:
            return {"improved": False}
        thresholds = self._mastery_thresholds(jutsu_name)
        row = self.mastery_data.setdefault(jutsu_name, {})
        best = row.get("best_time")
        prev_tier = self._get_mastery_tier(jutsu_name)
        if best is None or clear_time < best:
            row["best_time"] = float(clear_time)
            self._save_player_meta()
            new_tier = self._get_mastery_tier(jutsu_name)
            return {
                "improved": True,
                "first_record": best is None,
                "previous_best": float(best) if best is not None else None,
                "new_best": float(clear_time),
                "previous_tier": str(prev_tier),
                "new_tier": str(new_tier),
                "thresholds": thresholds,
            }
        return {
            "improved": False,
            "first_record": False,
            "previous_best": float(best) if best is not None else None,
            "new_best": float(best) if best is not None else None,
            "previous_tier": str(prev_tier),
            "new_tier": str(prev_tier),
            "thresholds": thresholds,
        }

    def _player_meta_file_path(self):
        safe_name = "".join(ch for ch in str(self.username or "Guest") if ch.isalnum())
        if not safe_name:
            safe_name = "Guest"
        return Path(f"user_meta_{safe_name}.json")

    def _load_player_meta_local(self):
        path = self._player_meta_file_path()
        if not path.exists():
            return {}
        try:
            with open(path, "r") as f:
                data = json.load(f)
            if isinstance(data, dict):
                return data
        except Exception:
            pass
        return {}

    def _save_player_meta_local(self):
        path = self._player_meta_file_path()
        payload = {
            "tutorial_seen": bool(getattr(self, "tutorial_seen", False)),
            "tutorial_seen_at": getattr(self, "tutorial_seen_at", None),
            "tutorial_version": str(getattr(self, "tutorial_version", "1.0") or "1.0"),
            "mastery": self.mastery_data if isinstance(getattr(self, "mastery_data", None), dict) else {},
        }
        try:
            with open(path, "w") as f:
                json.dump(payload, f, indent=2)
        except Exception as e:
            print(f"[!] Local player meta save failed: {e}")

    def _clear_player_meta_local(self):
        path = self._player_meta_file_path()
        try:
            path.unlink(missing_ok=True)
        except Exception:
            pass

    def _normalize_mastery_map(self, raw_mastery):
        """Sanitize mastery payload into {jutsu_name: {best_time: float}}."""
        if not isinstance(raw_mastery, dict):
            return {}
        out = {}
        for raw_name, raw_row in raw_mastery.items():
            name = str(raw_name or "").strip()
            if not name:
                continue
            best = None
            if isinstance(raw_row, dict):
                best = raw_row.get("best_time")
            elif isinstance(raw_row, (int, float)):
                best = raw_row
            if best is None:
                continue
            try:
                best_f = float(best)
            except Exception:
                continue
            if best_f <= 0:
                continue
            out[name] = {"best_time": best_f}
        return out

    def _merge_mastery_maps(self, local_mastery, cloud_mastery):
        """Merge local + cloud mastery, keeping better (lower) best_time per jutsu."""
        merged = {}
        local_norm = self._normalize_mastery_map(local_mastery)
        cloud_norm = self._normalize_mastery_map(cloud_mastery)
        all_names = set(local_norm.keys()) | set(cloud_norm.keys())
        for name in all_names:
            local_best = local_norm.get(name, {}).get("best_time")
            cloud_best = cloud_norm.get(name, {}).get("best_time")
            if local_best is None and cloud_best is None:
                continue
            if local_best is None:
                best = float(cloud_best)
            elif cloud_best is None:
                best = float(local_best)
            else:
                best = float(min(local_best, cloud_best))
            if best > 0:
                merged[name] = {"best_time": best}
        return merged

    def _load_player_meta(self):
        # Cloud-authoritative meta only. Guest does not persist local meta.
        self.tutorial_seen = False
        self.tutorial_seen_at = None
        self.tutorial_version = "1.0"
        self._profile_meta_cloud_sync_enabled = True
        self.mastery_data = {}
        self.quest_state = self._default_quest_state()

        if self.username == "Guest":
            # Ensure stale guest files are removed; guests are not allowed to persist progression/meta.
            self._clear_player_meta_local()
            self._refresh_quest_periods()
            return

        # Logged-in users do not trust local file; purge stale local meta cache.
        self._clear_player_meta_local()

        if self.network_manager and self.network_manager.client:
            try:
                profile = self.network_manager.get_profile(
                    self.username,
                    discord_id=self._active_discord_id(),
                )
                if isinstance(profile, dict) and profile:
                    cloud_seen = bool(profile.get("tutorial_seen", False))
                    cloud_seen_at = profile.get("tutorial_seen_at")
                    cloud_ver = profile.get("tutorial_version")
                    if cloud_seen:
                        self.tutorial_seen = True
                    if cloud_seen_at and not self.tutorial_seen_at:
                        self.tutorial_seen_at = cloud_seen_at
                    if cloud_ver:
                        self.tutorial_version = str(cloud_ver)
                    self.mastery_data = self._normalize_mastery_map(profile.get("mastery"))
            except Exception:
                pass

        if self._is_authoritative_competitive_user():
            # Pull quests/progression from authoritative server source.
            self._sync_competitive_state(force=True)
        self._refresh_quest_periods()

    def _sync_profile_meta_to_cloud(self):
        """Best-effort cloud sync for non-competitive profile meta (tutorial/mastery)."""
        if not getattr(self, "_profile_meta_cloud_sync_enabled", True):
            return
        if self.username == "Guest":
            return
        if not self._active_discord_id():
            return
        if not self.network_manager or not self.network_manager.client:
            return
        try:
            self.network_manager.upsert_profile_meta(
                username=self.username,
                tutorial_seen=bool(self.tutorial_seen),
                tutorial_seen_at=self.tutorial_seen_at,
                tutorial_version=self.tutorial_version,
                mastery=self.mastery_data if isinstance(self.mastery_data, dict) else {},
                discord_id=self._active_discord_id(),
            )
        except Exception as e:
            # If schema isn't migrated yet, avoid repeated noisy attempts.
            self._profile_meta_cloud_sync_enabled = False
            print(f"[!] Profile meta cloud sync disabled: {e}")

    def _save_player_meta(self):
        if self.username == "Guest":
            self._clear_player_meta_local()
            return
        # Logged-in users stay cloud-authoritative; avoid trust-on-local meta cache.
        self._clear_player_meta_local()
        self._sync_profile_meta_to_cloud()

    def __init__(self):
        from src.jutsu_academy.effects import (
            EffectOrchestrator,
            ReaperDeathSealEffect,
            ShadowCloneEffect,
            WaterDragonEffect,
        )
        from src.jutsu_academy.effects.sharingan_effect import SharinganEffect

        pygame.init()
        pygame.display.set_caption("Jutsu Academy")

        # Bootstrap with hidden window; reveal after settings bootstrap finishes.
        self.screen_w = SCREEN_WIDTH
        self.screen_h = SCREEN_HEIGHT
        self.fullscreen = False
        self.screen = pygame.display.set_mode((self.screen_w, self.screen_h), pygame.HIDDEN)
        self.clock = pygame.time.Clock()
        self.running = True
        
        # State
        self.state = GameState.MENU
        self.prev_state = None
        self.about_scroll_y = 0  # Scroll position for About page
        self.practice_scroll_y = 0
        self.library_mode = "browse"  # browse | freeplay | challenge
        self.library_item_rects = []
        
        # User/Auth state
        self.username = "Guest"
        self.discord_user = None
        self.user_avatar = None
        self.login_in_progress = False
        self.login_attempt_id = 0          # Incremented each login attempt
        self.login_started_at = 0.0        # Timestamp when login started
        self.discord_auth_url = None       # Current OAuth URL (for resume)
        self.login_timeout_s = 180         # 3 minutes timeout
        self.login_error = ""              # Error message for UI
        self.auth_instance = None          # Active DiscordLogin instance
        self.profile_dropdown_open = False
        self.login_modal_message = ""
        self.pending_action = None  # Action to perform after login
        self._pending_runtime_settings_apply = False
        self._load_user_session()
        
        # Settings
        self.settings = {
            "music_vol": 0.5,
            "sfx_vol": 0.7,
            "camera_idx": 0,
            "debug_hands": False,
            "use_mediapipe_signs": True,
            "restricted_signs": True,
            "resolution_idx": 0,
            "fullscreen": False,
        }
        self.load_settings()
        self.settings["use_mediapipe_signs"] = True
        self.settings["restricted_signs"] = True

        # Initialize network early so cloud settings can be loaded before first visible frame/audio.
        self.network_manager = NetworkManager()
        self._sync_network_identity()
        bootstrap_cloud_settings_ok = False
        if self.username != "Guest" and self.network_manager.client:
            try:
                cloud_res = self.load_settings_from_cloud(apply_runtime=False)
                bootstrap_cloud_settings_ok = bool(isinstance(cloud_res, dict) and cloud_res.get("ok", False))
            except Exception:
                pass

        # Apply saved resolution/fullscreen *after* load_settings
        res_idx = self.settings.get("resolution_idx", 0)
        if 0 <= res_idx < len(RESOLUTION_OPTIONS):
            _, rw, rh = RESOLUTION_OPTIONS[res_idx]
        else:
            _, rw, rh = RESOLUTION_OPTIONS[0]
            self.settings["resolution_idx"] = 0
        self.screen_w = rw
        self.screen_h = rh
        self.fullscreen = bool(self.settings.get("fullscreen", False))
        self._apply_display_mode()
        
        # Camera list (startup-safe; no hardware probe here)
        self.cameras = self._scan_cameras(probe=False)
        self.camera_device_indices = []
        
        # Fonts (Load once to avoid performance issues)
        self.fonts = {
            "title_lg": pygame.font.Font(None, 80),
            "title_md": pygame.font.Font(None, 56),
            "title_sm": pygame.font.Font(None, 40),
            "body": pygame.font.Font(None, 28),
            "body_sm": pygame.font.Font(None, 24),
            "small": pygame.font.Font(None, 18),
            "tiny": pygame.font.Font(None, 16),
            "icon": pygame.font.Font(None, 30),
        }
        
        # Audio
        pygame.mixer.init()
        self.sounds = {}
        self.music_playing = False
        
        # Game state (must init before loading sounds that use jutsu_list)
        self.game_mode = "practice"  # practice, challenge
        self.jutsu_list = OFFICIAL_JUTSUS.copy()
        self.jutsu_names = list(self.jutsu_list.keys())
        
        # Now load sounds (uses jutsu_list)
        self._load_sounds()
        self._try_play_music()
        
        # ML Models (lazy loaded)
        self.model = None
        self.recorder = SignRecorder() # MediaPipe + KNN
        
        # Network & Leaderboard
        self.connection_monitor_interval_s = 10.0
        self.connection_monitor_fail_limit = 5
        self.connection_monitor_grace_until = time.time() + 25.0
        self.connection_last_ok_at = 0.0
        self.connection_fail_count = 0
        self.connection_lost_title = "Connection Lost"
        self.connection_lost_lines = ["Network connection interrupted.", "Session has been terminated."]

        missing_backend_config = bool(
            (not str(getattr(self.network_manager, "url", "") or "").strip())
            or (not str(getattr(self.network_manager, "key", "") or "").strip())
        )
        if missing_backend_config:
            print("[!] Startup blocked: missing Supabase credentials in packaged environment.")
            self.connection_lost_title = "Configuration Missing"
            self.connection_lost_lines = [
                "Missing Supabase config (.env).",
                "Rebuild installer with .env.release.",
            ]
            self._handle_connection_lost(force_logout=True)
        else:
            threading.Thread(target=self._monitor_connection_loop, daemon=True).start()
            if not self._has_backend_connection(timeout_s=1.5):
                print("[!] Startup connectivity preflight failed.")
                self._handle_connection_lost(force_logout=True)
            else:
                self.connection_last_ok_at = time.time()

        if self.username != "Guest" and self.network_manager.client:
            try:
                self.network_manager.ensure_profile_identity_bound(
                    username=self.username,
                    discord_id=self._active_discord_id(),
                )
            except Exception:
                pass
            if not bootstrap_cloud_settings_ok:
                try:
                    self.load_settings_from_cloud(apply_runtime=True)
                except Exception:
                    pass
        self.leaderboard_data = []
        self.leaderboard_loading = False
        self.leaderboard_avatars = {} # Cache for rounded surfaces

        # Progression System (Shinobi Path)
        self.progression = ProgressionManager(self.username, network_manager=self.network_manager)
        self.xp_popups = [] # List of {"text": str, "x": int, "y": int, "timer": float, "color": tuple}
        self.unlocked_jutsus_known = {
            name for name, data in self.jutsu_list.items()
            if self.progression.level >= data.get("min_level", 0)
        }
        self._quest_state_last_sync_at = 0.0
        self._quest_state_sync_interval_s = 20.0
        self._quest_sync_inflight = False
        self._quest_claim_inflight = False
        self._warned_authoritative_progression_unavailable = False

        # Reusable alert queue/modal state
        self.alert_queue = []
        self.active_alert = None
        self.alert_ok_rect = pygame.Rect(0, 0, 0, 0)
        self.post_effect_alerts = []
        self.reward_panel_queue = []
        
        # Announcements
        self.announcements = []
        self.announcements_loading = False
        self.show_announcements = False
        self.current_announcement_idx = 0
        self.announcements_fetched = False
        self.version_alert_for_version = None
        self.announcement_timer_start = time.time()
        self.announcement_auto_show_delay = 1.5
        self.force_update_required = False
        self.force_update_remote_version = ""
        self.force_update_message = ""
        self.force_update_url = SOCIAL_LINKS.get("discord", "")
        self.force_maintenance_required = False
        self.force_maintenance_message = ""
        self.force_maintenance_url = SOCIAL_LINKS.get("discord", "")
        self.config_poll_interval_s = 20.0
        self.config_poll_last_at = 0.0
        
        # Trigger background fetch if online
        if self.network_manager.client:
             threading.Thread(target=self._fetch_announcements, daemon=True).start()

        self.class_names = None
        self.face_landmarker = None
        self.hand_landmarker = None
        self.hand_landmarker_image = None
        self.legacy_hands = None
        self.hand_detector_backend = "none"
        self.hand_detector_error = ""
        self.hand_model_path = ""
        self.hand_model_exists = False
        self.last_mp_timestamp = 0
        
        # Camera
        self.cap = None
        self.settings_preview_cap = None
        self.settings_preview_idx = None
        self.settings_preview_enabled = False
        self.camera_scan_last_at = 0.0
        
        # Game state continued
        self.current_jutsu_idx = 0
        self.sequence = []
        self.current_step = 0
        self.last_sign_time = 0
        self.cooldown = 0.5
        self.jutsu_active = False
        self.jutsu_start_time = 0
        self.jutsu_duration = 5.0
        self.pending_sounds = []
        self.pending_effects = []
        self.clone_spawn_delay_s = 1.5
        self.combo_clone_hold = False
        self.combo_chidori_triple = False
        self.combo_rasengan_triple = False
        
        # Challenge Mode State
        self.challenge_state = "waiting" # waiting, countdown, active, results
        self.challenge_start_time = 0
        self.challenge_final_time = 0
        self.challenge_countdown_start = 0
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
        
        # Modal Rects (Pre-initialize to avoid first-frame click fails)
        self.welcome_ok_rect = pygame.Rect(0, 0, 0, 0)
        self.welcome_modal_timer = 0.0 # For animations
        
        # Tracking & Smoothing
        self.mouth_pos = None
        self.left_eye_pos = None
        self.right_eye_pos = None
        self.left_eye_size = None
        self.right_eye_size = None
        self.left_eye_angle = 0.0
        self.right_eye_angle = 0.0
        self.hand_pos = None
        self.smooth_hand_pos = None
        self.hand_effect_scale = 1.0
        self.smooth_hand_effect_scale = None
        self.tracked_hand_label = None
        self.hand_lost_frames = 0
        self.max_hold_frames = 15 # frames to keep the effect where it was
        self.head_yaw = 0
        self.head_pitch = 0
        self.last_mp_result = None
        self.last_palm_spans = []

        # Robust sign recognition state
        self.raw_detected_sign = "idle"
        self.raw_detected_confidence = 0.0
        self.detected_sign = "idle"
        self.detected_confidence = 0.0
        self.last_detected_hands = 0
        self.sign_vote_window = []
        self.last_vote_hits = 0
        self.vote_window_size = 2
        self.vote_required_hits = 2
        self.vote_min_confidence = 0.45
        self.vote_entry_ttl_s = 0.7
        self.show_detection_panel = False
        self.model_toggle_rect = pygame.Rect(0, 0, 0, 0)
        self.diag_toggle_rect = pygame.Rect(0, 0, 0, 0)

        # Lighting quality gate
        self.lighting_status = "unknown"
        self.lighting_mean = 0.0
        self.lighting_contrast = 0.0
        self.lighting_min = 45.0
        self.lighting_max = 210.0
        self.lighting_min_contrast = 22.0

        # Per-user calibration profile
        self.calibration_profile = {}
        self.calibration_loaded_for = None
        self.calibration_active = False
        self.calibration_last_sync_ok = False
        self.calibration_restore_diag_state = None
        self.calibration_gate_pending_mode = ""
        self.calibration_gate_return_pending = False
        self.calibration_gate_return_at = 0.0
        self.calibration_started_at = 0.0
        self.calibration_duration_s = 12.0
        self.calibration_min_samples = 100
        self.calibration_samples = []
        self.calibration_message = ""
        self.calibration_message_until = 0.0
        self.calibration_camera_available = False
        self.calibration_camera_error = ""

        # Effects
        self.fire_particles = FireParticleSystem(200)
        self.phoenix_fireballs_active = False
        self.phoenix_fireball_count = 5
        self.phoenix_fireballs = []
        self.phoenix_fireball_systems = [FireParticleSystem(72) for _ in range(self.phoenix_fireball_count)]
        for _sys in self.phoenix_fireball_systems:
            _sys.set_style("fireball")
        self.effect_orchestrator = EffectOrchestrator()
        self.effect_orchestrator.register("clone", ShadowCloneEffect(swap_xy=True), passive=True)
        self.effect_orchestrator.register("reaper", ReaperDeathSealEffect())
        self.effect_orchestrator.register("water", WaterDragonEffect())
        self.effect_orchestrator.register("eye", SharinganEffect())
        
        # Video overlay for jutsus
        self.current_video = None
        self.video_cap = None
        self.jutsu_videos = {}
        self._load_jutsu_videos()
        self._load_feature_icons()
        self._load_player_meta()
        self.sequence_run_start = None
        self.quest_claim_rects = []
        self.tutorial_step_index = 0
        self.tutorial_steps = [
            {
                "icon_key": "camera",
                "title": "Setup Your Camera",
                "lines": [
                    "Open Settings and choose your camera device.",
                    "Enable preview to verify framing and lighting.",
                    "Keep both hands visible in the camera panel.",
                ],
            },
            {
                "icon_key": "signs",
                "title": "Perform Signs In Order",
                "lines": [
                    "Follow the sign sequence shown at the bottom.",
                    "Each correct sign advances your combo step.",
                    "Stable lighting improves landmark recognition.",
                ],
            },
            {
                "icon_key": "execute",
                "title": "Execute The Jutsu",
                "lines": [
                    "Complete all signs to trigger the jutsu effect.",
                    "You earn XP for successful completions.",
                    "Level up to unlock higher-tier jutsu.",
                ],
            },
            {
                "icon_key": "challenge",
                "title": "Rank Mode And Progress",
                "lines": [
                    "Use Rank Mode for timed runs and leaderboard ranking.",
                    "Visit Quest Board for daily/weekly XP rewards.",
                    "Master each jutsu to reach Bronze, Silver, and Gold tiers.",
                ],
            },
        ]

        # Icons
        self.icons = {}
        self._load_icons()
        
        # Logo
        self.logo = None
        self._load_logo()
        
        # Background image
        self.bg_image = None
        self._load_background()
        
        # Social icons
        self.social_icons = {}
        self._load_social_icons()
        
        # Mute toggle state
        self.is_muted = False
        self.mute_icons = {"mute": None, "unmute": None}
        self._load_mute_icons()
        
        # Arrow icons for navigation
        self.arrow_icons = {"left": None, "right": None}
        self._load_arrow_icons()
        
        # UI Elements
        self._create_menu_ui()
        self._create_settings_ui()
        self._create_practice_select_ui()
        self._create_about_ui()
        self._create_leaderboard_ui()
        self._create_library_ui()
        self._create_quest_ui()
        self._create_tutorial_ui()
        self._create_calibration_gate_ui()
        self.playing_back_button = Button(24, 20, 120, 42, "< BACK", font_size=22, color=COLORS["bg_card"])
        
        # FPS tracking
        self.fps = 0
        self.frame_count = 0
        self.fps_timer = time.time()

        if (not self.tutorial_seen) and self.state == GameState.MENU:
            self.state = GameState.TUTORIAL
        
        print("[+] Jutsu Academy initialized!")

    def _sync_screen_constants(self, width, height):
        """Propagate current screen dimensions to all pygame modules using shared constants."""
        import src.jutsu_academy.main_pygame_shared as _shared

        w = max(640, int(width))
        h = max(480, int(height))
        _shared.SCREEN_WIDTH = w
        _shared.SCREEN_HEIGHT = h

        for mod_name, mod in list(sys.modules.items()):
            if not mod_name.startswith("src.jutsu_academy.main_pygame"):
                continue
            if hasattr(mod, "SCREEN_WIDTH"):
                setattr(mod, "SCREEN_WIDTH", w)
            if hasattr(mod, "SCREEN_HEIGHT"):
                setattr(mod, "SCREEN_HEIGHT", h)

        self.screen_w = w
        self.screen_h = h

    def _rebuild_ui_for_screen_size(self):
        """Recreate static UI rects after display size changes."""
        if not hasattr(self, "menu_buttons"):
            return

        self._create_menu_ui()
        self._create_settings_ui()
        self._create_practice_select_ui()
        self._create_about_ui()
        self._create_leaderboard_ui()
        self._create_library_ui()
        self._create_quest_ui()
        self._create_tutorial_ui()
        self._create_calibration_gate_ui()

        if hasattr(self, "playing_back_button"):
            self.playing_back_button = Button(24, 20, 120, 42, "< BACK", font_size=22, color=COLORS["bg_card"])

    def _apply_display_mode(self):
        """Recreate display mode and ensure fullscreen always fits the actual monitor size."""
        flags = 0

        if self.fullscreen:
            # Desktop fullscreen: (0, 0) lets SDL/Pygame choose native monitor resolution.
            flags |= pygame.FULLSCREEN
            self.screen = pygame.display.set_mode((0, 0), flags)
        else:
            target_w = max(640, int(getattr(self, "screen_w", SCREEN_WIDTH)))
            target_h = max(480, int(getattr(self, "screen_h", SCREEN_HEIGHT)))
            self.screen = pygame.display.set_mode((target_w, target_h), flags)

        actual_w, actual_h = self.screen.get_size()
        self._sync_screen_constants(actual_w, actual_h)
        pygame.display.set_caption("Jutsu Academy")

        # Re-load background crop at new resolution to avoid edge blank space.
        if hasattr(self, "_load_background"):
            self._load_background()

        self._rebuild_ui_for_screen_size()

    def show_alert(self, title, message, button_text="OK", alert_sound=None):
        """Queue a reusable alert modal."""
        self.alert_queue.append({
            "title": str(title),
            "message": str(message),
            "button_text": str(button_text),
            "sound": str(alert_sound or "").strip(),
        })

    def process_unlock_alerts(self, previous_level=None, queue_alerts=True):
        """Return newly unlocked jutsus and optionally queue unlock alert(s)."""
        current_level = self.progression.level

        if previous_level is not None:
            newly_unlocked = sorted(
                [
                    name for name, data in self.jutsu_list.items()
                    if previous_level < data.get("min_level", 0) <= current_level
                ],
                key=lambda name: self.jutsu_list[name].get("min_level", 0),
            )
        else:
            currently_unlocked = {
                name for name, data in self.jutsu_list.items()
                if current_level >= data.get("min_level", 0)
            }
            newly_unlocked = sorted(
                currently_unlocked - self.unlocked_jutsus_known,
                key=lambda name: self.jutsu_list[name].get("min_level", 0),
            )

        if queue_alerts:
            for name in newly_unlocked:
                min_lv = self.jutsu_list[name].get("min_level", 0)
                self.show_alert(
                    "New Skill Unlocked",
                    f"{name} unlocked at LV.{min_lv}. Open Jutsu Library to preview sequence.",
                    "NICE",
                )
        self.unlocked_jutsus_known = {
            name for name, data in self.jutsu_list.items()
            if current_level >= data.get("min_level", 0)
        }
        return newly_unlocked

    def _notify_level_up(self, previous_level, source_label=""):
        """Show rich level-up panel and include newly unlocked skills."""
        current_level = int(self.progression.level)
        if current_level <= int(previous_level):
            return []

        newly_unlocked = self.process_unlock_alerts(previous_level=previous_level, queue_alerts=False)

        self._queue_reward_panel("level_up", {
            "previous_level": int(previous_level),
            "new_level":      current_level,
            "rank":           str(self.progression.rank),
            "newly_unlocked": newly_unlocked,
            "source_label":   str(source_label),
        }, sound_name="level")
        return newly_unlocked

    def _notify_mastery_update(self, jutsu_name, mastery_info):
        """Show rich mastery panel (replaces old show_alert popup)."""
        if not jutsu_name:
            return False
        if not isinstance(mastery_info, dict):
            return False
        if not mastery_info.get("improved", False):
            return False

        self._queue_reward_panel("mastery", {
            "jutsu_name": jutsu_name,
            "mastery_info": mastery_info,
        }, sound_name="level")
        return True

    def _queue_reward_panel(self, panel_type, payload=None, sound_name="level"):
        """Queue mastery/level-up panels so they open one-by-one without audio overlap."""
        queue = getattr(self, "reward_panel_queue", None)
        if queue is None:
            queue = []
            self.reward_panel_queue = queue
        queue.append({
            "type": str(panel_type or "").strip().lower(),
            "payload": dict(payload or {}),
            "sound": str(sound_name or "").strip(),
        })
        self._activate_next_reward_panel()

    def _activate_next_reward_panel(self):
        """Activate the next queued reward panel only when no other reward panel is open."""
        if getattr(self, "mastery_panel_data", None) or getattr(self, "level_up_panel_data", None):
            return False

        queue = getattr(self, "reward_panel_queue", None)
        if not queue:
            return False

        item = queue.pop(0)
        panel_type = str(item.get("type", "") or "").strip().lower()
        payload = dict(item.get("payload") or {})
        payload["opened_at"] = time.time()

        if panel_type == "mastery":
            self.mastery_panel_data = payload
        elif panel_type == "level_up":
            self.level_up_panel_data = payload
        else:
            return False

        sound_name = str(item.get("sound", "") or "").strip()
        if sound_name:
            if not hasattr(self, "pending_sounds") or self.pending_sounds is None:
                self.pending_sounds = []
            self.pending_sounds.append({"name": sound_name, "time": time.time()})
        return True

    def _activate_next_alert(self):
        """Activate next queued alert if none is currently shown."""
        if self.active_alert is None and self.alert_queue:
            self.active_alert = self.alert_queue.pop(0)
            sound_name = str(self.active_alert.get("sound", "") or "").strip()
            if sound_name:
                self.play_sound(sound_name)
