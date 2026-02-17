"""
manual_labeler.py - The easiest way to label your Naruto dataset.

Usage:
    python src/manual_labeler.py

Controls:
    [Mouse] Click & Drag  -> Draw bounding box
    [Space] / [Enter]     -> Save label and Next Image
    [D] / [Right Arrow]   -> Skip to Next Image
    [A] / [Left Arrow]    -> Go to Previous Image
    [X] / [Delete]        -> Move image (and existing label) to trash
    [R]                   -> Reset current box
    [Q]                   -> Quit

Workflow:
    Iterates through all images in dataset/images/raw/.
    Generates standard YOLO .txt labels alongside images.
"""

import sys
import shutil
import cv2
from pathlib import Path

# Add parent dir
sys.path.insert(0, str(Path(__file__).parent.parent))
from src.utils.paths import get_class_names, get_raw_images_dir

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


def key_is_left(key_code: int) -> bool:
    return key_code in (ord("a"), ord("A"), 81, 2424832, 65361)


def key_is_right(key_code: int) -> bool:
    return key_code in (ord("d"), ord("D"), 83, 2555904, 65363)


def key_is_delete(key_code: int) -> bool:
    return key_code in (ord("x"), ord("X"), 3014656, 65535, 127, 8)


def move_sample_to_trash(img_path: Path, txt_path: Path, trash_dir: Path, class_name: str) -> Path:
    class_trash_dir = trash_dir / class_name
    class_trash_dir.mkdir(parents=True, exist_ok=True)

    target_img = class_trash_dir / img_path.name
    stem = img_path.stem
    suffix = img_path.suffix
    attempt = 1
    while target_img.exists() or (txt_path.exists() and (class_trash_dir / f"{target_img.stem}.txt").exists()):
        target_img = class_trash_dir / f"{stem}_{attempt}{suffix}"
        attempt += 1

    shutil.move(str(img_path), str(target_img))
    if txt_path.exists():
        target_txt = class_trash_dir / f"{target_img.stem}.txt"
        shutil.move(str(txt_path), str(target_txt))

    return target_img

def main():
    import argparse
    
    parser = argparse.ArgumentParser(description="Manual Labeler for Naruto Hand Signs")
    parser.add_argument("--preview", "--all", action="store_true", help="Review all images (including already labeled ones)")
    parser.add_argument(
        "--min-box",
        type=int,
        default=10,
        help="Minimum box width/height in pixels to accept save (default: 10)",
    )
    args = parser.parse_args()
    if args.min_box < 1:
        print("[-] --min-box must be >= 1")
        return

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
    images.sort(key=lambda item: str(item[0]).lower())
    
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
            msg = (
                f"{current_idx+1}/{len(images)} | {class_name} | "
                "Drag Box | Space/Enter=Save | A/Left=Prev | D/Right=Skip | X/Delete=Trash"
            )
            cv2.rectangle(display, (0,0), (w, 30), (0,0,0), -1)
            cv2.putText(display, msg, (10, 20), cv2.FONT_HERSHEY_SIMPLEX, 0.4, (255,255,255), 1)
            
            # Draw Box
            if current_box:
                bx, by, bw, bh = current_box
                cv2.rectangle(display, (bx, by), (bx+bw, by+bh), (0, 255, 0), 2)
            
            cv2.imshow(window_name, display)
            key = cv2.waitKeyEx(20)
            
            # Controls
            if key in (ord('q'), ord('Q')):
                print("Quitting...")
                cv2.destroyAllWindows()
                return
                
            elif key in (ord('r'), ord('R')): # Reset
                current_box = None
                
            elif key_is_delete(key):
                trashed_to = move_sample_to_trash(img_path, txt_path, trash_dir, class_name)
                print(f"[-] Trashed {img_path.name} -> {trashed_to}")
                # Remove from list (or just skip)
                del images[current_idx]
                # Stay at current_idx (which is now the next image)
                break 

            if key_is_left(key): # PREVIOUS
                if current_idx > 0:
                    current_idx -= 1
                    break
            
            elif key_is_right(key): # NEXT (Skip)
                current_idx += 1
                break

            elif key in (32, 13): # SPACE/ENTER (Save & Next)
                if current_box and current_box[2] >= args.min_box and current_box[3] >= args.min_box:
                    # Save Label
                    xc, yc, wn, hn = convert_to_yolo(current_box, w, h)
                    line = f"{class_id} {xc:.6f} {yc:.6f} {wn:.6f} {hn:.6f}\n"
                    
                    with open(txt_path, "w") as f:
                        f.write(line)
                    print(f"[+] Saved {img_path.name}")
                    current_idx += 1
                    break
                else:
                    print(
                        f"[!] No valid box! Draw one (>= {args.min_box}px) "
                        "or press D/Right to skip."
                    )

    cv2.destroyAllWindows()
    print("[*] Labeling complete!")
    print("[*] Run 'process_dataset.py' to update training data.")

if __name__ == "__main__":
    main()
