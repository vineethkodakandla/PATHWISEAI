"""
ml/scripts/realworld_fetcher.py
================================
Live Internet Measurement Tool for PathWise AI

Measures real-world network latency, jitter, and packet loss by probing
publicly accessible internet infrastructure.  Can be used standalone or
called from generate_realworld_data.py to calibrate the statistical model.

Features:
  • TCP SYN-ACK RTT to DNS/HTTP servers (Google, Cloudflare, Quad9, etc.)
  • HTTP TTFB (time-to-first-byte) to public CDN endpoints
  • Jitter calculation from consecutive RTT measurements
  • Packet loss estimation from failed probe attempts
  • RIPE Atlas public API sampling (no API key required)
  • M-Lab NDT7 nearest-server discovery

Usage:
    # Quick 30-second measurement session:
    python ml/scripts/realworld_fetcher.py --duration 30

    # Extended 5-minute session, output to CSV:
    python ml/scripts/realworld_fetcher.py --duration 300 --output ml/data/live_probe.csv

    # With RIPE Atlas + M-Lab public APIs:
    python ml/scripts/realworld_fetcher.py --duration 60 --public-apis

    # Run as library:
    from ml.scripts.realworld_fetcher import LiveMeasurementSession
    session = LiveMeasurementSession()
    results = session.run(duration_sec=30)
"""

from __future__ import annotations

import argparse
import csv
import json
import logging
import socket
import sys
import time
import urllib.error
import urllib.request
from dataclasses import asdict, dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from statistics import mean, median, stdev
from typing import Optional

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(message)s",
    datefmt="%H:%M:%S",
)
logger = logging.getLogger(__name__)


# ─────────────────────────────────────────────────────────────────────────────
# Probe Targets
# ─────────────────────────────────────────────────────────────────────────────

# Well-known, stable public DNS servers — excellent RTT anchors
TCP_PROBE_TARGETS = [
    ("8.8.8.8",         53,  "Google DNS (anycast)"),
    ("1.1.1.1",         53,  "Cloudflare DNS"),
    ("9.9.9.9",         53,  "Quad9 DNS"),
    ("208.67.222.222",  53,  "Cisco OpenDNS"),
    ("8.8.4.4",         53,  "Google DNS alt"),
    ("1.0.0.1",         53,  "Cloudflare alt"),
]

# HTTP TTFB targets — public CDN endpoints (read-only HEAD requests)
HTTP_PROBE_TARGETS = [
    ("https://www.google.com",         "Google"),
    ("https://www.cloudflare.com",     "Cloudflare"),
    ("https://fast.com",               "Netflix CDN"),
    ("https://www.speedtest.net",      "Ookla"),
]


# ─────────────────────────────────────────────────────────────────────────────
# Data Models
# ─────────────────────────────────────────────────────────────────────────────

@dataclass
class RttSample:
    timestamp: float
    target: str
    label: str
    method: str          # "tcp" or "http"
    rtt_ms: Optional[float]
    success: bool
    error: str = ""


@dataclass
class LinkMeasurement:
    """Aggregated measurement for one WAN link-equivalent time window."""
    timestamp: float
    latency_ms: float
    jitter_ms: float
    packet_loss_pct: float
    samples: int


@dataclass
class SessionSummary:
    start_time: str
    end_time: str
    duration_sec: float
    total_probes: int
    successful_probes: int
    packet_loss_pct: float
    latency_p25_ms: float
    latency_p50_ms: float
    latency_p75_ms: float
    latency_p95_ms: float
    jitter_ms: float
    rtt_by_target: dict
    calibration: dict = field(default_factory=dict)


# ─────────────────────────────────────────────────────────────────────────────
# Measurement Functions
# ─────────────────────────────────────────────────────────────────────────────

def tcp_rtt(host: str, port: int = 53, timeout: float = 2.0) -> Optional[float]:
    """
    Measure TCP SYN–ACK RTT in milliseconds.
    Uses socket.create_connection which completes the 3-way handshake.
    """
    try:
        t0 = time.monotonic()
        s = socket.create_connection((host, port), timeout=timeout)
        rtt = (time.monotonic() - t0) * 1000.0
        s.close()
        return round(rtt, 3)
    except (socket.timeout, OSError, ConnectionRefusedError):
        return None


