/**
 * Navigation and active view route identifiers for the SafeGuard AI Control Station
 */

export type NavigationTab =
  | 'overview'       // Mission control overview dashboard
  | 'monitoring'     // Spatial floor plan & real AI video/webcam perception sentinel
  | 'alerts'         // Active & historical safety alerts with acknowledgement
  | 'analytics'      // Trend metrics, charts, severity distribution
  | 'devices'        // ESP32 telemetry, hardware status, UART terminal
  | 'events'         // Complete safety event history table with protocol inspection
  | 'health'         // Granular subsystem health & latency budget breakdown
  | 'protocol';      // Protocol Schema v1.0 & FirmGen RTM matrix
