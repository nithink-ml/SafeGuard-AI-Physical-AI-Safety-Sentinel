# SafeGuard AI — Testing & Verification Guide

This guide details how to execute, validate, and reproduce the automated unit tests, closed-loop simulation suite, and hardware acceptance procedures.

---

## 1. Automated Test Suite Execution

SafeGuard AI uses `pytest` for automated test execution. The suite contains 27 comprehensive tests verifying all 16 mandatory testing criteria.

### 1.1 Run All Tests
```bash
python -m pytest tests/ -v
```

### 1.2 Run Specific Verification Subsystems
```bash
# Event Schema & Protocol Constraints (REQ-002, REQ-004)
python -m pytest tests/test_event_schema.py -v

# Spatial Polygon & Foot-Point Logic (Geometry & Persistence)
python -m pytest tests/test_zone_logic.py -v

# Duplicate Event Suppression Ring Buffer (REQ-005)
python -m pytest tests/test_duplicate_events.py -v

# Transport & Broker Failure Handling (REQ-008)
python -m pytest tests/test_transport.py -v

# Firmware State Machine & Watchdog (REQ-001, REQ-003, REQ-007, REQ-010)
python -m pytest tests/test_firmware_emulator.py -v

# End-to-End Closed Loop Integration
python -m pytest tests/test_integration.py -v
```

---

## 2. Interactive Closed-Loop Simulation Demo

To execute the end-to-end command-line demonstration showing the complete Perceive -> Analyze -> Decide -> Communicate -> Act -> Verify cycle:

```bash
python simulation/run_demo.py
```

Expected output:
- [OK] Transport active
- [OK] REQ-001 PASS: All warning outputs initialized to SAFE INACTIVE state
- [OK] Spatial-Temporal Tracker configured
- [OK] SCENARIO 1: Safe Personnel Walkway Movement (Outside Polygon) -> PASS
- [OK] SCENARIO 2: Single-Frame Transient Noise (Persistence Test) -> PASS
- [OK] SCENARIO 3: Intrusion, Actuation, Duplicate Suppression, and Clearance -> PASS
- [OK] SCENARIO 4: Malformed Payload Rejection -> PASS
- [OK] All 27 assertions verified

---

## 3. Streamlit Demonstration Dashboard

To launch the interactive web dashboard with real-time hazard map rendering and virtual physical twin:

```bash
streamlit run dashboard/app.py
```

Features:
- Step through all 4 test scenarios interactively.
- Observe real-time virtual Red Beacon LED and Piezo Buzzer states.
- Inspect JSON telemetry and raw UART console log output.