def http_ttfb(url: str, timeout: float = 4.0) -> Optional[float]:
    """
    Measure HTTP time-to-first-byte (TTFB) in milliseconds.
    Sends a HEAD request and measures until response headers arrive.
    """
    try:
        req = urllib.request.Request(
            url,
            method="HEAD",
            headers={"User-Agent": "PathWiseAI-Monitor/1.0"},
        )
        t0 = time.monotonic()
        with urllib.request.urlopen(req, timeout=timeout):
            rtt = (time.monotonic() - t0) * 1000.0
        return round(rtt, 3)
    except (urllib.error.URLError, Exception):
        return None


def compute_jitter(rtts: list[float]) -> float:
    """
    Compute jitter as the mean absolute deviation of consecutive RTT differences.
    This matches the RFC 3550 (RTP) jitter definition used in network QoS.
    """
    if len(rtts) < 2:
        return 0.0
    diffs = [abs(rtts[i] - rtts[i - 1]) for i in range(1, len(rtts))]
    return round(mean(diffs), 3)


# ─────────────────────────────────────────────────────────────────────────────
# Public API Integrations
# ─────────────────────────────────────────────────────────────────────────────

def fetch_ripe_atlas_rtts(limit: int = 20) -> list[float]:
    """
    Fetch recent ping RTT measurements from RIPE Atlas public API.
    Uses MSM 1001 (built-in ping to k.root-servers.net) — always public.
    No API key required.
    """
    rtts: list[float] = []
    try:
        url = (
            f"https://atlas.ripe.net/api/v2/measurements/1001/latest/"
            f"?format=json&limit={limit}"
        )
        req = urllib.request.Request(
            url,
            headers={"Accept": "application/json", "User-Agent": "PathWiseAI/1.0"},
        )
        with urllib.request.urlopen(req, timeout=5.0) as resp:
            data = json.loads(resp.read())
            for result in data.get("results", []):
                avg = result.get("avg")
                if avg is not None and 1 < avg < 400:
                    rtts.append(float(avg))
        logger.info(f"  RIPE Atlas: fetched {len(rtts)} RTT samples")
    except Exception as e:
        logger.debug(f"  RIPE Atlas unavailable: {e}")
    return rtts


def fetch_mlab_nearest_server() -> Optional[str]:
    """
    Discover the nearest M-Lab NDT server via their locate API.
    Returns the server hostname or None if unavailable.
    """
    try:
        url = "https://locate.measurementlab.net/v2/nearest/ndt/ndt7"
        req = urllib.request.Request(
            url,
            headers={"Accept": "application/json", "User-Agent": "PathWiseAI/1.0"},
        )
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            data = json.loads(resp.read())
            results = data.get("results", [])
            if results:
                machine = results[0].get("machine", "")
                logger.info(f"  M-Lab nearest server: {machine}")
                return machine
    except Exception as e:
        logger.debug(f"  M-Lab unavailable: {e}")
    return None


# ─────────────────────────────────────────────────────────────────────────────
# Live Measurement Session
# ─────────────────────────────────────────────────────────────────────────────

