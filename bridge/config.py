"""
SafeGuard AI — Configuration Loader
Loads and validates application settings from JSON configuration files.
"""

import json
import os
from typing import Any, Dict


def load_app_config(config_path: str = "configs/app-config.example.json") -> Dict[str, Any]:
    """Load configuration dictionary with fallback defaults."""
    if not os.path.exists(config_path):
        # Fallback default configuration
        return {
            "system": {"system_name": "SafeGuard AI Physical Sentinel", "deployment_mode": "simulation"},
            "perception": {
                "confidence_threshold": 0.55,
                "persistence_frames": 3,
                "clearance_dwell_frames": 5,
                "zones_config_path": "configs/zones.json"
            },
            "bridge": {
                "transport_type": "mock",
                "mqtt": {"broker_host": "localhost", "broker_port": 1883}
            },
            "firmware": {
                "duplicate_window_size": 16,
                "alarm_timeout_sec": 30
            }
        }

    with open(config_path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_zones_config(zones_path: str = "configs/zones.json") -> Dict[str, Any]:
    """Load zones definition file."""
    if not os.path.exists(zones_path):
        return {"version": "1.0", "zones": []}
    with open(zones_path, "r", encoding="utf-8") as f:
        return json.load(f)
