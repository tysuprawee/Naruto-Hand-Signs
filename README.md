# Naruto Hand Signs YOLO

A complete Python project for training and running a YOLO model to recognize Naruto hand signs from a webcam.

## 🎯 Overview

This project allows you to:
1. **Capture** images of hand signs using your webcam
2. **Label** images externally (e.g., with Roboflow)
3. **Train** a YOLO model on your custom dataset
4. **Detect** hand signs in real-time with bounding boxes and labels

### Supported Hand Signs (Classes)
- 🐯 **tiger** (key: 1)
- 🐗 **boar** (key: 2)
- 🐍 **snake** (key: 3)
- 🐏 **ram** (key: 4)
- 🐦 **bird** (key: 5)

---

## 📁 Project Structure

```
naruto_handsigns_yolo/
├── src/
│   ├── capture_dataset.py   # Webcam capture script
│   ├── train.py             # YOLO training script
│   ├── detect_webcam.py     # Real-time detection script
│   └── utils/
│       ├── paths.py         # Centralized path handling
│       └── visualization.py # Drawing helpers
├── dataset/
│   ├── images/
│   │   ├── raw/             # Initial captures (organized by class)
│   │   ├── train/           # Training images (after labeling)
│   │   └── val/             # Validation images (after labeling)
│   └── labels/
│       ├── train/           # Training labels (.txt files)
│       └── val/             # Validation labels (.txt files)
├── yolo_config/
│   └── data.yaml            # YOLO dataset configuration
├── models/
│   └── runs/                # Training results and weights
├── requirements.txt
└── README.md
```

---

## 🚀 Getting Started

### 1. Create a Virtual Environment

**Windows:**
```bash
# Create virtual environment
python -m venv venv

# Activate it
venv\Scripts\activate
```

**macOS / Linux:**
```bash
# Create virtual environment
python3 -m venv venv

# Activate it
source venv/bin/activate
```

### 2. Install Dependencies

```bash
# Make sure you're in the project root directory
pip install -r requirements.txt
```

**Note for GPU users:** If you have an NVIDIA GPU and want faster training, install PyTorch with CUDA support from [pytorch.org](https://pytorch.org/).

### 3. Capture Dataset Images

Run the capture script to collect images of your hand signs:

```bash
# Windows
python src\capture_dataset.py

# macOS / Linux
python3 src/capture_dataset.py
```

**Controls:**
- Press `1` to capture a "tiger" image
- Press `2` to capture a "boar" image
- Press `3` to capture a "snake" image
- Press `4` to capture a "ram" image
- Press `5` to capture a "bird" image
- Press `q` to quit

**Tips for good dataset:**
- Capture 50-100+ images per class
- Vary lighting conditions
- Vary hand positions and angles
- Use different backgrounds
- Include both close-up and distant shots

Images are saved to `dataset/images/raw/<class_name>/`

### 4. Label Your Images

After capturing, you need to label your images with bounding boxes. We recommend using one of these tools:

1. **[Roboflow](https://roboflow.com/)** (free tier available) - Web-based, easy to use
2. **[LabelImg](https://github.com/heartexlabs/labelImg)** - Desktop app
3. **[CVAT](https://cvat.ai/)** - Web-based, feature-rich

**Steps:**
1. Upload your images from `dataset/images/raw/` to the labeling tool
2. Draw bounding boxes around hands making each sign
3. Label each box with the class name (tiger, boar, snake, ram, bird)
4. Export in **YOLO format**
5. Place the exported files:
   - Images → `dataset/images/train/` and `dataset/images/val/`
   - Labels (.txt) → `dataset/labels/train/` and `dataset/labels/val/`

**Recommended split:** 80% training, 20% validation

### 5. Train the Model

Once your labeled dataset is in place:

```bash
# Basic training (uses YOLOv8 nano model)
python src/train.py

# With custom options
python src/train.py --model yolov8s.pt --epochs 100 --batch 16
```

**Available arguments:**
| Argument | Default | Description |
|----------|---------|-------------|
| `--model` | yolov8n.pt | Base model (n=nano, s=small, m=medium) |
| `--epochs` | 100 | Number of training epochs |
| `--img-size` | 640 | Image size for training |
| `--batch` | 16 | Batch size (-1 for auto) |
| `--patience` | 50 | Early stopping patience |
| `--device` | auto | Device: 'cpu', '0' (GPU), etc. |

Training results are saved to `models/runs/<run_name>/`

### 6. Run Real-time Detection

After training, run detection with your trained model:

```bash
# Auto-find latest trained weights
python src/detect_webcam.py

# Specify weights file
python src/detect_webcam.py --weights models/runs/<run_name>/weights/best.pt
```

**Available arguments:**
| Argument | Default | Description |
|----------|---------|-------------|
| `--weights` | auto | Path to trained weights |
| `--camera` | 0 | Camera index |
| `--conf` | 0.5 | Confidence threshold |
| `--no-fps` | false | Hide FPS counter |

Press `q` to quit detection.

---

## 🔌 Raspberry Pi Integration

The detection script includes a stub function `send_prediction_to_pi()` in `detect_webcam.py`. To enable sending predictions:

1. Uncomment the relevant package in `requirements.txt`:
   - `pyserial` for serial/UART
   - `paho-mqtt` for MQTT
   - `requests` for HTTP

2. Edit `send_prediction_to_pi()` in `src/detect_webcam.py` with your implementation

3. Run detection with the `--send-to-pi` flag:
   ```bash
   python src/detect_webcam.py --send-to-pi
   ```

---

## 📝 Modifying Classes

To change the hand sign classes:

1. Edit `CLASSES` list in `src/utils/paths.py`
2. Update `KEY_CLASS_MAP` in `src/utils/paths.py`
3. Update `yolo_config/data.yaml` with new class names

---

## 🐛 Troubleshooting

**Camera not detected:**
- Try different camera indices: `--camera 1`, `--camera 2`
- Check if another application is using the camera

**CUDA out of memory:**
- Reduce batch size: `--batch 8` or `--batch 4`
- Use smaller model: `--model yolov8n.pt`

**Poor detection accuracy:**
- Collect more training images (aim for 100+ per class)
- Ensure labels are accurate
- Train for more epochs
- Try a larger model (yolov8s or yolov8m)

---

## 📚 Resources

- [Ultralytics YOLO Documentation](https://docs.ultralytics.com/)
- [Roboflow Labeling Guide](https://docs.roboflow.com/)
- [YOLO Format Explanation](https://roboflow.com/formats/yolo-darknet-txt)

---

## 📄 License

This project is provided as-is for educational purposes.
