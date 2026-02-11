from supabase import create_client, Client
from pathlib import Path
import json
import time
import os
import cv2
import threading
import uuid
import hashlib

# Load env variables simple parser
def get_env():
    env = {}
    
    # 1. Try Loading from os.environ first (if loaded by dotenv elsewhere)
    for k, v in os.environ.items():
        env[k] = v
        
    # 2. Check for .env files in common locations
    root_dir = Path(__file__).parent.parent.parent
    possible_paths = [
        root_dir / ".env",
        root_dir / "web" / ".env.local",
        root_dir / ".env.local"
    ]
    
    for env_path in possible_paths:
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

class NetworkManager:
    def __init__(self):
        env = get_env()
        
        # Try different key variants
        self.url = env.get("SUPABASE_URL") or env.get("NEXT_PUBLIC_SUPABASE_URL", "")
        self.key = env.get("SUPABASE_KEY") or env.get("NEXT_PUBLIC_SUPABASE_ANON_KEY", "")
        
        if not self.url or not self.key:
            print("[!] Supabase credentials missing (checked .env, web/.env.local)")
            self.client = None
        else:
            self.client: Client = create_client(self.url, self.key)
            
        self.room_id = None
        self.is_host = False
        self.last_state = {}
        self.msg_queue = []
        self.stop_thread = False
        self._warned_profile_fallback = False

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
                .in_('type', ['announcement', 'version'])\
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
        """Upload score to DB"""
        if not self.client: return
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
        except Exception as e:
            print(f"[!] Score submission failed: {e}")

    def issue_run_token(self, username, mode, client_started_at=None):
        """
        Request a short-lived challenge run token from Supabase.
        Falls back to local token if RPC isn't available yet.
        """
        fallback_token = f"local_{uuid.uuid4().hex}"
        if not self.client:
            return {"ok": False, "token": fallback_token, "source": "offline"}

        payload = {
            "p_username": username,
            "p_mode": str(mode or "").upper(),
            "p_client_started_at": client_started_at or time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
        }
        for attempt in range(2):
            try:
                response = self.client.rpc("issue_run_token", payload).execute()
                data = response.data
                if isinstance(data, list) and data:
                    data = data[0]
                if isinstance(data, dict) and data.get("token"):
                    return {
                        "ok": bool(data.get("ok", True)),
                        "token": data["token"],
                        "expires_at": data.get("expires_at"),
                        "source": "rpc",
                    }
            except Exception as e:
                if attempt == 1:
                    print(f"[!] issue_run_token RPC failed, using fallback token: {e}")
                time.sleep(0.1)

        return {"ok": False, "token": fallback_token, "source": "fallback"}

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
        Falls back to legacy direct insert while migration is pending.
        """
        if not self.client:
            return {"ok": False, "reason": "offline"}

        local_token = str(run_token or "")
        if (not local_token) or local_token.startswith("local_"):
            token_data = self.issue_run_token(
                username=username,
                mode=mode,
                client_started_at=time.strftime("%Y-%m-%dT%H:%M:%SZ", time.gmtime()),
            )
            refreshed_token = str(token_data.get("token") or "")
            if refreshed_token:
                local_token = refreshed_token

        payload = {
            "p_username": username,
            "p_mode": str(mode or "").upper(),
            "p_score_time": float(score_time),
            "p_run_token": local_token,
            "p_events": events or [],
            "p_run_hash": run_hash or "",
            "p_metadata": metadata or {},
            "p_discord_id": discord_id,
            "p_avatar_url": avatar_url,
        }
        if not payload["p_run_hash"]:
            canonical = json.dumps(payload["p_events"], separators=(",", ":"), sort_keys=True)
            payload["p_run_hash"] = hashlib.sha256(canonical.encode("utf-8")).hexdigest()

        for attempt in range(2):
            try:
                response = self.client.rpc("submit_challenge_run_secure", payload).execute()
                data = response.data
                if isinstance(data, list) and data:
                    data = data[0]
                if isinstance(data, dict):
                    return data
            except Exception as e:
                if attempt == 1:
                    print(f"[!] secure submit RPC failed, falling back to legacy insert: {e}")
                time.sleep(0.1)

        # Backward-compatible fallback so gameplay is not blocked pre-migration.
        self.submit_score(
            username=username,
            score_time=score_time,
            mode=mode,
            discord_id=discord_id,
            avatar_url=avatar_url,
        )
        return {"ok": True, "fallback": True}

    def get_profile(self, username):
        """Fetch player profile/progression from DB"""
        if not self.client: return None
        try:
            response = self.client.table('profiles').select('*').eq('username', username).execute()
            if response.data:
                return response.data[0]
            return {} # Return empty dict for "User Not Found"
        except Exception as e:
            print(f"[!] Profile fetch failed: {e}")
        return None # Return None for "Error"

    def upsert_profile(self, data):
        """Update or Insert player progression"""
        if not self.client: return
        try:
            username = data.get("username")
            if not username:
                return

            # Preferred path: server-side guarded merge.
            try:
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
                    "p_discord_id": data.get("discord_id"),
                }
                self.client.rpc("upsert_profile_guarded", rpc_payload).execute()
                return
            except Exception:
                if not self._warned_profile_fallback:
                    print("[!] upsert_profile_guarded RPC unavailable, using strict cloud-authoritative fallback.")
                    self._warned_profile_fallback = True
                pass

            existing = self.get_profile(username)
            merged = dict(data)
            if existing:
                # Strict fallback: cloud remains authority for progression fields.
                for key in ["xp", "level", "total_signs", "total_jutsus", "fastest_combo", "rank"]:
                    if key in existing:
                        merged[key] = existing.get(key)

                # Tutorial/version flags should stay true once true.
                if "tutorial_seen" in existing or "tutorial_seen" in merged:
                    merged["tutorial_seen"] = bool(existing.get("tutorial_seen", False) or merged.get("tutorial_seen", False))
                if "tutorial_seen_at" in existing and existing.get("tutorial_seen_at") and not merged.get("tutorial_seen_at"):
                    merged["tutorial_seen_at"] = existing.get("tutorial_seen_at")
                if "tutorial_version" in existing and not merged.get("tutorial_version"):
                    merged["tutorial_version"] = existing.get("tutorial_version")

                # Keep cloud discord id if client payload does not include one.
                if existing.get("discord_id") and not merged.get("discord_id"):
                    merged["discord_id"] = existing.get("discord_id")

            # We use username as the conflict target
            self.client.table('profiles').upsert(merged, on_conflict='username').execute()
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