class LiveMeasurementSession:
    """
    Runs a continuous measurement session, collecting RTT samples from
    multiple targets and aggregating them into per-second link-equivalent
    measurements suitable for PathWise AI training data.
    """

    def __init__(
        self,
        targets: Optional[list[tuple]] = None,
        probe_interval_ms: float = 500.0,
        use_http: bool = False,
    ):
        self.tcp_targets = targets or TCP_PROBE_TARGETS
        self.probe_interval_ms = probe_interval_ms
        self.use_http = use_http
        self._samples: list[RttSample] = []

    def _probe_once(self) -> list[RttSample]:
        """Probe all targets and return samples."""
        samples: list[RttSample] = []
        ts = time.time()

        for host, port, label in self.tcp_targets:
            rtt = tcp_rtt(host, port)
            samples.append(RttSample(
                timestamp=ts,
                target=host,
                label=label,
                method="tcp",
                rtt_ms=rtt,
                success=rtt is not None,
                error="" if rtt is not None else "timeout",
            ))

        if self.use_http:
            for url, label in HTTP_PROBE_TARGETS:
                rtt = http_ttfb(url)
                samples.append(RttSample(
                    timestamp=ts,
                    target=url,
                    label=label,
                    method="http",
                    rtt_ms=rtt,
                    success=rtt is not None,
                    error="" if rtt is not None else "error",
                ))

        return samples

    def run(
        self,
        duration_sec: int = 30,
        public_apis: bool = False,
    ) -> SessionSummary:
        """
        Run a measurement session for `duration_sec` seconds.
        Returns a SessionSummary with latency distribution statistics.
        """
        logger.info(f"Starting {duration_sec}s live measurement session…")
        logger.info(f"  Probing {len(self.tcp_targets)} TCP targets every {self.probe_interval_ms:.0f}ms")

        # Optional: RIPE Atlas / M-Lab
        atlas_rtts: list[float] = []
        if public_apis:
            atlas_rtts = fetch_ripe_atlas_rtts(limit=30)
            fetch_mlab_nearest_server()

        all_samples: list[RttSample] = []
        start_wall = time.time()
        end_wall = start_wall + duration_sec

        while time.time() < end_wall:
            t0 = time.monotonic()
            probe_samples = self._probe_once()
            all_samples.extend(probe_samples)

            # Progress indicator
            elapsed = time.time() - start_wall
            success_count = sum(1 for s in probe_samples if s.success)
            rtts_this_round = [s.rtt_ms for s in probe_samples if s.success]
            avg_rtt = mean(rtts_this_round) if rtts_this_round else float("nan")
            logger.debug(
                f"  t={elapsed:.0f}s  RTT={avg_rtt:.1f}ms  "
                f"success={success_count}/{len(probe_samples)}"
            )

            # Sleep for remainder of probe interval
            elapsed_ms = (time.monotonic() - t0) * 1000
            sleep_ms = max(0, self.probe_interval_ms - elapsed_ms)
            time.sleep(sleep_ms / 1000.0)

        self._samples = all_samples

        # ── Compute summary statistics ────────────────────────────────────────
        good = [s for s in all_samples if s.success]
        all_rtts = [s.rtt_ms for s in good if s.rtt_ms is not None]

        # Blend in RIPE Atlas RTTs for a more robust distribution
        combined_rtts = all_rtts + atlas_rtts
        combined_rtts.sort()

        if not combined_rtts:
            logger.warning("No successful RTT measurements.")
            combined_rtts = [20.0]  # fallback

        import statistics as _stats

        def percentile(data: list[float], q: float) -> float:
            if not data:
                return 0.0
            k = (len(data) - 1) * q / 100
            lo, hi = int(k), min(int(k) + 1, len(data) - 1)
            return data[lo] + (k - lo) * (data[hi] - data[lo])

        p25  = percentile(combined_rtts, 25)
        p50  = percentile(combined_rtts, 50)
        p75  = percentile(combined_rtts, 75)
        p95  = percentile(combined_rtts, 95)

        # Jitter per target
        target_jitters: dict[str, float] = {}
        rtt_by_target: dict[str, dict] = {}
        for host, port, label in self.tcp_targets:
            t_rtts = sorted(
                [s.rtt_ms for s in all_samples
                 if s.target == host and s.success and s.rtt_ms is not None]
            )
            if t_rtts:
                target_jitters[label] = compute_jitter(t_rtts)
                rtt_by_target[label] = {
                    "p50": percentile(t_rtts, 50),
                    "p95": percentile(t_rtts, 95),
                    "jitter": target_jitters[label],
                    "n": len(t_rtts),
                }

        overall_jitter = mean(list(target_jitters.values())) if target_jitters else 0.0

        # Packet loss (% of probes that failed)
        total = len(all_samples)
        failed = sum(1 for s in all_samples if not s.success)
        loss_pct = (failed / total * 100) if total > 0 else 0.0

        # Calibration offset vs fiber baseline (11.4ms)
        fiber_model_baseline = 11.4
        calibration_offset = p50 - fiber_model_baseline

        summary = SessionSummary(
            start_time=datetime.fromtimestamp(start_wall, tz=timezone.utc).isoformat(),
            end_time=datetime.now(timezone.utc).isoformat(),
            duration_sec=duration_sec,
            total_probes=total,
            successful_probes=len(good),
            packet_loss_pct=round(loss_pct, 2),
            latency_p25_ms=round(p25, 2),
            latency_p50_ms=round(p50, 2),
            latency_p75_ms=round(p75, 2),
            latency_p95_ms=round(p95, 2),
            jitter_ms=round(overall_jitter, 3),
            rtt_by_target=rtt_by_target,
            calibration={
                "offset_ms": round(calibration_offset, 2),
                "note": (
                    f"RTT is {abs(calibration_offset):.1f}ms "
                    f"{'above' if calibration_offset > 0 else 'below'} "
                    f"fiber model baseline ({fiber_model_baseline}ms)"
                ),
            },
        )
        return summary

    def get_samples_as_df(self):
        """Return all collected samples as a pandas DataFrame."""
        import pandas as pd
        rows = []
        for s in self._samples:
            rows.append({
                "timestamp": s.timestamp,
                "target": s.target,
                "label": s.label,
                "method": s.method,
                "rtt_ms": s.rtt_ms,
                "success": s.success,
                "error": s.error,
            })
        return pd.DataFrame(rows)


