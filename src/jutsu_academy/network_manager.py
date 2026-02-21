from supabase import create_client, Client
from pathlib import Path
import json
import time
import os
import base64
import cv2
import threading
import hashlib
import datetime
import requests
import sys
from email.utils import parsedate_to_datetime

# Load env variables simple parser
def _candidate_env_files():
    candidates = []

    # Current working dir first (allows explicit local override).
    cwd = Path.cwd()
    candidates.extend([
        cwd / ".env",
        cwd / ".env.local",
        cwd / "web" / ".env.local",
    ])

    # Source-tree roots (dev mode).
    root_dir = Path(__file__).parent.parent.parent
    candidates.extend([
        root_dir / ".env",
        root_dir / ".env.local",
        root_dir / "web" / ".env.local",
    ])

    # Frozen app roots (PyInstaller).
    if getattr(sys, "frozen", False):
        exe_dir = Path(sys.executable).resolve().parent
        meipass = Path(getattr(sys, "_MEIPASS", exe_dir))
        frozen_roots = [
            exe_dir,                 # onedir app folder
            exe_dir.parent,          # .app/Contents/MacOS parent fallback
            exe_dir / "_internal",   # pyinstaller data root
            meipass,                 # temp/extraction root
            meipass.parent,
        ]
        for root in frozen_roots:
            candidates.extend([
                root / ".env",
                root / ".env.local",
                root / "web" / ".env.local",
            ])

    # De-duplicate preserving order
    deduped = []
    seen = set()
    for path in candidates:
        key = str(path)
        if key in seen:
            continue
        seen.add(key)
        deduped.append(path)
    return deduped


def get_env():
    env = {}
    
    # 1. Try Loading from os.environ first (if loaded by dotenv elsewhere)
    for k, v in os.environ.items():
        env[k] = v

    # 2. Try obfuscated .config.dat (preferred for release builds)
    try:
        from src.jutsu_academy.config_obfuscator import get_obfuscated_config_paths, load_obfuscated_config
        for config_path in get_obfuscated_config_paths():
            if config_path.exists():
                try:
                    config = load_obfuscated_config(str(config_path))
                    if config:
                        for k, v in config.items():
                            if k not in env:
                                env[k] = v
                except Exception:
                    pass
    except ImportError:
        pass
        
    # 3. Check for plain .env files in common locations (dev/fallback)
    for env_path in _candidate_env_files():
        if env_path.exists():
            try:
                with open(env_path, "r") as f:
                    for line in f:
                        line = line.strip()
                        if not line or line.startswith("#"): continue
                        if "=" in line:
                            k, v = line.split("=", 1)
                            # Simple cleanup
                            k = k.strip() 
                            v = v.strip().strip('"').strip("'")
                            if k not in env: # Don't overwrite existing env vars
                                env[k] = v
            except:
                pass
                
    return env

def _decode_jwt_role(token):
    """Best-effort decode of JWT role claim (without signature verification)."""
    try:
        parts = str(token or "").split(".")
        if len(parts) != 3:
            return ""
        payload_b64 = parts[1]
        padding = "=" * ((4 - (len(payload_b64) % 4)) % 4)
        raw = base64.urlsafe_b64decode((payload_b64 + padding).encode("utf-8"))
        payload = json.loads(raw.decode("utf-8"))
        return str(payload.get("role") or "").lower()
    except Exception:
        return ""

