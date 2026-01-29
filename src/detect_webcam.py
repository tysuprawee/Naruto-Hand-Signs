"""
detect_webcam.py - Real-time detection script for Naruto hand signs.

This script runs real-time hand sign detection using a trained YOLO model.
It opens the webcam, runs inference on each frame, and displays the results
with bounding boxes, class names, and confidence scores.

Usage:
    python detect_webcam.py --weights models/runs/<run_name>/weights/best.pt
    python detect_webcam.py --weights path/to/best.pt --camera 1

Arguments:
    --weights: Path to trained YOLO weights file (required)
    --camera: Camera index (default: 0)
    --conf: Confidence threshold (default: 0.5)
    --show-fps: Show FPS counter (default: True)
"""

import sys
import time
import argparse
from pathlib import Path
from typing import Optional

import cv2
from ultralytics import YOLO

# Add the parent directory to path to import from utils
sys.path.insert(0, str(Path(__file__).parent.parent))

from src.utils.paths import get_latest_weights, get_class_names
from src.utils.visualization import (
    draw_detection_box,
    draw_fps,
    draw_label_with_background,
    create_class_color_map,
)


def send_prediction_to_pi(predicted_class: str, confidence: float = 0.0) -> None:
    """
    Stub function for sending predictions to a Raspberry Pi.
    
    This function is a placeholder for future integration. You can implement
    communication via:
    - Serial (pyserial): For direct USB/UART connection
    - Socket: For network-based communication
    - MQTT: For IoT-style messaging
    - HTTP: For REST API calls
    
    Args:
        predicted_class: The predicted hand sign class name.
        confidence: Confidence score of the prediction (0-1).
    
    Example implementation with sockets:
        import socket
        PI_HOST = "192.168.1.100"  # Raspberry Pi IP
        PI_PORT = 5000
        
        with socket.socket(socket.AF_INET, socket.SOCK_STREAM) as s:
            s.connect((PI_HOST, PI_PORT))
            message = f"{predicted_class},{confidence:.3f}"
            s.sendall(message.encode())
    
    Example implementation with serial:
        import serial
        ser = serial.Serial('/dev/ttyUSB0', 9600)
        ser.write(f"{predicted_class}\n".encode())
    """
    # TODO: Implement your Raspberry Pi communication here
    # For now, this just prints to console
    pass  # Uncomment the line below to see predictions in console
    # print(f"[Pi] Would send: {predicted_class} ({confidence:.2f})")


def get_highest_confidence_detection(detections: list) -> Optional[dict]:
    """
    Get the detection with the highest confidence.
    
    Args:
        detections: List of detection dictionaries.
        
    Returns:
        The detection with highest confidence, or None if empty.
    """
    if not detections:
        return None
    return max(detections, key=lambda x: x['confidence'])


def parse_yolo_results(results, class_names: list) -> list:
    """
    Parse YOLO results into a list of detection dictionaries.
    
    Args:
        results: YOLO inference results.
        class_names: List of class names.
        
    Returns:
        List of detection dictionaries with 'box', 'confidence', 'class_id', 'class_name'.
    """
    detections = []
    
    for result in results:
        if result.boxes is None:
            continue
            
        boxes = result.boxes
        for i in range(len(boxes)):
            # Get bounding box coordinates (xyxy format)
            box = boxes.xyxy[i].cpu().numpy()
            x1, y1, x2, y2 = map(int, box)
            
            # Get confidence and class
            conf = float(boxes.conf[i].cpu().numpy())
            class_id = int(boxes.cls[i].cpu().numpy())
            class_name = class_names[class_id] if class_id < len(class_names) else f"class_{class_id}"
            
            detections.append({
                'box': (x1, y1, x2, y2),
                'confidence': conf,
                'class_id': class_id,
                'class_name': class_name,
            })
    
    return detections


