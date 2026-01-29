"""
visualization.py - Helper functions for drawing text and boxes on frames.

This module provides utilities for visualizing detections on video frames,
including labeled boxes with background rectangles for better readability.
"""

import cv2
import numpy as np
from typing import Tuple, Optional


# Default color scheme (BGR format for OpenCV)
DEFAULT_BOX_COLOR = (0, 255, 0)       # Green
DEFAULT_TEXT_COLOR = (255, 255, 255)  # White
DEFAULT_BG_COLOR = (0, 0, 0)          # Black


def draw_label_with_background(
    frame: np.ndarray,
    text: str,
    position: Tuple[int, int],
    font_scale: float = 0.7,
    font_thickness: int = 2,
    text_color: Tuple[int, int, int] = DEFAULT_TEXT_COLOR,
    bg_color: Tuple[int, int, int] = DEFAULT_BG_COLOR,
    padding: int = 5,
    alpha: float = 0.7
) -> np.ndarray:
    """
    Draw text with a semi-transparent background rectangle.
    
    Args:
        frame: The image/frame to draw on (will be modified in-place).
        text: The text to display.
        position: (x, y) position for the text (top-left of text).
        font_scale: Font size scale.
        font_thickness: Thickness of the font.
        text_color: BGR color tuple for text.
        bg_color: BGR color tuple for background.
        padding: Padding around text in pixels.
        alpha: Transparency of background (0=transparent, 1=opaque).
        
    Returns:
        The modified frame.
    """
    font = cv2.FONT_HERSHEY_SIMPLEX
    x, y = position
    
    # Get text size
    (text_width, text_height), baseline = cv2.getTextSize(
        text, font, font_scale, font_thickness
    )
    
    # Calculate background rectangle coordinates
    bg_x1 = x - padding
    bg_y1 = y - text_height - padding
    bg_x2 = x + text_width + padding
    bg_y2 = y + baseline + padding
    
    # Ensure coordinates are within frame bounds
    bg_x1 = max(0, bg_x1)
    bg_y1 = max(0, bg_y1)
    bg_x2 = min(frame.shape[1], bg_x2)
    bg_y2 = min(frame.shape[0], bg_y2)
    
    # Draw semi-transparent background
    if alpha < 1.0:
        overlay = frame.copy()
        cv2.rectangle(overlay, (bg_x1, bg_y1), (bg_x2, bg_y2), bg_color, -1)
        cv2.addWeighted(overlay, alpha, frame, 1 - alpha, 0, frame)
    else:
        cv2.rectangle(frame, (bg_x1, bg_y1), (bg_x2, bg_y2), bg_color, -1)
    
    # Draw text
    cv2.putText(frame, text, (x, y), font, font_scale, text_color, font_thickness)
    
    return frame


def draw_detection_box(
    frame: np.ndarray,
    box: Tuple[int, int, int, int],
    label: str,
    confidence: float,
    box_color: Tuple[int, int, int] = DEFAULT_BOX_COLOR,
    text_color: Tuple[int, int, int] = DEFAULT_TEXT_COLOR,
    thickness: int = 2,
    font_scale: float = 0.6
) -> np.ndarray:
    """
    Draw a detection bounding box with label and confidence.
    
    Args:
        frame: The image/frame to draw on.
        box: (x1, y1, x2, y2) bounding box coordinates.
        label: Class label to display.
        confidence: Confidence score (0-1).
        box_color: BGR color for the box.
        text_color: BGR color for the text.
        thickness: Line thickness for the box.
        font_scale: Font size scale.
        
    Returns:
        The modified frame.
    """
    x1, y1, x2, y2 = map(int, box)
    
    # Draw bounding box
    cv2.rectangle(frame, (x1, y1), (x2, y2), box_color, thickness)
    
    # Prepare label text with confidence
    label_text = f"{label}: {confidence:.2f}"
    
    # Draw label above the box
    label_y = y1 - 10 if y1 > 30 else y2 + 20
    draw_label_with_background(
        frame,
        label_text,
        (x1, label_y),
        font_scale=font_scale,
        text_color=text_color,
        bg_color=box_color,
        padding=3
    )
    
    return frame


