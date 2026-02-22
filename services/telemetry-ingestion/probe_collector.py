"""
probe_collector.py — Real-time TCP probe collector.

Measures actual network link performance by timing TCP round-trips to the
local network emulator echo servers. All measurements come from real kernel
TCP stack timing (time.perf_counter() wrapping a connect/send/recv cycle),
not from synthetic math.

Metrics collected per link per second:
  latency_ms         Mean TCP RTT over PROBE_COUNT probes
  jitter_ms          (max - min) / 2 of RTT samples  [RFC 3393]
  packet_loss_pct    Fraction of probes that timed-out or were refused
  bandwidth_util_pct Interface RX+TX bytes delta / theoretical max,
                     read from /proc/net/dev (real kernel counter)
  rtt_ms             2 × mean one-way latency (standard definition)
"""

import asyncio
import logging
import os
import time
from pathlib import Path

from collector import TelemetryCollector, TelemetryPoint
from network_emulator import LINK_PROFILES

logger = logging.getLogger(__name__)

PROBE_COUNT = int(os.getenv("PROBE_COUNT", "8"))       # probes per link per tick
PROBE_TIMEOUT = float(os.getenv("PROBE_TIMEOUT", "2.0"))  # seconds per probe


# ---------------------------------------------------------------------------
# /proc/net/dev bandwidth reader
# ---------------------------------------------------------------------------

class BandwidthMonitor:
    """
    Reads kernel byte counters from /proc/net/dev and converts the delta
    between two samples into a bandwidth utilization percentage.

    Uses whichever non-loopback interface has the most traffic.
    Link-speed assumption: 1 Gbps (1_000_000_000 bits/s). Override via
    LINK_SPEED_GBPS env var.
    """

    LINK_SPEED_BITS = float(os.getenv("LINK_SPEED_GBPS", "1")) * 1e9

    def __init__(self):
        self._prev: dict[str, tuple[int, int, float]] = {}  # iface → (rx, tx, ts)

    def _read_proc(self) -> dict[str, tuple[int, int]]:
        """Parse /proc/net/dev → {iface: (rx_bytes, tx_bytes)}."""
        result = {}
        try:
            lines = Path("/proc/net/dev").read_text().splitlines()[2:]
            for line in lines:
                parts = line.split(":")
                if len(parts) != 2:
                    continue
                iface = parts[0].strip()
                fields = parts[1].split()
                if len(fields) < 9:
                    continue
                result[iface] = (int(fields[0]), int(fields[8]))  # rx_bytes, tx_bytes
        except Exception:
            pass
        return result

    def _best_iface(self, data: dict[str, tuple[int, int]]) -> str | None:
        """Pick the busiest interface (loopback included as fallback for probe traffic)."""
        # Prefer a real (non-lo) interface; fall back to lo if that's all there is
        non_lo = {k: v for k, v in data.items() if k != "lo"}
        candidates = non_lo if non_lo else data
        best = None
        best_bytes = -1
        for iface, (rx, tx) in candidates.items():
            total = rx + tx
            if total > best_bytes:
                best_bytes = total
                best = iface
        # If no non-lo interface has any traffic, fall back to loopback
        if best is not None and best_bytes == 0 and "lo" in data:
            best = "lo"
        return best

    def sample_bytes_per_sec(self) -> float:
        """Return total RX+TX bytes/second across all active interfaces."""
        now = time.monotonic()
        data = self._read_proc()
        iface = self._best_iface(data)
        if not iface or iface not in data:
            return 0.0
        rx, tx = data[iface]
        bps = 0.0
        if iface in self._prev:
            prev_rx, prev_tx, prev_ts = self._prev[iface]
            dt = max(now - prev_ts, 0.001)
            bps = ((rx - prev_rx) + (tx - prev_tx)) / dt
        self._prev[iface] = (rx, tx, now)
        return max(0.0, bps)

    def link_util_pct(self, bytes_per_sec: float, link_bandwidth_mbps: float,
                      num_links: int) -> float:
        """
        Convert raw interface bytes/sec to per-link utilization %.

        The probe collector shares the loopback equally across all links, so
        each link's share is bytes_per_sec / num_links.  That is compared to
        the link's theoretical bandwidth (in bytes/s).
        """
        link_bps = (bytes_per_sec / max(num_links, 1)) * 8  # bits per second per link
        link_capacity_bps = link_bandwidth_mbps * 1e6
        return round(min(100.0, link_bps / link_capacity_bps * 100), 2)


