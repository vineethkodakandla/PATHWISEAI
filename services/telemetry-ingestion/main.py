#!/usr/bin/env python3
"""
Telemetry Ingestion Service — Entry Point

Three collection modes (set via COLLECTOR_MODE env var):

  synthetic (default)
    Generates statistically realistic but fully synthetic telemetry.
    No external dependencies.  Good for unit/integration testing.

  probe
    Starts 4 local TCP echo servers (network_emulator.py), each with a
    distinct WAN link profile (fiber / broadband / satellite / 5G).
    Measures actual TCP round-trip times using time.perf_counter().
    Reads /proc/net/dev for real kernel interface bandwidth counters.
    THIS IS THE REAL-TIME DEMO MODE.

  live
    Polls real network devices via SNMP (requires pysnmp and reachable
    devices).  Set DEVICE_INVENTORY=devices.json with your device list.
"""

import asyncio
import json
import logging
import os
from pathlib import Path

import redis.asyncio as redis
from collector import TelemetryCollector

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO")),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("telemetry-ingestion")

# Default device inventory used in synthetic/live modes
DEFAULT_DEVICES = [
    {"ip": "10.0.1.1", "community": "public", "link_id": "fiber-primary"},
    {"ip": "10.0.1.2", "community": "public", "link_id": "broadband-secondary"},
    {"ip": "10.0.1.3", "community": "public", "link_id": "satellite-backup"},
    {"ip": "10.0.1.4", "community": "public", "link_id": "5g-mobile"},
]


def load_device_inventory() -> list[dict]:
    """Load device inventory from file or fall back to defaults."""
    inventory_path = os.getenv("DEVICE_INVENTORY", "devices.json")
    if Path(inventory_path).exists():
        with open(inventory_path) as f:
            return json.load(f)
    return DEFAULT_DEVICES


async def _register_links(redis_url: str, link_ids: list[str]):
    """Register active link IDs in Redis so all services discover them."""
    r = redis.from_url(redis_url)
    for lid in link_ids:
        await r.sadd("active_links", lid)
    await r.aclose()
    logger.info(f"Registered {len(link_ids)} active links: {link_ids}")


# ---------------------------------------------------------------------------
# Mode: probe  (real-time TCP measurements)
# ---------------------------------------------------------------------------

async def run_probe_mode(redis_url: str, poll_interval: float):
    """
    Launch the network emulator + TCP probe collector.

    The emulator creates 4 local echo servers; the prober measures actual
    TCP RTTs and publishes TelemetryPoints to Redis in real time.
    """
    from network_emulator import LINK_PROFILES, NetworkEmulator
    from probe_collector import ProbeCollector

    link_ids = [p["link_id"] for p in LINK_PROFILES]
    await _register_links(redis_url, link_ids)

    emulator = NetworkEmulator(LINK_PROFILES)
    await emulator.start()

    probe = ProbeCollector(redis_url=redis_url, poll_interval=poll_interval)

    logger.info("Running in PROBE mode — real TCP measurements to local echo servers")
    await asyncio.gather(
        probe.run(),
        emulator.run_brownout_scheduler(),
    )


# ---------------------------------------------------------------------------
# Mode: synthetic  (default, no external deps)
# ---------------------------------------------------------------------------

async def run_synthetic_mode(redis_url: str, poll_interval: float):
    devices = load_device_inventory()
    logger.info(f"Loaded {len(devices)} devices for polling")
    await _register_links(redis_url, [d.get("link_id", d["ip"]) for d in devices])

    collector = TelemetryCollector(redis_url=redis_url, poll_interval=poll_interval)
    logger.info("Running in SYNTHETIC mode")
    await collector.run(devices)


# ---------------------------------------------------------------------------
# Mode: live  (real SNMP — requires devices and pysnmp)
# ---------------------------------------------------------------------------

async def run_live_mode(redis_url: str, poll_interval: float):
    devices = load_device_inventory()
    logger.info(f"Loaded {len(devices)} devices for SNMP polling")
    await _register_links(redis_url, [d.get("link_id", d["ip"]) for d in devices])

    collector = TelemetryCollector(
        redis_url=redis_url, poll_interval=poll_interval, mode="live"
    )
    logger.info("Running in LIVE mode (SNMP)")
    await collector.run(devices)


# ---------------------------------------------------------------------------
# Entry point
# ---------------------------------------------------------------------------

async def main():
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    poll_interval = float(os.getenv("POLL_INTERVAL", "1.0"))
    mode = os.getenv("COLLECTOR_MODE", "synthetic").lower()

    if mode == "probe":
        await run_probe_mode(redis_url, poll_interval)
    elif mode == "live":
        await run_live_mode(redis_url, poll_interval)
    else:
        await run_synthetic_mode(redis_url, poll_interval)


if __name__ == "__main__":
    asyncio.run(main())
