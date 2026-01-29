"""
process_dataset.py - Auto-label and split dataset for YOLO training.

Reads raw images from dataset/images/raw/, detects hands using skin-tone logic,
generates YOLO labels, and splits data into train/val sets.

Updates:
- Checks for existing manual labels (.txt) in raw/ folder first.
- Falls back to auto-detection if no label found.
"""

import sys
import shutil
import random
from pathlib import Path
import cv2
import numpy as np
from tqdm import tqdm

# Add parent dir to path
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.utils.paths import get_class_names, get_dataset_dir

# Initialize DATASET_DIR
DATASET_DIR = get_dataset_dir()

# Config
TRAIN_SPLIT = 0.8
MIN_CONTOUR_AREA = 3000

# Color ranges for skin detection (HSV)
LOWER_SKIN = np.array([0, 30, 80], dtype=np.uint8)
UPPER_SKIN = np.array([20, 170, 255], dtype=np.uint8)

def get_yolo_bbox(img_shape, bbox):
    """Convert (x, y, w, h) to YOLO (xc, yc, w, h) normalized."""
    h_img, w_img = img_shape[:2]
    x, y, w, h = bbox
    
    xc = (x + w / 2) / w_img
    yc = (y + h / 2) / h_img
    wn = w / w_img
    hn = h / h_img
    
    return xc, yc, wn, hn

def detect_hand_bbox(frame):
    """Detect hand using skin segmentation and return bbox (x,y,w,h) or None."""
    h, w = frame.shape[:2]
    
    # ROI: Exclude top 1/3 (face usually) and sides
    roi_top = int(h * 0.3)
    roi_frame = frame[roi_top:h, :] 
    
    hsv = cv2.cvtColor(roi_frame, cv2.COLOR_BGR2HSV)
    mask = cv2.inRange(hsv, LOWER_SKIN, UPPER_SKIN)
    
    # Architecture: Open/Close to remove noise
    kernel = cv2.getStructuringElement(cv2.MORPH_ELLIPSE, (5, 5))
    mask = cv2.morphologyEx(mask, cv2.MORPH_OPEN, kernel)
    mask = cv2.morphologyEx(mask, cv2.MORPH_CLOSE, kernel)
    
    contours, _ = cv2.findContours(mask, cv2.RETR_EXTERNAL, cv2.CHAIN_APPROX_SIMPLE)
    
    if not contours:
        return None
        
    # Find largest contour that looks somewhat like a hand
    best_cnt = None
    max_area = 0
    
    for cnt in contours:
        area = cv2.contourArea(cnt)
        if area > MIN_CONTOUR_AREA:
            # Optional: Circularity check (hands are not perfect circles)
            if area > max_area:
                max_area = area
                best_cnt = cnt
                
    if best_cnt is not None:
        x, y, bw, bh = cv2.boundingRect(best_cnt)
        # Adjust y back to full frame coordinates
        return (x, y + roi_top, bw, bh)
        
    return None

def main():
    print("[*] Starting Dataset Processing...")
    
    # Verify Raw Data
    raw_dir = DATASET_DIR / "images" / "raw"
    if not raw_dir.exists():
        print("[-] No raw data found!")
        return

    # Setup Destination Dirs
    for split in ["train", "val"]:
        for dtype in ["images", "labels"]:
            d = DATASET_DIR / dtype / split
            # Clear existing data to remove deleted/trashed files
            if d.exists():
                shutil.rmtree(d)
            d.mkdir(parents=True, exist_ok=True)
            
    # Map class name to ID
    class_names = get_class_names()
    class_map = {name: i for i, name in enumerate(class_names)}
    
    total_imgs = 0
    labeled_imgs = 0
    manual_count = 0
    auto_count = 0
    
    for class_name_path in raw_dir.glob("*"):
        if not class_name_path.is_dir(): continue
        if class_name_path.name == "trash": continue
        
        class_name = class_name_path.name
        if class_name not in class_map:
            print(f"[!] Ignoring unknown folder: {class_name}")
            continue
            
        class_id = class_map[class_name]
        images = list(class_name_path.glob("*.jpg")) + list(class_name_path.glob("*.png"))
        
        print(f"[*] Processing {class_name}: {len(images)} images...")
        
        for img_path in tqdm(images):
            total_imgs += 1
            
            # Check for MANUAL label first
            raw_label_path = img_path.with_suffix(".txt")
            label_content = None
            is_manual = False
            
            if raw_label_path.exists():
                with open(raw_label_path, "r") as f:
                    label_content = f.read()
                is_manual = True
                manual_count += 1
            else:
                # AUTO label
                frame = cv2.imread(str(img_path))
                if frame is None: continue
                
                bbox = detect_hand_bbox(frame)
                if bbox:
                    xc, yc, wn, hn = get_yolo_bbox(frame.shape, bbox)
                    label_content = f"{class_id} {xc:.6f} {yc:.6f} {wn:.6f} {hn:.6f}\n"
                    auto_count += 1
            
            if label_content:
                # Prepare Data
                split = "train" if random.random() < TRAIN_SPLIT else "val"
                
                # Copy Image
                dest_img_path = DATASET_DIR / "images" / split / img_path.name
                shutil.copy2(img_path, dest_img_path)
                
                # Write Label
                label_path = DATASET_DIR / "labels" / split / (img_path.stem + ".txt")
                with open(label_path, "w") as f:
                    f.write(label_content)
                    
                labeled_imgs += 1
                
    print("-" * 40)
    print(f"[=] Completed. Total Raw: {total_imgs}")
    print(f"[+] Labeled: {labeled_imgs}")
    print(f"    - Manual: {manual_count}")
    print(f"    - Auto:   {auto_count}")
    print("[*] Ready for training.")

if __name__ == "__main__":
    main()
