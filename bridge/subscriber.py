"""
SafeGuard AI — Safety Event Subscriber
Listens to the transport medium, validates incoming JSON payloads, and invokes callbacks.
"""

import json
import logging
from typing import Callable, Optional
from pydantic import ValidationError
from bridge.event_schema import FirmwareTelemetry, SafetyEvent
from bridge.transport import BaseTransport

logger = logging.getLogger("safeguard.subscriber")


class SafetyEventSubscriber:
    """
    Subscribes to safety event channels and deserializes valid SafetyEvent or Telemetry objects.
    """

    def __init__(self, transport: BaseTransport):
        self.transport = transport
        self.event_callbacks: list[Callable[[SafetyEvent], None]] = []
        self.telemetry_callbacks: list[Callable[[FirmwareTelemetry], None]] = []
        self.malformed_count: int = 0
        self.valid_count: int = 0

    def register_event_handler(self, callback: Callable[[SafetyEvent], None]) -> None:
        self.event_callbacks.append(callback)

    def register_telemetry_handler(self, callback: Callable[[FirmwareTelemetry], None]) -> None:
        self.telemetry_callbacks.append(callback)

    def start_listening(self, event_topic: str = "safeguard/events", telemetry_topic: str = "safeguard/telemetry/+") -> bool:
        """
        Subscribe to event and telemetry topics.
        """
        self.transport.subscribe(event_topic, self._on_raw_message)
        self.transport.subscribe(telemetry_topic, self._on_telemetry_message)
        # Also subscribe to zone-specific wildcard if supported
        self.transport.subscribe("safeguard/zones/+/events", self._on_raw_message)
        logger.info(f"[Subscriber] Listening on '{event_topic}' and '{telemetry_topic}'")
        return True

    def _on_raw_message(self, topic: str, payload: str) -> None:
        try:
            event = SafetyEvent.model_validate_json(payload)
            self.valid_count += 1
            for cb in self.event_callbacks:
                try:
                    cb(event)
                except Exception as cb_err:
                    logger.error(f"[Subscriber] Error in event callback: {cb_err}")
        except ValidationError as val_err:
            self.malformed_count += 1
            logger.warning(f"[Subscriber] Rejected malformed safety event on '{topic}': {val_err}")
        except Exception as e:
            self.malformed_count += 1
            logger.warning(f"[Subscriber] Unexpected payload parse error on '{topic}': {e}")

    def _on_telemetry_message(self, topic: str, payload: str) -> None:
        try:
            telemetry = FirmwareTelemetry.model_validate_json(payload)
            for cb in self.telemetry_callbacks:
                try:
                    cb(telemetry)
                except Exception as cb_err:
                    logger.error(f"[Subscriber] Error in telemetry callback: {cb_err}")
        except Exception as e:
            logger.debug(f"[Subscriber] Telemetry parse notice on '{topic}': {e}")
