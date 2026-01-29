"""
capture_dataset.py - simple_raw_capture

A lightweight dataset capture tool for YOLO.
No automatic detection, no cropping - just saves raw webcam frames.
Press 1-5 to save labeled images to proper folders.
"""

import sys
import time
import argparse
from pathlib import Path
from datetime import datetime
import cv2
import numpy as np

# Add parent dir to path to use our existing utils
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.utils.paths import (
    get_class_image_dir, ensure_directories_exist,
    KEY_CLASS_MAP, get_class_names
)
from src.utils.visualization import draw_label_with_background

def main():
    parser = argparse.ArgumentParser(description="Simple Raw Capture Tool")
    parser.add_argument("--camera", type=int, default=0, help="Camera index")
    parser.add_argument("--width", type=int, default=640, help="Frame width")
    parser.add_argument("--height", type=int, default=480, help="Frame height")
    args = parser.parse_args()

    print(f"[*] Opening camera {args.camera} in RAW mode...")
    cap = cv2.VideoCapture(args.camera, cv2.CAP_DSHOW)
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)

    if not cap.isOpened():
        print("[-] Error: Could not open camera.")
        return

    # Initialize directories & counts
    ensure_directories_exist()
    class_counts = {}
    class_dirs = {}
    for name in get_class_names():
        directory = get_class_image_dir(name)
        # Ensure 'raw' folder path logic from utils/paths.py is respected
        # Note: utils/paths.py handles the structure dataset/images/raw/<class>
        directory.mkdir(parents=True, exist_ok=True)
        class_dirs[name] = directory
        
        # Count existing files
        count = len(list(directory.glob("*.jpg"))) + len(list(directory.glob("*.png")))
        class_counts[name] = count
        print(f"    {name}: {count} existing images")

    print("[*] Ready. Press 1-5 to capture. 'q' to quit.")
    print("[*] Press 'c' to toggle Continuous Mode.")

    flash_timer = 0
    saved_message = ""
    
    countdown_active = False
    countdown_start = 0
    countdown_class = None
    continuous_mode = False
    
    INITIAL_DURATION = 3
    RAPID_DURATION = 1
    current_duration = INITIAL_DURATION
    
    while True:
        ret, frame = cap.read()
        if not ret: break

        start_time = time.time()
        
        # Mirror view
        frame = cv2.flip(frame, 1)
        original_frame = frame.copy() # Keep clean copy for saving
        display = frame.copy()

        # Input handling
        key = cv2.waitKey(1) & 0xFF
        if key == ord('q'):
            break
        elif key == ord('c'):
            continuous_mode = not continuous_mode
            state = "ON" if continuous_mode else "OFF"
            print(f"[*] Continuous Mode: {state}")
        elif key == 32: # SPACE to stop current countdown/loop
            if countdown_active:
                countdown_active = False
                countdown_class = None
                print("[*] Countdown/Loop stopped.")
        
        # Start countdown
        if key in KEY_CLASS_MAP:
            if not countdown_active:
                countdown_class = KEY_CLASS_MAP[key]
                countdown_start = start_time
                countdown_active = True
                
                # First capture always full duration
                current_duration = INITIAL_DURATION
                
                print(f"[*] Starting countdown for {countdown_class}...")
            else:
                 pass

        # Countdown Logic
        current_countdown = None
        if countdown_active:
            elapsed = start_time - countdown_start
            remaining = current_duration - int(elapsed) # Use dynamic duration
            
            if remaining <= 0:
                # CAPTURE!
                class_name = countdown_class
                timestamp = datetime.now().strftime("%Y%m%d_%H%M%S_%f")
                filename = f"{class_name}_{timestamp}.jpg"
                filepath = class_dirs[class_name] / filename
                
                if cv2.imwrite(str(filepath), original_frame):
                    class_counts[class_name] += 1
                    flash_timer = start_time + 0.2
                    saved_message = f"Saved: {class_name} ({class_counts[class_name]})"
                    print(f"[+] {saved_message}")
                else:
                    print(f"[-] Failed to save to {filepath}")
                
                # Continuous Logic
                if continuous_mode:
                    countdown_start = start_time 
                    # SWITCH TO RAPID FIRE DURATION
                    current_duration = RAPID_DURATION
                else:
                    countdown_active = False
                    countdown_class = None
            else:
                current_countdown = remaining

        # --- HUD / Overlay ---
        h, w = display.shape[:2]
        
        # Header
        mode_str = "CONTINUOUS (RAPID)" if continuous_mode else "Single"
        color_mode = (0, 255, 0) if continuous_mode else (0, 255, 255)
        
        draw_label_with_background(display, f"Hand Signs Capture | Mode: Raw ({mode_str})", (10, 30), text_color=color_mode)
        draw_label_with_background(display, f"Timer: {current_duration}s | Space to stop", (10, 60), text_color=(200, 200, 200), font_scale=0.4)

        # Class list
        y = 100
        for k, name in sorted(KEY_CLASS_MAP.items()):
            count = class_counts[name]
            col = (0,255,0) if name == countdown_class else (255,255,255)
            pre = ">> " if name == countdown_class else ""
            text = f"{pre}[{chr(k)}] {name}: {count}"
            draw_label_with_background(display, text, (10, y), text_color=col, font_scale=0.5, padding=2)
            y += 25

        # Show Countdown
        if current_countdown is not None:
             cv2.putText(display, str(current_countdown), (w//2-20, h//2+20), 
                        cv2.FONT_HERSHEY_SIMPLEX, 5, (0, 255, 255), 8)

        # Flash effect
        if start_time < flash_timer:
            overlay = display.copy()
            cv2.rectangle(overlay, (0, 0), (w, h), (255, 255, 255), -1)
            cv2.addWeighted(overlay, 0.5, display, 0.5, 0, display)
            draw_label_with_background(display, "CAPTURED!", (w//2-50, h//2), text_color=(0, 255, 0), bg_color=(0,0,0), font_scale=1.0)



        cv2.imshow("Hand Signs Capture | Mode: Raw", display)

    cap.release()
    cv2.destroyAllWindows()

if __name__ == "__main__":
    main()
