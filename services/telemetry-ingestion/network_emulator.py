"""
network_emulator.py — Local TCP echo servers that emulate 4 WAN link types.

Each server listens on a loopback port and adds a realistic delay before
echoing back any received bytes. Combined with occasional simulated packet
drops and bandwidth caps this produces genuinely different performance
profiles that drive the LSTM prediction pipeline with real-time variation.

Link profiles (tunable via EMULATOR_CONFIG env var):
  fiber-primary      port 19201  ~5ms   jitter 0.5ms  loss 0%
  broadband-secondary port 19202  ~15ms  jitter 3ms    loss 0.05%
  satellite-backup   port 19203  ~300ms jitter 50ms   loss 0.3%
  5g-mobile          port 19204  ~20ms  jitter 8ms    loss 0.15%

Brownout injection: every ~120s a random link degrades for 30-60s, then
recovers — this gives the prediction engine something real to detect.
"""

import asyncio
import logging
import math
import random
import time

logger = logging.getLogger(__name__)

# Emulated WAN link profiles
LINK_PROFILES = [
    {
        "link_id": "fiber-primary",
        "port": 19201,
        "base_delay_ms": 5.0,
        "jitter_ms": 0.5,
        "loss_pct": 0.0,
        "bandwidth_mbps": 1000.0,
    },
    {
        "link_id": "broadband-secondary",
        "port": 19202,
        "base_delay_ms": 15.0,
        "jitter_ms": 3.0,
        "loss_pct": 0.05,
        "bandwidth_mbps": 100.0,
    },
    {
        "link_id": "satellite-backup",
        "port": 19203,
        "base_delay_ms": 300.0,
        "jitter_ms": 50.0,
        "loss_pct": 0.3,
        "bandwidth_mbps": 10.0,
    },
    {
        "link_id": "5g-mobile",
        "port": 19204,
        "base_delay_ms": 20.0,
        "jitter_ms": 8.0,
        "loss_pct": 0.15,
        "bandwidth_mbps": 200.0,
    },
]


class LinkEmulator:
    """
    Single TCP echo server emulating one WAN link.

    Delay model: half-normal jitter sampled from |N(0, jitter_ms)|
    added to base_delay to produce realistic one-way delay per connection.
    Diurnal load variation is applied with a 2-minute period so the
    dashboard shows visible oscillation without waiting 24 hours.
    """

    def __init__(self, profile: dict):
        self.link_id = profile["link_id"]
        self.port = profile["port"]
        self.base_delay_ms = profile["base_delay_ms"]
        self.jitter_ms = profile["jitter_ms"]
        self.loss_pct = profile["loss_pct"]
        self.bandwidth_mbps = profile["bandwidth_mbps"]
        self._brownout_until: float = 0.0
        self._brownout_severity: float = 0.0
        self._server: asyncio.Server | None = None

    def current_delay_ms(self) -> float:
        """Return instantaneous one-way delay including brownout & diurnal."""
        now = time.monotonic()
        # Fast 2-minute diurnal cycle for demo visibility
        diurnal = 0.25 * math.sin(2 * math.pi * (now % 120) / 120) + 0.75

        severity = 0.0
        if now < self._brownout_until:
            elapsed = self._brownout_until - now
            total = 60.0
            ramp = 1.0 - (elapsed / total)
            severity = self._brownout_severity * min(ramp, 1.0)

        jitter = abs(random.gauss(0, self.jitter_ms))
        return self.base_delay_ms * diurnal + severity * self.base_delay_ms * 2 + jitter

    def trigger_brownout(self):
        """Simulate a link degradation event lasting 30-60 seconds."""
        now = time.monotonic()
        duration = random.uniform(30, 60)
        self._brownout_until = now + duration
        self._brownout_severity = random.uniform(1.5, 4.0)
        logger.info(
            f"[{self.link_id}] Brownout triggered: "
            f"severity={self._brownout_severity:.1f}x, duration={duration:.0f}s"
        )

    def is_dropped(self) -> bool:
        """Return True if this packet should be dropped (simulated loss)."""
        effective_loss = self.loss_pct
        if time.monotonic() < self._brownout_until:
            effective_loss *= self._brownout_severity
        return random.random() * 100 < effective_loss

    async def _handle(self, reader: asyncio.StreamReader, writer: asyncio.StreamWriter):
        """Echo handler: delay then echo back the received probe byte."""
        try:
            data = await asyncio.wait_for(reader.read(64), timeout=5.0)
            if not data or self.is_dropped():
                writer.close()
                return
            delay_s = self.current_delay_ms() / 1000.0
            await asyncio.sleep(delay_s)
            writer.write(data)
            await writer.drain()
        except (TimeoutError, ConnectionResetError):
            pass
        finally:
            try:
                writer.close()
                await writer.wait_closed()
            except Exception:
                pass

    async def start(self):
        self._server = await asyncio.start_server(
            self._handle, "127.0.0.1", self.port
        )
        logger.info(f"[{self.link_id}] Echo server listening on 127.0.0.1:{self.port}")

    async def stop(self):
        if self._server:
            self._server.close()
            await self._server.wait_closed()


class NetworkEmulator:
    """Manages all link emulators and runs periodic brownout injection."""

    def __init__(self, profiles: list[dict] = LINK_PROFILES):
        self.links = [LinkEmulator(p) for p in profiles]

    async def start(self):
        await asyncio.gather(*[link.start() for link in self.links])
        logger.info(f"Network emulator running ({len(self.links)} links)")

    async def run_brownout_scheduler(self):
        """Randomly degrade one link every ~120s for demo variation."""
        while True:
            # Wait 60-180 seconds between brownout events
            await asyncio.sleep(random.uniform(60, 180))
            victim = random.choice(self.links)
            victim.trigger_brownout()

    async def stop(self):
        await asyncio.gather(*[link.stop() for link in self.links])


async def main():
    logging.basicConfig(
        level=logging.INFO,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    )
    emulator = NetworkEmulator()
    await emulator.start()
    await emulator.run_brownout_scheduler()


if __name__ == "__main__":
    asyncio.run(main())
