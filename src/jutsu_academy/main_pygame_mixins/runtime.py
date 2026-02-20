from src.jutsu_academy.main_pygame_shared import *


class RuntimeMixin:
    def handle_events(self):
        """Handle pygame events."""
        mouse_click = False
        
        # Capture events first
        events = pygame.event.get()
        if getattr(self, "_pending_runtime_settings_apply", False):
            self._pending_runtime_settings_apply = False
            try:
                if hasattr(self, "apply_settings_runtime"):
                    self.apply_settings_runtime()
            except Exception as e:
                print(f"[!] Runtime settings apply failed on main thread: {e}")
        self._activate_next_alert()
        if hasattr(self, "_activate_next_reward_panel"):
            self._activate_next_reward_panel()
        self._refresh_quest_periods()
        if (
            self.state == GameState.CALIBRATION_GATE
            and getattr(self, "calibration_gate_return_pending", False)
            and (not getattr(self, "calibration_active", False))
            and (time.time() >= float(getattr(self, "calibration_gate_return_at", 0.0) or 0.0))
        ):
            self._exit_calibration_gate()
            return

        # Poll app_config periodically so maintenance/update toggles can apply live.
        now = time.time()
        if self.network_manager and self.network_manager.client:
            if (not self.announcements_loading) and (now - getattr(self, "config_poll_last_at", 0.0) >= getattr(self, "config_poll_interval_s", 20.0)):
                self.config_poll_last_at = now
                threading.Thread(target=self._fetch_announcements, daemon=True).start()

        # Hard maintenance gate takes priority over version gate.
        if self.force_maintenance_required and self.state not in [GameState.MAINTENANCE_REQUIRED, GameState.QUIT_CONFIRM]:
            if self.state == GameState.SETTINGS:
                self._stop_settings_camera_preview()
            if self.state in [GameState.PLAYING, GameState.CALIBRATION_GATE]:
                self._reset_active_effects(reset_calibration=True)
                self._stop_camera()
            self.show_announcements = False
            self.active_alert = None
            self.state = GameState.MAINTENANCE_REQUIRED

        if self.state == GameState.MAINTENANCE_REQUIRED:
            if not self.force_maintenance_required and not self.force_update_required:
                self.state = GameState.MENU
            mouse_pos = pygame.mouse.get_pos()
            for event in events:
                if event.type == pygame.QUIT:
                    self.running = False
                elif event.type == pygame.KEYDOWN and event.key in [pygame.K_ESCAPE, pygame.K_RETURN, pygame.K_SPACE]:
                    self.running = False
                elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                    if hasattr(self, "maintenance_open_rect") and self.maintenance_open_rect.collidepoint(mouse_pos):
                        self.play_sound("click")
                        url = self.force_maintenance_url if self.force_maintenance_url else SOCIAL_LINKS.get("discord")
                        if url:
                            webbrowser.open(url)
                    elif hasattr(self, "maintenance_exit_rect") and self.maintenance_exit_rect.collidepoint(mouse_pos):
                        self.play_sound("click")
                        self.running = False
            return

        # Hard version gate: block access when backend marks this client outdated.
        if self.force_update_required and self.state not in [GameState.UPDATE_REQUIRED, GameState.QUIT_CONFIRM]:
            if self.state == GameState.SETTINGS:
                self._stop_settings_camera_preview()
            if self.state in [GameState.PLAYING, GameState.CALIBRATION_GATE]:
                self._reset_active_effects(reset_calibration=True)
                self._stop_camera()
            self.show_announcements = False
            self.active_alert = None
            self.state = GameState.UPDATE_REQUIRED

        if self.state == GameState.UPDATE_REQUIRED:
            mouse_pos = pygame.mouse.get_pos()
            for event in events:
                if event.type == pygame.QUIT:
                    self.running = False
                elif event.type == pygame.KEYDOWN and event.key in [pygame.K_ESCAPE, pygame.K_RETURN, pygame.K_SPACE]:
                    self.running = False
                elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                    if hasattr(self, "update_open_rect") and self.update_open_rect.collidepoint(mouse_pos):
                        self.play_sound("click")
                        url = self.force_update_url if self.force_update_url else SOCIAL_LINKS.get("discord")
                        if url:
                            webbrowser.open(url)
                    elif hasattr(self, "update_exit_rect") and self.update_exit_rect.collidepoint(mouse_pos):
                        self.play_sound("click")
                        self.running = False
            return

        # Global reusable alert modal: blocks underlying interactions
        if self.active_alert:
            mouse_pos = pygame.mouse.get_pos()
            for event in events:
                if event.type == pygame.QUIT:
                    self.prev_state = self.state
                    self.state = GameState.QUIT_CONFIRM
                    self.active_alert = None
                    return
                if event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                    if self.alert_ok_rect.collidepoint(mouse_pos):
                        self.play_sound("click")
                        self.active_alert = None
                        return
                if event.type == pygame.KEYDOWN and event.key in [pygame.K_ESCAPE, pygame.K_RETURN, pygame.K_SPACE]:
                    self.play_sound("click")
                    self.active_alert = None
                    return
            return
        
        # IMPORTANT: Announcement Overlay Clicks
        # If showing announcements, we intercept clicks and keys
        # If showing announcements, we intercept clicks and keys, BUT only if we are in the MENU state.
        # This prevents it from blocking modals like LOGIN_MODAL which render on top.
        if self.show_announcements and self.state == GameState.MENU:
            mouse_pos = pygame.mouse.get_pos()
            for event in events:
                if event.type == pygame.QUIT:
                    self.running = False
                elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                    # Prev
                    if hasattr(self, 'ann_prev_rect') and self.ann_prev_rect.collidepoint(mouse_pos):
                         self.current_announcement_idx = max(0, self.current_announcement_idx - 1)
                         self.play_sound("click")
                    # Next
                    elif hasattr(self, 'ann_next_rect') and self.ann_next_rect.collidepoint(mouse_pos):
                         self.current_announcement_idx = min(len(self.announcements)-1, self.current_announcement_idx + 1)
                         self.play_sound("click")
                    # Close
                    elif hasattr(self, 'ann_close_rect') and self.ann_close_rect.collidepoint(mouse_pos):
                         self.show_announcements = False
                         self.play_sound("click")
                elif event.type == pygame.KEYDOWN:
                    if event.key in [pygame.K_ESCAPE, pygame.K_SPACE, pygame.K_RETURN]:
                         self.show_announcements = False
                         self.play_sound("click")
                    elif event.key == pygame.K_LEFT:
                         self.current_announcement_idx = max(0, self.current_announcement_idx - 1)
                    elif event.key == pygame.K_RIGHT:
                         self.current_announcement_idx = min(len(self.announcements)-1, self.current_announcement_idx + 1)
            return # Block other menu interactions while announcements are up

        for event in events:
            if event.type == pygame.QUIT:
                # Intercept close button
                if self.state == GameState.SETTINGS:
                    self._stop_settings_camera_preview()
                self.prev_state = self.state
                self.state = GameState.QUIT_CONFIRM
            elif event.type == pygame.MOUSEBUTTONDOWN and event.button == 1:
                mouse_click = True
            elif event.type == pygame.KEYDOWN:
                if event.key == pygame.K_ESCAPE:
                    if self.state == GameState.PLAYING:
                        self.stop_game()
                    elif self.state == GameState.MENU:
                        # ESC in menu -> Quit Confirm
                        self.prev_state = GameState.MENU
                        self.state = GameState.QUIT_CONFIRM
                    elif self.state in [GameState.SETTINGS, GameState.ABOUT, GameState.PRACTICE_SELECT, GameState.JUTSU_LIBRARY, GameState.QUESTS, GameState.TUTORIAL, GameState.CALIBRATION_GATE]:
                        if self.state == GameState.SETTINGS:
                            self._stop_settings_camera_preview()
                        if self.state == GameState.JUTSU_LIBRARY:
                            self.state = GameState.PRACTICE_SELECT
                        elif self.state == GameState.QUESTS:
                            self.state = GameState.PRACTICE_SELECT
                        elif self.state == GameState.CALIBRATION_GATE:
                            self._exit_calibration_gate()
                        elif self.state == GameState.TUTORIAL:
                            self.tutorial_seen = True
                            self.tutorial_seen_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                            self._save_player_meta()
                            self.state = GameState.MENU
                        else:
                            self.state = GameState.MENU
                    elif self.state == GameState.LOGIN_MODAL:
                        if not self.login_in_progress:
                            self.state = GameState.MENU
                elif self.state == GameState.PLAYING:
                    can_switch = not self.jutsu_active
                    if self.game_mode == "challenge" and self.challenge_state != "waiting":
                        can_switch = False
                        
                    if event.key == pygame.K_LEFT and can_switch:
                        self.switch_jutsu(-1)
                    elif event.key == pygame.K_RIGHT and can_switch:
                        self.switch_jutsu(1)
                    elif event.key == pygame.K_r:
                        self.current_step = 0
                        self.sequence_run_start = None
                        if hasattr(self, "_reset_active_effects"):
                            self._reset_active_effects(reset_calibration=False)
                    elif event.key == pygame.K_c:
                        self.start_calibration(manual=True, force_show_diag=True)
                        self.play_sound("click")
                    elif event.key == pygame.K_m:
                        self.play_sound("error")
                        if hasattr(self, "show_alert"):
                            self.show_alert(
                                "Model Locked",
                                "The YOLO model has been locked to ensure competitive integrity and standardized detection times. Please continue using MediaPipe.",
                                "UNDERSTOOD"
                            )
                    elif event.key == pygame.K_SPACE:
                        if self.game_mode == "challenge":
                            if self.challenge_state == "waiting":
                                self.challenge_state = "countdown"
                                self.challenge_countdown_start = time.time()
                                if hasattr(self, "_challenge_reset_proof"):
                                    self._challenge_reset_proof()
                                self.play_sound("click")
                            elif self.challenge_state == "results":
                                # Reset challenge
                                self.challenge_state = "waiting"
                                self.current_step = 0
                                self.sequence_run_start = None
                                self.submission_complete = False
                                self.challenge_rank_info = ""
                                if hasattr(self, "_challenge_reset_proof"):
                                    self._challenge_reset_proof()
                                if hasattr(self, "_reset_active_effects"):
                                    self._reset_active_effects(reset_calibration=False)
                elif self.state == GameState.CALIBRATION_GATE:
                    if event.key == pygame.K_c:
                        if self.start_calibration(manual=True, force_show_diag=True):
                            self.play_sound("click")
                    elif event.key in [pygame.K_SPACE, pygame.K_RETURN]:
                        if not getattr(self, "calibration_active", False):
                            if self.start_calibration(manual=True, force_show_diag=True):
                                self.play_sound("click")
            elif event.type == pygame.MOUSEWHEEL:
                if self.state == GameState.ABOUT:
                    self.about_scroll_y -= event.y * 30
                    if self.about_scroll_y < 0:
                        self.about_scroll_y = 0
                elif self.state == GameState.PRACTICE_SELECT:
                    self.practice_scroll_y -= event.y * 36
                    if self.practice_scroll_y < 0:
                        self.practice_scroll_y = 0
        
        # ✅ IMPORTANT: read mouse state AFTER event processing
        mouse_pos = pygame.mouse.get_pos()
        mouse_down = pygame.mouse.get_pressed()[0]
        
        # State-specific updates
        if self.state == GameState.QUIT_CONFIRM:
            if mouse_click:
                # Quit
                if hasattr(self, 'quit_confirm_rect') and self.quit_confirm_rect.collidepoint(mouse_pos):
                    # Do NOT call cleanup() here, let the loop finish
                    self.play_sound("click")
                    self.running = False
                # Stay
                if hasattr(self, 'quit_cancel_rect') and self.quit_cancel_rect.collidepoint(mouse_pos):
                    self.play_sound("click")
                    self.state = self.prev_state if self.prev_state else GameState.MENU
        
        elif self.state == GameState.LOGOUT_CONFIRM:
            if mouse_click:
                # Yes, Logout and Quit
                if hasattr(self, 'logout_confirm_rect') and self.logout_confirm_rect.collidepoint(mouse_pos):
                    self.play_sound("click")
                    self.logout_discord()
                    self.profile_dropdown_open = False
                    self.running = False # Quit game on logout as requested
                # Cancel
                if hasattr(self, 'logout_cancel_rect') and self.logout_cancel_rect.collidepoint(mouse_pos):
                    self.play_sound("click")
                    self.state = GameState.MENU
                    
        elif self.state == GameState.WELCOME_MODAL:
            # Handle key fallback
            if any(event.type == pygame.KEYDOWN and event.key in [pygame.K_SPACE, pygame.K_RETURN] for event in events):
                 self.play_sound("click")
                 self.state = GameState.MENU
                 if self.pending_action == "practice":
                     self.state = GameState.PRACTICE_SELECT
                     self.pending_action = None
            
            if mouse_click:
                if hasattr(self, 'welcome_ok_rect') and self.welcome_ok_rect.collidepoint(mouse_pos):
                    self.play_sound("click")
                    self.state = GameState.MENU
                    # Optionally go to practice if that was pending
                    if self.pending_action == "practice":
                        self.state = GameState.PRACTICE_SELECT
                        self.pending_action = None
                        
        elif self.state == GameState.ERROR_MODAL:
            if mouse_click:
                 if hasattr(self, 'error_ok_rect') and self.error_ok_rect.collidepoint(mouse_pos):
                     self.play_sound("click")
                     self.state = GameState.MENU
            
        elif self.state == GameState.CONNECTION_LOST:
            if mouse_click:
                if hasattr(self, 'conn_lost_exit_rect') and self.conn_lost_exit_rect.collidepoint(mouse_pos):
                    self.play_sound("click")
                    self.running = False

        elif self.state == GameState.MENU:
            # Check mute button click
            if mouse_click and self.mute_button_rect.collidepoint(mouse_pos):
                self.play_sound("click")
                self.toggle_mute()
            
            # Check social links
            if mouse_click and hasattr(self, 'social_rects'):
                for link_name, rect in self.social_rects.items():
                    if rect.collidepoint(mouse_pos):
                        self.play_sound("click")
                        url = SOCIAL_LINKS.get(link_name)
                        if url:
                            webbrowser.open(url)
            
            # Profile Interactions
            if mouse_click:
                if self.profile_dropdown_open:
                    # Check logout click
                    if hasattr(self, 'logout_item_rect') and self.logout_item_rect.collidepoint(mouse_pos):
                        self.play_sound("click")
                        self.state = GameState.LOGOUT_CONFIRM
                        self.profile_dropdown_open = False
                    # Close dropdown if clicked outside
                    elif hasattr(self, 'profile_rect') and not self.profile_rect.collidepoint(mouse_pos):
                        self.profile_dropdown_open = False
                
                # Toggle dropdown on profile click (if logged in)
                if hasattr(self, 'profile_rect') and self.profile_rect.collidepoint(mouse_pos):
                    self.play_sound("click")
                    if self.discord_user:
                        self.profile_dropdown_open = not self.profile_dropdown_open
                    else:
                        # If guest, clicking profile opens login modal
                        self.state = GameState.LOGIN_MODAL
                        self.login_modal_message = "Log in to access your profile."
                        self.pending_action = None

            # Menu buttons
            for name, btn in self.menu_buttons.items():
                if btn.update(mouse_pos, mouse_click, mouse_down, self.play_sound):
                    if name == "practice":
                        if not self._has_backend_connection(timeout_s=2.5):
                            self._handle_connection_lost(force_logout=True)
                            return
                        # Check login requirement
                        if not self.discord_user:
                            self.state = GameState.LOGIN_MODAL
                            self.login_modal_message = "Please log in with Discord to access the Academy and save your progress."
                            self.pending_action = "practice"
                        else:
                            self.state = GameState.PRACTICE_SELECT
                    elif name == "settings":
                        self.settings_preview_enabled = False
                        self._stop_settings_camera_preview()
                        self.state = GameState.SETTINGS
                    elif name == "about":
                        self.state = GameState.ABOUT
                    elif name == "tutorial":
                        self.tutorial_step_index = 0
                        self.state = GameState.TUTORIAL
                    elif name == "quit":
                        self.prev_state = GameState.MENU
                        self.state = GameState.QUIT_CONFIRM
        
        elif self.state == GameState.LOGIN_MODAL:
            if mouse_click:
                if hasattr(self, 'modal_login_rect') and self.modal_login_rect.collidepoint(mouse_pos):
                    self.play_sound("click")
                    if self.login_in_progress:
                        # Reopen browser - same server will receive callback
                        if self.discord_auth_url:
                            webbrowser.open(self.discord_auth_url)
                            print(f"[AUTH] User clicked reopen browser")
                        else:
                            print(f"[AUTH] No URL yet, waiting...")
                    else:
                        # Start new login
                        self.start_discord_login()
                
                # Cancel button
                if hasattr(self, 'modal_cancel_rect') and self.modal_cancel_rect.collidepoint(mouse_pos):
                    self.play_sound("click")
                    if self.login_in_progress:
                        # Cancel the login
                        self.cancel_discord_login()
                    self.state = GameState.MENU
                    self.pending_action = None
                    self.login_error = ""
        
        elif self.state == GameState.SETTINGS:
            # Update sliders
            any_dragging = False
            for slider in self.settings_sliders.values():
                if slider.update(mouse_pos, mouse_down, mouse_click):
                    any_dragging = True
            
            # Real-time volume updates while dragging
            if any_dragging or mouse_click:
                if not self.is_muted:
                    pygame.mixer.music.set_volume(self._effective_music_volume(self.settings_sliders["music"].value))
            
            if self.camera_dropdown.update(mouse_pos, mouse_click, self.play_sound):
                self.settings["camera_idx"] = self.camera_dropdown.selected_idx
                if self.settings_preview_enabled:
                    self._start_settings_camera_preview(self.camera_dropdown.selected_idx)

            # Resolution dropdown — apply immediately on change
            if self.resolution_dropdown.update(mouse_pos, mouse_click, self.play_sound):
                res_idx = self.resolution_dropdown.selected_idx
                if 0 <= res_idx < len(RESOLUTION_OPTIONS):
                    _, rw, rh = RESOLUTION_OPTIONS[res_idx]
                else:
                    _, rw, rh = RESOLUTION_OPTIONS[0]
                self.screen_w = rw
                self.screen_h = rh
                self.settings["resolution_idx"] = res_idx
                self._apply_display_mode()
            
            # Keep restricted signs always ON and non-interactive.
            self.settings_checkboxes["restricted"].checked = True
            self.settings_checkboxes["debug_hands"].update(mouse_pos, mouse_click, self.play_sound)

            # Fullscreen — apply immediately on change
            old_fs = self.fullscreen
            self.settings_checkboxes["fullscreen"].update(mouse_pos, mouse_click, self.play_sound)
            new_fs = self.settings_checkboxes["fullscreen"].checked
            if new_fs != old_fs:
                self.fullscreen = new_fs
                self.settings["fullscreen"] = new_fs
                self._apply_display_mode()
            
            for name, btn in self.settings_buttons.items():
                if btn.update(mouse_pos, mouse_click, mouse_down, self.play_sound):
                    if name == "preview_toggle":
                        self.settings_preview_enabled = not self.settings_preview_enabled
                        if self.settings_preview_enabled:
                            self._refresh_settings_camera_options(force=False)
                            self._start_settings_camera_preview(self.settings["camera_idx"])
                        else:
                            self._stop_settings_camera_preview()
                    if name == "scan_cameras":
                        self._refresh_settings_camera_options(force=True)
                        self.settings["camera_idx"] = self.camera_dropdown.selected_idx
                        if self.settings_preview_enabled:
                            self._start_settings_camera_preview(self.settings["camera_idx"])
                    if name == "back":
                        # Save settings
                        self.settings["music_vol"] = self.settings_sliders["music"].value
                        self.settings["sfx_vol"] = self.settings_sliders["sfx"].value
                        self.settings["camera_idx"] = self.camera_dropdown.selected_idx
                        self.settings["debug_hands"] = self.settings_checkboxes["debug_hands"].checked
                        self.settings["restricted_signs"] = True

                        # Resolution & fullscreen
                        self.settings["resolution_idx"] = self.resolution_dropdown.selected_idx
                        self.settings["fullscreen"] = self.settings_checkboxes["fullscreen"].checked

                        res_idx = self.settings["resolution_idx"]
                        if 0 <= res_idx < len(RESOLUTION_OPTIONS):
                            _, rw, rh = RESOLUTION_OPTIONS[res_idx]
                        else:
                            _, rw, rh = RESOLUTION_OPTIONS[0]
                        self.screen_w = rw
                        self.screen_h = rh
                        self.fullscreen = self.settings["fullscreen"]
                        self._apply_display_mode()
                        
                        if not self.is_muted:
                            pygame.mixer.music.set_volume(self._effective_music_volume(self.settings["music_vol"]))
                        self.save_settings()
                        self.settings_preview_enabled = False
                        self._stop_settings_camera_preview()
                        self.state = GameState.MENU
        
        elif self.state == GameState.PRACTICE_SELECT:
            for name, btn in self.practice_buttons.items():
                if btn.update(mouse_pos, mouse_click, mouse_down, self.play_sound):
                    if name == "freeplay":
                        if not self._has_backend_connection(timeout_s=2.5):
                            self._handle_connection_lost(force_logout=True)
                            return
                        if self._mode_requires_calibration_gate():
                            self._enter_calibration_gate("freeplay")
                        else:
                            self.library_mode = "freeplay"
                            self.state = GameState.JUTSU_LIBRARY
                    elif name == "challenge":
                        if not self._has_backend_connection(timeout_s=2.5):
                            self._handle_connection_lost(force_logout=True)
                            return
                        if self._mode_requires_calibration_gate():
                            self._enter_calibration_gate("challenge")
                        else:
                            self.library_mode = "challenge"
                            self.state = GameState.JUTSU_LIBRARY
                    elif name == "library":
                        self.library_mode = "browse"
                        self.state = GameState.JUTSU_LIBRARY
                    elif name == "multiplayer":
                        self.play_sound("click")
                        print("[*] Multiplayer is currently locked.")
                    elif name == "quests":
                        self.state = GameState.QUESTS
                    elif name == "leaderboard":
                        self.state = GameState.LEADERBOARD
                        # Trigger fetch
                        threading.Thread(target=self._fetch_leaderboard, daemon=True).start()
                    elif name == "back":
                        self.state = GameState.MENU

        elif self.state == GameState.CALIBRATION_GATE:
            buttons = getattr(self, "calibration_gate_buttons", {})
            if isinstance(buttons, dict):
                if "start" in buttons:
                    buttons["start"].enabled = not bool(
                        getattr(self, "calibration_gate_return_pending", False)
                        or getattr(self, "calibration_active", False)
                    )
                if "scan" in buttons:
                    buttons["scan"].enabled = not bool(
                        getattr(self, "calibration_gate_return_pending", False)
                        or getattr(self, "calibration_active", False)
                    )
                if "settings" in buttons:
                    buttons["settings"].enabled = not bool(getattr(self, "calibration_active", False))
                if "back" in buttons:
                    buttons["back"].enabled = not bool(getattr(self, "calibration_active", False))

            cam_dropdown = getattr(self, "calibration_camera_dropdown", None)
            if cam_dropdown and cam_dropdown.update(mouse_pos, mouse_click, self.play_sound):
                self.settings["camera_idx"] = cam_dropdown.selected_idx
                self._stop_camera()
                selected_name = None
                if 0 <= cam_dropdown.selected_idx < len(cam_dropdown.options):
                    selected_name = cam_dropdown.options[cam_dropdown.selected_idx]
                if self._ensure_calibration_camera_ready(scan_devices=False):
                    if selected_name:
                        self.calibration_message = f"Camera selected: {selected_name}"
                    else:
                        self.calibration_message = "Camera selected."
                else:
                    self.calibration_message = self.calibration_camera_error or "Camera unavailable for calibration."
                self.calibration_message_until = time.time() + 4.0

            for name, btn in buttons.items():
                if btn.update(mouse_pos, mouse_click, mouse_down, self.play_sound):
                    if name == "scan":
                        self._refresh_settings_camera_options(force=True)
                        self._sync_calibration_camera_dropdown()
                        self._stop_camera()
                        if self._ensure_calibration_camera_ready(scan_devices=False):
                            names = list(getattr(self, "cameras", []) or [])
                            idx = int(self.settings.get("camera_idx", 0))
                            selected_name = names[idx] if 0 <= idx < len(names) else None
                            if selected_name:
                                self.calibration_message = f"Camera ready: {selected_name}"
                            else:
                                self.calibration_message = "Camera scan complete."
                        else:
                            self.calibration_message = self.calibration_camera_error or "Camera unavailable for calibration."
                        self.calibration_message_until = time.time() + 4.0
                    elif name == "start":
                        if not getattr(self, "calibration_active", False):
                            self.start_calibration(manual=True, force_show_diag=True)
                    elif name == "settings":
                        self._stop_camera()
                        self.settings_preview_enabled = True
                        self._refresh_settings_camera_options(force=True)
                        self._start_settings_camera_preview(self.settings.get("camera_idx", 0))
                        self.state = GameState.SETTINGS
                    elif name == "back":
                        self._exit_calibration_gate()
        
        elif self.state == GameState.LEADERBOARD:
            # Mode Selector Click (Arrows)
            clicked_dir = 0
            if mouse_click:
                if hasattr(self, 'mode_arrow_left_rect') and self.mode_arrow_left_rect.collidepoint(mouse_pos):
                    clicked_dir = -1
                elif hasattr(self, 'mode_arrow_right_rect') and self.mode_arrow_right_rect.collidepoint(mouse_pos):
                    clicked_dir = 1
            
            if clicked_dir != 0:
                self.play_sound("click")
                
                # Get modes
                if not hasattr(self, "leaderboard_modes_list"):
                    try:
                        self.leaderboard_modes_list = [k.upper() for k in OFFICIAL_JUTSUS.keys()]
                    except:
                        self.leaderboard_modes_list = ["FIREBALL", "CHIDORI", "SHARINGAN", "RASENGAN"]
                        
                # Cycle
                curr = getattr(self, "leaderboard_mode", "FIREBALL")
                try:
                    idx = self.leaderboard_modes_list.index(curr)
                    new_idx = (idx + clicked_dir) % len(self.leaderboard_modes_list)
                    self.leaderboard_mode = self.leaderboard_modes_list[new_idx]
                except:
                    self.leaderboard_mode = self.leaderboard_modes_list[0]
                    
                # Refetch
                threading.Thread(target=self._fetch_leaderboard, daemon=True).start()

            # Pagination Clicks
            if mouse_click:
                page_changed = False
                if hasattr(self, 'leaderboard_prev_rect') and self.leaderboard_prev_rect.collidepoint(mouse_pos):
                    self.leaderboard_page = max(0, getattr(self, 'leaderboard_page', 0) - 1)
                    page_changed = True
                    self.play_sound("click")
                elif hasattr(self, 'leaderboard_next_rect') and self.leaderboard_next_rect.collidepoint(mouse_pos):
                    self.leaderboard_page = getattr(self, 'leaderboard_page', 0) + 1
                    page_changed = True
                    self.play_sound("click")
                
                if page_changed:
                    threading.Thread(target=self._fetch_leaderboard, daemon=True).start()

            for name, btn in self.leaderboard_buttons.items():
                if btn.update(mouse_pos, mouse_click, mouse_down, self.play_sound):
                    if name == "back":
                        self.state = GameState.PRACTICE_SELECT
                    elif name == "refresh":
                        threading.Thread(target=self._fetch_leaderboard, daemon=True).start()
        
        elif self.state == GameState.ABOUT:
            for name, btn in self.about_buttons.items():
                if btn.update(mouse_pos, mouse_click, mouse_down, self.play_sound):
                    if name == "back":
                        self.state = GameState.MENU

        elif self.state == GameState.TUTORIAL:
            step_idx = getattr(self, "tutorial_step_index", 0)
            max_idx = len(self.tutorial_steps) - 1
            for name, btn in self.tutorial_buttons.items():
                if btn.update(mouse_pos, mouse_click, mouse_down, self.play_sound):
                    if name == "back":
                        self.tutorial_step_index = max(0, step_idx - 1)
                    elif name == "next":
                        if step_idx >= max_idx:
                            self.tutorial_seen = True
                            self.tutorial_seen_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                            self._save_player_meta()
                            self.state = GameState.MENU
                        else:
                            self.tutorial_step_index = min(max_idx, step_idx + 1)
                    elif name == "skip":
                        self.tutorial_seen = True
                        self.tutorial_seen_at = time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime())
                        self._save_player_meta()
                        self.state = GameState.MENU

        elif self.state == GameState.QUESTS:
            if mouse_click:
                for item in getattr(self, "quest_claim_rects", []):
                    if item["rect"].collidepoint(mouse_pos):
                        self._claim_quest(item["scope"], item["id"])
                        break
            for name, btn in self.quest_buttons.items():
                if btn.update(mouse_pos, mouse_click, mouse_down, self.play_sound):
                    if name == "back":
                        self.state = GameState.PRACTICE_SELECT

        elif self.state == GameState.JUTSU_LIBRARY:
            if mouse_click:
                for item in getattr(self, "library_item_rects", []):
                    if item["rect"].collidepoint(mouse_pos):
                        if self.library_mode == "browse":
                            self.play_sound("click")
                            break

                        if not item["unlocked"]:
                            self.play_sound("click")
                            req_lv = item["min_level"]
                            self.show_alert("Skill Locked", f"{item['name']} unlocks at LV.{req_lv}.")
                            break

                        if item["name"] in self.jutsu_names:
                            if not self._has_backend_connection(timeout_s=2.5):
                                self._handle_connection_lost(force_logout=True)
                                return
                            jutsu_idx = self.jutsu_names.index(item["name"])
                            self.play_sound("click")
                            mode = "practice" if self.library_mode == "freeplay" else "challenge"
                            self.start_game(mode, initial_jutsu_idx=jutsu_idx)
                            break

            for name, btn in self.library_buttons.items():
                if btn.update(mouse_pos, mouse_click, mouse_down, self.play_sound):
                    if name == "back":
                        self.state = GameState.PRACTICE_SELECT
        
        elif self.state == GameState.PLAYING:
            # Mastery panel intercepts all clicks while open
            if mouse_click and getattr(self, "mastery_panel_data", None):
                if hasattr(self, "_mastery_cont_rect") and self._mastery_cont_rect.collidepoint(mouse_pos):
                    self.play_sound("click")
                    self.mastery_panel_data = None
                    if hasattr(self, "_activate_next_reward_panel"):
                        self._activate_next_reward_panel()
                return
            # Level-up panel intercepts clicks while open (shown after mastery panel)
            if mouse_click and getattr(self, "level_up_panel_data", None):
                if hasattr(self, "_level_up_cont_rect") and self._level_up_cont_rect.collidepoint(mouse_pos):
                    self.play_sound("click")
                    self.level_up_panel_data = None
                    if hasattr(self, "_activate_next_reward_panel"):
                        self._activate_next_reward_panel()
                return
            # [i] Model info popup
            if mouse_click and hasattr(self, "_model_info_rect") and self._model_info_rect.collidepoint(mouse_pos):
                self.play_sound("click")
                self.show_alert(
                    "Which Model Should I Use?",
                    (
                        "MEDIAPIPE (recommended)\n"
                        "Best accuracy & fairness — detects hand landmarks "
                        "directly without a custom dataset. Use this for ranked "
                        "runs and everyday training.\n\n"
                        "YOLO (Locked)\n"
                        "Currently disabled/locked to ensure competitive integrity "
                        "and standardized detection times across all shinobi."
                    ),
                    "GOT IT",
                )
                return
            if mouse_click and hasattr(self, "model_toggle_rect") and self.model_toggle_rect.collidepoint(mouse_pos):
                self.play_sound("error")
                self.show_alert(
                    "Model Locked",
                    "The YOLO model has been locked to ensure competitive integrity and standardized detection times. Please continue using MediaPipe.",
                    "UNDERSTOOD"
                )
                return
            if mouse_click and hasattr(self, "diag_toggle_rect") and self.diag_toggle_rect.collidepoint(mouse_pos):
                self.show_detection_panel = not bool(getattr(self, "show_detection_panel", False))
                self.play_sound("click")
                return
            if hasattr(self, "playing_back_button"):
                if self.playing_back_button.update(mouse_pos, mouse_click, mouse_down, self.play_sound):
                    self.stop_game(return_to_library=True)
                    return

            # Check arrow clicks
            cam_x = (SCREEN_WIDTH - 640) // 2
            cam_y = 110 # Synchronized with render_playing margin
            
            # Switch gating: Disable if challenge is active/countdown
            can_switch = not self.jutsu_active
            if self.game_mode == "challenge" and self.challenge_state != "waiting":
                can_switch = False

            if mouse_click and can_switch:
                if hasattr(self, "left_arrow_rect") and self.left_arrow_rect.collidepoint(mouse_pos):
                    self.switch_jutsu(-1)
                    self.play_sound("click")
                elif hasattr(self, "right_arrow_rect") and self.right_arrow_rect.collidepoint(mouse_pos):
                    self.switch_jutsu(1)
                    self.play_sound("click")

    def run(self):
        """Main game loop."""
        try:
            while self.running:
                dt = self.clock.tick(FPS) / 1000.0

                self.handle_events()

                # Render based on state
                if self.state == GameState.MENU:
                    self.render_menu()
                elif self.state == GameState.MAINTENANCE_REQUIRED:
                    self.render_maintenance_required()
                elif self.state == GameState.UPDATE_REQUIRED:
                    self.render_update_required()
                elif self.state == GameState.LOGIN_MODAL:
                    # Render menu underneath, then modal on top
                    self.render_menu()
                    self.render_login_modal()
                elif self.state == GameState.SETTINGS:
                    self.render_settings()
                elif self.state == GameState.PRACTICE_SELECT:
                    self.render_practice_select()
                elif self.state == GameState.CALIBRATION_GATE:
                    self.render_calibration_gate()
                elif self.state == GameState.ABOUT:
                    self.render_about()
                elif self.state == GameState.TUTORIAL:
                    self.render_tutorial()
                elif self.state == GameState.JUTSU_LIBRARY:
                    self.render_jutsu_library()
                elif self.state == GameState.QUESTS:
                    self.render_quests()
                elif self.state == GameState.LEADERBOARD:
                    self.render_leaderboard()
                elif self.state == GameState.LOADING:
                    self._render_loading()
                elif self.state == GameState.PLAYING:
                    self.render_playing(dt)
                elif self.state == GameState.LOGIN_MODAL:
                    # Render underlying state first for background context
                    if self.prev_state == GameState.MENU:
                        self.render_menu()
                    elif self.prev_state == GameState.PRACTICE_SELECT:
                        self.render_practice_select()
                    else:
                        self.render_menu()
                    self.render_login_modal()
                elif self.state == GameState.QUIT_CONFIRM:
                    # Render underlying state first
                    if self.prev_state:
                        if self.prev_state == GameState.MENU:
                            self.render_menu()
                        else:
                            self.screen.fill(COLORS["bg_dark"])
                    else:
                        self.render_menu()
                    self.render_quit_confirm()
                elif self.state == GameState.WELCOME_MODAL:
                    # Render underlying background only (cleaner)
                    if hasattr(self, 'bg_image') and self.bg_image:
                        self.screen.blit(self.bg_image, (0, 0))
                    else:
                        self.screen.fill(COLORS["bg_dark"])
                    self.render_welcome_modal(dt)
                elif self.state == GameState.LOGOUT_CONFIRM:
                    # Render underlying state first
                    self.render_menu()
                    self.render_logout_confirm()
                elif self.state == GameState.CONNECTION_LOST:
                    # Render underlying state first (to look like an overlay)
                    self.render_menu()
                    self.render_connection_lost()

                if self.active_alert:
                    self.render_alert_modal()

                # Rich level-up panel: shown over any state, handled by mouse below
                if getattr(self, "level_up_panel_data", None) and self.state != GameState.PLAYING:
                    if hasattr(self, "_render_level_up_panel"):
                        still = self._render_level_up_panel()
                        if not still:
                            self.level_up_panel_data = None
                            if hasattr(self, "_activate_next_reward_panel"):
                                self._activate_next_reward_panel()
                        elif mouse_click := pygame.mouse.get_pressed()[0]:
                            if hasattr(self, "_level_up_cont_rect") and self._level_up_cont_rect.collidepoint(pygame.mouse.get_pos()):
                                self.play_sound("click")
                                self.level_up_panel_data = None
                                if hasattr(self, "_activate_next_reward_panel"):
                                    self._activate_next_reward_panel()

                pygame.display.flip()
        finally:
            self.cleanup()

    def cleanup(self):
        """Clean up resources."""
        if getattr(self, "_cleanup_done", False):
            return
        self._cleanup_done = True
        if hasattr(self, "_save_player_meta"):
            self._save_player_meta()
        if hasattr(self, "_submit_challenge_score_on_exit"):
            self._submit_challenge_score_on_exit(blocking=True)
        if hasattr(self, "_reset_active_effects"):
            self._reset_active_effects(reset_calibration=True)
        self._stop_camera()
        if hasattr(self, "_stop_settings_camera_preview"):
            self._stop_settings_camera_preview()
        if pygame.mixer.get_init():
            pygame.mixer.stop()
        pygame.quit()
        print("[*] Jutsu Academy closed.")
