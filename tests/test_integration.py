"""
Tests for End-to-End System Integration (Requirement 16)
Perceive -> Analyze -> Decide -> Communicate -> Act -> Verify
"""

import pytest
from bridge.event_schema import SafetyEvent
from bridge.publisher import SafetyEventPublisher
from bridge.subscriber import SafetyEventSubscriber
from bridge.transport import MockTransport
from perception.zone_filter import DetectionTarget, RestrictedZone, TemporalPersistenceTracker
from simulation.firmware_emulator import ESP32FirmwareEmulator, FirmwareState


def test_end_to_end_closed_loop():
    """Test 16: Full end-to-end event delivery and actuation."""
    # 1. Setup transport & bridge
    transport = MockTransport()
    transport.connect()

    publisher = SafetyEventPublisher(transport=transport, default_topic="safeguard/events")
    subscriber = SafetyEventSubscriber(transport=transport)

    # 2. Setup firmware
    firmware = ESP32FirmwareEmulator(device_id="ESP32-INTEGRATION-01")
    subscriber.register_event_handler(lambda ev: firmware.handle_safety_event(ev))
    subscriber.start_listening()

    assert firmware.current_state == FirmwareState.STATE_NORMAL

    # 3. Setup perception
    zone = RestrictedZone(
        zone_id="zone-integration",
        name="Integration Enclosure",
        polygon_vertices=[[100, 100], [500, 100], [500, 500], [100, 500]],
    )
    tracker = TemporalPersistenceTracker(
        zones=[zone],
        persistence_threshold_frames=2,
        clearance_dwell_frames=2,
        confidence_threshold=0.50,
        simulation=True,
    )

    # 4. Perceive: Worker enters zone (foot point at (300, 300))
    det_inside = DetectionTarget(bbox=(280, 150, 320, 300), confidence=0.95)

    # Frame 1: Persistence count 1 -> no event dispatched
    events_f1 = tracker.process_frame_detections([det_inside], frame_index=1)
    for ev in events_f1:
        publisher.publish_event(ev)
    assert firmware.current_state == FirmwareState.STATE_NORMAL

    # Frame 2: Persistence count 2 -> ENTRY event dispatched across bridge!
    events_f2 = tracker.process_frame_detections([det_inside], frame_index=2)
    assert len(events_f2) == 1
    for ev in events_f2:
        publisher.publish_event(ev)

    # 5. Act & Verify: Firmware must have received event and asserted alarm
    assert firmware.current_state == FirmwareState.STATE_ALARM
    assert firmware.red_led is True
    assert firmware.buzzer_active is True
    assert firmware.active_incident_id is not None

    # 6. Worker steps outside (foot point at (50, 50))
    det_outside = DetectionTarget(bbox=(40, 20, 60, 50), confidence=0.92)

    # Frame 3: Outside dwell frame 1 -> alarm stays active
    events_f3 = tracker.process_frame_detections([det_outside], frame_index=3)
    for ev in events_f3:
        publisher.publish_event(ev)
    assert firmware.current_state == FirmwareState.STATE_ALARM

    # Frame 4: Outside dwell frame 2 -> CLEAR event dispatched!
    events_f4 = tracker.process_frame_detections([det_outside], frame_index=4)
    assert len(events_f4) == 1
    for ev in events_f4:
        publisher.publish_event(ev)

    # 7. Act & Verify: Firmware returns to normal
    assert firmware.current_state == FirmwareState.STATE_NORMAL
    assert firmware.red_led is False
    assert firmware.buzzer_active is False
    assert firmware.active_incident_id is None