# ─────────────────────────────────────────────────────────────────────────────
# CLI Entry Point
# ─────────────────────────────────────────────────────────────────────────────

def print_summary(summary: SessionSummary):
    """Pretty-print the session summary."""
    print("\n" + "=" * 60)
    print("  PathWise AI — Live RTT Measurement Summary")
    print("=" * 60)
    print(f"  Duration      : {summary.duration_sec}s")
    print(f"  Total probes  : {summary.total_probes}")
    print(f"  Success rate  : {summary.successful_probes}/{summary.total_probes} "
          f"({100 - summary.packet_loss_pct:.1f}%)")
    print(f"  Packet loss   : {summary.packet_loss_pct:.2f}%")
    print()
    print(f"  Latency P25   : {summary.latency_p25_ms:.1f} ms")
    print(f"  Latency P50   : {summary.latency_p50_ms:.1f} ms")
    print(f"  Latency P75   : {summary.latency_p75_ms:.1f} ms")
    print(f"  Latency P95   : {summary.latency_p95_ms:.1f} ms")
    print(f"  Jitter        : {summary.jitter_ms:.2f} ms")
    print()
    if summary.rtt_by_target:
        print("  Per-target breakdown:")
        for label, stats in summary.rtt_by_target.items():
            print(f"    {label:<30} P50={stats['p50']:.1f}ms  "
                  f"P95={stats['p95']:.1f}ms  jitter={stats['jitter']:.2f}ms  "
                  f"n={stats['n']}")
    print()
    if summary.calibration:
        print(f"  Calibration   : {summary.calibration.get('note', '')}")
    print("=" * 60)


def main():
    parser = argparse.ArgumentParser(
        description="Live internet RTT measurement tool for PathWise AI calibration",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=__doc__,
    )
    parser.add_argument(
        "--duration", type=int, default=30,
        help="Measurement duration in seconds (default: 30)",
    )
    parser.add_argument(
        "--interval-ms", type=float, default=500.0,
        help="Probe interval in milliseconds (default: 500ms = 2 probes/sec)",
    )
    parser.add_argument(
        "--include-http", action="store_true",
        help="Also probe HTTP TTFB (slower but more realistic)",
    )
    parser.add_argument(
        "--public-apis", action="store_true",
        help="Fetch data from RIPE Atlas and M-Lab APIs",
    )
    parser.add_argument(
        "--output", type=str, default="",
        help="Save measurements to CSV file",
    )
    parser.add_argument(
        "--json", type=str, default="",
        help="Save summary to JSON file",
    )
    args = parser.parse_args()

    session = LiveMeasurementSession(
        probe_interval_ms=args.interval_ms,
        use_http=args.include_http,
    )

    summary = session.run(
        duration_sec=args.duration,
        public_apis=args.public_apis,
    )

    print_summary(summary)

    # ── Save outputs ──────────────────────────────────────────────────────────
    if args.output:
        try:
            df = session.get_samples_as_df()
            out_path = Path(args.output)
            out_path.parent.mkdir(parents=True, exist_ok=True)
            df.to_csv(out_path, index=False)
            logger.info(f"Samples saved → {out_path} ({len(df):,} rows)")
        except ImportError:
            logger.warning("pandas not installed — cannot save CSV")

    if args.json:
        json_path = Path(args.json)
        json_path.parent.mkdir(parents=True, exist_ok=True)
        summary_dict = asdict(summary)
        json_path.write_text(json.dumps(summary_dict, indent=2))
        logger.info(f"Summary saved → {json_path}")


if __name__ == "__main__":
    main()
