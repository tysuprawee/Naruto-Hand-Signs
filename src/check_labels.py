"""
check_labels.py - Verify the quality of auto-generated YOLO labels.

Draws bounding boxes from 'dataset/labels' onto 'dataset/images'
and saves them to 'dataset/debug_labels' for inspection.
"""

import sys
import shutil
import random
from pathlib import Path
import cv2
import numpy as np

# Add parent dir
sys.path.insert(0, str(Path(__file__).parent.parent))
from src.utils.paths import get_class_names, get_dataset_dir
DATASET_DIR = get_dataset_dir()

def draw_yolo_box(img, label_lines, class_names):
    h, w = img.shape[:2]
    colors = [(0, 255, 0), (0, 0, 255), (255, 0, 0)]
    
    for line in label_lines:
        parts = line.strip().split()
        if len(parts) != 5: continue
        
        cls_id = int(parts[0])
        xc = float(parts[1])
        yc = float(parts[2])
        wn = float(parts[3])
        hn = float(parts[4])
        
        # Denormalize
        bw = int(wn * w)
        bh = int(hn * h)
        x = int((xc * w) - (bw / 2))
        y = int((yc * h) - (bh / 2))
        
        # Draw
        color = colors[cls_id % len(colors)]
        cv2.rectangle(img, (x, y), (x+bw, y+bh), color, 2)
        
        name = class_names[cls_id] if cls_id < len(class_names) else str(cls_id)
        cv2.putText(img, name, (x, y-5), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        
    return img

def main():
    print("[*] Checking labels...")
    debug_dir = DATASET_DIR / "debug_labels"
    if debug_dir.exists():
        shutil.rmtree(debug_dir)
    debug_dir.mkdir(parents=True)
    
    # Check 'train' folder
    img_dir = DATASET_DIR / "images" / "train"
    lbl_dir = DATASET_DIR / "labels" / "train"
    
    images = list(img_dir.glob("*.jpg"))
    if not images:
        print("[-] No images found.")
        return
        
    # Sample 10 images
    sample = random.sample(images, min(len(images), 20))
    class_names = get_class_names()
    
    for img_path in sample:
        # Find corresponding label
        lbl_path = lbl_dir / (img_path.stem + ".txt")
        if not lbl_path.exists():
            print(f"[!] No label for {img_path.name}")
            continue
            
        with open(lbl_path, "r") as f:
            lines = f.readlines()
            
        img = cv2.imread(str(img_path))
        img = draw_yolo_box(img, lines, class_names)
        
        out_path = debug_dir / img_path.name
        cv2.imwrite(str(out_path), img)
        print(f"[+] Saved {out_path}")
        
    print(f"\n[*] Check {debug_dir} to verify if the boxes are correct!")
    # Open explorer
    import os
    os.startfile(str(debug_dir))

if __name__ == "__main__":
    main()
