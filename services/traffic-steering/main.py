#!/usr/bin/env python3
"""
Traffic Steering Service — Entry Point

Runs the steering engine loop: reads predictions from Redis,
decides if traffic should be shifted, and executes via SDN controller.
"""

import asyncio
import logging
import os

from flow_manager import FlowManager

logging.basicConfig(
    level=getattr(logging, os.getenv("LOG_LEVEL", "INFO")),
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("traffic-steering")


async def main():
    redis_url = os.getenv("REDIS_URL", "redis://localhost:6379")
    odl_url = os.getenv("ODL_URL", "http://localhost:8181")
    sdn_type = os.getenv("SDN_TYPE", "opendaylight")

    logger.info(f"Starting traffic-steering service (SDN: {sdn_type})")
    manager = FlowManager(redis_url=redis_url, sdn_type=sdn_type, sdn_url=odl_url)
    await asyncio.gather(manager.run(), manager.listen_for_requests())


if __name__ == "__main__":
    asyncio.run(main())
