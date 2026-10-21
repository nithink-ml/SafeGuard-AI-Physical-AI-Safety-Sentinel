# SafeGuard AI — Firmware Acceptance Test Matrix

**Document Purpose**: Record formal acceptance criteria, execution setup, observed behavior, and verification evidence for FirmGen firmware requirements (REQ-001 through REQ-010).

---

## Acceptance Testing Log

| Test ID | Req ID | Test Setup | Action Performed | Expected Result | Actual Result | Status | Evidence Location |
| :---: | :---: | :--- | :--- | :--- | :--- | :---: | :--- |
| **FAT-01** | REQ-001 | Firmware emulator twin instantiated | Cold boot execution (`_boot_sequence()`) | Warning outputs (LED, Buzzer) measure LOW (0V). State transitions from INIT to NORMAL. | Actuators set to False; state transitions to STATE_NORMAL. | **PASS** | `tests/test_firmware_emulator.py::test_firmware_safe_initialization` |
| **FAT-02** | REQ-002 | Protocol Schema v1.0 payload | Ingest valid `restricted_zone_entry` JSON via `process_raw_message()` | Parser returns `PARSER_OK`, extracts `event_id`, `zone_id`, `confidence`. | Valid JSON parsed; fields populated; returns True. | **PASS** | `tests/test_event_schema.py::test_valid_entry_event` |
| **FAT-03** | REQ-003 | State = `STATE_NORMAL` | Inject valid breach event with confidence 0.94 | State transitions to `STATE_ALARM`. Red LED pin is asserted HIGH. Buzzer active. | Red LED = True, Buzzer = True, State = STATE_ALARM, Latency < 2ms. | **PASS** | `tests/test_firmware_emulator.py::test_alarm_activation` |
| **FAT-04** | REQ-004 | State = `STATE_NORMAL` | Ingest malformed JSON `{"schema_version": "1.0", broken_json` | Ingestion rejected with error code; state remains NORMAL; zero memory leaks. | Returns False; `malformed_events_rejected` counter incremented to 1; state unaltered. | **PASS** | `tests/test_event_schema.py::test_invalid_json` |
| **FAT-05** | REQ-005 | State = `STATE_ALARM` | Deliver identical `event_id` twice in succession | First delivery accepted; second delivery discarded with duplicate log. | Second delivery returns False; `duplicate_events_dropped` incremented; no alarm refire. | **PASS** | `tests/test_duplicate_events.py::test_duplicate_event_suppression` |
| **FAT-06** | REQ-006 | Active UART listener | Trigger state transition `NORMAL -> ALARM` | Formatted UART string emitted over serial port at 115200 baud. | Log captured: `[UART] [STATE_TRANSITION] STATE_NORMAL -> STATE_ALARM`. | **PASS** | `tests/test_firmware_emulator.py::test_alarm_activation` |
| **FAT-07** | REQ-007 | State = `STATE_ALARM` | Deliver valid `restricted_zone_clear` event | State transitions to `STATE_NORMAL`. Warning outputs deasserted immediately. | Red LED = False, Buzzer = False, State = STATE_NORMAL. | **PASS** | `tests/test_firmware_emulator.py::test_alarm_reset_on_clear_event` |
| **FAT-08** | REQ-008 | Transport streaming | Abruptly disconnect transport link, wait 100ms, reconnect | Tasks continue cycling without deadlock; resumes event handling upon reconnection. | Reconnection successful; event ingestion resumes seamlessly. | **PASS** | `tests/test_transport.py::test_transport_reconnection_logic` |
| **FAT-09** | REQ-009 | FreeRTOS background task | Query `get_telemetry()` after 2 seconds uptime | Emits valid JSON telemetry packet containing uptime, free heap, active state, counters. | Complete telemetry packet generated conforming to `FirmwareTelemetry` schema. | **PASS** | `tests/test_firmware_emulator.py::test_runtime_telemetry_emission` |
| **FAT-10** | REQ-010 | State = `STATE_ALARM` | Cease all communication for > watchdog timeout interval | Watchdog timer triggers fail-safe auto-clear; state resets to NORMAL. | Watchdog expired; alarm auto-cleared; logged over UART. | **PASS** | `tests/test_firmware_emulator.py::test_communication_timeout_watchdog` |

---

## Physical Hardware Acceptance Verification Checklist
When physical hardware is connected:
1. Verify PIN_RED_WARNING_LED on an oscilloscope / DMM: ensure 0.0V at boot.
2. Inject FAT-03 entry payload: measure latency from UART newline to GPIO 21 rising edge (< 5ms).
3. Confirm audible output from piezo buzzer on GPIO 18.
