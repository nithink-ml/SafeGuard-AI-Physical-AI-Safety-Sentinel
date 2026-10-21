/**
 * Protocol Schema v1.0 Types for SafeGuard AI
 * Defines strict binary and JSON serialization formats between PipeGen vision and FirmGen ESP32 firmware.
 */

export type EventType =
  | 'restricted_zone_entry'
  | 'restricted_zone_clear'
  | 'heartbeat'
  | 'manual_reset';

export type EventSource = 'pipegen' | 'simulation' | 'manual' | 'event_bridge';

export interface FootPoint {
  x: number;
  y: number;
}

export interface BoundingBox {
  x_min: number;
  y_min: number;
  x_max: number;
  y_max: number;
}

export interface SafetyEvent {
  schema_version: '1.0';
  event_id: string;
  event_type: EventType;
  person_detected: boolean;
  zone_id: string;
  confidence: number;
  timestamp: string; // ISO-8601 UTC
  source: EventSource;
  simulation: boolean;
  foot_point?: FootPoint | [number, number] | null;
  bounding_box?: BoundingBox | [number, number, number, number] | null;
  actor_id?: string;
  persistence_frames?: number;
}

export interface ZoneDefinition {
  zone_id: string;
  zone_name: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  color_bgr: [number, number, number];
  polygon: [number, number][];
  vertices?: [number, number][];
  description: string;
}
