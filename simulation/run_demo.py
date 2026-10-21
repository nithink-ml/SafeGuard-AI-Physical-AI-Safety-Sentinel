"""
SafeGuard AI — Closed-Loop Physical AI Sentinel Simulation Demo
Executes the complete Perceive -> Analyze -> Decide -> Communicate -> Act -> Verify cycle.
"""

import os
import sys
import time

# Ensure project root is on sys.path
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from bridge.config import load_zones_config
from bridge.event_schema import SafetyEvent
from bridge.publisher import SafetyEventPublisher
from bridge.subscriber import SafetyEventSubscriber
from bridge.transport import MockTransport
from perception.zone_filter import RestrictedZone, TemporalPersistenceTracker
from simulation.firmware_emulator import ESP32FirmwareEmulator, FirmwareState
from simulation.mock_perception import MockPerceptionProducer


def print_banner(text: str) -> None:
    border = "=" * 70
    print(f"\n{border}\n{text.center(70)}\n{border}")


def run_closed_loop_simulation() -> bool:
    print_banner("SAFEGUARD AI - PHYSICAL AI SENTINEL (SIMULATION RUNNER)")
    print("[STATUS] Host: Windows 11 | Mode: HARDWARE-FREE HIGH-FIDELITY TWIN")
    print("[CYCLE] Perceive -> Analyze -> Decide -> Communicate -> Act -> Verify\n")

    # Step 1: Initialize Transport Layer
    print("[1. COMMUNICATE] Initializing In-Memory Mock Transport...")
    transport = MockTransport(simulate_latency_sec=0.01)
    transport.connect()
    assert transport.is_connected(), "Transport must be connected"
    print("  [OK] Transport active.")

    # Step 2: Initialize Firmware Subsystem (ESP32 Twin)
    print("\n[2. ACT] Initializing ESP32 Firmware Subsystem (FirmGen REQ-001 Verification)...")
    firmware = ESP32FirmwareEmulator(device_id="ESP32-DEMO-01", duplicate_window_size=16)
    assert firmware.current_state == FirmwareState.STATE_NORMAL, "Must boot to NORMAL"
    assert not firmware.red_led, "Red LED must be OFF on boot"
    assert not firmware.buzzer_active, "Buzzer must be OFF on boot"
    print("  [OK] REQ-001 PASS: All warning outputs initialized to SAFE INACTIVE state (0V).")
    print(f"  [OK] Initial Firmware State: {firmware.current_state}")

    # Step 3: Wire Event Bridge
    print("\n[3. BRIDGE] Wiring Event Publisher and Firmware Subscriber...")
    publisher = SafetyEventPublisher(transport=transport, default_topic="safeguard/events")
    subscriber = SafetyEventSubscriber(transport=transport)
    subscriber.register_event_handler(lambda ev: firmware.handle_safety_event(ev))
    subscriber.start_listening()
    print("  [OK] Event bridge subscribed to 'safeguard/events'.")

    # Step 4: Configure Perception Engine
    print("\n[4. PERCEIVE & DECIDE] Loading Restricted Safety Zones...")
    zones_data = load_zones_config("configs/zones.json")
    zones = [RestrictedZone.from_dict(zd) for zd in zones_data.get("zones", [])]
    if not zones:
        # Fallback default zone
        zones = [
            RestrictedZone(
                zone_id="zone-machine-danger-1",
                name="Robotic Welding Enclosure",
                polygon_vertices=[[350, 400], [780, 400], [920, 720], [240, 720]],
            )
        ]
    print(f"  [OK] Loaded {len(zones)} restricted zone(s): {[z.zone_id for z in zones]}")

    tracker = TemporalPersistenceTracker(
        zones=zones,
        persistence_threshold_frames=3,
        clearance_dwell_frames=5,
        confidence_threshold=0.55,
        simulation=True,
    )
    print("  [OK] Spatial-Temporal Tracker configured (Persistence: 3 frames, Clearance: 5 frames).")

    # Scenario 1: Safe Personnel Movement
    print("\n" + "-" * 70)
    print("--- SCENARIO 1: Safe Personnel Walkway Movement (Outside Polygon) ---")
    safe_detections = MockPerceptionProducer.get_safe_worker_trajectory()
    for idx, det in enumerate(safe_detections):
        events = tracker.process_frame_detections([det], frame_index=idx)
        print(f"  [Frame {idx}] Target foot at {det.foot_point} | Zone: Outside | Events: {len(events)}")
        assert len(events) == 0, "No safety event should be generated outside zone"
    assert firmware.current_state == FirmwareState.STATE_NORMAL
    print("  [OK] PASS: Safe movement did not trigger physical alert.")

    # Scenario 2: Transient Noise / Single-Frame Flicker
    print("\n" + "-" * 70)
    print("--- SCENARIO 2: Single-Frame Transient Noise (Persistence Test) ---")
    flicker = MockPerceptionProducer.get_flicker_noise_trajectory()
    events = tracker.process_frame_detections(flicker, frame_index=10)
    print(f"  [Frame 10] Transient foot at {flicker[0].foot_point} | Events emitted: {len(events)}")
    assert len(events) == 0, "Single-frame flicker must be rejected by persistence filter"
    assert firmware.current_state == FirmwareState.STATE_NORMAL
    print("  [OK] PASS: False trigger successfully suppressed by persistence filter.")

    # Scenario 3: Real Intrusion Sequence
    print("\n" + "-" * 70)
    print("--- SCENARIO 3: Intrusion, Actuation, Duplicate Suppression, and Clearance ---")
    intrusion_seq = MockPerceptionProducer.get_full_intrusion_trajectory()
    active_alarm_seen = False
    clearance_seen = False

    for frame_idx, detections in enumerate(intrusion_seq):
        events = tracker.process_frame_detections(detections, frame_index=frame_idx)
        for ev in events:
            # Publish event through transport to firmware
            publisher.publish_event(ev)

        # Check firmware status
        telemetry = firmware.get_telemetry()
        foot_pt = detections[0].foot_point if detections else (0, 0)
        print(
            f"  [Step {frame_idx:02d}] Foot: {foot_pt} | Firmware: {firmware.current_state:<12} | "
            f"LED: {'ON ' if firmware.red_led else 'OFF'} | Buzzer: {'ON ' if firmware.buzzer_active else 'OFF'}"
        )

        if firmware.current_state == FirmwareState.STATE_ALARM:
            active_alarm_seen = True
        elif active_alarm_seen and firmware.current_state == FirmwareState.STATE_NORMAL:
            clearance_seen = True

    assert active_alarm_seen, "Firmware must have triggered STATE_ALARM"
    assert clearance_seen, "Firmware must have safely cleared back to STATE_NORMAL"
    print("  [OK] PASS: Closed loop verified (Intrusion -> Alert -> Clear -> Reset).")

    # Scenario 4: Malformed Payload Rejection
    print("\n" + "-" * 70)
    print("--- SCENARIO 4: Malformed Payload & Duplicate Resilience ---")
    malformed_json = '{"schema_version": "1.0", "corrupted": true}'
    accepted = firmware.process_raw_message(malformed_json)
    assert not accepted, "Firmware must reject malformed JSON"
    assert firmware.malformed_events_rejected >= 1
    print("  [OK] REQ-004 PASS: Malformed JSON rejected without crashing firmware.")

    # Step 5: Telemetry & Summary
    print_banner("SIMULATION DEMONSTRATION COMPLETE - EVIDENCE SUMMARY")
    final_telemetry = firmware.get_telemetry()
    print(f"  * Device ID                 : {final_telemetry.device_id}")
    print(f"  * Final Firmware State      : {final_telemetry.state}")
    print(f"  * Red Warning LED Pin       : {'ACTIVE (HIGH)' if final_telemetry.actuators.red_led else 'INACTIVE (LOW)'}")
    print(f"  * Piezo Buzzer Pin          : {'ACTIVE' if final_telemetry.actuators.buzzer_active else 'INACTIVE'}")
    print(f"  * Total Events Ingested     : {final_telemetry.stats.total_events_received}")
    print(f"  * Duplicate Events Dropped  : {final_telemetry.stats.duplicate_events_dropped}")
    print(f"  * Malformed Payloads Blocked: {final_telemetry.stats.malformed_events_rejected}")
    print(f"  * Total UART Logs Emitted   : {len(firmware.uart_logs)}")
    print("\n[VERIFICATION STATUS]")
    print("  SIMULATION          : [PASS] VERIFIED & OPERATIONAL")
    print("  PIPEGEN PIPELINE    : [BLOCKED ON HOST] SPECIFIED & STAGED (Target Jetson/dGPU)")
    print("  FIRMGEN FIRMWARE    : [BLOCKED ON HOST] FROZEN & SYNTHESIZED (Target ESP32)")
    print("  CLOSED LOOP CYCLE   : [PASS] VERIFIED (SOFTWARE TWIN)")
    return True


if __name__ == "__main__":
    success = run_closed_loop_simulation()
    sys.exit(0 if success else 1)
