"""
SafeGuard AI — Perception Pipeline Runner (Stage 5: Run)
Executes live video ingestion, person detection, foot-point geometry,
polygon containment, temporal persistence filtering, and event dispatch.
"""

import argparse
import os
import sys
import time
from typing import List, Optional, Tuple

import cv2
import numpy as np

# Ensure project root is on path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from bridge.config import load_app_config, load_zones_config
from bridge.event_schema import EventSource, EventType, SafetyEvent
from bridge.publisher import SafetyEventPublisher
from bridge.transport import MockTransport, MqttTransport, SerialTransport
from perception.zone_filter import (
    DetectionTarget,
    RestrictedZone,
    TemporalPersistenceTracker,
    calculate_foot_point,
)


class SafeGuardPerceptionPipeline:
    """
    Live perception engine connecting video capture, detector, zone logic, and event publisher.
    """

    def __init__(
        self,
        zones_config_path: str = "configs/zones.json",
        app_config_path: str = "configs/app-config.example.json",
        transport_type: str = "mock",
        source: str = "0",
        confidence_threshold: float = 0.55,
        persistence_frames: int = 3,
        headless: bool = True,
    ):
        self.headless = headless
        self.source = source
        self.confidence_threshold = confidence_threshold

        # Load configs
        self.app_config = load_app_config(app_config_path)
        zones_dict = load_zones_config(zones_config_path)
        self.zones = [RestrictedZone.from_dict(zd) for zd in zones_dict.get("zones", [])]

        # Initialize Transport
        if transport_type == "mqtt":
            mqtt_cfg = self.app_config.get("bridge", {}).get("mqtt", {})
            self.transport = MqttTransport(
                broker_host=mqtt_cfg.get("broker_host", "localhost"),
                broker_port=mqtt_cfg.get("broker_port", 1883),
            )
        elif transport_type == "serial":
            ser_cfg = self.app_config.get("bridge", {}).get("serial", {})
            self.transport = SerialTransport(
                port=ser_cfg.get("port", "COM3"),
                baud_rate=ser_cfg.get("baud_rate", 115200),
            )
        else:
            self.transport = MockTransport()

        self.transport.connect()
        self.publisher = SafetyEventPublisher(self.transport, default_topic="safeguard/events")

        # Persistence tracker
        self.tracker = TemporalPersistenceTracker(
            zones=self.zones,
            persistence_threshold_frames=persistence_frames,
            clearance_dwell_frames=5,
            confidence_threshold=confidence_threshold,
            simulation=(transport_type == "mock"),
        )

        # Initialize detector
        self.detector = self._init_detector()

    def _init_detector(self):
        """Initialize YOLO detector with graceful fallback."""
        try:
            from ultralytics import YOLO
            # Use lightweight nano model
            model = YOLO("yolov8n.pt")
            print("[Perception] Ultralytics YOLOv8n initialized successfully.")
            return model
        except Exception as e:
            print(f"[Perception] Warning: Could not initialize Ultralytics detector: {e}")
            print("[Perception] Fallback to synthetic target generator mode.")
            return None

    def run(self, max_frames: Optional[int] = None) -> int:
        """Execute perception loop."""
        # Open video source
        if self.source.isdigit():
            cap = cv2.VideoCapture(int(self.source))
        elif os.path.exists(self.source):
            cap = cv2.VideoCapture(self.source)
        else:
            print(f"[Perception] Source '{self.source}' not accessible, running synthetic camera stream.")
            cap = None

        frame_count = 0
        events_emitted = 0
        print("[Perception] Pipeline running. Press 'q' to stop.")

        try:
            while True:
                if max_frames and frame_count >= max_frames:
                    break

                if cap and cap.isOpened():
                    ret, frame = cap.read()
                    if not ret:
                        print("[Perception] End of video stream.")
                        break
                else:
                    # Synthetic black frame with test grid (1280x720)
                    frame = np.zeros((720, 1280, 3), dtype=np.uint8)
                    cv2.putText(frame, "SAFEGUARD AI SYNTHETIC TEST FEED", (50, 50),
                                cv2.FONT_HERSHEY_SIMPLEX, 1.0, (255, 255, 255), 2)

                frame_count += 1
                detections = self._detect_persons(frame, frame_count)

                # Process zone logic and persistence
                events = self.tracker.process_frame_detections(detections, frame_index=frame_count)
                for ev in events:
                    self.publisher.publish_event(ev)
                    events_emitted += 1

                # Visual annotation
                annotated = self._annotate_frame(frame, detections)

                if not self.headless:
                    cv2.imshow("SafeGuard AI — Perception Pipeline", annotated)
                    if cv2.waitKey(1) & 0xFF == ord("q"):
                        break

                time.sleep(0.01)

        finally:
            if cap:
                cap.release()
            if not self.headless:
                cv2.destroyAllWindows()
            self.transport.disconnect()

        print(f"[Perception] Pipeline exited. Total frames: {frame_count}, Events: {events_emitted}")
        return events_emitted

    def _detect_persons(self, frame: np.ndarray, frame_index: int) -> List[DetectionTarget]:
        """Detect person instances in the frame."""
        targets: List[DetectionTarget] = []

        if self.detector is not None:
            try:
                # Class 0 is 'person' in standard COCO
                results = self.detector.predict(
                    frame, classes=[0], conf=self.confidence_threshold, verbose=False
                )
                for r in results:
                    boxes = r.boxes
                    for box in boxes:
                        coords = box.xyxy[0].tolist()
                        conf = float(box.conf[0])
                        targets.append(
                            DetectionTarget(
                                bbox=(coords[0], coords[1], coords[2], coords[3]),
                                confidence=conf,
                            )
                        )
                return targets
            except Exception as e:
                pass

        # Fallback synthetic target moving across screen
        # Moves across frame from x=200 to x=800, touches zone around frame 15..30
        x = 200 + (frame_index * 20) % 800
        y_foot = 500.0  # inside zone
        targets.append(
            DetectionTarget(
                bbox=(x - 30.0, 300.0, x + 30.0, y_foot),
                confidence=0.91,
                track_id=1,
            )
        )
        return targets

    def _annotate_frame(self, frame: np.ndarray, detections: List[DetectionTarget]) -> np.ndarray:
        """Render polygons, bounding boxes, foot points, and breach indicators."""
        vis = frame.copy()
        overlay = vis.copy()

        # 1. Draw Restricted Zones
        for zone in self.zones:
            pts = np.array(zone.vertices, np.int32).reshape((-1, 1, 2))
            # Determine if this zone is currently breached
            zstate = self.tracker.get_zone_state(zone.zone_id)
            is_breached = zstate and (zstate["active_incident_id"] is not None)

            fill_color = (0, 0, 255) if is_breached else (0, 255, 0)
            cv2.fillPoly(overlay, [pts], fill_color)
            cv2.polylines(vis, [pts], True, (0, 0, 255) if is_breached else (0, 200, 0), 2)

            label = f"{zone.name} [{'BREACH!' if is_breached else 'SECURE'}]"
            v0 = zone.vertices[0]
            cv2.putText(vis, label, (int(v0[0]), int(v0[1]) - 10),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.6, (0, 0, 255) if is_breached else (0, 255, 0), 2)

        # Apply transparency for polygons
        cv2.addWeighted(overlay, 0.25, vis, 0.75, 0, vis)

        # 2. Draw Personnel Detections & Foot Points
        for det in detections:
            x1, y1, x2, y2 = [int(v) for v in det.bbox]
            foot_x, foot_y = [int(v) for v in det.foot_point]

            # Bounding box
            cv2.rectangle(vis, (x1, y1), (x2, y2), (255, 200, 0), 2)
            cv2.putText(vis, f"Person {det.confidence:.2f}", (x1, y1 - 8),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.5, (255, 200, 0), 1)

            # Ground contact foot point (Highlighted Circle)
            cv2.circle(vis, (foot_x, foot_y), 6, (0, 0, 255), -1)
            cv2.circle(vis, (foot_x, foot_y), 8, (255, 255, 255), 2)
            cv2.putText(vis, f"Foot ({foot_x},{foot_y})", (foot_x + 8, foot_y + 4),
                        cv2.FONT_HERSHEY_SIMPLEX, 0.45, (255, 255, 255), 1)

        return vis


def main():
    parser = argparse.ArgumentParser(description="SafeGuard AI Perception Pipeline Runner")
    parser.add_argument("--source", default="0", help="Camera index (0) or path to video file")
    parser.add_argument("--transport", default="mock", choices=["mock", "mqtt", "serial"])
    parser.add_argument("--headless", action="store_true", help="Run without GUI window")
    parser.add_argument("--max-frames", type=int, default=None, help="Maximum frames to process")
    args = parser.parse_args()

    pipeline = SafeGuardPerceptionPipeline(
        source=args.source,
        transport_type=args.transport,
        headless=args.headless,
    )
    pipeline.run(max_frames=args.max_frames)


if __name__ == "__main__":
    main()