def draw_fps(
    frame: np.ndarray,
    fps: float,
    position: Tuple[int, int] = (10, 30)
) -> np.ndarray:
    """
    Draw FPS counter on frame.
    
    Args:
        frame: The image/frame to draw on.
        fps: Frames per second value.
        position: (x, y) position for the FPS text.
        
    Returns:
        The modified frame.
    """
    return draw_label_with_background(
        frame,
        f"FPS: {fps:.1f}",
        position,
        font_scale=0.7,
        text_color=(0, 255, 0),
        bg_color=(0, 0, 0),
        padding=5
    )


def draw_capture_overlay(
    frame: np.ndarray,
    key_class_map: dict,
    class_counts: dict,
    current_class: Optional[str] = None
) -> np.ndarray:
    """
    Draw helpful overlay for dataset capture mode.
    Shows key mappings and capture counts.
    
    Args:
        frame: The image/frame to draw on.
        key_class_map: Dictionary mapping key codes to class names.
        class_counts: Dictionary mapping class names to capture counts.
        current_class: Currently selected class (if any).
        
    Returns:
        The modified frame.
    """
    y_offset = 30
    line_height = 30
    
    # Draw title
    draw_label_with_background(
        frame,
        "Dataset Capture Mode",
        (10, y_offset),
        font_scale=0.8,
        text_color=(0, 255, 255),
        bg_color=(50, 50, 50),
        padding=5
    )
    y_offset += line_height + 10
    
    # Draw instructions
    draw_label_with_background(
        frame,
        "Press key to capture | 'q' to quit",
        (10, y_offset),
        font_scale=0.5,
        text_color=(200, 200, 200),
        bg_color=(30, 30, 30),
        padding=3
    )
    y_offset += line_height
    
    # Draw key mappings and counts
    for key_code, class_name in sorted(key_class_map.items()):
        key_char = chr(key_code)
        count = class_counts.get(class_name, 0)
        
        # Highlight current class
        if class_name == current_class:
            text_color = (0, 255, 0)
            prefix = ">> "
        else:
            text_color = (255, 255, 255)
            prefix = "   "
        
        text = f"{prefix}[{key_char}] {class_name}: {count} images"
        draw_label_with_background(
            frame,
            text,
            (10, y_offset),
            font_scale=0.5,
            text_color=text_color,
            bg_color=(30, 30, 30),
            padding=3
        )
        y_offset += line_height - 5
    
    return frame


def draw_detection_overlay(
    frame: np.ndarray,
    detections: list,
    class_names: list,
    show_fps: bool = True,
    fps: float = 0.0
) -> np.ndarray:
    """
    Draw all detections on a frame with optional FPS display.
    
    Args:
        frame: The image/frame to draw on.
        detections: List of detections, each with box, confidence, class_id.
        class_names: List of class names (indexed by class_id).
        show_fps: Whether to show FPS counter.
        fps: Current FPS value.
        
    Returns:
        The modified frame.
    """
    # Color palette for different classes
    colors = [
        (255, 100, 100),  # Light blue
        (100, 255, 100),  # Light green
        (100, 100, 255),  # Light red
        (255, 255, 100),  # Cyan
        (255, 100, 255),  # Magenta
    ]
    
    for det in detections:
        box = det['box']
        confidence = det['confidence']
        class_id = det['class_id']
        
        class_name = class_names[class_id] if class_id < len(class_names) else f"class_{class_id}"
        color = colors[class_id % len(colors)]
        
        draw_detection_box(frame, box, class_name, confidence, box_color=color)
    
    if show_fps and fps > 0:
        draw_fps(frame, fps)
    
    return frame


def create_class_color_map(class_names: list) -> dict:
    """
    Create a consistent color mapping for class names.
    
    Args:
        class_names: List of class names.
        
    Returns:
        Dictionary mapping class names to BGR colors.
    """
    # Predefined vibrant colors for hand signs
    palette = [
        (0, 165, 255),    # Orange - Tiger
        (0, 128, 0),      # Dark Green - Boar
        (128, 0, 128),    # Purple - Snake
        (255, 0, 0),      # Blue - Ram
        (0, 255, 255),    # Yellow - Bird
    ]
    
    return {
        name: palette[i % len(palette)]
        for i, name in enumerate(class_names)
    }
