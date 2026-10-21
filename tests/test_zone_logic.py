"""
Tests for Zone Logic, Foot-Point Geometry, and Temporal Persistence (Requirements 2, 3, 4, 5)
"""

import pytest
from perception.zone_filter import (
    DetectionTarget,
    RestrictedZone,
    TemporalPersistenceTracker,
    calculate_foot_point,
)


@pytest.fixture
def test_zone():
    # Quadrilateral zone: [100, 100] to [300, 300]
    return RestrictedZone(
        zone_id="test-zone-1",
        name="Test Safety Enclosure",
        polygon_vertices=[[100, 100], [300, 100], [300, 300], [100, 300]],
    )


def test_foot_point_calculation():
    """Verify foot point is strictly bottom-center."""
    bbox = (100.0, 50.0, 200.0, 250.0)
    foot_x, foot_y = calculate_foot_point(bbox)
    assert foot_x == 150.0
    assert foot_y == 250.0


def test_person_outside_restricted_zone(test_zone):
    """Test 2: Person outside restricted zone."""
    tracker = TemporalPersistenceTracker(
        zones=[test_zone],
        persistence_threshold_frames=2,
        clearance_dwell_frames=2,
        confidence_threshold=0.50,
        simulation=True,
    )
    # Target foot at (50, 50) -> well outside [100..300, 100..300]
    det_outside = DetectionTarget(bbox=(40, 10, 60, 50), confidence=0.90)
    assert not test_zone.contains_point(det_outside.foot_point)

    events = tracker.process_frame_detections([det_outside], frame_index=0)
    assert len(events) == 0


def test_person_inside_restricted_zone(test_zone):
    """Test 3: Person inside restricted zone with persistence."""
    tracker = TemporalPersistenceTracker(
        zones=[test_zone],
        persistence_threshold_frames=2,
        clearance_dwell_frames=2,
        confidence_threshold=0.50,
        simulation=True,
    )
    # Target foot at (200, 200) -> inside [100..300, 100..300]
    det_inside = DetectionTarget(bbox=(180, 100, 220, 200), confidence=0.92)
    assert test_zone.contains_point(det_inside.foot_point)

    # Frame 1: breach count 1 -> below persistence threshold 2 -> NO event yet
    events_f1 = tracker.process_frame_detections([det_inside], frame_index=1)
    assert len(events_f1) == 0

    # Frame 2: breach count 2 -> persistence met -> 1 ENTRY event generated
    events_f2 = tracker.process_frame_detections([det_inside], frame_index=2)
    assert len(events_f2) == 1
    assert events_f2[0].event_type.value == "restricted_zone_entry"
    assert events_f2[0].zone_id == "test-zone-1"
    assert events_f2[0].confidence == 0.92


def test_low_confidence_detection_filtered(test_zone):
    """Test 4: Low-confidence detection is suppressed."""
    tracker = TemporalPersistenceTracker(
        zones=[test_zone],
        persistence_threshold_frames=1,
        confidence_threshold=0.60,
        simulation=True,
    )
    # Inside zone, but confidence is 0.45 (< 0.60)
    det_low_conf = DetectionTarget(bbox=(180, 100, 220, 200), confidence=0.45)
    events = tracker.process_frame_detections([det_low_conf], frame_index=1)
    assert len(events) == 0


def test_persistence_suppresses_flicker(test_zone):
    """Test 5: Persistence suppresses transient single-frame flicker."""
    tracker = TemporalPersistenceTracker(
        zones=[test_zone],
        persistence_threshold_frames=3,
        confidence_threshold=0.50,
        simulation=True,
    )
    det_inside = DetectionTarget(bbox=(180, 100, 220, 200), confidence=0.90)

    # 1 frame inside
    events = tracker.process_frame_detections([det_inside], frame_index=1)
    assert len(events) == 0

    # Next frame outside (noise cleared)
    det_outside = DetectionTarget(bbox=(10, 10, 30, 40), confidence=0.90)
    events = tracker.process_frame_detections([det_outside], frame_index=2)
    assert len(events) == 0
    # State reset
    state = tracker.get_zone_state("test-zone-1")
    assert state["breach_count"] == 0


def test_clearance_dwell_cycle(test_zone):
    """Verify clearance dwell frames before restricted_zone_clear is emitted."""
    tracker = TemporalPersistenceTracker(
        zones=[test_zone],
        persistence_threshold_frames=1,
        clearance_dwell_frames=2,
        confidence_threshold=0.50,
        simulation=True,
    )
    det_inside = DetectionTarget(bbox=(180, 100, 220, 200), confidence=0.90)
    det_outside = DetectionTarget(bbox=(10, 10, 30, 40), confidence=0.90)

    # Frame 1: Intrusion -> Entry event
    ev1 = tracker.process_frame_detections([det_inside], frame_index=1)
    assert len(ev1) == 1
    assert ev1[0].event_type.value == "restricted_zone_entry"

    # Frame 2: Outside (dwell frame 1 of 2) -> No clear event yet
    ev2 = tracker.process_frame_detections([det_outside], frame_index=2)
    assert len(ev2) == 0

    # Frame 3: Outside (dwell frame 2 of 2) -> Clear event emitted!
    ev3 = tracker.process_frame_detections([det_outside], frame_index=3)
    assert len(ev3) == 1
    assert ev3[0].event_type.value == "restricted_zone_clear"
