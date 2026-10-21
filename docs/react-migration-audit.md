# SafeGuard AI — React Frontend Migration Audit & Gap Analysis

**Project:** SafeGuard AI — Physical AI Safety Sentinel  
**Team:** Byte Hustlers (Team Code: 69949982)  
**Date:** 2026-10-18  
**Author:** Full-Stack & Physical AI Engineering Team  

---

## 1. Executive Summary

This document establishes the baseline audit for migrating SafeGuard AI from its initial Streamlit demonstration interface (`dashboard/app.py`) to an enterprise-grade, high-performance React + TypeScript control station (`frontend/`), fully integrated with the FastAPI backend, PipeGen perception engine (YOLOv8 + foot-point geometry), and FirmGen ESP32 firmware twin.

---

## 2. Current Architecture Inventory

### 2.1 Streamlit Interface (`dashboard/app.py`)
- **Technology:** Streamlit (Python) running at `http://localhost:8501`.
- **Key Features:**
  1. *Video File Upload & CCTV Inspector*: Accepts video files or uses built-in `data/sample_factory_cctv.mp4`; executes live YOLOv8n person detection; computes foot contact point $P = ((x_1+x_2)/2, y_2)$; applies 3-frame persistence filter against `configs/zones.json`; annotates frames with OpenCV; plays audio beep via `winsound`; logs events.
  2. *Interactive Factory Floor Digital Twin*: 2D canvas (720x1280) rendering hazard zones, worker coordinate sliders ($X \in [100, 1180]$, $Y \in [100, 680]$), and instant breach/clear buttons.
  3. *Live Laptop Webcam Sentinel*: Captures webcam stream via `cv2.VideoCapture(0)`, checks worker foot point against camera zone polygon, triggers warnings.
  4. *Telemetry & Actuator Status*: Displays Red Beacon LED (GPIO 21/2) and Piezo Buzzer (GPIO 18/4) states.
  5. *Event Log Table*: Renders recent `SafetyEvent` records.

### 2.2 Existing Prototype Frontend (`frontend/`)
- **Technology:** React 19, Vite 8, TailwindCSS 3.4, Lucide React (JavaScript `.jsx`, not TypeScript).
- **Existing Components:**
  - `Header.jsx`: Top navigation, FSM status badge, actuator states, audio toggle, reset button, WebSocket indicator.
  - `FloorPlanCanvas.jsx`: Interactive SVG floor map with drag-and-drop worker avatar, zone rendering, breach triggers.
  - `VideoSentinel.jsx`: Mock canvas animation (`Math.sin` trajectory) rather than real backend YOLOv8 inference.
  - `UartConsole.jsx`: Diagnostic telemetry gauges (heap, uptime, duplicates, total events) and UART terminal log list.
  - `ProtocolInspector.jsx`: Displays JSON schema payload and FirmGen RTM requirements table.
  - `utils/audio.js`: Web Audio API 2.4 kHz piezo buzzer synthesizer.
- **Identified Gaps in Existing Frontend:**
  - Lacks TypeScript (`tsconfig.json`, typed interfaces for all API payloads and states).
  - Lacks comprehensive views: Overview Dashboard, Safety Alerts list/detail/ack, Analytics charts, Dedicated Event History, System Health monitor.
  - VideoSentinel lacks real AI inference communication with the backend.
  - Hardcoded API base URLs (`http://localhost:8000`) without centralized environment variable support (`VITE_API_BASE_URL`).

### 2.3 Backend Microservice (`backend/server.py`)
- **Technology:** FastAPI, Uvicorn, WebSockets, Pydantic v2.
- **Existing Endpoints:**
  - `GET /api/status`: Overall system health and firmware stats.
  - `GET /api/zones`: Configured restricted hazard polygon vertices.
  - `POST /api/simulate/move`: Worker position update, foot-point check, persistence filter, firmware ring buffer ingestion.
  - `POST /api/simulate/incursion`: Preset breach and clear triggers.
  - `POST /api/firmware/reset`: Manual operator reset command (REQ-007).
  - `GET /api/telemetry`: FreeRTOS telemetry metrics (REQ-009).
  - `GET /api/logs`: Recent UART serial logs (REQ-006).
  - `POST /api/upload/video`: File upload endpoint saving to `data/uploads/`.
  - `WebSocket /ws`: Bi-directional real-time telemetry streaming and operator commands.
- **Identified Gaps in Backend for Full React Parity:**
  - No `GET /api/events` endpoint to query historical events with filtering/pagination.
  - No `GET /api/alerts` / `POST /api/alerts/{id}/ack` endpoints to manage active and acknowledged safety alerts.
  - No `GET /api/analytics` endpoint for safety trends, severity distributions, and detection metrics.
  - No `POST /api/inference/frame` endpoint for real-time edge AI inference on webcam/uploaded frames via YOLOv8n.
  - No `GET /api/health` granular endpoint checking all 5 subsystems (Backend, YOLO Inference, Firmware Twin, Event Bridge, Persistence Filter).

