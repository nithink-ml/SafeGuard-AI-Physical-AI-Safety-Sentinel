# SafeGuard AI — Communication Protocol Specification

**Specification Version**: 1.0.0  
**Transport Bindings**: MQTT v3.1.1 / v5.0, Serial UART (115200 8N1), In-Memory Simulation Bus

---

## 1. Message Format & Schema

All messages exchanged between the SafeGuard AI Perception Pipeline, Event Bridge, and Embedded Firmware use UTF-8 encoded JSON.

### 1.1 Restricted Zone Entry Event (`restricted_zone_entry`)

Dispatched when a person's foot point enters a restricted polygon and persists beyond the configured confirmation threshold.

```json
{
  "schema_version": "1.0",
  "event_id": "INC-20261016-0001",
  "event_type": "restricted_zone_entry",
  "person_detected": true,
  "zone_id": "zone-machine-danger-1",
  "confidence": 0.932,
  "timestamp": "2026-10-16T17:30:00.124Z",
  "source": "pipegen",
  "simulation": false,
  "foot_point": {
    "x": 642,
    "y": 789
  },
  "bounding_box": {
    "x_min": 580,
    "y_min": 320,
    "x_max": 704,
    "y_max": 789
  }
}
```

### 1.2 Restricted Zone Clearance Event (`restricted_zone_clear`)

Dispatched when an active breach condition clears (no person detected inside zone for clearance window).

```json
{
  "schema_version": "1.0",
  "event_id": "CLR-20261016-0001",
  "event_type": "restricted_zone_clear",
  "person_detected": false,
  "zone_id": "zone-machine-danger-1",
  "confidence": 0.0,
  "timestamp": "2026-10-16T17:30:15.820Z",
  "source": "pipegen",
  "simulation": false
}
```

### 1.3 Heartbeat & Liveness Message (`heartbeat`)

Dispatched every 1000ms by the Event Bridge to verify communication health.

```json
{
  "schema_version": "1.0",
  "event_id": "HBT-20261016-1044",
  "event_type": "heartbeat",
  "timestamp": "2026-10-16T17:30:01.000Z",
  "source": "event_bridge"
}
```

### 1.4 Firmware Live Intelligence Telemetry Packet (`telemetry`)

Emitted by the ESP32 firmware back to the bridge / supervisor over UART or MQTT.

```json
{
  "schema_version": "1.0",
  "device_id": "ESP32-SAFEGUARD-01",
  "state": "STATE_ALARM",
  "uptime_sec": 3482,
  "free_heap_bytes": 194320,
  "active_incident_id": "INC-20261016-0001",
  "actuators": {
    "red_led": true,
    "buzzer_active": true
  },
  "stats": {
    "total_events_received": 42,
    "duplicate_events_dropped": 5,
    "malformed_events_rejected": 1
  }
}
```

---

## 2. Validation Constraints

| Field | Type | Required | Valid Values / Constraints |
| :--- | :--- | :---: | :--- |
| `schema_version` | String | Yes | Must be `"1.0"` |
| `event_id` | String | Yes | Non-empty alphanumeric string (max 64 chars) |
| `event_type` | String | Yes | `"restricted_zone_entry"`, `"restricted_zone_clear"`, `"heartbeat"`, `"manual_reset"` |
| `person_detected`| Boolean| Yes | `true` or `false` |
| `zone_id` | String | Yes (for zone events) | Non-empty string matching configured zones |
| `confidence` | Float | Yes (for zone events) | `0.0 <= confidence <= 1.0` |
| `timestamp` | String | Yes | ISO-8601 string format |
| `source` | String | Yes | `"pipegen"`, `"simulation"`, `"manual"`, `"event_bridge"` |
| `simulation` | Boolean| Yes | Explicit flag declaring whether event is synthetic |

---

## 3. Physical Framing & Delivery

### 3.1 MQTT Binding
- **Broker Port**: 1883 (TCP plaintext) or 8883 (TLS MQTTS).
- **Default Topics**:
  - Events: `safeguard/zones/{zone_id}/events`
  - All Events: `safeguard/events`
  - Telemetry: `safeguard/telemetry/{device_id}`
- **QoS**: QoS 1 (At least once delivery) with automatic client retry.

### 3.2 Serial UART Binding
- **Baud Rate**: 115200 bps
- **Framing**: 8 Data bits, No parity, 1 Stop bit (8N1).
- **Delimiter**: Messages are single-line strings terminated by `\n` (`0x0A`).
- **Maximum Line Buffer**: 1024 bytes per line. Lines exceeding 1024 bytes are flushed and logged as framing errors.