def main():
    """Main function for real-time detection."""
    
    # =========================================================================
    # STEP 1: Parse command-line arguments
    # =========================================================================
    parser = argparse.ArgumentParser(
        description="Real-time Naruto hand sign detection with YOLO"
    )
    parser.add_argument(
        "--weights", "-w",
        type=str,
        required=False,
        help="Path to trained YOLO weights file"
    )
    parser.add_argument(
        "--camera", "-c",
        type=int,
        default=0,
        help="Camera index (default: 0)"
    )
    parser.add_argument(
        "--conf", "--confidence",
        type=float,
        default=0.5,
        help="Confidence threshold (default: 0.5)"
    )
    parser.add_argument(
        "--iou",
        type=float,
        default=0.45,
        help="IoU threshold for NMS (default: 0.45)"
    )
    parser.add_argument(
        "--show-fps",
        action="store_true",
        default=True,
        help="Show FPS counter (default: True)"
    )
    parser.add_argument(
        "--no-fps",
        action="store_true",
        help="Hide FPS counter"
    )
    parser.add_argument(
        "--width",
        type=int,
        default=640,
        help="Frame width (default: 640)"
    )
    parser.add_argument(
        "--height",
        type=int,
        default=480,
        help="Frame height (default: 480)"
    )
    parser.add_argument(
        "--send-to-pi",
        action="store_true",
        help="Enable sending predictions to Raspberry Pi"
    )
    args = parser.parse_args()
    
    show_fps = args.show_fps and not args.no_fps
    
    # =========================================================================
    # STEP 2: Load YOLO model
    # =========================================================================
    print("=" * 60)
    print("Naruto Hand Signs - Real-time Detection")
    print("=" * 60)
    
    # Find weights file
    weights_path = args.weights
    if not weights_path:
        print("[*] No weights specified, searching for latest trained model...")
        weights_path = get_latest_weights()
        if weights_path:
            print(f"[+] Found: {weights_path}")
        else:
            print("[-] No trained weights found!")
            print("[*] Please train a model first with train.py")
            print("[*] Or specify weights with --weights <path>")
            return 1
    
    weights_path = Path(weights_path)
    if not weights_path.exists():
        print(f"[-] Weights file not found: {weights_path}")
        return 1
    
    print(f"\n[*] Loading model: {weights_path}")
    
    try:
        model = YOLO(str(weights_path))
    except Exception as e:
        print(f"[-] Error loading model: {e}")
        return 1
    
    # Get class names from model
    class_names = get_class_names()
    color_map = create_class_color_map(class_names)
    
    print(f"[*] Classes: {class_names}")
    print(f"[*] Confidence threshold: {args.conf}")
    
    # =========================================================================
    # STEP 3: Initialize webcam
    # =========================================================================
    print(f"\n[*] Opening camera {args.camera}...")
    # Use DirectShow backend on Windows for better compatibility
    cap = cv2.VideoCapture(args.camera, cv2.CAP_DSHOW)
    
    if not cap.isOpened():
        print(f"[-] Error: Could not open camera {args.camera}")
        print("[*] Try a different camera index with --camera <index>")
        return 1
    
    # Set resolution
    cap.set(cv2.CAP_PROP_FRAME_WIDTH, args.width)
    cap.set(cv2.CAP_PROP_FRAME_HEIGHT, args.height)
    
    # Get actual resolution
    actual_width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
    actual_height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
    print(f"[*] Camera resolution: {actual_width}x{actual_height}")
    
    # =========================================================================
    # STEP 4: Detection loop
    # =========================================================================
    print("\n" + "=" * 60)
    print("Press 'q' to quit")
    print("=" * 60 + "\n")
    
    # FPS calculation variables
    fps = 0.0
    frame_count = 0
    start_time = time.time()
    fps_update_interval = 0.5  # Update FPS every 0.5 seconds
    
    # Track last prediction for Pi communication
    last_prediction = None
    last_prediction_time = 0
    prediction_cooldown = 0.5  # Send to Pi at most every 0.5 seconds
    
    try:
        while True:
            # Read frame
            ret, frame = cap.read()
            if not ret:
                print("[-] Error: Failed to read frame")
                break
            
            # Run YOLO inference
            results = model.predict(
                frame,
                conf=args.conf,
                iou=args.iou,
                verbose=False
            )
            
            # Parse results
            detections = parse_yolo_results(results, class_names)
            
            # Draw detections
            for det in detections:
                box = det['box']
                confidence = det['confidence']
                class_name = det['class_name']
                color = color_map.get(class_name, (0, 255, 0))
                
                draw_detection_box(
                    frame,
                    box,
                    class_name,
                    confidence,
                    box_color=color
                )
            
            # Calculate and display FPS
            frame_count += 1
            elapsed = time.time() - start_time
            
            if elapsed >= fps_update_interval:
                fps = frame_count / elapsed
                frame_count = 0
                start_time = time.time()
            
            if show_fps:
                draw_fps(frame, fps)
            
            # Display detection count
            det_text = f"Detections: {len(detections)}"
            draw_label_with_background(
                frame,
                det_text,
                (frame.shape[1] - 150, 30),
                font_scale=0.6,
                text_color=(255, 255, 255),
                bg_color=(50, 50, 50)
            )
            
            # Handle Raspberry Pi communication
            if args.send_to_pi:
                current_time = time.time()
                if current_time - last_prediction_time >= prediction_cooldown:
                    top_detection = get_highest_confidence_detection(detections)
                    if top_detection:
                        prediction = top_detection['class_name']
                        if prediction != last_prediction:
                            send_prediction_to_pi(prediction, top_detection['confidence'])
                            last_prediction = prediction
                            last_prediction_time = current_time
            
            # Show frame
            cv2.imshow("Naruto Hand Signs Detection - Press 'q' to quit", frame)
            
            # Check for quit
            key = cv2.waitKey(1) & 0xFF
            if key == ord('q') or key == ord('Q'):
                print("\n[*] Quitting...")
                break
    
    except KeyboardInterrupt:
        print("\n[*] Interrupted by user")
    
    finally:
        # =====================================================================
        # STEP 5: Cleanup
        # =====================================================================
        cap.release()
        cv2.destroyAllWindows()
    
    print("[*] Detection session ended")
    return 0


if __name__ == "__main__":
    sys.exit(main())