class NetworkManager:
    def __init__(self):
        env = get_env()
        
        # Try different key variants
        self.url = env.get("SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL", "")
        self.key = (
            env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")
            or env.get("SUPABASE_ANON_KEY")
            or env.get("SUPABASE_KEY", "")
        )
        if (not env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY")) and env.get("SUPABASE_KEY"):
            print("[!] Using SUPABASE_KEY fallback. Prefer NEXT_PUBLIC_SUPABASE_ANON_KEY for client builds.")
        
        if not self.url or not self.key:
            print("[!] Supabase credentials missing (checked .env, web/.env.local)")
            self.client = None
        else:
            self.client: Client = create_client(self.url, self.key)

        allow_direct_raw = str(env.get("ALLOW_DIRECT_LEADERBOARD_WRITE", "")).strip().lower()
        self.allow_direct_leaderboard_write = allow_direct_raw in {"1", "true", "yes", "on"}
        self.supabase_key_role = _decode_jwt_role(self.key)
        if self.allow_direct_leaderboard_write:
            print("[!] Direct leaderboard insert override enabled. Use only in trusted server/admin contexts.")
            
        self.room_id = None
        self.is_host = False
        self.last_state = {}
        self.msg_queue = []
        self.stop_thread = False
        self._warned_profile_fallback = False
        self._warned_profile_meta_missing_columns = False
        self._warned_profile_meta_rpc_fallback = False
        self._server_time_offset_s = 0.0
        self._server_time_offset_ready = False
        self._server_time_last_sync = 0.0
        self._server_time_next_retry_at = 0.0
        self.active_username = ""
        self.active_discord_id = ""

    def set_active_identity(self, username=None, discord_id=None):
        """Set the active client identity used for guarded RPC calls."""
        self.active_username = str(username or "").strip()
        self.active_discord_id = str(discord_id or "").strip()

    def _resolve_discord_id(self, discord_id=None):
        raw = str(discord_id or "").strip()
        if raw:
            return raw
        return str(getattr(self, "active_discord_id", "") or "").strip()

    def _rpc_dict(self, rpc_name, payload=None, retries=2, retry_sleep_s=0.1):
        """Run RPC and normalize to a single dict response."""
        if not self.client:
            return {"ok": False, "reason": "offline"}
        body = payload or {}
        last_error = ""
        for attempt in range(max(1, int(retries))):
            try:
                response = self.client.rpc(rpc_name, body).execute()
                data = response.data
                if isinstance(data, list) and data:
                    data = data[0]
                if isinstance(data, dict):
                    return data
            except Exception as e:
                last_error = str(e)
                if attempt == (max(1, int(retries)) - 1):
                    print(f"[!] RPC {rpc_name} failed: {e}")
                time.sleep(float(retry_sleep_s))
        err_lower = last_error.lower()
        reason = "rpc_unavailable"
        if "does not exist" in err_lower or ("function" in err_lower and "not found" in err_lower):
            reason = "rpc_missing"
        elif "permission denied" in err_lower or "not allowed" in err_lower or "row-level security" in err_lower:
            reason = "rpc_forbidden"
        elif "timeout" in err_lower or "timed out" in err_lower:
            reason = "rpc_timeout"
        return {
            "ok": False,
            "reason": reason,
            "rpc": rpc_name,
            "detail": last_error[:300],
        }

    def connect(self, room_id):
        if not self.client: return
        
        self.room_id = room_id if room_id else f"ROOM_{int(time.time())}"
        self.is_host = True if not room_id else False
        
        print(f"[*] Connected to Room: {self.room_id} (Role: {'HOST' if self.is_host else 'GUEST'})")
        
        # Start Polling Thread
        self.t = threading.Thread(target=self.poll_loop)
        self.t.start()

    def poll_loop(self):
        """Polls the match state file from storage every 1s"""
        while not self.stop_thread:
            try:
                # Attempt to download matches/id.json
                # Note: Using 'training_data' bucket for now as we know it exists
                # In production, create a 'matches' bucket
                try:
                    data = self.client.storage.from_("training_data").download(f"matches/{self.room_id}.json")
                    state = json.loads(data)
                    
                    # Check for updates
                    if state.get("timestamp", 0) > self.last_state.get("timestamp", 0):
                        # New update!
                        self.last_state = state
                        # Logic to see if it's a message for me
                        # If I am host, and turn is guest, and new state says turn is host -> I received pass
                        
                        if state.get("last_action") and state["last_action"] != self.last_state.get("last_action_id"):
                             self.msg_queue.append(state["payload"])
                    
                except Exception as e:
                    # File likely doesn't exist yet (new room)
                    if self.is_host and not self.last_state:
                        # Create it
                        self.send_state({"status": "waiting"})
                    pass
                    
            except Exception as e:
                print(f"[!] Network Error: {e}")
            
            time.sleep(1.0)

    def send_state(self, payload):
        """Write state to storage"""
        if not self.client: return
        
        state = {
            "room_id": self.room_id,
            "timestamp": time.time(),
            "turn": "host" if self.is_host else "guest", # Simplified
            "payload": payload,
            "last_action_id": str(time.time())
        }
        
        # Determine filename
        filename = f"matches/{self.room_id}.json"
        
        # json dump
        data = json.dumps(state).encode('utf-8')
        
        # Upload (Upsert)
        try:
            self.client.storage.from_("training_data").upload(
                filename, 
                data, 
                {"upsert": "true", "content-type": "application/json"}
            )
        except Exception as e:
            print(f"[!] Send Error: {e}")

    def send_attack(self, frame):
        # 1. Upload Image
        img_name = f"matches/{self.room_id}_{int(time.time())}.jpg"
        _, buf = cv2.imencode(".jpg", frame)
        try:
             self.client.storage.from_("training_data").upload(
                img_name,
                buf.tobytes(),
                {"content-type": "image/jpeg"}
             )
             img_url = self.client.storage.from_("training_data").get_public_url(img_name)
             
             # 2. Update State
             self.send_state({
                 "type": "attack",
                 "damage": 20,
                 "image": img_url
             })
             
        except Exception as e:
            print(f"Attack upload failed: {e}")

    def receive(self):
        if self.msg_queue:
            return self.msg_queue.pop(0)
        return None

    def close(self):
        self.stop_thread = True
        
    def join_room(self, room_id):
        # Improved connection logic
        # 1. Determine Host/Guest
        # For simple Storage-based matching:
        # If room_id is empty => Host a new random room
        # If room_id provided => Join (Guest)
        
        if not room_id:
            # HOST
            self.room_id = f"ROOM_{int(time.time())}"[-6:] # Short ID
            self.is_host = True
            role = "host"
        else:
            # GUEST
            self.room_id = room_id
            self.is_host = False
            role = "guest"
            
        print(f"[*] Connected to Room: {self.room_id} ({role})")
        # Start state polling
        self.t = threading.Thread(target=self.poll_loop)
        self.t.start()
        
        return role

    def get_leaderboard(self, limit=10, offset=0, mode="Fireball"):
        """Fetch top scores filtered by Jutsu (mode)"""
        if not self.client: return []
        try:
            # We filter by 'mode' column which now holds the Jutsu Name
            response = self.client.table('leaderboard')\
                .select('*')\
                .eq('mode', mode)\
                .order('score_time', desc=False)\
                .range(offset, offset + limit - 1)\
                .execute()
            return response.data
        except Exception as e:
            print(f"[!] Leaderboard fetch failed: {e}")
            return []

    def get_announcements(self, limit=10):
        """Fetch active announcements + version entries from app_config table."""
        if not self.client: return []
        try:
            response = self.client.table('app_config')\
                .select('*')\
                .in_('type', ['announcement', 'version', 'maintenance'])\
                .eq('is_active', True)\
                .order('priority', desc=True)\
                .order('created_at', desc=True)\
                .limit(limit)\
                .execute()
            return response.data
        except Exception as e:
            print(f"[!] Announcements fetch failed: {e}")
            return []

    def submit_score(self, username, score_time, mode="Fireball", discord_id=None, avatar_url=None):
        """
        Direct leaderboard insert (admin/server-only).
        Disabled by default for client safety; use submit_score_secure() for gameplay.
        """
        if not self.allow_direct_leaderboard_write:
            print("[!] Direct leaderboard insert disabled. Use submit_score_secure() RPC.")
            return {"ok": False, "reason": "direct_submit_disabled"}
        if self.supabase_key_role != "service_role":
            print("[!] Direct leaderboard insert requires service-role key.")
            return {"ok": False, "reason": "service_role_required"}
        if not self.client:
            return {"ok": False, "reason": "offline"}
        try:
            data = {
                "username": username,
                "score_time": float(score_time),
                "mode": mode
            }
            if discord_id: data["discord_id"] = discord_id
            if avatar_url: data["avatar_url"] = avatar_url

            self.client.table('leaderboard').insert(data).execute()
            print(f"[+] Score submitted: {score_time}s by {username}")
            return {"ok": True}
        except Exception as e:
            print(f"[!] Score submission failed: {e}")
            return {"ok": False, "reason": "insert_failed"}

    def issue_run_token(self, username, mode, client_started_at=None, discord_id=None):
        """
        Request a short-lived challenge run token from Supabase.
        Returns a failure result if RPC isn't available.
        """
        if not self.client:
            return {"ok": False, "token": "", "source": "offline", "reason": "offline"}
        resolved_discord_id = self._resolve_discord_id(discord_id)
        if not resolved_discord_id:
            return {"ok": False, "token": "", "source": "identity", "reason": "missing_discord_id"}

        payload = {
            "p_username": username,
            "p_discord_id": resolved_discord_id,
            "p_mode": str(mode or "").upper(),
            "p_client_started_at": client_started_at or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        data = self._rpc_dict("issue_run_token_bound", payload, retries=2)
        if isinstance(data, dict) and data.get("token"):
            return {
                "ok": bool(data.get("ok", True)),
                "token": data["token"],
                "expires_at": data.get("expires_at"),
                "source": "rpc",
            }
        return {
            "ok": False,
            "token": "",
            "source": "unavailable",
            "reason": data.get("reason", "rpc_unavailable") if isinstance(data, dict) else "rpc_unavailable",
        }

    def submit_score_secure(
        self,
        username,
        score_time,
        mode="Fireball",
        run_token=None,
        events=None,
        run_hash=None,
        metadata=None,
        discord_id=None,
        avatar_url=None,
    ):
        """
        Submit score through server validation RPC.
        Fails closed if server validation is unavailable.
        """
        if not self.client:
            return {"ok": False, "reason": "offline"}
        resolved_discord_id = self._resolve_discord_id(discord_id)
        if not resolved_discord_id:
            return {"ok": False, "reason": "missing_discord_id"}

        local_token = str(run_token or "")
        if (not local_token) or local_token.startswith("local_"):
            token_data = self.issue_run_token(
                username=username,
                mode=mode,
                client_started_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
                discord_id=resolved_discord_id,
            )
            refreshed_token = str(token_data.get("token") or "")
            if refreshed_token:
                local_token = refreshed_token
            elif isinstance(token_data, dict):
                return {"ok": False, "reason": token_data.get("reason", "token_unavailable")}

        if (not local_token) or local_token.startswith("local_"):
            return {"ok": False, "reason": "token_unavailable"}

        payload = {
            "p_username": username,
            "p_mode": str(mode or "").upper(),
            "p_score_time": float(score_time),
            "p_run_token": local_token,
            "p_events": events or [],
            "p_run_hash": run_hash or "",
            "p_metadata": metadata or {},
            "p_discord_id": resolved_discord_id,
            "p_avatar_url": avatar_url,
        }
        if not payload["p_run_hash"]:
            canonical = json.dumps(payload["p_events"], separators=(",", ":"), sort_keys=True)
            payload["p_run_hash"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

        for attempt in range(2):
            try:
                response = self.client.rpc("submit_challenge_run_secure_bound", payload).execute()
                data = response.data
                if isinstance(data, list) and data:
                    data = data[0]
                if isinstance(data, dict):
                    return data
            except Exception as e:
                if attempt == 1:
                    print(f"[!] secure submit RPC failed: {e}")
                time.sleep(0.1)

        return {"ok": False, "reason": "rpc_unavailable"}

    def get_competitive_state_authoritative(self, username, discord_id=None):
        """
        Fetch authoritative progression + quest state from server.
        Preferred response shape:
        {ok, profile:{...}, quests:{...}}
        """
        if not username:
            return {"ok": False, "reason": "missing_username"}
        resolved_discord_id = self._resolve_discord_id(discord_id)
        if not resolved_discord_id:
            return {"ok": False, "reason": "missing_discord_id"}
        data = self._rpc_dict(
            "get_competitive_state_authoritative_bound",
            {
                "p_username": str(username),
                "p_discord_id": resolved_discord_id,
            },
            retries=2,
        )
        return data if isinstance(data, dict) else {"ok": False, "reason": "state_unavailable"}

    def award_jutsu_completion_authoritative(self, username, xp_gain, signs_landed, is_challenge, mode=None, discord_id=None):
        """
        Apply server-authoritative progression/quest increment for a completed jutsu.
        """
        if not username:
            return {"ok": False, "reason": "missing_username"}
        resolved_discord_id = self._resolve_discord_id(discord_id)
        if not resolved_discord_id:
            return {"ok": False, "reason": "missing_discord_id"}
        payload = {
            "p_username": str(username),
            "p_discord_id": resolved_discord_id,
            "p_xp_gain": int(max(0, xp_gain or 0)),
            "p_signs_landed": int(max(0, signs_landed or 0)),
            "p_is_challenge": bool(is_challenge),
            "p_mode": str(mode or "").upper(),
        }
        return self._rpc_dict("award_jutsu_completion_authoritative_bound", payload, retries=2)

    def claim_quest_authoritative(self, username, scope, quest_id, discord_id=None):
        """
        Claim quest reward on server with one-claim-per-period enforcement.
        """
        if not username:
            return {"ok": False, "reason": "missing_username"}
        resolved_discord_id = self._resolve_discord_id(discord_id)
        if not resolved_discord_id:
            return {"ok": False, "reason": "missing_discord_id"}
        payload = {
            "p_username": str(username),
            "p_discord_id": resolved_discord_id,
            "p_scope": str(scope or "").lower(),
            "p_quest_id": str(quest_id or ""),
        }
        return self._rpc_dict("claim_quest_authoritative_bound", payload, retries=2)

    def get_profile(self, username, discord_id=None):
        """Fetch player profile/progression from DB"""
        if not self.client: return None
        resolved_discord_id = self._resolve_discord_id(discord_id)
        try:
            query = self.client.table('profiles').select('*').eq('username', username)
            if resolved_discord_id:
                query = query.eq("discord_id", resolved_discord_id)
            response = query.execute()
            if response.data:
                return response.data[0]
            return {} # Return empty dict for "User Not Found"
        except Exception as e:
            print(f"[!] Profile fetch failed: {e}")
        return None # Return None for "Error"

    def _sync_server_time_offset(self):
        """Best-effort sync of local clock offset against server UTC time."""
        if not self.url:
            return False

        headers = {}
        if self.key:
            headers["apikey"] = self.key
            headers["Authorization"] = f"Bearer {self.key}"

        base = self.url.rstrip("/")
        candidates = [base, f"{base}/rest/v1/"]

        for endpoint in candidates:
            try:
                response = requests.head(endpoint, headers=headers, timeout=2)
                date_header = response.headers.get("Date")
                if not date_header:
                    # Some proxies omit Date on HEAD, retry with GET.
                    response = requests.get(endpoint, headers=headers, timeout=2)
                    date_header = response.headers.get("Date")
                if not date_header:
                    continue

                server_dt = parsedate_to_datetime(date_header)
                if server_dt.tzinfo is None:
                    server_dt = server_dt.replace(tzinfo=datetime.timezone.utc)
                server_ts = server_dt.astimezone(datetime.timezone.utc).timestamp()
                local_ts = time.time()

                self._server_time_offset_s = float(server_ts - local_ts)
                self._server_time_last_sync = local_ts
                self._server_time_offset_ready = True
                return True
            except Exception:
                continue

        return False

    def get_authoritative_utc_now(self, max_age_s=300, retry_backoff_s=60):
        """
        Return best-effort authoritative UTC time.
        Uses cached server offset and refreshes periodically.
        Falls back to local UTC when network sync is unavailable.
        """
        now_ts = time.time()
        needs_refresh = (
            (not self._server_time_offset_ready)
            or ((now_ts - self._server_time_last_sync) >= float(max_age_s))
        )

        if needs_refresh and now_ts >= self._server_time_next_retry_at:
            ok = self._sync_server_time_offset()
            if not ok:
                self._server_time_next_retry_at = now_ts + float(retry_backoff_s)

        if self._server_time_offset_ready:
            return datetime.datetime.fromtimestamp(
                now_ts + self._server_time_offset_s,
                tz=datetime.timezone.utc,
            )
        return datetime.datetime.fromtimestamp(now_ts, tz=datetime.timezone.utc)

    def get_profile_settings_authoritative(self, username, discord_id=None):
        """Fetch cloud-authoritative user settings."""
        if not self.client:
            return {"ok": False, "reason": "offline"}
        if not username:
            return {"ok": False, "reason": "missing_username"}
        resolved_discord_id = self._resolve_discord_id(discord_id)
        if not resolved_discord_id:
            return {"ok": False, "reason": "missing_discord_id"}
        payload = {
            "p_username": str(username),
            "p_discord_id": resolved_discord_id,
        }
        return self._rpc_dict("get_profile_settings_bound", payload, retries=2)

    def get_calibration_profile_authoritative(self, username, discord_id=None):
        """Fetch cloud-authoritative calibration profile."""
        if not self.client:
            return {"ok": False, "reason": "offline"}
        if not username:
            return {"ok": False, "reason": "missing_username"}
        resolved_discord_id = self._resolve_discord_id(discord_id)
        if not resolved_discord_id:
            return {"ok": False, "reason": "missing_discord_id"}
        payload = {
            "p_username": str(username),
            "p_discord_id": resolved_discord_id,
        }
        return self._rpc_dict("get_calibration_profile_bound", payload, retries=2)

    def upsert_profile_settings_authoritative(self, username, user_settings, discord_id=None):
        """Persist user settings through guarded bound RPC."""
        if not self.client:
            return {"ok": False, "reason": "offline"}
        if not username:
            return {"ok": False, "reason": "missing_username"}
        resolved_discord_id = self._resolve_discord_id(discord_id)
        if not resolved_discord_id:
            return {"ok": False, "reason": "missing_discord_id"}
        if not isinstance(user_settings, dict):
            return {"ok": False, "reason": "invalid_settings"}
        payload = {
            "p_username": str(username),
            "p_discord_id": resolved_discord_id,
            "p_user_settings": user_settings,
        }
        return self._rpc_dict("upsert_profile_settings_bound", payload, retries=2)

    def upsert_calibration_profile_authoritative(self, username, calibration_profile, discord_id=None):
        """Persist calibration profile through guarded bound RPC."""
        if not self.client:
            return {"ok": False, "reason": "offline"}
        if not username:
            return {"ok": False, "reason": "missing_username"}
        resolved_discord_id = self._resolve_discord_id(discord_id)
        if not resolved_discord_id:
            return {"ok": False, "reason": "missing_discord_id"}
        if not isinstance(calibration_profile, dict):
            return {"ok": False, "reason": "invalid_calibration_profile"}
        payload = {
            "p_username": str(username),
            "p_discord_id": resolved_discord_id,
            "p_calibration_profile": calibration_profile,
        }
        return self._rpc_dict("upsert_calibration_profile_bound", payload, retries=2)

    def ensure_profile_identity_bound(self, username, discord_id=None):
        """Bind username row to discord_id once (bootstrap for legacy null discord_id rows)."""
        if not self.client:
            return {"ok": False, "reason": "offline"}
        if not username:
            return {"ok": False, "reason": "missing_username"}
        resolved_discord_id = self._resolve_discord_id(discord_id)
        if not resolved_discord_id:
            return {"ok": False, "reason": "missing_discord_id"}
        payload = {
            "p_username": str(username),
            "p_discord_id": resolved_discord_id,
        }
        return self._rpc_dict("bind_profile_identity_bound", payload, retries=2)

    def upsert_profile_meta(
        self,
        username,
        tutorial_seen=None,
        tutorial_seen_at=None,
        tutorial_version=None,
        mastery=None,
        quests=None,
        discord_id=None,
    ):
        """Update profile meta fields without touching progression authority fields."""
        if not self.client:
            return
        if not username:
            return
        resolved_discord_id = self._resolve_discord_id(discord_id)
        if (username != "Guest") and (not resolved_discord_id):
            return {"ok": False, "reason": "missing_discord_id"}

        payload = {"username": username}

        if tutorial_seen is not None:
            payload["tutorial_seen"] = bool(tutorial_seen)
        if tutorial_seen_at is not None:
            payload["tutorial_seen_at"] = tutorial_seen_at
        if tutorial_version is not None:
            payload["tutorial_version"] = tutorial_version
        if isinstance(mastery, dict):
            payload["mastery"] = mastery
        if isinstance(quests, dict):
            payload["quests"] = quests
        if resolved_discord_id:
            payload["discord_id"] = resolved_discord_id

        if len(payload) <= 1:
            return

        # Preferred path: server-side guarded meta upsert (RLS-safe).
        rpc_payload = {
            "p_username": username,
            "p_tutorial_seen": bool(tutorial_seen) if tutorial_seen is not None else None,
            "p_tutorial_seen_at": tutorial_seen_at,
            "p_tutorial_version": tutorial_version,
            "p_mastery": mastery if isinstance(mastery, dict) else None,
            "p_quests": quests if isinstance(quests, dict) else None,
            "p_discord_id": resolved_discord_id,
        }
        res = self._rpc_dict("upsert_profile_meta_guarded_bound", rpc_payload, retries=2)
        if isinstance(res, dict) and res.get("ok", False):
            return res
        if not self._warned_profile_meta_rpc_fallback:
            reason = res.get("reason", "rpc_unavailable") if isinstance(res, dict) else "rpc_unavailable"
            print(f"[!] upsert_profile_meta_guarded_bound rejected: {reason}.")
            self._warned_profile_meta_rpc_fallback = True
        return res if isinstance(res, dict) else {"ok": False, "reason": "rpc_unavailable"}

    def upsert_profile(self, data):
        """Update or Insert player progression"""
        if not self.client: return
        try:
            username = data.get("username")
            if not username:
                return
            resolved_discord_id = self._resolve_discord_id(data.get("discord_id"))
            if (username != "Guest") and (not resolved_discord_id):
                return {"ok": False, "reason": "missing_discord_id"}

            # Preferred path: server-side guarded merge.
            rpc_payload = {
                "p_username": username,
                "p_xp": int(data.get("xp", 0) or 0),
                "p_level": int(data.get("level", 0) or 0),
                "p_rank": str(data.get("rank", "") or ""),
                "p_total_signs": int(data.get("total_signs", 0) or 0),
                "p_total_jutsus": int(data.get("total_jutsus", 0) or 0),
                "p_fastest_combo": int(data.get("fastest_combo", 0) or 0),
                "p_tutorial_seen": bool(data.get("tutorial_seen", False)),
                "p_tutorial_seen_at": data.get("tutorial_seen_at"),
                "p_tutorial_version": data.get("tutorial_version"),
                "p_discord_id": resolved_discord_id,
            }
            res = self._rpc_dict("upsert_profile_guarded_bound", rpc_payload, retries=2)
            if isinstance(res, dict) and res.get("ok", False):
                return res
            if not self._warned_profile_fallback:
                reason = res.get("reason", "rpc_unavailable") if isinstance(res, dict) else "rpc_unavailable"
                print(f"[!] upsert_profile_guarded_bound rejected: {reason}.")
                self._warned_profile_fallback = True
            return res if isinstance(res, dict) else {"ok": False, "reason": "rpc_unavailable"}
        except Exception as e:
            print(f"[!] Profile sync failed: {e}")

if __name__ == "__main__":
    nm = NetworkManager()
    print(f"URL: {nm.url}")
    print(f"Key Found: {'Yes' if nm.key else 'No'}")
    if nm.client:
        print("Client created successfully.")
        # Try fetch
        print("Fetching leaderboard...")
        print(nm.get_leaderboard(limit=1))
    else:
        print("Client failed.")
