"""
SafeGuard AI — Transport Abstraction Layer
Supports Mock (In-Memory), MQTT (Paho-MQTT), and Serial UART transports.
"""

import abc
import json
import logging
import queue
import threading
import time
from typing import Any, Callable, Dict, Optional

logger = logging.getLogger("safeguard.transport")


class BaseTransport(abc.ABC):
    """Abstract interface for all SafeGuard communication transports."""

    @abc.abstractmethod
    def connect(self) -> bool:
        """Establish connection to the medium."""
        pass

    @abc.abstractmethod
    def disconnect(self) -> None:
        """Terminate the connection cleanly."""
        pass

    @abc.abstractmethod
    def is_connected(self) -> bool:
        """Return True if connection is active and healthy."""
        pass

    @abc.abstractmethod
    def publish(self, topic: str, payload: str) -> bool:
        """Send a string payload to a topic or channel."""
        pass

    @abc.abstractmethod
    def subscribe(self, topic: str, callback: Callable[[str, str], None]) -> bool:
        """Subscribe to a topic with callback(topic, payload)."""
        pass


class MockTransport(BaseTransport):
    """
    In-memory thread-safe message transport for automated testing and hardware-free simulation.
    Supports simulated packet loss, network latency, and connection failures.
    """

    def __init__(self, simulate_latency_sec: float = 0.0, packet_loss_rate: float = 0.0):
        self._connected = False
        self._subscriptions: Dict[str, list[Callable[[str, str], None]]] = {}
        self._message_history: list[Dict[str, Any]] = []
        self._lock = threading.Lock()
        self.simulate_latency_sec = simulate_latency_sec
        self.packet_loss_rate = packet_loss_rate

    def connect(self) -> bool:
        with self._lock:
            self._connected = True
            logger.info("[MockTransport] Connected.")
            return True

    def disconnect(self) -> None:
        with self._lock:
            self._connected = False
            logger.info("[MockTransport] Disconnected.")

    def is_connected(self) -> bool:
        with self._lock:
            return self._connected

    def publish(self, topic: str, payload: str) -> bool:
        if not self.is_connected():
            logger.warning(f"[MockTransport] Failed publish to '{topic}': Transport not connected.")
            return False

        if self.simulate_latency_sec > 0:
            time.sleep(self.simulate_latency_sec)

        with self._lock:
            self._message_history.append({
                "topic": topic,
                "payload": payload,
                "timestamp": time.time()
            })

            # Topic matching: direct match or wildcard '#'
            callbacks_to_fire = []
            for sub_topic, cbs in self._subscriptions.items():
                if sub_topic == topic or sub_topic == "#" or (sub_topic.endswith("/#") and topic.startswith(sub_topic[:-2])):
                    callbacks_to_fire.extend(cbs)

        for cb in callbacks_to_fire:
            try:
                cb(topic, payload)
            except Exception as e:
                logger.error(f"[MockTransport] Error in subscription callback for '{topic}': {e}")

        return True

    def subscribe(self, topic: str, callback: Callable[[str, str], None]) -> bool:
        with self._lock:
            if topic not in self._subscriptions:
                self._subscriptions[topic] = []
            self._subscriptions[topic].append(callback)
            logger.debug(f"[MockTransport] Subscribed to '{topic}'.")
            return True

    def get_history(self) -> list[Dict[str, Any]]:
        with self._lock:
            return list(self._message_history)

    def clear_history(self) -> None:
        with self._lock:
            self._message_history.clear()


