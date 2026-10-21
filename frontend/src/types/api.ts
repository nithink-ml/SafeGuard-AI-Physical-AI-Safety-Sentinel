/**
 * Typed API interfaces for SafeGuard AI FastAPI backend endpoints
 */

import { FirmwareState, ActuatorState } from './telemetry';
import { SafetyEvent, ZoneDefinition } from './schema';

export interface SystemStatusResponse {
  status: 'OPERATIONAL' | 'DEGRADED' | 'DISCONNECTED';
  system: string;
  version: string;
  track: string;
  tools: {
    perception: string;
    firmware: string;
    standards: string;
  };
  bonuses: {
    closed_loop: boolean;
    live_intelligence: boolean;
  };
  firmware: {
    state: FirmwareState;
    red_led: boolean;
    buzzer_active: boolean;
    uptime_sec: number;
    free_heap_bytes: number;
    total_events: number;
    duplicates_dropped: number;
    is_simulated: boolean;
    physical_connected: boolean;
  };
  zones_count: number;
  total_events: number;
  active_alerts_count: number;
  yolo_ready: boolean;
}

export interface SubsystemHealth {
  status: 'UP' | 'UP_SIMULATED' | 'DEGRADED' | 'DOWN';
  details?: string;
  model?: string;
  classes?: string[];
  target_device?: string;
  spatial_math?: string;
  persistence_filter?: string;
  device_id?: string;
  state?: string;
  physical_hardware?: string;
  ring_buffer_capacity?: number;
  free_heap_bytes?: number;
  watchdog_active?: boolean;
  schema_version?: string;
  serialization?: string;
  buffered_events?: number;
  zones_loaded?: number;
  zones_file?: string;
  latency_ms?: number;
  connections?: number;
}

export interface DetailedHealthResponse {
  timestamp: number;
  overall_status: 'HEALTHY' | 'DEGRADED' | 'UNHEALTHY';
  uptime_sec: number;
  subsystems: {
    backend_api: SubsystemHealth;
    perception_engine: SubsystemHealth;
    firmware_subsystem: SubsystemHealth;
    event_bridge: SubsystemHealth;
    zone_configuration: SubsystemHealth;
  };
  timing_budget: {
    camera_acquisition_ms: number;
    yolo_inference_ms: number;
    spatial_raycast_ms: number;
    temporal_persistence_ms: number;
    schema_serialization_ms: number;
    uart_ingestion_ms: number;
    actuator_response_ms: number;
    total_latency_ms: number;
    budget_limit_ms: number;
    budget_status: 'PASS' | 'FAIL';
  };
}

export interface ZonesResponse {
  zones: ZoneDefinition[];
}

export interface WorkerMovementResponse {
  worker: { x: number; y: number; actor_id: string };
  inside_zone: boolean;
  zone_id: string | null;
  firmware_state: FirmwareState;
  red_led: boolean;
  buzzer_active: boolean;
  alarm_active: boolean;
  event_emitted: any | null;
}

export interface SafetyAlert {
  alert_id: string;
  event_id: string;
  timestamp: string;
  severity: 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO';
  zone_id: string;
  actor_id?: string;
  confidence: number;
  foot_point?: [number, number] | null;
  bounding_box?: [number, number, number, number] | null;
  acknowledged: boolean;
  acknowledged_by?: string | null;
  ack_timestamp?: number | null;
  note?: string | null;
  cleared_timestamp?: string | null;
}

export interface AlertsResponse {
  alerts: SafetyAlert[];
  active_count: number;
  total_count: number;
}

export interface EventsResponse {
  events: SafetyEvent[];
  total_buffered: number;
  returned: number;
}

export interface AnalyticsSummary {
  total_breaches: number;
  total_clearances: number;
  total_events_buffered: number;
  duplicates_suppressed: number;
  active_alerts: number;
  fsm_alarm_active: boolean;
  average_latency_ms: number;
}

export interface AnalyticsTimeSeriesPoint {
  time_label: string;
  breaches: number;
  clearances: number;
  total: number;
}

export interface AnalyticsResponse {
  summary: AnalyticsSummary;
  severity_distribution: {
    critical: number;
    warning: number;
    info: number;
    normal: number;
  };
  time_series: AnalyticsTimeSeriesPoint[];
  zone_distribution: Record<string, number>;
}

export interface FrameDetection {
  bbox: [number, number, number, number];
  confidence: number;
  foot_point: [number, number];
  inside_zone: boolean;
  zone_id?: string | null;
}

export interface FrameInferenceResponse {
  frame_index: number;
  detections: FrameDetection[];
  detections_count: number;
  events_emitted: any[];
  firmware_state: FirmwareState;
  red_led: boolean;
  buzzer_active: boolean;
  latency_ms: number;
}

export interface SampleVideoStepResponse {
  frame_index: number;
  total_frames: number;
  detections: FrameDetection[];
  is_breach: boolean;
  events_emitted: any[];
  latency_ms: number;
  firmware_state: FirmwareState;
  red_led: boolean;
  buzzer_active: boolean;
  image_data: string;
}

export interface SampleVideoInfoResponse {
  exists: boolean;
  path: string;
  file_size_bytes: number;
  total_frames: number;
  fps: number;
  resolution: string;
}

export interface UartLogsResponse {
  logs: string[];
  total_count: number;
}
