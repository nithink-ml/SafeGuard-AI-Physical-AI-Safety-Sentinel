"""
SafeGuard AI — Mock Perception Producer
Generates synthetic worker trajectories, bounding boxes, and ground foot points.
"""

from typing import List, Tuple
from perception.zone_filter import DetectionTarget


class MockPerceptionProducer:
    """
    Simulates factory personnel moving across the shop floor.
    Demonstrates safe passage, boundary walking, zone intrusion, and clearance.
    """

    @staticmethod
    def get_safe_worker_trajectory() -> List[DetectionTarget]:
        """
        Worker walking along the designated safe walkway (y=200, well above machine zone y=400..720).
        """
        frames = []
        # Trajectory moves from x=100 to x=800 along y=220
        for x in [100, 250, 400, 550, 700]:
            bbox = (float(x - 30), 100.0, float(x + 30), 220.0)
            frames.append(DetectionTarget(bbox=bbox, confidence=0.91, track_id=1))
        return frames

    @staticmethod
    def get_flicker_noise_trajectory() -> List[DetectionTarget]:
        """
        A single-frame noisy false detection inside the danger zone.
        Should be rejected by the persistence filter (requires 3 frames).
        """
        # Frame 1: inside zone [500, 500]
        f1 = DetectionTarget(bbox=(470.0, 380.0, 530.0, 500.0), confidence=0.88, track_id=2)
        return [f1]

    @staticmethod
    def get_low_confidence_trajectory() -> List[DetectionTarget]:
        """
        Worker detected inside zone, but detector confidence is 0.40 (below 0.55 threshold).
        Should be ignored by confidence filter.
        """
        return [
            DetectionTarget(bbox=(470.0, 380.0, 530.0, 500.0), confidence=0.40, track_id=3)
            for _ in range(5)
        ]

    @staticmethod
    def get_full_intrusion_trajectory() -> List[List[DetectionTarget]]:
        """
        Multi-frame sequence demonstrating:
        1. Worker approaches boundary (Frame 0, 1)
        2. Worker steps foot into zone (Frame 2, 3, 4) -> Triggers breach after persistence
        3. Worker remains in zone (Frame 5) -> Duplicate suppressed
        4. Worker steps back out (Frame 6, 7, 8, 9, 10) -> Clearance dwell triggers clear event
        """
        sequence: List[List[DetectionTarget]] = []

        # Step 1: Outside (y_max=360, machine zone is y=400..720)
        sequence.append([DetectionTarget(bbox=(400.0, 240.0, 460.0, 360.0), confidence=0.89, track_id=10)])
        sequence.append([DetectionTarget(bbox=(420.0, 260.0, 480.0, 380.0), confidence=0.91, track_id=10)])

        # Step 2: Foot crosses into zone at y_max=450 (Polygon y is 400..720, x is 350..780)
        sequence.append([DetectionTarget(bbox=(440.0, 320.0, 500.0, 450.0), confidence=0.92, track_id=10)])  # Frame 2: breach 1
        sequence.append([DetectionTarget(bbox=(450.0, 330.0, 510.0, 460.0), confidence=0.94, track_id=10)])  # Frame 3: breach 2
        sequence.append([DetectionTarget(bbox=(460.0, 340.0, 520.0, 470.0), confidence=0.95, track_id=10)])  # Frame 4: breach 3 (PERSISTENCE MET!)

        # Step 3: Still inside
        sequence.append([DetectionTarget(bbox=(470.0, 350.0, 530.0, 480.0), confidence=0.96, track_id=10)])  # Frame 5: duplicate suppressed

        # Step 4: Evacuates zone (Foot steps back out to y_max=350)
        sequence.append([DetectionTarget(bbox=(450.0, 230.0, 510.0, 350.0), confidence=0.93, track_id=10)])  # Clear frame 1
        sequence.append([DetectionTarget(bbox=(440.0, 220.0, 500.0, 340.0), confidence=0.92, track_id=10)])  # Clear frame 2
        sequence.append([DetectionTarget(bbox=(430.0, 210.0, 490.0, 330.0), confidence=0.91, track_id=10)])  # Clear frame 3
        sequence.append([DetectionTarget(bbox=(420.0, 200.0, 480.0, 320.0), confidence=0.90, track_id=10)])  # Clear frame 4
        sequence.append([DetectionTarget(bbox=(410.0, 190.0, 470.0, 310.0), confidence=0.89, track_id=10)])  # Clear frame 5 (CLEARANCE MET!)

        return sequence