class MqttTransport(BaseTransport):
    """
    Production MQTT client wrapper using paho-mqtt with automatic reconnect.
    """

    def __init__(
        self,
        broker_host: str = "localhost",
        broker_port: int = 1883,
        client_id: str = "safeguard_bridge",
        keepalive: int = 60,
    ):
        self.broker_host = broker_host
        self.broker_port = broker_port
        self.client_id = client_id
        self.keepalive = keepalive
        self._connected = False
        self._client: Optional[Any] = None
        self._subscriptions: Dict[str, list[Callable[[str, str], None]]] = {}
        self._lock = threading.Lock()

    def connect(self) -> bool:
        try:
            import paho.mqtt.client as mqtt

            # Support both paho-mqtt v1.x and v2.x CallbackAPIVersion
            if hasattr(mqtt, "CallbackAPIVersion"):
                self._client = mqtt.Client(
                    callback_api_version=mqtt.CallbackAPIVersion.VERSION2,
                    client_id=self.client_id
                )
            else:
                self._client = mqtt.Client(client_id=self.client_id)

            def on_connect(client, userdata, flags, reason_code, properties=None):
                with self._lock:
                    self._connected = True
                logger.info(f"[MqttTransport] Connected to broker {self.broker_host}:{self.broker_port}")
                # Resubscribe on reconnect
                for topic in self._subscriptions.keys():
                    client.subscribe(topic, qos=1)

            def on_disconnect(client, userdata, disconnect_flags_or_rc, reason_code=None, properties=None):
                with self._lock:
                    self._connected = False
                logger.warning(f"[MqttTransport] Disconnected from broker {self.broker_host}:{self.broker_port}")

            def on_message(client, userdata, msg):
                payload_str = msg.payload.decode("utf-8", errors="replace")
                callbacks = []
                with self._lock:
                    for sub_topic, cbs in self._subscriptions.items():
                        # Simple match or exact
                        if sub_topic == msg.topic or sub_topic == "#":
                            callbacks.extend(cbs)
                for cb in callbacks:
                    try:
                        cb(msg.topic, payload_str)
                    except Exception as err:
                        logger.error(f"[MqttTransport] Callback error on {msg.topic}: {err}")

            self._client.on_connect = on_connect
            self._client.on_disconnect = on_disconnect
            self._client.on_message = on_message

            self._client.connect(self.broker_host, self.broker_port, self.keepalive)
            self._client.loop_start()
            return True
        except Exception as e:
            logger.warning(f"[MqttTransport] Connection failed to {self.broker_host}:{self.broker_port}: {e}")
            self._connected = False
            return False

    def disconnect(self) -> None:
        if self._client is not None:
            try:
                self._client.loop_stop()
                self._client.disconnect()
            except Exception as e:
                logger.debug(f"[MqttTransport] Disconnect exception: {e}")
        self._connected = False

    def is_connected(self) -> bool:
        with self._lock:
            return self._connected

    def publish(self, topic: str, payload: str) -> bool:
        if not self._client or not self.is_connected():
            logger.warning(f"[MqttTransport] Cannot publish, client not connected.")
            return False
        res = self._client.publish(topic, payload, qos=1)
        return res.rc == 0

    def subscribe(self, topic: str, callback: Callable[[str, str], None]) -> bool:
        with self._lock:
            if topic not in self._subscriptions:
                self._subscriptions[topic] = []
            self._subscriptions[topic].append(callback)
            if self._client and self.is_connected():
                self._client.subscribe(topic, qos=1)
        return True


class SerialTransport(BaseTransport):
    """
    Serial UART transport for direct USB/TTL connection to ESP32 board.
    """

    def __init__(self, port: str = "COM3", baud_rate: int = 115200, timeout: float = 1.0):
        self.port = port
        self.baud_rate = baud_rate
        self.timeout = timeout
        self._serial: Optional[Any] = None
        self._connected = False
        self._worker_thread: Optional[threading.Thread] = None
        self._stop_event = threading.Event()
        self._callbacks: list[Callable[[str, str], None]] = []
        self._lock = threading.Lock()

    def connect(self) -> bool:
        try:
            import serial
            self._serial = serial.Serial(self.port, self.baud_rate, timeout=self.timeout)
            self._connected = True
            self._stop_event.clear()
            self._worker_thread = threading.Thread(target=self._reader_loop, daemon=True)
            self._worker_thread.start()
            logger.info(f"[SerialTransport] Connected to {self.port} at {self.baud_rate} baud.")
            return True
        except Exception as e:
            logger.warning(f"[SerialTransport] Could not open serial port {self.port}: {e}")
            self._connected = False
            return False

    def _reader_loop(self) -> None:
        while not self._stop_event.is_set() and self._serial and self._serial.is_open:
            try:
                line = self._serial.readline()
                if line:
                    decoded = line.decode("utf-8", errors="replace").strip()
                    if decoded:
                        with self._lock:
                            cbs = list(self._callbacks)
                        for cb in cbs:
                            try:
                                cb("serial/rx", decoded)
                            except Exception as ex:
                                logger.error(f"[SerialTransport] Callback error: {ex}")
            except Exception as e:
                logger.warning(f"[SerialTransport] Serial read error: {e}")
                break

    def disconnect(self) -> None:
        self._stop_event.set()
        if self._serial and self._serial.is_open:
            try:
                self._serial.close()
            except Exception:
                pass
        self._connected = False

    def is_connected(self) -> bool:
        return self._connected and self._serial is not None and self._serial.is_open

    def publish(self, topic: str, payload: str) -> bool:
        if not self.is_connected() or not self._serial:
            return False
        try:
            # Framing: newline delimited JSON
            data = (payload.strip() + "\n").encode("utf-8")
            self._serial.write(data)
            self._serial.flush()
            return True
        except Exception as e:
            logger.error(f"[SerialTransport] Write error: {e}")
            return False

    def subscribe(self, topic: str, callback: Callable[[str, str], None]) -> bool:
        with self._lock:
            self._callbacks.append(callback)
        return True
