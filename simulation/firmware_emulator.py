"""
SafeGuard AI — ESP32 Firmware Emulator
Faithfully emulates FirmGen-synthesized ESP32 firmware (REQ-001 to REQ-010).
"""

from collections import deque
import json
import logging
import time
from typing import Any, Deque, Dict, List, Optional
from bridge.event_schema import ActuatorState, EventType, FirmwareTelemetry, SafetyEvent, TelemetryStats

logger = logging.getLogger("safeguard.emulator")


class FirmwareState:
    STATE_INIT = "STATE_INIT"
    STATE_NORMAL = "STATE_NORMAL"
    STATE_ALARM = "STATE_ALARM"
    STATE_COMM_ERROR = "STATE_COMM_ERROR"


class ESP32FirmwareEmulator:
    """
    High-fidelity Python twin of the ESP-IDF v5.5 C firmware.
    Enforces identical state transitions, memory ring buffer, and pin logic.
    """

    def __init__(
        self,
        device_id: str = "ESP32-SAFEGUARD-01",
        duplicate_window_size: int = 16,
        alarm_timeout_sec: float = 30.0,
    ):
        self.device_id = device_id
        self.duplicate_window_size = duplicate_window_size
        self.alarm_timeout_sec = alarm_timeout_sec

        # REQ-001: Safe initial state
        self.current_state = FirmwareState.STATE_INIT
        self.red_led: bool = False
        self.buzzer_active: bool = False

        # REQ-005: Circular ring buffer for duplicate suppression
        self._processed_event_ids: Deque[str] = deque(maxlen=duplicate_window_size)

        # Operational metrics
        self.boot_time = time.time()
        self.last_packet_time = time.time()
        self.active_incident_id: Optional[str] = None
        self.total_events_received: int = 0
        self.duplicate_events_dropped: int = 0
        self.malformed_events_rejected: int = 0

        # UART log output buffer
        self.uart_logs: List[str] = []

        # Boot firmware to NORMAL
        self._boot_sequence()

    def _boot_sequence(self) -> None:
        """Execute deterministic boot sequence matching app_main()."""
        self._log_uart("[BOOT] ESP32 initializing... Core 0/1 active.")
        # REQ-001: Assert safe outputs (all LOW)
        self.red_led = False
        self.buzzer_active = False
        self._processed_event_ids.clear()
        self.current_state = FirmwareState.STATE_NORMAL
        self._log_uart("[BOOT] REQ-001 Verified: Actuator pins initialized to SAFE INACTIVE state (0V).")
        self._log_uart(f"[STATE_TRANSITION] {FirmwareState.STATE_INIT} -> {FirmwareState.STATE_NORMAL} (Boot Complete)")

    def _log_uart(self, message: str) -> None:
        """Simulate UART 115200 baud serial output (REQ-006)."""
        elapsed = time.time() - self.boot_time
        formatted = f"[UART:{self.device_id} +{elapsed:07.3f}s] {message}"
        self.uart_logs.append(formatted)
        logger.info(formatted)

    def process_raw_message(self, raw_json_str: str) -> bool:
        """
        Ingest and parse a raw JSON payload string (REQ-002, REQ-004).
        """
        self.last_packet_time = time.time()
        self.total_events_received += 1

        try:
            # Check maximum buffer size (1024 bytes)
            if len(raw_json_str.encode("utf-8")) > 1024:
                self.malformed_events_rejected += 1
                self._log_uart(f"[ERR_PAYLOAD_TOO_LARGE] Buffer size exceeded 1024 bytes.")
                return False

            parsed = json.loads(raw_json_str)
        except Exception as e:
            # REQ-004: Reject malformed messages
            self.malformed_events_rejected += 1
            self._log_uart(f"[ERR_MALFORMED_JSON] Parsing failed: {e}")
            return False

        # Validate mandatory schema fields
        mandatory = ["schema_version", "event_id", "event_type"]
        if not all(k in parsed for k in mandatory):
            self.malformed_events_rejected += 1
            self._log_uart(f"[ERR_SCHEMA_INVALID] Missing mandatory protocol fields.")
            return False

        if parsed.get("schema_version") != "1.0":
            self.malformed_events_rejected += 1
            self._log_uart(f"[ERR_UNSUPPORTED_VERSION] Got {parsed.get('schema_version')}, expected '1.0'.")
            return False

        # Handle Heartbeat
        if parsed.get("event_type") == EventType.HEARTBEAT.value:
            self._log_uart(f"[HEARTBEAT] Received pulse {parsed.get('event_id')}.")
            return True

        # Handle Manual Reset
        if parsed.get("event_type") == EventType.MANUAL_RESET.value:
            self.reset_alarm("Manual Operator Reset Command")
            return True

        # Validate Safety Event payload
        try:
            event = SafetyEvent.model_validate(parsed)
        except Exception as ve:
            self.malformed_events_rejected += 1
            self._log_uart(f"[ERR_FIELD_VALIDATION] Failed model constraints: {ve}")
            return False

        return self.handle_safety_event(event)

    def handle_safety_event(self, event: SafetyEvent) -> bool:
        """
        Handle a typed SafetyEvent (REQ-003, REQ-005, REQ-007).
        """
        self.last_packet_time = time.time()

        # REQ-005: Duplicate event suppression
        if event.event_id in self._processed_event_ids:
            self.duplicate_events_dropped += 1
            self._log_uart(
                f"[WARN_DUPLICATE_IGNORED] Event ID '{event.event_id}' already processed in ring buffer. Discarding."
            )
            return False

        # Push to duplicate suppression ring buffer
        self._processed_event_ids.append(event.event_id)

        # Process by event type
        if event.event_type == EventType.RESTRICTED_ZONE_ENTRY:
            return self._trigger_alarm(event)
        elif event.event_type == EventType.RESTRICTED_ZONE_CLEAR:
            return self._handle_zone_clear(event)
        else:
            self.malformed_events_rejected += 1
            self._log_uart(f"[ERR_UNKNOWN_TYPE] Unhandled event type: {event.event_type}")
            return False

    def _trigger_alarm(self, event: SafetyEvent) -> bool:
        """REQ-003: Activate warning outputs on valid restricted zone entry."""
        old_state = self.current_state
        self.current_state = FirmwareState.STATE_ALARM
        self.active_incident_id = event.event_id

        # Assert physical warning outputs
        self.red_led = True
        self.buzzer_active = True

        # Acoustic feedback simulation (Piezo Buzzer 2.4kHz)
        try:
            import winsound
            winsound.Beep(2400, 120)
        except Exception:
            pass

        # REQ-006: Log state transition
        self._log_uart(
            f"[STATE_TRANSITION] {old_state} -> {FirmwareState.STATE_ALARM} "
            f"(Incident: {event.event_id}, Zone: '{event.zone_id}', Conf: {event.confidence:.2f})"
        )
        self._log_uart(f"[ACTUATOR_ALERT] Red Beacon LED asserted HIGH (GPIO 21). Buzzer active (GPIO 18).")
        return True

    def _handle_zone_clear(self, event: SafetyEvent) -> bool:
        """REQ-007: Event-clear policy."""
        old_state = self.current_state
        self.current_state = FirmwareState.STATE_NORMAL
        cleared_incident = self.active_incident_id
        self.active_incident_id = None

        # Deassert physical warning outputs
        self.red_led = False
        self.buzzer_active = False

        self._log_uart(
            f"[STATE_TRANSITION] {old_state} -> {FirmwareState.STATE_NORMAL} "
            f"(Clearance Event: {event.event_id}, Cleared Incident: {cleared_incident})"
        )
        self._log_uart(f"[ACTUATOR_CLEAR] Warning actuators deasserted (Safe Normal State).")
        return True

    def reset_alarm(self, reason: str = "Manual Operator Reset") -> None:
        """REQ-007: Manual alarm reset."""
        if self.current_state == FirmwareState.STATE_ALARM:
            old_state = self.current_state
            self.current_state = FirmwareState.STATE_NORMAL
            self.active_incident_id = None
            self.red_led = False
            self.buzzer_active = False
            self._log_uart(
                f"[STATE_TRANSITION] {old_state} -> {FirmwareState.STATE_NORMAL} (Reset Reason: {reason})"
            )

    def check_watchdog_timeout(self) -> bool:
        """REQ-010: Check communication timeout in alarm state."""
        if self.current_state == FirmwareState.STATE_ALARM:
            elapsed = time.time() - self.last_packet_time
            if elapsed >= self.alarm_timeout_sec:
                self._log_uart(
                    f"[WATCHDOG_TIMEOUT] No heartbeat/event for {elapsed:.1f}s. Enforcing safe auto-clear policy."
                )
                self.reset_alarm("Watchdog Safety Timeout")
                return True
        return False

    def get_telemetry(self) -> FirmwareTelemetry:
        """REQ-009: Runtime telemetry output."""
        uptime = int(time.time() - self.boot_time)
        return FirmwareTelemetry(
            schema_version="1.0",
            device_id=self.device_id,
            state=self.current_state,
            uptime_sec=uptime,
            free_heap_bytes=192480,  # Simulated free heap bytes
            active_incident_id=self.active_incident_id,
            actuators=ActuatorState(
                red_led=self.red_led,
                buzzer_active=self.buzzer_active,
            ),
            stats=TelemetryStats(
                total_events_received=self.total_events_received,
                duplicate_events_dropped=self.duplicate_events_dropped,
                malformed_events_rejected=self.malformed_events_rejected,
            ),
        )
