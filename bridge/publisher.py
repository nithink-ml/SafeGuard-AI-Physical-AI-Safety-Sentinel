"""
SafeGuard AI — Safety Event Publisher
Validates, serializes, and publishes safety events across the configured transport layer.
"""

import json
import logging
import time
from typing import Optional
from bridge.event_schema import SafetyEvent
from bridge.transport import BaseTransport

logger = logging.getLogger("safeguard.publisher")


class SafetyEventPublisher:
    """
    High-level publisher that validates, deduplicates, and transmits safety events.
    """

    def __init__(
        self,
        transport: BaseTransport,
        default_topic: str = "safeguard/events",
        min_interval_sec: float = 0.05,
    ):
        self.transport = transport
        self.default_topic = default_topic
        self.min_interval_sec = min_interval_sec
        self._last_event_id: Optional[str] = None
        self._last_publish_time: float = 0.0
        self.published_count: int = 0
        self.rejected_count: int = 0

    def publish_event(self, event: SafetyEvent, topic: Optional[str] = None) -> bool:
        """
        Validate, serialize, and transmit a SafetyEvent instance.
        """
        target_topic = topic or self.default_topic

        # Validate minimum time interval for identical event IDs (rate limiting)
        now = time.time()
        if (
            self._last_event_id == event.event_id
            and (now - self._last_publish_time) < self.min_interval_sec
        ):
            logger.debug(f"[Publisher] Throttling rapid duplicate event_id: {event.event_id}")
            self.rejected_count += 1
            return False

        try:
            # Serialize using Pydantic JSON mode
            payload_json = event.model_dump_json()
        except Exception as e:
            logger.error(f"[Publisher] Serialization error for event {event.event_id}: {e}")
            self.rejected_count += 1
            return False

        if not self.transport.is_connected():
            logger.warning(f"[Publisher] Transport disconnected. Cannot deliver event {event.event_id}.")
            self.rejected_count += 1
            return False

        success = self.transport.publish(target_topic, payload_json)
        if success:
            self._last_event_id = event.event_id
            self._last_publish_time = now
            self.published_count += 1
            logger.info(
                f"[Publisher] Published {event.event_type.value} [ID: {event.event_id}] "
                f"Zone: {event.zone_id} Conf: {event.confidence:.2f} -> '{target_topic}'"
            )
            return True
        else:
            logger.error(f"[Publisher] Transport failed to send payload to '{target_topic}'")
            self.rejected_count += 1
            return False
