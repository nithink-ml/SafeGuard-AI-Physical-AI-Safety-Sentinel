"""
Tests for Duplicate Event Suppression & Sliding Window (Requirement 6 / REQ-005)
"""

import pytest
from bridge.event_schema import SafetyEvent
from simulation.firmware_emulator import ESP32FirmwareEmulator, FirmwareState


@pytest.fixture
def emulator():
    return ESP32FirmwareEmulator(device_id="ESP32-TEST", duplicate_window_size=16)


def test_duplicate_event_suppression(emulator):
    """Test 6: Duplicate event with identical event_id is rejected."""
    event = SafetyEvent.create_entry_event(
        event_id="INC-DUP-001",
        zone_id="zone-A",
        confidence=0.91,
        foot_point=(100, 200),
        bounding_box=(80, 50, 120, 200),
        simulation=True,
    )

    # First delivery: processed successfully -> triggers alarm
    first_ok = emulator.handle_safety_event(event)
    assert first_ok is True
    assert emulator.current_state == FirmwareState.STATE_ALARM
    assert emulator.duplicate_events_dropped == 0

    # Second delivery: identical event_id -> must be suppressed
    second_ok = emulator.handle_safety_event(event)
    assert second_ok is False
    assert emulator.duplicate_events_dropped == 1
    assert emulator.current_state == FirmwareState.STATE_ALARM

    # Third delivery: still suppressed
    third_ok = emulator.handle_safety_event(event)
    assert third_ok is False
    assert emulator.duplicate_events_dropped == 2


def test_sliding_window_capacity(emulator):
    """Verify that buffer size remains bounded to window size (16 items)."""
    # Send 20 distinct event IDs
    for i in range(20):
        ev = SafetyEvent.create_entry_event(
            event_id=f"INC-SEQ-{i:03d}",
            zone_id="zone-A",
            confidence=0.85,
            foot_point=(100, 200),
            bounding_box=(80, 50, 120, 200),
            simulation=True,
        )
        emulator.handle_safety_event(ev)

    # Internal queue must not exceed window size (16)
    assert len(emulator._processed_event_ids) == 16
    assert emulator.duplicate_events_dropped == 0
    # Oldest event (INC-SEQ-000) has rolled off the window
    assert "INC-SEQ-000" not in emulator._processed_event_ids
    # Latest event (INC-SEQ-019) is in the window
    assert "INC-SEQ-019" in emulator._processed_event_ids
