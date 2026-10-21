"""
Tests for Transport Layer & Broker Availability (Requirements 10, 11)
"""

import pytest
from bridge.transport import MockTransport, MqttTransport


def test_mock_transport_connect_and_deliver():
    """Verify mock transport connects, publishes, and delivers to subscribers."""
    transport = MockTransport()
    assert transport.connect() is True
    assert transport.is_connected() is True

    received_messages = []
    transport.subscribe("safeguard/events", lambda topic, payload: received_messages.append(payload))

    success = transport.publish("safeguard/events", '{"test": 123}')
    assert success is True
    assert len(received_messages) == 1
    assert received_messages[0] == '{"test": 123}'

    transport.disconnect()
    assert transport.is_connected() is False
    # Publishing while disconnected must fail gracefully
    assert transport.publish("safeguard/events", '{"test": 456}') is False


def test_mock_transport_wildcard_subscription():
    """Verify '#' wildcard topic subscription."""
    transport = MockTransport()
    transport.connect()

    received = []
    transport.subscribe("#", lambda topic, payload: received.append((topic, payload)))

    transport.publish("safeguard/zones/zone-1/events", "zone-1-payload")
    transport.publish("safeguard/telemetry/ESP32", "esp-payload")

    assert len(received) == 2
    assert received[0][0] == "safeguard/zones/zone-1/events"
    assert received[1][0] == "safeguard/telemetry/ESP32"


def test_mqtt_broker_unavailable_handling():
    """Test 10: MQTT broker unavailable handled gracefully without crash."""
    # Attempting to connect to an unused localhost port (e.g. 59999)
    mqtt = MqttTransport(broker_host="127.0.0.1", broker_port=59999, client_id="test_fail")
    connected = mqtt.connect()
    # Should return False or handle disconnection cleanly without uncaught exception
    assert mqtt.is_connected() is False

    # Attempt to publish while disconnected should return False
    pub_result = mqtt.publish("safeguard/events", '{"sample": "data"}')
    assert pub_result is False
    mqtt.disconnect()


def test_transport_reconnection_logic():
    """Test 11: Transport reconnection simulation."""
    transport = MockTransport()
    transport.connect()
    assert transport.is_connected() is True

    # Simulate link drop
    transport.disconnect()
    assert transport.is_connected() is False

    # Reconnect
    reconnected = transport.connect()
    assert reconnected is True
    assert transport.is_connected() is True
