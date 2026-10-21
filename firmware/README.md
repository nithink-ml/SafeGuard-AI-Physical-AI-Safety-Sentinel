# SafeGuard AI — Embedded Firmware Subsystem (CraftifAI FirmGen v0.4.1)

This subsystem implements **Track B: FirmGen Embedded Firmware** adhering to formal requirement synthesis, traceability, and acceptance criteria.

---

## 1. FirmGen Workflow & Requirement Traceability

```
[PRD Definition] ──► [FirmGen Ingestion] ──► [Requirement Freeze] ──► [Firmware Generation] ──► [Hardware Validation]
```

- **Formal PRD**: [`firmgen-prd.md`](firmgen-prd.md) & [`../docs/firmware-prd.md`](../docs/firmware-prd.md)
- **Traceability Matrix**: [`firmgen-traceability.md`](firmgen-traceability.md)
- **Target Microcontroller**: Espressif ESP32 / ESP32-S3 (Xtensa Dual-Core 240MHz, 520KB SRAM)
- **Framework**: ESP-IDF v5.5 (Embedded C/C++, FreeRTOS)

---

## 2. Requirements & Verification Summary

| Req ID | Title | Verification Criteria | Status (Twin) | Status (Board) |
| :--- | :--- | :--- | :---: | :---: |
| **REQ-001** | Safe Initial State | Actuators guaranteed LOW (0V) at boot | ✅ PASS | ⏳ BLOCKED (Awaiting board) |
| **REQ-002** | Schema Ingestion | Parses Protocol v1.0 JSON payloads | ✅ PASS | ⏳ BLOCKED (Awaiting board) |
| **REQ-003** | Alarm Actuation | Triggers Red LED & Buzzer on breach | ✅ PASS | ⏳ BLOCKED (Awaiting board) |
| **REQ-004** | Malformed Rejection | Blocks corrupted JSON without crash | ✅ PASS | ⏳ BLOCKED (Awaiting board) |
| **REQ-005** | Duplicate Suppression| 16-entry ring buffer discards dups | ✅ PASS | ⏳ BLOCKED (Awaiting board) |
| **REQ-006** | UART Transition Log | Emits formatted state transition log | ✅ PASS | ⏳ BLOCKED (Awaiting board) |
| **REQ-007** | Clear & Reset Policy | Deasserts alarm on clearance/reset | ✅ PASS | ⏳ BLOCKED (Awaiting board) |
| **REQ-008** | Interruption Recovery| Handles link drops without deadlock | ✅ PASS | ⏳ BLOCKED (Awaiting board) |
| **REQ-009** | Live Telemetry | Emits JSON health telemetry every 1s | ✅ PASS | ⏳ BLOCKED (Awaiting board) |
| **REQ-010** | Watchdog Fail-Safe | 30s auto-clear on communication loss | ✅ PASS | ⏳ BLOCKED (Awaiting board) |

---

## 3. Physical Hardware Wiring Diagram

```
       ESP32 Dev Board
   ┌──────────────────────┐
   │                      │
   │  GPIO 21 (Pin 33) ───┼──► [330Ω Resistor] ──► Red High-Intensity LED ──► GND
   │                      │
   │  GPIO 18 (Pin 30) ───┼──► [2N2222 Transistor] ──► Piezo Buzzer (+5V)
   │                      │
   │  GPIO  0 (BOOT)   ───┼──► [Tactile Button] ──► GND (Manual Reset)
   │                      │
   │  GPIO  1 (TX0)    ───┼──► Host PC USB-UART RX (115200 8N1)
   │  GPIO  3 (RX0)    ───┼──► Host PC USB-UART TX (115200 8N1)
   │  GND              ───┼──► Common Ground Bus
   └──────────────────────┘
```

---

## 4. Hardware Build & Flash Instructions

When an ESP32 board is connected to a workstation running ESP-IDF v5.5:

```bash
# 1. Export ESP-IDF environment variables
. $HOME/esp/esp-idf/export.sh  # Linux / macOS
# OR on Windows ESP-IDF Command Prompt:
# export.bat

# 2. Set target
cd firmware
idf.py set-target esp32

# 3. Build project
idf.py build

# 4. Flash and monitor output
idf.py -p /dev/ttyUSB0 flash monitor  # Replace with COM port on Windows
```
