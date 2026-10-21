"""
Tests for ESP32 Firmware Emulator (Requirements 12, 13, 14, 15 / REQ-001 to REQ-010)
"""

import time
import pytest
from bridge.event_schema import SafetyEvent
from simulation.firmware_emulator import ESP32FirmwareEmulator, FirmwareState


@pytest.fixture
def emulator():
    return ESP32FirmwareEmulator(device_id="ESP32-TEST", alarm_timeout_sec=0.1)


def test_firmware_safe_initialization(emulator):
    """Test 12 / REQ-001: Safe initial state (Outputs LOW, state NORMAL)."""
    assert emulator.current_state == FirmwareState.STATE_NORMAL
    assert emulator.red_led is False
    assert emulator.buzzer_active is False
    assert len(emulator.uart_logs) >= 2
    assert "REQ-001 Verified" in emulator.uart_logs[1]


def test_alarm_activation(emulator):
    """Test 13 / REQ-003: Alarm activation on valid restricted_zone_entry."""
    event = SafetyEvent.create_entry_event(
        event_id="INC-ALARM-01",
        zone_id="zone-machine-danger-1",
        confidence=0.94,
        foot_point=(500, 600),
        bounding_box=(450, 300, 550, 600),
        simulation=True,
    )
    handled = emulator.handle_safety_event(event)
    assert handled is True
    assert emulator.current_state == FirmwareState.STATE_ALARM
    assert emulator.red_led is True
    assert emulator.buzzer_active is True
    assert emulator.active_incident_id == "INC-ALARM-01"

    # Verify REQ-006 UART logging
    last_log = emulator.uart_logs[-2]
    assert "STATE_NORMAL -> STATE_ALARM" in last_log


def test_alarm_reset_on_clear_event(emulator):
    """Test 14 / REQ-007: Alarm reset upon receiving restricted_zone_clear."""
    # First trigger alarm
    entry_ev = SafetyEvent.create_entry_event(
        event_id="INC-ALARM-02",
        zone_id="zone-machine-danger-1",
        confidence=0.91,
        foot_point=(500, 600),
        bounding_box=(450, 300, 550, 600),
        simulation=True,
    )
    emulator.handle_safety_event(entry_ev)
    assert emulator.current_state == FirmwareState.STATE_ALARM

    # Deliver clearance event
    clear_ev = SafetyEvent.create_clear_event(
        event_id="CLR-ALARM-02",
        zone_id="zone-machine-danger-1",
        simulation=True,
    )
    emulator.handle_safety_event(clear_ev)

    assert emulator.current_state == FirmwareState.STATE_NORMAL
    assert emulator.red_led is False
    assert emulator.buzzer_active is False
    assert emulator.active_incident_id is None


def test_manual_alarm_reset(emulator):
    """Test manual operator reset."""
    entry_ev = SafetyEvent.create_entry_event(
        event_id="INC-MAN-01",
        zone_id="zone-A",
        confidence=0.88,
        foot_point=(100, 200),
        bounding_box=(50, 50, 150, 200),
        simulation=True,
    )
    emulator.handle_safety_event(entry_ev)
    assert emulator.current_state == FirmwareState.STATE_ALARM

    emulator.reset_alarm("Physical Emergency Pushbutton")
    assert emulator.current_state == FirmwareState.STATE_NORMAL
    assert emulator.red_led is False
    assert emulator.buzzer_active is False


def test_communication_timeout_watchdog(emulator):
    """Test 15 / REQ-010: Watchdog timeout auto-recovers from stranded alarm."""
    entry_ev = SafetyEvent.create_entry_event(
        event_id="INC-WATCHDOG-01",
        zone_id="zone-A",
        confidence=0.85,
        foot_point=(100, 200),
        bounding_box=(50, 50, 150, 200),
        simulation=True,
    )
    emulator.handle_safety_event(entry_ev)
    assert emulator.current_state == FirmwareState.STATE_ALARM

    # Wait beyond timeout (0.1s configured for test)
    time.sleep(0.15)
    timed_out = emulator.check_watchdog_timeout()
    assert timed_out is True
    assert emulator.current_state == FirmwareState.STATE_NORMAL
    assert emulator.red_led is False
    assert emulator.buzzer_active is False


def test_runtime_telemetry_emission(emulator):
    """REQ-009: Runtime telemetry output verification."""
    telemetry = emulator.get_telemetry()
    assert telemetry.device_id == "ESP32-TEST"
    assert telemetry.state == FirmwareState.STATE_NORMAL
    assert telemetry.actuators.red_led is False
    assert telemetry.actuators.buzzer_active is False
    assert telemetry.uptime_sec >= 0
    assert telemetry.free_heap_bytes > 0