### 2.4 Perception Engine (`perception/`)
- **Technology:** YOLOv8n (Ultralytics PyTorch/TensorRT), OpenCV, NumPy.
- **Pipeline Stages:**
  - Stage 1: `pipegen_requirements.json` (Declarative requirements).
  - Stage 2: `pipeline_ir.json` (DeepStream GStreamer DAG).
  - Stage 3: `model_config.json` (TensorRT execution engine settings).
  - Stage 4: `compile_pipeline.sh` (Compiler execution script).
  - Stage 5: `run_pipeline.py` & `zone_filter.py` (Live inference runner & spatial math).
- **Core Math:** Foot-point ground contact calculation $P_{\text{contact}} = \left(\frac{x_{\min} + x_{\max}}{2}, y_{\max}\right)$ with Jordan curve theorem ray-casting against polygonal hazard zones.

### 2.5 FirmGen Embedded Firmware & Twin (`firmware/`, `simulation/`)
- **Firmware Source:** ESP-IDF v5.5 FreeRTOS C project (`firmware/main/`). Zero dynamic allocation (`malloc`/`free`), 16-entry ring buffer deduplication, safe boot state (0V), GPIO 2 (Red Beacon LED), GPIO 4 (Piezo Buzzer).
- **Firmware Status:** FROZEN & SYNTHESIZED. The physical ESP32 board is currently disconnected on the macOS host; the host environment is running the bit-exact Python firmware twin (`simulation/firmware_emulator.py`).
- **Traceability:** 10/10 requirements formally verified in `firmware/firmgen-traceability.md`.

### 2.6 Test Suite (`tests/`)
- **Status:** 27/27 passing tests (`pytest tests/ -v`).
- **Coverage:** Event schema validation, zone polygon geometry, deduplication ring buffer, mock transport, firmware emulator state machine, closed-loop integration.

---

## 3. Existing API Contracts & Schemas

### 3.1 Protocol Schema v1.0 (`bridge/event_schema.py`)
```json
{
  "schema_version": "1.0",
  "event_id": "evt-uuid-v4",
  "timestamp": 1729112930.542,
  "event_type": "restricted_zone_entry | restricted_zone_clear | firmware_telemetry",
  "source": "pipegen_edge_vision_sentinel",
  "actor_id": "worker-01",
  "zone_id": "zone-machine-danger-1",
  "confidence": 0.954,
  "foot_point": [500.0, 450.0],
  "bounding_box": [472.5, 340.0, 527.5, 450.0],
  "persistence_frames": 3
}
```

### 3.2 WebSocket Telemetry Payload (`/ws`)
```json
{
  "type": "TELEMETRY_UPDATE",
  "timestamp": 1729112930.542,
  "firmware": {
    "device_id": "ESP32-SAFEGUARD-PRO",
    "state": "STATE_NORMAL | STATE_ALARM",
    "red_led": false,
    "buzzer": false,
    "uptime_sec": 42.0,
    "free_heap_bytes": 294812,
    "total_events": 5,
    "duplicate_dropped": 0,
    "malformed_rejected": 0,
    "active_incident_id": null
  },
  "worker": { "x": 200.0, "y": 200.0, "actor_id": "worker-01" },
  "latest_event": { ... },
  "recent_logs": [ ... ]
}
```

---

## 4. Features Directly Reusable

1. **Polygon Geometry & Foot-Point Math:** `perception/zone_filter.py` and `configs/zones.json`.
2. **Pydantic Protocol Schema Models:** `bridge/event_schema.py`.
3. **Firmware Digital Twin & Ring Buffer Logic:** `simulation/firmware_emulator.py`.
4. **Interactive SVG 2D Canvas Concept:** `frontend/src/components/FloorPlanCanvas.jsx` (will be typed and enhanced).
5. **Web Audio API 2.4 kHz Buzzer Synthesizer:** `frontend/src/utils/audio.js` (reliable browser-native acoustic feedback without requiring OS-level `winsound`).
6. **UART Terminal Streamer:** `frontend/src/components/UartConsole.jsx`.

---

## 5. Migration Strategy & Proposed React Architecture

### 5.1 Technology Selection
- **Core:** React 19 + TypeScript (strict typing for all safety payloads).
- **Bundler:** Vite 8 (fast HMR, optimized production build).
- **Styling:** Tailwind CSS 3.4 + custom industrial dark aesthetic design system.
- **Icons:** Lucide React.
- **Charts / Visualizations:** SVG-based responsive industrial charts & SVG spatial twin.
- **Networking:** Native Fetch API with typed service layer + resilient WebSocket manager with auto-reconnection and exponential backoff.
- **Audio:** Browser Web Audio API acoustic alarm synthesizer (2.4 kHz piezo square wave with envelope).

