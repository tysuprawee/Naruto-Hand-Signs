from src.jutsu_academy.main_pygame_shared import *


class AuthMixin:
    def _has_backend_connection(self, timeout_s=1.5):
        """
        Strict connectivity check for required backend host (Supabase).
        We treat any non-5xx HTTP response from the configured project host as reachable.
        """
        timeout_s = float(max(0.4, timeout_s))
        nm = getattr(self, "network_manager", None)
        base_url = str(getattr(nm, "url", "") or "").strip().rstrip("/")
        api_key = str(getattr(nm, "key", "") or "").strip()
        if not base_url:
            return False

        headers = {}
        if api_key:
            headers["apikey"] = api_key
            headers["Authorization"] = f"Bearer {api_key}"

        probes = [
            f"{base_url}/rest/v1/",
            f"{base_url}/auth/v1/settings",
        ]
        for url in probes:
            try:
                r = requests.get(url, headers=headers, timeout=timeout_s, allow_redirects=False)
                code = int(getattr(r, "status_code", 0) or 0)
                if 100 <= code < 500:
                    return True
            except Exception:
                pass
        return False

    def _has_internet_connection(self, timeout_s=1.5):
        """Fast best-effort connectivity check for required online gameplay paths."""
        # For this app, backend availability is the true gate.
        if self._has_backend_connection(timeout_s=timeout_s):
            return True

        timeout_s = float(max(0.4, timeout_s))

        # Primary: raw socket to public DNS (fast, no DNS lookup dependency).
        for host in ("1.1.1.1", "8.8.8.8"):
            try:
                sock = socket.create_connection((host, 53), timeout=timeout_s)
                sock.close()
                return True
            except OSError:
                pass

        # Fallback: HTTPS probe to backend/public endpoint.
        probe_urls = ["https://discord.com/api/v10/gateway"]

        for url in probe_urls:
            try:
                r = requests.get(url, timeout=timeout_s)
                if int(getattr(r, "status_code", 0) or 0) < 500:
                    return True
            except Exception:
                pass
        return False

    def _handle_connection_lost(self, force_logout=True):
        """Transition to hard offline gate and terminate authenticated session."""
        self.connection_monitor_grace_until = time.time() + 12.0
        if bool(force_logout) and getattr(self, "discord_user", None):
            self.logout_discord()
        self.state = GameState.CONNECTION_LOST

    def _load_user_session(self):
        """Load saved user session and refresh profile."""
        try:
            session_path = Path("user_session.json")
            if session_path.exists():
                with open(session_path) as f:
                    data = json.load(f)
                    self.username = data.get("username", "Guest")
                    self.discord_user = data.get("discord_user")
                    
                    if self.discord_user:
                        print(f"[+] Loaded session: {self.username}")
                        if hasattr(self, "_sync_network_identity"):
                            self._sync_network_identity()
                        # Load avatar and refresh token in background
                        threading.Thread(target=self._load_discord_avatar, daemon=True).start()
                        threading.Thread(target=self._refresh_discord_token, daemon=True).start()
        except Exception as e:
            print(f"[!] Session load error: {e}")

    def _refresh_discord_token(self):
        """Validate current session token with Discord."""
        if not self.discord_user or "access_token" not in self.discord_user:
            return
            
        try:
            token = self.discord_user["access_token"]
            r = requests.get("https://discord.com/api/users/@me", 
                             headers={"Authorization": f"Bearer {token}"}, timeout=5)
            if r.status_code == 200:
                print("[+] Discord session validated")
            else:
                print("[-] Discord session expired or invalid")
                # We don't force logout yet, but could if needed
        except Exception as e:
            print(f"[!] Token refresh error: {e}")

    def _save_user_session(self):
        """Save user session to file."""
        try:
            data = {
                "username": self.username,
                "discord_user": self.discord_user
            }
            with open("user_session.json", "w") as f:
                json.dump(data, f)
        except Exception as e:
            print(f"[!] Session save error: {e}")

    def _monitor_connection_loop(self):
        """Monitor internet connection in background."""
        interval_s = float(max(5.0, getattr(self, "connection_monitor_interval_s", 10.0)))
        fail_limit = int(max(3, getattr(self, "connection_monitor_fail_limit", 5)))
        while True:
            try:
                # Avoid false kicks while auth flow/state transitions are happening.
                if bool(getattr(self, "login_in_progress", False)):
                    time.sleep(interval_s)
                    continue
                if self.state in {GameState.LOGIN_MODAL, GameState.WELCOME_MODAL, GameState.CONNECTION_LOST}:
                    time.sleep(interval_s)
                    continue
                if time.time() < float(getattr(self, "connection_monitor_grace_until", 0.0) or 0.0):
                    time.sleep(interval_s)
                    continue

                if self._has_backend_connection(timeout_s=3.5):
                    self.connection_fail_count = 0
                    self.connection_last_ok_at = time.time()
                else:
                    self.connection_fail_count += 1
                    print(f"[!] Connection check failed ({self.connection_fail_count}/{fail_limit})")

                    if self.connection_fail_count >= fail_limit:
                        print("[!] Connection lost. Terminating session.")
                        self._handle_connection_lost(force_logout=True)
            except Exception:
                if self.state not in {GameState.CONNECTION_LOST, GameState.LOGIN_MODAL, GameState.WELCOME_MODAL}:
                    self.connection_fail_count += 1
                    if self.connection_fail_count >= fail_limit:
                        self._handle_connection_lost(force_logout=True)
            
            time.sleep(interval_s)

    def _create_rounded_avatar(self, img_data, size=(40, 40)):
        """Convert raw image data to a rounded pygame surface using PIL for smooth masking."""
        try:
            from PIL import Image, ImageDraw
            if isinstance(img_data, bytes):
                pil_img = Image.open(BytesIO(img_data))
            else:
                pil_img = Image.open(img_data) # Path
                
            pil_img = pil_img.convert("RGBA").resize(size, Image.Resampling.LANCZOS)
            
            # Create smooth rounded rectangle mask
            mask = Image.new('L', size, 0)
            draw = ImageDraw.Draw(mask)
            # Use radius ~20% of size for a modern "squircle" look
            radius = size[0] // 5
            draw.rounded_rectangle((0, 0, size[0], size[1]), radius=radius, fill=255)
            
            # Apply mask to alpha channel
            pil_img.putalpha(mask)
            
            # Convert back to pygame surface
            data = pil_img.tobytes()
            return pygame.image.fromstring(data, size, "RGBA")
        except Exception as e:
            print(f"[!] Avatar rounding error: {e}")
            return self._get_fallback_avatar(size)

    def _get_fallback_avatar(self, size=(40, 40)):
        """Load the shadow fallback and round it."""
        path = "src/pics/shadow.jpg"
        if not os.path.exists(path):
            # Procedural fallback if file missing
            surf = pygame.Surface(size, pygame.SRCALPHA)
            pygame.draw.circle(surf, (60, 60, 70), (size[0]//2, size[1]//2), size[0]//2)
            return surf
        return self._create_rounded_avatar(path, size)

    def _load_discord_avatar(self):
        """Load Discord avatar from URL and round it."""
        if not self.discord_user:
            self.user_avatar = self._get_fallback_avatar()
            self.user_avatar_hires = self._get_fallback_avatar(size=(128, 128))
            return
            
        try:
            user_id = self.discord_user.get("id")
            avatar_hash = self.discord_user.get("avatar")
            if user_id and avatar_hash:
                avatar_url = f"https://cdn.discordapp.com/avatars/{user_id}/{avatar_hash}.png?size=128"
                response = requests.get(avatar_url, timeout=5)
                if response.status_code == 200:
                    self.user_avatar = self._create_rounded_avatar(response.content)
                    # Store a high-res circular version for the welcome modal
                    self.user_avatar_hires = self._create_circular_avatar(response.content, size=(128, 128))
                    print("[+] Avatar loaded and rounded")
                    return
        except Exception as e:
            print(f"[!] Avatar fetch error: {e}")
            
        # Fallback
        self.user_avatar = self._get_fallback_avatar()
        self.user_avatar_hires = self._get_fallback_avatar(size=(128, 128))

    def _create_circular_avatar(self, img_data, size=(128, 128)):
        """Create a circular avatar for the welcome modal."""
        try:
            from PIL import Image, ImageDraw
            if isinstance(img_data, bytes):
                pil_img = Image.open(BytesIO(img_data))
            else:
                pil_img = Image.open(img_data)

            pil_img = pil_img.convert("RGBA").resize(size, Image.Resampling.LANCZOS)

            # Circular mask
            mask = Image.new('L', size, 0)
            draw = ImageDraw.Draw(mask)
            draw.ellipse((0, 0, size[0], size[1]), fill=255)
            pil_img.putalpha(mask)

            data = pil_img.tobytes()
            return pygame.image.fromstring(data, size, "RGBA")
        except Exception as e:
            print(f"[!] Circular avatar error: {e}")
            return self._get_fallback_avatar(size)

    def start_discord_login(self):
        """Start Discord login in background thread."""
        if self.discord_user:
            print("[AUTH] Already logged in")
            return
        
        if not DISCORD_CLIENT_ID or not DISCORD_CLIENT_SECRET:
            print("[AUTH] Missing Discord credentials in env")
            return

        now = time.time()

        if self.login_in_progress:
            # Check if we have an active auth instance
            if self.auth_instance:
                # Reopen browser with potentially new random state
                url = self.auth_instance.get_authorize_url()
                print(f"[AUTH][attempt={self.login_attempt_id}] Resume: Reopening browser with fresh state")
                webbrowser.open(url)
                # Store the new URL just in case, though we primarily just open it
                self.discord_auth_url = url
                return

            # If stuck too long, force cancel and restart
            if self.login_started_at and (now - self.login_started_at) > self.login_timeout_s:
                print(f"[AUTH][attempt={self.login_attempt_id}] Stuck > timeout; forcing cancel/restart")
                self.cancel_discord_login()
            else:
                # Wait for init
                print(f"[AUTH][attempt={self.login_attempt_id}] Login initializing...")
                return

        # Start new attempt
        self.login_attempt_id += 1
        attempt_id = self.login_attempt_id
        self.login_in_progress = True
        self.login_started_at = now
        self.login_error = ""
        self.discord_auth_url = None
        self.connection_fail_count = 0
        self.connection_monitor_grace_until = max(float(getattr(self, "connection_monitor_grace_until", 0.0) or 0.0), now + 120.0)

        print(f"[AUTH][attempt={attempt_id}] Starting login thread")
        threading.Thread(target=self._do_discord_login, args=(attempt_id,), daemon=True).start()

    def cancel_discord_login(self):
        """Cancel current login attempt."""
        # Shutdown current server if active
        if self.auth_instance:
            print("[AUTH] Shutting down active auth server...")
            self.auth_instance.shutdown()
            self.auth_instance = None
            
        self.login_attempt_id += 1  # invalidate old attempts
        self.login_in_progress = False
        self.login_started_at = 0.0
        self.discord_auth_url = None
        self.login_error = "Canceled"
        print(f"[AUTH] Cancel requested. New current attempt={self.login_attempt_id}")

    def _do_discord_login(self, attempt_id):
        """Perform Discord login (runs in thread)."""
        auth = None
        try:
            from src.jutsu_academy.discord_auth import DiscordLogin
            # Create and store instance
            auth = DiscordLogin(DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET)
            self.auth_instance = auth

            # Expose the URL
            self.discord_auth_url = auth.get_authorize_url()
            print(f"[AUTH][attempt={attempt_id}] URL ready: {self.discord_auth_url[:50]}...")
            webbrowser.open(self.discord_auth_url)
            print(f"[AUTH][attempt={attempt_id}] Browser opened")

            # Wait for login
            user = auth.login(timeout=self.login_timeout_s)

            # Stale attempt guard
            if attempt_id != self.login_attempt_id:
                print(f"[AUTH][attempt={attempt_id}] Stale result ignored (current={self.login_attempt_id})")
                return

            if user:
                self.discord_user = user
                self.username = user.get("username", "User")
                self.connection_fail_count = 0
                self.connection_monitor_grace_until = time.time() + 45.0
                if hasattr(self, "_sync_network_identity"):
                    self._sync_network_identity()
                if getattr(self, "network_manager", None):
                    try:
                        self.network_manager.ensure_profile_identity_bound(
                            username=self.username,
                            discord_id=str(user.get("id") or ""),
                        )
                    except Exception:
                        pass
                self.progression = ProgressionManager(self.username, network_manager=self.network_manager) # Reload for new user
                self._quest_state_last_sync_at = 0.0
                self._quest_sync_inflight = False
                if hasattr(self, "load_settings_from_cloud"):
                    try:
                        self.load_settings_from_cloud(apply_runtime=False)
                        self._pending_runtime_settings_apply = True
                    except Exception:
                        pass
                self._load_player_meta()
                self._save_user_session()
                threading.Thread(target=self._load_discord_avatar, daemon=True).start()
                print(f"[AUTH][attempt={attempt_id}] Success: {self.username}")
                # Show welcome modal
                self.state = GameState.WELCOME_MODAL
            else:
                self.login_error = "Login timed out. Please try again."
                print(f"[AUTH][attempt={attempt_id}] No user returned (timeout/cancel)")
                # Show modal with error
                if self.state != GameState.MENU:
                    self.state = GameState.LOGIN_MODAL

        except Exception as e:
            if attempt_id == self.login_attempt_id:
                self.login_error = "Login failed. Please try again."
                if self.state != GameState.MENU:
                    self.state = GameState.LOGIN_MODAL
            print(f"[AUTH][attempt={attempt_id}] Error: {e}")

        finally:
            # Cleanup auth instance reference if it matches this thread's
            if self.auth_instance == auth:
                self.auth_instance = None
                
            # Only clear status if this attempt is still current
            if attempt_id == self.login_attempt_id:
                self.login_in_progress = False
                self.discord_auth_url = None
                print(f"[AUTH][attempt={attempt_id}] Login finished; in_progress=False")

    def logout_discord(self):
        """Log out Discord user."""
        self.discord_user = None
        self.username = "Guest"
        self.username = "Guest"
        if hasattr(self, "_sync_network_identity"):
            self._sync_network_identity()
        self.progression = ProgressionManager(self.username, network_manager=self.network_manager) # Reset to guest progress
        self._quest_state_last_sync_at = 0.0
        self._quest_sync_inflight = False
        self._load_player_meta()
        self.user_avatar = None
        self.user_avatar = None
        # Delete session file
        try:
            Path("user_session.json").unlink(missing_ok=True)
        except:
            pass
        print("[*] Logged out")