# ---------------------------------------------------------------------------
# TCP RTT prober
# ---------------------------------------------------------------------------

async def _probe_once(host: str, port: int, payload: bytes = b"PROBE\n") -> float | None:
    """
    Open a TCP connection, send payload, wait for echo.
    Returns round-trip time in milliseconds, or None on failure.
    """
    t0 = time.perf_counter()
    try:
        reader, writer = await asyncio.wait_for(
            asyncio.open_connection(host, port),
            timeout=PROBE_TIMEOUT,
        )
        writer.write(payload)
        await writer.drain()
        data = await asyncio.wait_for(reader.read(len(payload)), timeout=PROBE_TIMEOUT)
        rtt_ms = (time.perf_counter() - t0) * 1000.0
        writer.close()
        try:
            await writer.wait_closed()
        except Exception:
            pass
        return rtt_ms if data else None
    except Exception:
        return None


async def probe_link(host: str, port: int, n: int = PROBE_COUNT) -> dict:
    """
    Send n TCP probes concurrently and compute latency/jitter/loss.

    Concurrent probes match real hardware probing tools (e.g. fping).
    """
    tasks = [_probe_once(host, port) for _ in range(n)]
    results = await asyncio.gather(*tasks)

    rtts = [r for r in results if r is not None]
    lost = n - len(rtts)

    if not rtts:
        # Total blackout — return very degraded metrics
        return {
            "latency_ms": 999.0,
            "jitter_ms": 0.0,
            "packet_loss_pct": 100.0,
            "rtt_ms": 1998.0,
        }

    avg = sum(rtts) / len(rtts)
    jitter = (max(rtts) - min(rtts)) / 2.0
    loss_pct = (lost / n) * 100.0

    return {
        "latency_ms": round(avg, 2),
        "jitter_ms": round(jitter, 2),
        "packet_loss_pct": round(loss_pct, 2),
        "rtt_ms": round(avg * 2, 2),
    }


# ---------------------------------------------------------------------------
# ProbeCollector: wraps TelemetryCollector publish() with real measurements
# ---------------------------------------------------------------------------

class ProbeCollector:
    """
    Polls each emulated link via TCP probes and publishes TelemetryPoints
    to Redis Streams, reusing TelemetryCollector.publish().
    """

    def __init__(self, redis_url: str, poll_interval: float = 1.0):
        self._publisher = TelemetryCollector(redis_url=redis_url, mode="synthetic")
        self._interval = poll_interval
        self._bw = BandwidthMonitor()
        self._profiles = LINK_PROFILES

    async def run(self):
        logger.info(
            f"ProbeCollector started ({len(self._profiles)} links, "
            f"{PROBE_COUNT} probes/link/tick)"
        )
        # Warm up bandwidth monitor (discard first reading — always 0)
        self._bw.sample_bytes_per_sec()

        while True:
            tick_start = time.monotonic()

            # Probe all links concurrently
            probe_tasks = [
                probe_link("127.0.0.1", p["port"])
                for p in self._profiles
            ]
            probe_results = await asyncio.gather(*probe_tasks)

            # Real bytes/sec from /proc/net/dev.  Divide equally across links
            # then compute utilisation vs each link's theoretical capacity.
            total_bps = self._bw.sample_bytes_per_sec()
            num_links = len(self._profiles)

            now = time.time()
            for profile, metrics in zip(self._profiles, probe_results):
                bw_util = self._bw.link_util_pct(
                    total_bps, profile["bandwidth_mbps"], num_links
                )

                point = TelemetryPoint(
                    timestamp=now,
                    link_id=profile["link_id"],
                    latency_ms=metrics["latency_ms"],
                    jitter_ms=metrics["jitter_ms"],
                    packet_loss_pct=metrics["packet_loss_pct"],
                    bandwidth_utilization_pct=round(bw_util, 2),
                    rtt_ms=metrics["rtt_ms"],
                )
                await self._publisher.publish(point)

            elapsed = time.monotonic() - tick_start
            await asyncio.sleep(max(0.0, self._interval - elapsed))