### 5.2 Proposed Directory Structure
```
frontend/
├── index.html
├── package.json
├── tsconfig.json
├── tsconfig.node.json
├── vite.config.ts
├── tailwind.config.js
├── postcss.config.js
├── src/
│   ├── main.tsx
│   ├── App.tsx
│   ├── index.css
│   ├── types/
│   │   ├── api.ts              # API request & response types
│   │   ├── schema.ts           # Protocol Schema v1.0 TypeScript definitions
│   │   ├── telemetry.ts        # Firmware telemetry & actuator types
│   │   └── navigation.ts       # View/route navigation types
│   ├── services/
│   │   ├── api.ts              # Centralized typed HTTP client
│   │   ├── websocket.ts        # Resilient WebSocket streaming service
│   │   └── inference.ts        # AI perception & frame inference service
│   ├── components/
│   │   ├── common/             # Badges, Cards, Modal, StatBox, StatusPill
│   │   ├── shell/              # SidebarNav, TopHeader, SystemStatusBar
│   │   ├── dashboard/          # OverviewMetrics, RecentActivityList, SeverityChart
│   │   ├── monitoring/         # FloorPlanCanvas, VisionSentinel, LiveControls
│   │   ├── alerts/             # AlertTable, AlertDetailModal, SeverityFilter
│   │   ├── analytics/          # TrendLineChart, CategoryBarChart, EventMetrics
│   │   ├── devices/            # DeviceTelemetryCard, Esp32StatusBanner, UartTerminal
│   │   ├── events/             # EventHistoryTable, PayloadInspectorModal
│   │   └── health/             # SubsystemHealthGrid, LatencyBudgetCard
│   └── utils/
│       ├── audio.ts            # Web Audio API 2.4kHz piezo synthesizer
│       └── formatters.ts       # Timestamps, byte formatters, coordinate formatters
```

---

## 6. Backend Enhancements Required

To support the complete enterprise dashboard requirements without breaking any existing contracts:
1. **Event Storage & Query Endpoint:** Store incoming `SafetyEvent` records in an in-memory sliding buffer (capacity 500) and expose `GET /api/events` with query filters (`limit`, `event_type`, `zone_id`).
2. **Alert Management Endpoint:** Expose `GET /api/alerts` (active unacknowledged breaches) and `POST /api/alerts/{event_id}/ack`.
3. **Analytics Metrics Endpoint:** Expose `GET /api/analytics` returning event counts grouped by hour, severity distributions, and false-positive suppression statistics.
4. **Real AI Frame Inference Endpoint:** Expose `POST /api/inference/frame` accepting a camera frame (base64 or multipart), executing `yolov8n.pt`, running foot-point geometry through `persistence_tracker`, and returning detections with real bounding boxes and breach triggers.
5. **System Health Endpoint:** Expose `GET /api/health` providing live readiness checks for Backend API, YOLO Inference Engine, ESP32 Firmware Twin, Event Bridge, and Zone Configs.

---

## 7. Migration Risks & Mitigations

| Risk | Impact | Mitigation Strategy |
| :--- | :---: | :--- |
| **Breaking existing 27/27 test suite** | Critical | Preserve all existing functions, models, and classes in `backend/`, `bridge/`, `perception/`, and `simulation/`. Add new endpoints additively. |
| **Physical ESP32 hardware absence** | Medium | Maintain the bit-exact Python firmware twin (`ESP32FirmwareEmulator`). Explicitly label all hardware status indicators as "Simulated Digital Twin (Physical Disconnected)" to prevent false claims. |
| **Webcam browser permissions** | Low | Provide graceful fallback to sample factory CCTV video (`data/sample_factory_cctv.mp4`) and synthetic spatial test trajectories. |
| **Streamlit regression during development** | High | Keep `dashboard/app.py` untouched and fully functional during the React implementation. Only switch default instructions once React is verified. |

---

## 8. Definition of Verification

- [x] Baseline test suite run: 27/27 passing tests verified.
- [x] Repository and files inspected.
- [ ] TypeScript conversion and component implementation.
- [ ] Backend route additions with validation.
- [ ] End-to-end integration verified (move/incursion $\rightarrow$ YOLO/persistence $\rightarrow$ event bridge $\rightarrow$ firmware emulator $\rightarrow$ WebSocket $\rightarrow$ React UI).
- [ ] Production build (`npm run build`) passing with zero TypeScript or lint errors.
