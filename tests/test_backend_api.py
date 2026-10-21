"""
Unit and integration tests for FastAPI backend server endpoints:
- System status & detailed health
- Restricted zone definitions
- Simulated worker movement & persistence triggers
- Incursion breach & clearance flows
- Manual firmware operator reset
- FreeRTOS telemetry & UART serial logs
- Event history querying & filtering
- Active alert acknowledgement
- Industrial analytics & timing budget
- Frame-level AI perception inference
"""

import pytest
import asyncio
from backend.server import (
    app,
    get_system_status,
    get_detailed_health,
    get_zones,
    simulate_worker_movement,
    trigger_incursion,
    reset_firmware,
    get_telemetry,
    get_uart_logs,
    get_safety_events,
    get_safety_alerts,
    acknowledge_alert,
    get_safety_analytics,
    get_sample_video_info,
    PositionUpdate,
    IncursionTrigger,
    AlertAckRequest,
    firmware_emulator,
)


@pytest.mark.asyncio
async def test_api_status_operational():
    status = await get_system_status()
    assert status["status"] == "OPERATIONAL"
    assert status["system"] == "SafeGuard AI — Physical AI Safety Sentinel"
    assert status["bonuses"]["closed_loop"] is True
    assert status["zones_count"] >= 1
    assert "uptime_sec" in status["firmware"]


@pytest.mark.asyncio
async def test_api_detailed_health():
    health = await get_detailed_health()
    assert health["overall_status"] == "HEALTHY"
    assert "backend_api" in health["subsystems"]
    assert "perception_engine" in health["subsystems"]
    assert "firmware_subsystem" in health["subsystems"]
    assert health["timing_budget"]["budget_status"] == "PASS"
    assert health["timing_budget"]["total_latency_ms"] < 150.0


@pytest.mark.asyncio
async def test_api_zones_retrieval():
    zones_resp = await get_zones()
    assert "zones" in zones_resp
    assert len(zones_resp["zones"]) > 0
    zone0 = zones_resp["zones"][0]
    assert "zone_id" in zone0
    assert "vertices" in zone0
    assert len(zone0["vertices"]) >= 3


@pytest.mark.asyncio
async def test_api_simulate_move_outside():
    # Coords outside restricted zone (safe corridor)
    pos = PositionUpdate(x=150.0, y=150.0, actor_id="worker-test", confidence=0.95)
    res = await simulate_worker_movement(pos)
    assert res["worker"]["x"] == 150.0
    assert res["inside_zone"] is False


@pytest.mark.asyncio
async def test_api_incursion_breach_and_clear():
    # 1. Trigger breach
    breach_trig = IncursionTrigger(scenario="breach", actor_id="worker-breach-test")
    res_breach = await trigger_incursion(breach_trig)
    assert res_breach["inside_zone"] is True
    assert res_breach["firmware_state"] == "STATE_ALARM"
    assert res_breach["red_led"] is True
    assert res_breach["buzzer_active"] is True

    # 2. Check alerts endpoint
    alerts_resp = await get_safety_alerts(active_only=True)
    assert alerts_resp["active_count"] >= 1
    active_alert = alerts_resp["alerts"][0]
    alert_id = active_alert["alert_id"]

    # 3. Acknowledge alert
    ack_req = AlertAckRequest(acknowledged_by="Test Operator", note="Inspected and acknowledged")
    ack_resp = await acknowledge_alert(alert_id, ack_req)
    assert ack_resp["status"] == "ALERT_ACKNOWLEDGED"
    assert ack_resp["alert"]["acknowledged"] is True

    # 4. Trigger safe clearance
    clear_trig = IncursionTrigger(scenario="clear", actor_id="worker-breach-test")
    res_clear = await trigger_incursion(clear_trig)
    assert res_clear["inside_zone"] is False

    # 5. Reset firmware
    reset_resp = await reset_firmware()
    assert reset_resp["status"] == "RESET_SUCCESSFUL"
    assert reset_resp["current_state"] == "STATE_NORMAL"
    assert reset_resp["red_led"] is False
    assert reset_resp["buzzer"] is False


@pytest.mark.asyncio
async def test_api_telemetry_and_logs():
    telem = await get_telemetry()
    assert "device_id" in telem
    assert telem["is_simulated"] is True
    assert telem["physical_connected"] is False
    assert "free_heap_bytes" in telem

    logs_resp = await get_uart_logs(limit=10)
    assert "logs" in logs_resp
    assert isinstance(logs_resp["logs"], list)


@pytest.mark.asyncio
async def test_api_events_and_analytics():
    events_resp = await get_safety_events(limit=20)
    assert "events" in events_resp
    assert isinstance(events_resp["events"], list)

    analytics_resp = await get_safety_analytics()
    assert "summary" in analytics_resp
    assert "severity_distribution" in analytics_resp
    assert "time_series" in analytics_resp
    assert analytics_resp["summary"]["average_latency_ms"] > 0


@pytest.mark.asyncio
async def test_api_sample_video_info():
    info = await get_sample_video_info()
    assert "exists" in info
    assert info["exists"] is True
    assert info["total_frames"] > 0
    assert "resolution" in info
