"""
manual_labeler.py - The easiest way to label your Naruto dataset.

Usage:
    python src/manual_labeler.py

Controls:
    [Mouse] Click & Drag  -> Draw bounding box
    [Space]               -> Save label and Next Image
    [D] or [Delete]       -> Skip/Delete Image (Moves to trash)
    [R]                   -> Reset current box
    [Q]                   -> Quit

Workflow:
    Iterates through all images in dataset/images/raw/.
    Generates standard YOLO .txt labels alongside images.
"""

import sys
import shutil
import cv2
import glob
from pathlib import Path

# Add parent dir
sys.path.insert(0, str(Path(__file__).parent.parent))
from src.utils.paths import get_class_names, get_dataset_dir, get_raw_images_dir

# Global state for mouse callback
drawing = False
ix, iy = -1, -1
current_box = None # (x, y, w, h)

def draw_box(event, x, y, flags, param):
    global ix, iy, drawing, current_box

    if event == cv2.EVENT_LBUTTONDOWN:
        drawing = True
        ix, iy = x, y
        current_box = None

    elif event == cv2.EVENT_MOUSEMOVE:
        if drawing:
            current_box = (min(ix, x), min(iy, y), abs(x - ix), abs(y - iy))

    elif event == cv2.EVENT_LBUTTONUP:
        drawing = False
        current_box = (min(ix, x), min(iy, y), abs(x - ix), abs(y - iy))

def convert_to_yolo(box, img_w, img_h):
    # Box: x, y, w, h
    x, y, w, h = box
    xc = (x + w/2) / img_w
    yc = (y + h/2) / img_h
    wn = w / img_w
    hn = h / img_h
    return xc, yc, wn, hn

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Manual Labeler for Naruto Hand Signs")
    parser.add_argument("--preview", "--all", action="store_true", help="Review all images (including already labeled ones)")
    args = parser.parse_args()

    print("[*] Starting Manual Labeler...")
    
    raw_dir = get_raw_images_dir()
    classes = get_class_names()
    
    # Collect all images
    images = []
    for cls in classes:
        cls_dir = raw_dir / cls
        if cls_dir.exists():
            # Only label images that DON'T have a label yet?
            # Or allow editing? Let's check for .txt
            imgs = list(cls_dir.glob("*.jpg")) + list(cls_dir.glob("*.png"))
            for img in imgs:
                txt_path = img.with_suffix(".txt")
                if args.preview or not txt_path.exists():
                    images.append((img, cls))
    
    if not images:
        print("[*] No images found to label.")
        if not args.preview:
            print("[*] All images appear to be labeled! Use '--preview' to review and edit existing labels.")
        return

    print(f"[*] Found {len(images)} images to label.")
    
    window_name = "Manual Labeler"
    cv2.namedWindow(window_name)
    cv2.setMouseCallback(window_name, draw_box)
    
    trash_dir = raw_dir / "trash"
    trash_dir.mkdir(exist_ok=True)
    
    global current_box
    
    current_idx = 0
    while current_idx < len(images):
        img_path, class_name = images[current_idx]
        class_id = classes.index(class_name)
        
        img = cv2.imread(str(img_path))
        if img is None:
             current_idx += 1
             continue
        
        h, w = img.shape[:2]
        
        # Load existing label if any
        current_box = None
        txt_path = img_path.with_suffix(".txt")
        if txt_path.exists():
             with open(txt_path, 'r') as f:
                 line = f.readline().strip()
                 if line:
                     parts = list(map(float, line.split()))
                     if len(parts) == 5:
                         # De-normalize
                         _, xc, yc, wn, hn = parts
                         bw = int(wn * w)
                         bh = int(hn * h)
                         bx = int((xc * w) - (bw/2))
                         by = int((yc * h) - (bh/2))
                         current_box = (bx, by, bw, bh)

        while True:
            display = img.copy()
            
            # Draw Instructions
            msg = f"{current_idx+1}/{len(images)} | {class_name} | Drag Box | Space=Save | <- Prev | -> Skip | X=Trash"
            cv2.rectangle(display, (0,0), (w, 30), (0,0,0), -1)
            cv2.putText(display, msg, (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255,255,255), 1)
            
            # Draw Box
            if current_box:
                bx, by, bw, bh = current_box
                cv2.rectangle(display, (bx, by), (bx+bw, by+bh), (0, 255, 0), 2)
            
            cv2.imshow(window_name, display)
            key = cv2.waitKey(20) & 0xFF
            
            # Controls
            if key == ord('q'):
                print("Quitting...")
                return
                
            elif key == ord('r'): # Reset
                current_box = None
                
            elif key == ord('x'): # Trash (was d)
                print(f"[-] Trashed {img_path.name}")
                shutil.move(str(img_path), str(trash_dir / img_path.name))
                # Remove from list (or just skip)
                del images[current_idx]
                # Stay at current_idx (which is now the next image)
                break 

            elif key == 81 or key == 2: # Left Arrow (Key codes vary, usually 81/82/83/84 on win/gtk)
                # Wait, standard arrow keys in cv2 are platform dependent.
                # Usually: 2424832 (Left), 2555904 (Right) on Windows?
                # Or extension keys. Simplest is 'a' / 'd' as well.
                pass
            
            # Using 'a' and 'd' for navigation is safer than arrow keys in cv2 default
            # But let's support Arrows (81=Left, 83=Right on Windows)
            if key == ord('a') or key == 81: # PREVIOUS
                if current_idx > 0:
                    current_idx -= 1
                    break
            
            elif key == ord('d') or key == 83: # NEXT (Skip)
                current_idx += 1
                break

            elif key == 32: # SPACE (Save & Next)
                if current_box and current_box[2] > 0 and current_box[3] > 0:
                    # Save Label
                    xc, yc, wn, hn = convert_to_yolo(current_box, w, h)
                    line = f"{class_id} {xc:.6f} {yc:.6f} {wn:.6f} {hn:.6f}\n"
                    
                    with open(txt_path, "w") as f:
                        f.write(line)
                    print(f"[+] Saved {img_path.name}")
                    current_idx += 1
                    break
                else:
                    # If empty, maybe delete label?
                    if txt_path.exists():
                         # Ask or just ignore? User pressed space without box -> maybe means "No object"?
                         # Let's verify.
                         print("[!] No box! Draw one or press 'd' to skip.")
                    else:
                         print("[!] No box! Draw one or press 'd' to skip.")

    cv2.destroyAllWindows()
    print("[*] Labeling complete!")
    print("[*] Run 'process_dataset.py' to update training data.")

if __name__ == "__main__":
    main()
