"""
Tests for SafeGuard AI Event Schema & Serialization (Requirements 1, 7, 8, 9)
"""

import json
import pytest
from pydantic import ValidationError
from bridge.event_schema import (
    BoundingBox,
    EventSource,
    EventType,
    FootPoint,
    HeartbeatEvent,
    SafetyEvent,
)


def test_valid_entry_event():
    """Test 1: Valid person detection entry event."""
    event = SafetyEvent.create_entry_event(
        event_id="INC-001",
        zone_id="zone-machine-danger-1",
        confidence=0.92,
        foot_point=(500.0, 600.0),
        bounding_box=(460.0, 300.0, 540.0, 600.0),
        simulation=True,
    )
    assert event.schema_version == "1.0"
    assert event.event_id == "INC-001"
    assert event.event_type == EventType.RESTRICTED_ZONE_ENTRY
    assert event.person_detected is True
    assert event.confidence == 0.92
    assert event.foot_point.x == 500.0
    assert event.foot_point.y == 600.0
    assert event.simulation is True

    # Validate JSON round-trip
    dumped = event.model_dump_json()
    reparsed = SafetyEvent.model_validate_json(dumped)
    assert reparsed.event_id == event.event_id


def test_valid_clear_event():
    """Test valid clearance event."""
    event = SafetyEvent.create_clear_event(
        event_id="CLR-001",
        zone_id="zone-machine-danger-1",
        simulation=True,
    )
    assert event.event_type == EventType.RESTRICTED_ZONE_CLEAR
    assert event.person_detected is False
    assert event.confidence == 0.0


def test_invalid_json():
    """Test 7: Malformed / unparseable JSON string."""
    with pytest.raises(ValueError):
        SafetyEvent.model_validate_json('{"schema_version": "1.0", broken_json')


def test_missing_required_fields():
    """Test 8: Rejection when mandatory fields are omitted."""
    # Missing 'event_id' and 'timestamp'
    payload = {
        "schema_version": "1.0",
        "event_type": "restricted_zone_entry",
        "person_detected": True,
        "zone_id": "zone-A",
        "confidence": 0.85,
    }
    with pytest.raises(ValidationError) as exc_info:
        SafetyEvent.model_validate(payload)
    errors = str(exc_info.value)
    assert "event_id" in errors
    assert "timestamp" in errors


def test_unknown_event_type():
    """Test 9: Unknown / unsupported event type."""
    payload = {
        "schema_version": "1.0",
        "event_id": "INC-099",
        "event_type": "UNKNOWN_CUSTOM_BREACH",
        "person_detected": True,
        "zone_id": "zone-A",
        "confidence": 0.85,
        "timestamp": "2026-10-16T17:30:00Z",
    }
    with pytest.raises(ValidationError):
        SafetyEvent.model_validate(payload)


def test_unsupported_schema_version():
    """Rejection when schema version is not 1.0."""
    payload = {
        "schema_version": "2.0",
        "event_id": "INC-099",
        "event_type": "restricted_zone_entry",
        "person_detected": True,
        "zone_id": "zone-A",
        "confidence": 0.85,
        "timestamp": "2026-10-16T17:30:00Z",
    }
    with pytest.raises(ValidationError) as exc_info:
        SafetyEvent.model_validate(payload)
    assert "Unsupported schema version" in str(exc_info.value)


def test_confidence_out_of_bounds():
    """Rejection when confidence is < 0.0 or > 1.0."""
    with pytest.raises(ValidationError):
        SafetyEvent.create_entry_event(
            event_id="INC-OUT-OF-BOUNDS",
            zone_id="zone-A",
            confidence=1.45,  # Invalid: > 1.0
            foot_point=(100, 200),
            bounding_box=(50, 50, 150, 200),
        )


def test_bounding_box_geometry_validation():
    """Rejection when x_min >= x_max or y_min >= y_max."""
    with pytest.raises(ValidationError):
        BoundingBox(x_min=200, y_min=100, x_max=150, y_max=300)
