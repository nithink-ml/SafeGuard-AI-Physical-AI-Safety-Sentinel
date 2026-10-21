# Project Description: SafeGuard AI — Physical AI Safety Sentinel

**Hackathon**: Embedded SF: CraftifAI Physical AI Hackathon  
**Track Chosen**: Suggested Problem Track #1 — Workplace Safety Sentinel  
**Core Technologies**: CraftifAI PipeGen (v0.5.1) + CraftifAI FirmGen (v0.4.1)  
**Bonus Prizes Claimed**:
1. 🎯 **Closed Loop Bonus** (PipeGen Perception $\rightarrow$ Protocol Schema v1.0 $\rightarrow$ FirmGen ESP32 Physical Actuation in real time)
2. 📊 **Live Intelligence Bonus** (Live runtime telemetry, free heap, uptime, and state diagnostics emitted by firmware and visualized live)

---

## 1. Problem Statement & Motivation
In industrial manufacturing plants, automated robotic cells, and heavy logistics facilities, unauthorized entry into hazardous machinery envelopes poses severe risks of injury or death. Traditional safety systems either rely on rigid, expensive physical fences or passive cloud camera feeds that merely record incidents without initiating immediate local deterrence at the hazard perimeter. 

**SafeGuard AI** solves this by establishing an autonomous, real-time Physical AI loop: an intelligent vision sentinel monitors the hazard zone and instantaneously commands an embedded microcontroller to sound physical alarms and flash warning beacons before an accident occurs.

---

## 2. Track A: CraftifAI PipeGen Perception Subsystem
* **Inputs**: Live video files (MP4/AVI), CCTV RTSP streams, or USB/laptop webcams.
* **Pipeline Tasks**: 
  1. DeepStream/TensorRT real-time person detection.
  2. Foot-point contact computation: $P_{contact} = \left(\frac{x_{min} + x_{max}}{2}, y_{max}\right)$ ensuring zero false alarms from shadows or airborne tools.
  3. Shapely arbitrary polygon containment test against user-defined hazard zones.
  4. Temporal persistence filter (requiring $\ge 3$ consecutive frames inside zone before triggering).
* **Models & Precision**: YOLOv8 nano foundation model (`yolov8n`), TensorRT FP16/INT8 precision for ultra-low latency (<20ms per frame).
* **Actionable Output**: Schema v1.0 JSON structured safety payloads (`restricted_zone_entry` and `restricted_zone_clear`) dispatched over MQTT/Serial bus.
* **Specification Artifacts**: `perception/pipeline_ir.json`, `perception/pipegen_requirements.json`, `perception/model_config.json`.

---

## 3. Track B: CraftifAI FirmGen Firmware Subsystem
* **Target Microcontroller**: Espressif ESP32 (Xtensa Dual-Core 240MHz, 520KB SRAM).
* **RTOS & Framework**: ESP-IDF v5.5 (FreeRTOS).
* **Coding Standard**: BARR-C:2018 (Embedded C Safety Standard) with Zero Dynamic Memory Allocation (`malloc`) in the safety-critical path.
* **PRD & Frozen Requirements**: 10 formal requirements categorized into **7 Explicit** and **3 Inferred** constraints (frozen and verified):
  - `REQ-001` (Inferred): Safe initial state (0V on bootloader handoff).
  - `REQ-002` (Explicit): Protocol Schema v1.0 JSON streaming ingestion.
  - `REQ-003` (Explicit): Sub-5ms FSM transition to `STATE_ALARM`, asserting Red Beacon LED (GPIO 2) and Piezo Buzzer (GPIO 4).
  - `REQ-004` (Explicit): Malformed JSON rejection without memory leak.
  - `REQ-005` (Explicit): 16-entry circular ring buffer for duplicate `event_id` suppression.
  - `REQ-006` (Explicit): Timestamped UART state change logging at 115200 baud.
  - `REQ-007` (Explicit): Safe clear and reset policy on `restricted_zone_clear`.
  - `REQ-008` (Explicit): Carrier loss recovery and auto-reconnect.
  - `REQ-009` (Inferred): Periodic runtime telemetry broadcasting every 1000ms.
  - `REQ-010` (Inferred): Communication watchdog timeout fail-safe.
* **FirmGen Artifacts**: `firmware/firmgen-prd.md`, `firmware/firmgen_project.json`, `firmware/firmgen-traceability.md`.

---

## 4. Closed-Loop Integration & Data Flow
1. **Perceive & Analyze**: Edge camera feeds frames into PipeGen inference engine.
2. **Decide**: Foot-point polygon math verifies breach; persistent breaches generate a versioned `restricted_zone_entry` event.
3. **Communicate**: Bridge delivers JSON payload over MQTT / Serial bus.
4. **Act**: ESP32 FirmGen FSM receives packet, checks ring buffer, transitions to `STATE_ALARM`, flashes Red LED, and pulses acoustic buzzer.
5. **Verify**: ESP32 emits FreeRTOS telemetry back to the supervisor dashboard, closing the loop.

---

## 5. Live Intelligence & Diagnostics
A dedicated low-priority FreeRTOS telemetry task (`telemetry.c`) streams board health metrics:
* System Uptime (seconds)
* Free Internal Heap Memory (bytes)
* Active FSM State (`STATE_NORMAL` vs `STATE_ALARM`)
* Total Events Processed & Suppressed Duplicate Counters
These are surfaced live on the supervisor web dashboard alongside UART audit logs.

---

## 6. Verification & Bring-Up Paths
* **Digital Twin / Emulator**: High-fidelity twin (`simulation/firmware_emulator.py`) running identical FSM logic, ring buffer, acoustic audio alarm, and telemetry. Fully validated via 27/27 automated pytest tests.
* **Hardware Bring-Up Ready**: Ready for physical ESP32 flashing via `idf.py -p COMx flash monitor` using the step-by-step checklist in `docs/hardware-bringup-checklist.md`.
