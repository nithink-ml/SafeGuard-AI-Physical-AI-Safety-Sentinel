"""
SafeGuard AI — Factory CCTV Sample Video Generator
Creates a realistic 720p factory video with a real pedestrian walking into a danger zone.
"""

import os
import cv2
import numpy as np
import requests
from ultralytics import YOLO

os.makedirs("data", exist_ok=True)
bus_path = "data/bus.jpg"
output_video_path = "data/sample_factory_cctv.mp4"

# 1. Download reference image with real pedestrians if not present
if not os.path.exists(bus_path):
    print("Downloading reference pedestrian image...")
    url = "https://raw.githubusercontent.com/ultralytics/ultralytics/main/ultralytics/assets/bus.jpg"
    r = requests.get(url, timeout=15)
    with open(bus_path, "wb") as f:
        f.write(r.content)
    print(f"Downloaded {len(r.content)} bytes.")

# 2. Extract pedestrian crop using YOLO
model = YOLO("yolov8n.pt")
img = cv2.imread(bus_path)
results = model.predict(img, classes=[0], conf=0.7, verbose=False)

person_crop = None
for r in results:
    boxes = r.boxes
    if len(boxes) > 0:
        # Pick the most confident person box
        b = boxes[0]
        x1, y1, x2, y2 = [int(v) for v in b.xyxy[0].tolist()]
        person_crop = img[y1:y2, x1:x2].copy()
        break

if person_crop is None:
    # Fallback to center crop
    person_crop = img[100:600, 50:300].copy()

# Resize person to realistic height (e.g. height 220px, proportional width)
p_h, p_w = person_crop.shape[:2]
target_h = 220
target_w = int(p_w * (target_h / p_h))
person_resized = cv2.resize(person_crop, (target_w, target_h))

# Soft elliptical alpha mask for smooth blending
mask = np.zeros((target_h, target_w), dtype=np.float32)
cv2.ellipse(mask, (target_w // 2, target_h // 2), (target_w // 2 - 2, target_h // 2 - 2), 0, 0, 360, 1.0, -1)
mask = cv2.GaussianBlur(mask, (15, 15), 5)
mask = np.repeat(mask[:, :, np.newaxis], 3, axis=2)

# 3. Create 200-frame video (10 seconds @ 20 FPS, 1280x720)
fourcc = cv2.VideoWriter_fourcc(*"mp4v")
writer = cv2.VideoWriter(output_video_path, fourcc, 20.0, (1280, 720))

print("Generating factory CCTV video frames...")

# Danger zone polygon vertices: [350, 400], [780, 400], [920, 720], [240, 720]
# Safe walkway: Y < 350

num_frames = 180
for f_idx in range(num_frames):
    # Factory floor background
    frame = np.zeros((720, 1280, 3), dtype=np.uint8)
    frame[:] = (35, 42, 50)  # Concrete floor gray

    # Floor grid markings
    for x in range(0, 1280, 80):
        cv2.line(frame, (x, 0), (x, 720), (45, 54, 65), 1)
    for y in range(0, 720, 80):
        cv2.line(frame, (0, y), (1280, y), (45, 54, 65), 1)

    # Safe walkway lines
    cv2.line(frame, (0, 320), (1280, 320), (80, 95, 110), 2)
    cv2.putText(frame, "PEDESTRIAN SAFE WALKWAY (Y < 350)", (50, 80),
                cv2.FONT_HERSHEY_SIMPLEX, 0.7, (140, 160, 180), 2)

    # Danger zone caution perimeter markings on floor (yellow/black hash)
    pts = np.array([[350, 400], [780, 400], [920, 720], [240, 720]], np.int32).reshape((-1, 1, 2))
    cv2.polylines(frame, [pts], True, (0, 215, 255), 3)  # Yellow caution line
    cv2.putText(frame, "CAUTION: ROBOTIC WORK CELL EXCLUSION ZONE", (360, 390),
                cv2.FONT_HERSHEY_SIMPLEX, 0.65, (0, 215, 255), 2)

    # CCTV timestamp and camera header
    cv2.putText(frame, f"CAM-04 SHOP-FLOOR-NORTH | FRAME {f_idx:04d} | 2026-10-16 14:32:{f_idx//20:02d}",
                (30, 40), cv2.FONT_HERSHEY_SIMPLEX, 0.6, (200, 200, 200), 1)

    # Calculate person movement trajectory:
    # Frames 0-45: Moves along safe walkway (X: 150->450, Foot Y: 240)
    # Frames 46-75: Steps down into danger zone (X: 450->560, Foot Y: 240->520) -> INTRUSION!
    # Frames 76-125: Remains inside danger zone (X: 560->620, Foot Y: 520) -> ALARM ACTIVE!
    # Frames 126-160: Steps back out to safe walkway (X: 620->700, Foot Y: 520->240) -> CLEARANCE!
    # Frames 161-180: Continues walking safely away (X: 700->850, Foot Y: 240)
    if f_idx <= 45:
        cur_x = int(150 + (f_idx / 45.0) * 300)
        cur_foot_y = 240
    elif f_idx <= 75:
        p = (f_idx - 45) / 30.0
        cur_x = int(450 + p * 110)
        cur_foot_y = int(240 + p * 280)
    elif f_idx <= 125:
        p = (f_idx - 75) / 50.0
        cur_x = int(560 + p * 60)
        cur_foot_y = 520
    elif f_idx <= 160:
        p = (f_idx - 125) / 35.0
        cur_x = int(620 + p * 80)
        cur_foot_y = int(520 - p * 280)
    else:
        p = (f_idx - 160) / 20.0
        cur_x = int(700 + p * 150)
        cur_foot_y = 240

    # Person top-left coordinate
    px1 = cur_x - target_w // 2
    py1 = cur_foot_y - target_h
    px2 = px1 + target_w
    py2 = cur_foot_y

    # Composite person onto frame with alpha mask
    if px1 >= 0 and px2 < 1280 and py1 >= 0 and py2 < 720:
        bg_roi = frame[py1:py2, px1:px2].astype(np.float32)
        fg_roi = person_resized.astype(np.float32)
        blended = (fg_roi * mask + bg_roi * (1.0 - mask)).astype(np.uint8)
        frame[py1:py2, px1:px2] = blended

    writer.write(frame)

writer.release()
print(f"Sample video created successfully: {output_video_path}")
