"""
SafeGuard AI — Spatial-Temporal Zone Decision Engine
Computes foot-point geometry, polygon containment, and temporal persistence.
"""

import logging
import time
import uuid
from typing import Any, Dict, List, Optional, Tuple
from shapely.geometry import Point, Polygon
from bridge.event_schema import EventSource, EventType, SafetyEvent

logger = logging.getLogger("safeguard.zone_filter")


def calculate_foot_point(bbox: Tuple[float, float, float, float]) -> Tuple[float, float]:
    """
    Compute the ground contact foot point (bottom-center of bounding box).
    bbox format: (x_min, y_min, x_max, y_max)
    """
    x_min, y_min, x_max, y_max = bbox
    foot_x = (x_min + x_max) / 2.0
    foot_y = y_max
    return (round(foot_x, 2), round(foot_y, 2))


class RestrictedZone:
    """
    Represents a 2D restricted polygon zone on the shop floor.
    """

    def __init__(
        self,
        zone_id: str,
        name: str,
        polygon_vertices: List[List[float]],
        severity: str = "CRITICAL",
        color_bgr: Tuple[int, int, int] = (0, 0, 255),
    ):
        self.zone_id = zone_id
        self.name = name
        self.vertices = polygon_vertices
        self.severity = severity
        self.color_bgr = color_bgr
        if len(polygon_vertices) < 3:
            raise ValueError(f"Zone '{zone_id}' requires at least 3 vertices to form a polygon.")
        self._polygon = Polygon(polygon_vertices)

    def contains_point(self, point_xy: Tuple[float, float]) -> bool:
        """
        Check if (x, y) point is inside or on the boundary of the polygon.
        """
        pt = Point(point_xy[0], point_xy[1])
        return self._polygon.contains(pt) or self._polygon.touches(pt)

    @classmethod
    def from_dict(cls, data: Dict[str, Any]) -> "RestrictedZone":
        return cls(
            zone_id=data["zone_id"],
            name=data.get("zone_name", data["zone_id"]),
            polygon_vertices=data["polygon"],
            severity=data.get("severity", "CRITICAL"),
            color_bgr=tuple(data.get("color_bgr", [0, 0, 255])),
        )


class DetectionTarget:
    """
    A single person detection candidate.
    """
    def __init__(self, bbox: Tuple[float, float, float, float], confidence: float, track_id: Optional[int] = None):
        self.bbox = bbox
        self.confidence = confidence
        self.track_id = track_id
        self.foot_point = calculate_foot_point(bbox)


class TemporalPersistenceTracker:
    """
    Applies temporal persistence filtering and clearance hysteresis to eliminate noisy triggers.
    Tracks breach status per zone.
    """

    def __init__(
        self,
        zones: List[RestrictedZone],
        persistence_threshold_frames: int = 3,
        clearance_dwell_frames: int = 5,
        confidence_threshold: float = 0.55,
        simulation: bool = False,
    ):
        self.zones = {z.zone_id: z for z in zones}
        self.persistence_threshold = persistence_threshold_frames
        self.clearance_dwell = clearance_dwell_frames
        self.confidence_threshold = confidence_threshold
        self.simulation = simulation

        # State per zone:
        # 'breach_count': consecutive frames inside
        # 'clear_count': consecutive frames outside after breach
        # 'active_incident_id': Optional[str]
        # 'active_since': Optional[float]
        self._zone_states: Dict[str, Dict[str, Any]] = {}
        for zid in self.zones.keys():
            self._zone_states[zid] = {
                "breach_count": 0,
                "clear_count": 0,
                "active_incident_id": None,
                "active_since": None,
                "best_target": None,
            }

    def process_frame_detections(
        self, detections: List[DetectionTarget], frame_index: int = 0
    ) -> List[SafetyEvent]:
        """
        Evaluate all detections against all zones. Return any generated SafetyEvent objects.
        """
        generated_events: List[SafetyEvent] = []

        # Filter valid person detections by confidence threshold
        valid_targets = [d for d in detections if d.confidence >= self.confidence_threshold]

        for zone_id, zone in self.zones.items():
            state = self._zone_states[zone_id]

            # Find all targets whose foot point is inside this zone
            intruders = [t for t in valid_targets if zone.contains_point(t.foot_point)]

            if intruders:
                # Target is inside the zone
                state["breach_count"] += 1
                state["clear_count"] = 0
                # Select intruder with highest confidence
                intruders.sort(key=lambda t: t.confidence, reverse=True)
                best_intruder = intruders[0]
                state["best_target"] = best_intruder

                # Check if persistence threshold reached
                if state["breach_count"] >= self.persistence_threshold:
                    if state["active_incident_id"] is None:
                        # Transition to ACTIVE_INCIDENT -> Generate restricted_zone_entry
                        incident_id = f"INC-{int(time.time()*1000)}-{zone_id[:8]}"
                        state["active_incident_id"] = incident_id
                        state["active_since"] = time.time()

                        event = SafetyEvent.create_entry_event(
                            event_id=incident_id,
                            zone_id=zone_id,
                            confidence=best_intruder.confidence,
                            foot_point=best_intruder.foot_point,
                            bounding_box=best_intruder.bbox,
                            simulation=self.simulation,
                            source=EventSource.SIMULATION if self.simulation else EventSource.PIPEGEN,
                        )
                        logger.warning(
                            f"[ZoneDecider] BREACH CONFIRMED in '{zone_id}'! "
                            f"Foot: {best_intruder.foot_point}, Conf: {best_intruder.confidence:.2f}"
                        )
                        generated_events.append(event)
                    else:
                        # Incident is already active -> Suppress duplicate entry events
                        logger.debug(
                            f"[ZoneDecider] Incident {state['active_incident_id']} in '{zone_id}' still active (Frame {frame_index})."
                        )
            else:
                # No valid intruders inside this zone in this frame
                state["breach_count"] = 0

                if state["active_incident_id"] is not None:
                    # An incident was active, now checking clearance dwell
                    state["clear_count"] += 1
                    if state["clear_count"] >= self.clearance_dwell:
                        # Zone confirmed clear -> Generate restricted_zone_clear
                        clear_event_id = f"CLR-{int(time.time()*1000)}-{zone_id[:8]}"
                        old_incident_id = state["active_incident_id"]

                        event = SafetyEvent.create_clear_event(
                            event_id=clear_event_id,
                            zone_id=zone_id,
                            simulation=self.simulation,
                            source=EventSource.SIMULATION if self.simulation else EventSource.PIPEGEN,
                        )
                        logger.info(
                            f"[ZoneDecider] Zone '{zone_id}' CLEARED after incident {old_incident_id}."
                        )
                        state["active_incident_id"] = None
                        state["active_since"] = None
                        state["clear_count"] = 0
                        state["best_target"] = None
                        generated_events.append(event)

        return generated_events

    def get_zone_state(self, zone_id: str) -> Optional[Dict[str, Any]]:
        return self._zone_states.get(zone_id)
