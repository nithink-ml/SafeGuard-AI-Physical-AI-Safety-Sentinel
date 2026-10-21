# SafeGuard AI — Physical Hardware Bring-Up Checklist

This checklist provides the concise, verified sequence for validating SafeGuard AI on physical edge AI hardware (NVIDIA Jetson / dGPU) and embedded microcontrollers (ESP32).

---

## Phase A: Embedded Microcontroller Bring-Up (ESP32)

- [ ] **Step A1: Physical Hardware Connection**
  - Plug ESP32 into USB port.
  - Verify device appears in `[System.IO.Ports.SerialPort]::GetPortNames()` (e.g. `COM3` or `/dev/ttyUSB0`).
- [ ] **Step A2: Pin Wiring Check**
  - Connect Red LED + 330Ω resistor to GPIO 21.
  - Connect Piezo Buzzer to GPIO 18.
  - Verify grounds are tied to ESP32 GND.
- [ ] **Step A3: Build & Flash Firmware**
  ```bash
  cd firmware
  idf.py -p COM3 flash monitor
  ```
- [ ] **Step A4: Boot State Inspection (REQ-001)**
  - Confirm Red LED and Buzzer measure 0.0V (logic LOW).
  - Confirm console output: `[REQ-001] Safe Initial State Verified: Warning outputs LOW (0V).`
- [ ] **Step A5: Serial Injection Test (REQ-002, REQ-003, REQ-005, REQ-007)**
  - Inject test entry payload:
    ```json
    {"schema_version":"1.0","event_id":"TEST-01","event_type":"restricted_zone_entry","person_detected":true,"zone_id":"zone-A","confidence":0.95,"timestamp":"2026-10-16T17:30:00Z","source":"manual","simulation":false}
    ```
  - Verify Red LED lights up and Buzzer sounds within 5ms.
  - Re-inject identical `TEST-01` payload; verify `[REQ-005] Duplicate event 'TEST-01' ignored`.
  - Inject clearance event; verify Red LED and Buzzer turn off immediately.

---

## Phase B: Edge AI Perception Pipeline Bring-Up (NVIDIA Jetson / Linux)

- [ ] **Step B1: Camera Inspection**
  - Connect USB webcam or CSI camera.
  - Verify with `v4l2-ctl --list-devices`.
- [ ] **Step B2: Validate PipeGen Intermediate Representation (IR)**
  ```bash
  pipegen validate --ir perception/pipeline_ir.json --strict
  ```
- [ ] **Step B3: Compile TensorRT Engine**
  ```bash
  chmod +x perception/compile_pipeline.sh
  ./perception/compile_pipeline.sh
  ```
- [ ] **Step B4: Run Live Pipeline with Hardware Serial Egress**
  ```bash
  python perception/run_pipeline.py --source 0 --transport serial
  ```
- [ ] **Step B5: Full Closed-Loop Validation**
  - Walk into camera field of view.
  - Step foot into restricted zone rectangle.
  - Confirm physical Red LED and Buzzer trigger on the breadboard!
  - Step back out; confirm physical actuators silence.
