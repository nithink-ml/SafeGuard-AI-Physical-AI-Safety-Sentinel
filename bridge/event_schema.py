"""
SafeGuard AI — Safety Event Schema & Validation
Adheres to SafeGuard AI Communication Protocol v1.0.
"""

from datetime import datetime, timezone
from enum import Enum
from typing import Any, Dict, List, Optional, Tuple
from pydantic import BaseModel, Field, field_validator, model_validator


class EventType(str, Enum):
    RESTRICTED_ZONE_ENTRY = "restricted_zone_entry"
    RESTRICTED_ZONE_CLEAR = "restricted_zone_clear"
    HEARTBEAT = "heartbeat"
    MANUAL_RESET = "manual_reset"


class EventSource(str, Enum):
    PIPEGEN = "pipegen"
    SIMULATION = "simulation"
    MANUAL = "manual"
    EVENT_BRIDGE = "event_bridge"


class FootPoint(BaseModel):
    x: float = Field(..., description="X-coordinate in pixels")
    y: float = Field(..., description="Y-coordinate in pixels")


class BoundingBox(BaseModel):
    x_min: float = Field(..., description="Top-left X coordinate")
    y_min: float = Field(..., description="Top-left Y coordinate")
    x_max: float = Field(..., description="Bottom-right X coordinate")
    y_max: float = Field(..., description="Bottom-right Y coordinate")

    @model_validator(mode="after")
    def validate_box(self) -> "BoundingBox":
        if self.x_min >= self.x_max:
            raise ValueError(f"x_min ({self.x_min}) must be strictly less than x_max ({self.x_max})")
        if self.y_min >= self.y_max:
            raise ValueError(f"y_min ({self.y_min}) must be strictly less than y_max ({self.y_max})")
        return self


class SafetyEvent(BaseModel):
    """
    Standard safety event payload dispatched by perception pipeline.
    """
    schema_version: str = Field(default="1.0", description="Protocol schema version")
    event_id: str = Field(..., min_length=1, max_length=64, description="Unique event identifier")
    event_type: EventType = Field(..., description="Category of the event")
    person_detected: bool = Field(..., description="Whether a human target was detected")
    zone_id: str = Field(..., min_length=1, max_length=64, description="Identifier of the restricted zone")
    confidence: float = Field(..., ge=0.0, le=1.0, description="Detection confidence score between 0.0 and 1.0")
    timestamp: str = Field(..., description="ISO-8601 formatted UTC timestamp")
    source: EventSource = Field(default=EventSource.PIPEGEN, description="Originating subsystem")
    simulation: bool = Field(default=False, description="Flag indicating synthetic simulation data")
    foot_point: Optional[FootPoint] = Field(default=None, description="Ground contact point")
    bounding_box: Optional[BoundingBox] = Field(default=None, description="Bounding box")

    @field_validator("schema_version")
    @classmethod
    def validate_version(cls, v: str) -> str:
        if v != "1.0":
            raise ValueError(f"Unsupported schema version: '{v}'. Expected '1.0'.")
        return v

    @field_validator("timestamp")
    @classmethod
    def validate_timestamp_format(cls, v: str) -> str:
        try:
            # Accepts standard ISO 8601 formats (e.g. 2026-10-16T17:30:00Z or with offset)
            datetime.fromisoformat(v.replace("Z", "+00:00"))
        except Exception as e:
            raise ValueError(f"Invalid ISO-8601 timestamp string '{v}': {e}")
        return v

    @classmethod
    def create_entry_event(
        cls,
        event_id: str,
        zone_id: str,
        confidence: float,
        foot_point: Tuple[float, float],
        bounding_box: Tuple[float, float, float, float],
        simulation: bool = False,
        source: EventSource = EventSource.PIPEGEN,
    ) -> "SafetyEvent":
        now_utc = datetime.now(timezone.utc).isoformat()
        return cls(
            schema_version="1.0",
            event_id=event_id,
            event_type=EventType.RESTRICTED_ZONE_ENTRY,
            person_detected=True,
            zone_id=zone_id,
            confidence=round(confidence, 4),
            timestamp=now_utc,
            source=source,
            simulation=simulation,
            foot_point=FootPoint(x=foot_point[0], y=foot_point[1]),
            bounding_box=BoundingBox(
                x_min=bounding_box[0],
                y_min=bounding_box[1],
                x_max=bounding_box[2],
                y_max=bounding_box[3],
            ),
        )

    @classmethod
    def create_clear_event(
        cls,
        event_id: str,
        zone_id: str,
        simulation: bool = False,
        source: EventSource = EventSource.PIPEGEN,
    ) -> "SafetyEvent":
        now_utc = datetime.now(timezone.utc).isoformat()
        return cls(
            schema_version="1.0",
            event_id=event_id,
            event_type=EventType.RESTRICTED_ZONE_CLEAR,
            person_detected=False,
            zone_id=zone_id,
            confidence=0.0,
            timestamp=now_utc,
            source=source,
            simulation=simulation,
        )


class HeartbeatEvent(BaseModel):
    schema_version: str = Field(default="1.0")
    event_id: str = Field(..., min_length=1)
    event_type: EventType = Field(default=EventType.HEARTBEAT)
    timestamp: str = Field(...)
    source: EventSource = Field(default=EventSource.EVENT_BRIDGE)


class ActuatorState(BaseModel):
    red_led: bool = Field(default=False)
    buzzer_active: bool = Field(default=False)


class TelemetryStats(BaseModel):
    total_events_received: int = 0
    duplicate_events_dropped: int = 0
    malformed_events_rejected: int = 0


class FirmwareTelemetry(BaseModel):
    schema_version: str = Field(default="1.0")
    device_id: str = Field(...)
    state: str = Field(...)
    uptime_sec: int = Field(ge=0)
    free_heap_bytes: int = Field(ge=0)
    active_incident_id: Optional[str] = None
    actuators: ActuatorState
    stats: TelemetryStats
