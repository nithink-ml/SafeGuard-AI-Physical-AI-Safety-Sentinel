/**
 * Firmware and Diagnostic Telemetry Types
 * Corresponds to FreeRTOS internal state registers and BARR-C ring buffer status.
 */

export type FirmwareState = 'STATE_INIT' | 'STATE_NORMAL' | 'STATE_ALARM' | 'STATE_CARRIER_DROP';

export interface ActuatorState {
  red_led: boolean;      // GPIO 2
  buzzer_active: boolean; // GPIO 4
}

export interface TelemetryStats {
  total_events_received: number;
  duplicate_events_dropped: number;
  malformed_events_rejected: number;
}

export interface FirmwareTelemetry {
  device_id: string;
  uptime_sec: number;
  free_heap_bytes: number;
  state: FirmwareState;
  stats: TelemetryStats;
  actuators: ActuatorState;
  is_simulated: boolean;
  physical_connected: boolean;
}

export interface WebSocketTelemetryMessage {
  type: 'TELEMETRY_UPDATE' | 'PONG';
  timestamp: number;
  firmware: {
    device_id: string;
    state: FirmwareState;
    red_led: boolean;
    buzzer: boolean;
    uptime_sec: number;
    free_heap_bytes: number;
    total_events: number;
    duplicate_dropped: number;
    malformed_rejected: number;
    active_incident_id: string | null;
    is_simulated: boolean;
    physical_connected: boolean;
  };
  worker: {
    x: number;
    y: number;
    actor_id: string;
  };
  latest_event: any | null;
  recent_logs: string[];
  active_alerts_count?: number;
  total_events_count?: number;
}
