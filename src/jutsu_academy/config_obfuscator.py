"""
Obfuscated config file utilities for Jutsu Academy builds.

Instead of shipping a plain-text .env file alongside the executable,
this module encodes the config into a binary .dat file that is not
human-readable at a glance.

Usage (build time):
    python src/jutsu_academy/config_obfuscator.py encode .env.release dist/JutsuAcademy/.config.dat

Usage (runtime):
    from config_obfuscator import load_obfuscated_config
    env = load_obfuscated_config("path/to/.config.dat")
    # env is a dict like {"SUPABASE_URL": "...", ...}
"""

import base64
import json
import os
import sys
import zlib
from pathlib import Path


# Simple XOR key — NOT cryptographic security, but prevents plain-text snooping.
# Anyone who reads this source can reverse it, but it stops casual users from
# opening the file and seeing raw credentials.
_OBFUSCATION_KEY = b"JutsuAcademy2026NarutoHandSigns"


def _xor_bytes(data: bytes, key: bytes) -> bytes:
    """XOR data with a repeating key."""
    key_len = len(key)
    return bytes(b ^ key[i % key_len] for i, b in enumerate(data))


def encode_env_to_config(env_path: str, output_path: str) -> None:
    """
    Read a .env file and write an obfuscated .config.dat binary file.
    """
    env = {}
    with open(env_path, "r", encoding="utf-8") as f:
        for line in f:
            line = line.strip()
            if not line or line.startswith("#"):
                continue
            if "=" in line:
                k, v = line.split("=", 1)
                k = k.strip()
                v = v.strip().strip('"').strip("'")
                env[k] = v

    # Serialize → compress → XOR → base64
    payload = json.dumps(env, separators=(",", ":")).encode("utf-8")
    compressed = zlib.compress(payload, 9)
    xored = _xor_bytes(compressed, _OBFUSCATION_KEY)
    encoded = base64.b64encode(xored)

    os.makedirs(os.path.dirname(output_path) or ".", exist_ok=True)
    with open(output_path, "wb") as f:
        # Magic header so we know it's our format
        f.write(b"JUTSU_CFG_V1\n")
        f.write(encoded)

    print(f"[+] Encoded {len(env)} keys → {output_path} ({os.path.getsize(output_path)} bytes)")


def load_obfuscated_config(config_path: str) -> dict:
    """
    Load and decode an obfuscated .config.dat file.
    Returns a dict of key-value pairs.
    """
    path = Path(config_path)
    if not path.exists():
        return {}

    with open(path, "rb") as f:
        header = f.readline()
        if not header.startswith(b"JUTSU_CFG_V1"):
            return {}
        encoded = f.read()

    xored = base64.b64decode(encoded)
    compressed = _xor_bytes(xored, _OBFUSCATION_KEY)
    payload = zlib.decompress(compressed)
    return json.loads(payload.decode("utf-8"))


def get_obfuscated_config_paths() -> list:
    """
    Return candidate paths for .config.dat based on runtime context.
    """
    candidates = []

    # Current working directory
    cwd = Path.cwd()
    candidates.append(cwd / ".config.dat")

    # Source tree root (dev mode)
    root_dir = Path(__file__).parent.parent.parent
    candidates.append(root_dir / ".config.dat")

    # Frozen app (PyInstaller)
    if getattr(sys, "frozen", False):
        exe_dir = Path(sys.executable).resolve().parent
        meipass = Path(getattr(sys, "_MEIPASS", exe_dir))
        for root in [exe_dir, exe_dir.parent, exe_dir / "_internal", meipass, meipass.parent]:
            candidates.append(root / ".config.dat")

    # De-duplicate preserving order
    seen = set()
    deduped = []
    for p in candidates:
        key = str(p)
        if key not in seen:
            seen.add(key)
            deduped.append(p)
    return deduped


def load_config_auto() -> dict:
    """
    Try loading from obfuscated .config.dat first, then fall back to .env files.
    """
    # 1. Try obfuscated config
    for path in get_obfuscated_config_paths():
        if path.exists():
            try:
                config = load_obfuscated_config(str(path))
                if config:
                    return config
            except Exception:
                pass

    # 2. Fall back to plain .env (dev mode)
    return {}


# CLI usage for build scripts
if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage:")
        print("  python config_obfuscator.py encode <input.env> <output.config.dat>")
        print("  python config_obfuscator.py decode <input.config.dat>")
        sys.exit(1)

    cmd = sys.argv[1]

    if cmd == "encode":
        if len(sys.argv) < 4:
            print("Usage: python config_obfuscator.py encode <input.env> <output.config.dat>")
            sys.exit(1)
        encode_env_to_config(sys.argv[2], sys.argv[3])

    elif cmd == "decode":
        if len(sys.argv) < 3:
            print("Usage: python config_obfuscator.py decode <input.config.dat>")
            sys.exit(1)
        config = load_obfuscated_config(sys.argv[2])
        for k, v in config.items():
            print(f"{k}={v}")

    else:
        print(f"Unknown command: {cmd}")
        sys.exit(1)
