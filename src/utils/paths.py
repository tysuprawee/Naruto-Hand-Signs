"""
paths.py - Centralized path handling for the Naruto hand signs YOLO project.

This module provides consistent access to all project directories,
eliminating the need to hardcode paths in multiple files.
"""

from pathlib import Path
from typing import Optional


def get_project_root() -> Path:
    """
    Get the project root directory.
    
    Returns:
        Path to the project root (naruto_handsigns_yolo directory).
    """
    # Navigate up from this file: utils/ -> src/ -> project_root/
    return Path(__file__).resolve().parent.parent.parent


def get_src_dir() -> Path:
    """Get the src directory path."""
    return get_project_root() / "src"


def get_dataset_dir() -> Path:
    """Get the dataset directory path."""
    return get_project_root() / "dataset"


def get_images_dir() -> Path:
    """Get the images directory path."""
    return get_dataset_dir() / "images"


def get_raw_images_dir() -> Path:
    """Get the raw images directory (for initial webcam captures)."""
    return get_images_dir() / "raw"


def get_train_images_dir() -> Path:
    """Get the training images directory."""
    return get_images_dir() / "train"


def get_val_images_dir() -> Path:
    """Get the validation images directory."""
    return get_images_dir() / "val"


def get_labels_dir() -> Path:
    """Get the labels directory path."""
    return get_dataset_dir() / "labels"


def get_train_labels_dir() -> Path:
    """Get the training labels directory."""
    return get_labels_dir() / "train"


def get_val_labels_dir() -> Path:
    """Get the validation labels directory."""
    return get_labels_dir() / "val"


def get_yolo_config_dir() -> Path:
    """Get the YOLO config directory path."""
    return get_project_root() / "yolo_config"


def get_data_yaml_path() -> Path:
    """Get the path to data.yaml configuration file."""
    return get_yolo_config_dir() / "data.yaml"


def get_models_dir() -> Path:
    """Get the models directory path."""
    return get_project_root() / "models"


def get_runs_dir() -> Path:
    """Get the training runs directory path."""
    return get_models_dir() / "runs"


def get_class_image_dir(class_name: str) -> Path:
    """
    Get the directory for a specific class's raw images.
    
    Args:
        class_name: Name of the class (e.g., 'tiger', 'boar').
        
    Returns:
        Path to the class's image directory.
    """
    return get_raw_images_dir() / class_name


def ensure_directories_exist() -> None:
    """
    Create all necessary project directories if they don't exist.
    Call this at project initialization.
    """
    directories = [
        get_raw_images_dir(),
        get_train_images_dir(),
        get_val_images_dir(),
        get_train_labels_dir(),
        get_val_labels_dir(),
        get_yolo_config_dir(),
        get_runs_dir(),
    ]
    
    for directory in directories:
        directory.mkdir(parents=True, exist_ok=True)


def get_latest_weights(run_name: Optional[str] = None) -> Optional[Path]:
    """
    Find the latest best.pt weights file from training runs.
    
    Args:
        run_name: Specific run folder name. If None, searches all runs.
        
    Returns:
        Path to best.pt if found, None otherwise.
    """
    runs_dir = get_runs_dir()
    
    if run_name:
        weights_path = runs_dir / run_name / "weights" / "best.pt"
        return weights_path if weights_path.exists() else None
    
    # Search for the most recent run with weights
    # Filter for directories that contain weights
    all_runs = [d for d in runs_dir.iterdir() if d.is_dir()]
    
    if not all_runs:
        return None
    
    # Sort by directory name (contains timestamp YYYYMMDD_HHMMSS)
    all_runs.sort(key=lambda x: x.name, reverse=True)
    
    for run_dir in all_runs:
        # Check for best.pt
        weights_path = run_dir / "weights" / "best.pt"
        if weights_path.exists():
            return weights_path
    
    return None


# Class definitions - easy to modify for different hand signs
CLASSES = [
    "tiger", "boar", "snake", "ram", "bird",
    "dragon", "dog", "rat", "horse", "monkey", "ox", "hare", "clap"
]

# Key mappings for dataset capture (key -> class name)
KEY_CLASS_MAP = {
    ord('1'): "tiger",
    ord('2'): "boar",
    ord('3'): "snake",
    ord('4'): "ram",
    ord('5'): "bird",
    ord('6'): "dragon",
    ord('7'): "dog",
    ord('8'): "rat",
    ord('9'): "horse",
    ord('0'): "monkey",
    ord('-'): "ox",
    ord('='): "hare",
    ord('/'): "clap",
}


def get_class_names() -> list[str]:
    """Get the list of class names in order."""
    return CLASSES.copy()


def get_class_index(class_name: str) -> int:
    """
    Get the index of a class name.
    
    Args:
        class_name: Name of the class.
        
    Returns:
        Integer index of the class.
        
    Raises:
        ValueError: If class name not found.
    """
    if class_name not in CLASSES:
        raise ValueError(f"Unknown class: {class_name}. Valid classes: {CLASSES}")
    return CLASSES.index(class_name)
