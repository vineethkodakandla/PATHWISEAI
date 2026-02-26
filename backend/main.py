"""
PathWise AI - Standalone Backend (Offline Mode)
================================================
No Docker, No Redis, No Database required.
Pure in-memory simulation for local laptop demo.

Simulates 4 WAN networks with realistic congestion patterns,
and compares LSTM-based predictive network selection vs naive
reactive selection in real time.

Run: uvicorn main:app --reload --port 8000
"""

import asyncio
import math
import random
import time
import json
from typing import Dict, List, Optional
from contextlib import asynccontextmanager

from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel


# ─── Network Definitions ──────────────────────────────────────────────────────

NETWORKS: Dict[str, Dict] = {
    "fiber-primary": {
        "id": "fiber-primary",
        "name": "Fiber Primary",
        "type": "fiber",
        "base_latency": 8.0,
        "base_jitter": 1.5,
        "base_packet_loss": 0.05,
        "base_bandwidth": 1000.0,
        "color": "#00d4ff",
        "icon": "fiber",
        # Congestion wave: amplitude(ms), frequency(Hz), phase offset
        "congestion": {"amplitude": 7.0, "frequency": 0.008, "phase": 0.0},
    },
    "broadband": {
        "id": "broadband",
        "name": "Cable Broadband",
        "type": "broadband",
        "base_latency": 25.0,
        "base_jitter": 8.0,
        "base_packet_loss": 0.30,
        "base_bandwidth": 200.0,
        "color": "#7c3aed",
        "icon": "broadband",
        "congestion": {"amplitude": 18.0, "frequency": 0.012, "phase": 1.57},
    },
    "5g-mobile": {
        "id": "5g-mobile",
        "name": "5G Mobile",
        "type": "5g",
        "base_latency": 18.0,
        "base_jitter": 12.0,
        "base_packet_loss": 0.80,
        "base_bandwidth": 300.0,
        "color": "#00ff88",
        "icon": "5g",
        "congestion": {"amplitude": 22.0, "frequency": 0.020, "phase": 3.14},
    },
    "satellite": {
        "id": "satellite",
        "name": "Satellite",
        "type": "satellite",
        "base_latency": 580.0,
        "base_jitter": 45.0,
        "base_packet_loss": 1.50,
        "base_bandwidth": 50.0,
        "color": "#ff8c00",
        "icon": "satellite",
        "congestion": {"amplitude": 65.0, "frequency": 0.005, "phase": 4.71},
    },
}

LINK_ORDER = ["fiber-primary", "broadband", "5g-mobile", "satellite"]


# ─── Global Application State ──────────────────────────────────────────────────

class AppState:
    def __init__(self):
        self.lstm_enabled: bool = False
        self.active_connections: List[WebSocket] = []
        self.t: float = 0.0  # Simulation time in seconds
        self.selected_network: str = "fiber-primary"       # LSTM selection
        self.naive_selected_network: str = "fiber-primary"  # Naive selection
        self.steering_log: List[Dict] = []
        # Performance comparison counters
        self.lstm_total_latency: float = 0.0
        self.naive_total_latency: float = 0.0
        self.lstm_switches: int = 0
        self.naive_switches: int = 0
        self.tick_count: int = 0
        # History buffer for sparklines (last 60 ticks per network)
        self.history: Dict[str, List[Dict]] = {nid: [] for nid in NETWORKS}

state = AppState()


# ─── Simulation Core ───────────────────────────────────────────────────────────

def get_metrics(network_id: str, t: float, noise_scale: float = 1.0) -> Dict:
    """
    Generate realistic network metrics at time t.
    Uses sinusoidal congestion waves + Gaussian noise to simulate
    realistic WAN behavior (peak hours, weather, interference).
    """
    net = NETWORKS[network_id]
    c = net["congestion"]

    # Congestion wave (only positive values cause degradation)
    wave = math.sin(t * c["frequency"] * 2 * math.pi + c["phase"])
    congestion = max(0.0, wave) * c["amplitude"]

    # Random noise (gaussian)
    noise = random.gauss(0.0, 1.0) * noise_scale

    latency = max(1.0, net["base_latency"] + congestion + noise * 2.5)
    jitter = max(0.1, net["base_jitter"] + congestion * 0.35 + abs(noise) * 0.8)
    packet_loss = max(0.0, min(100.0,
        net["base_packet_loss"] + congestion * 0.06 + max(0.0, noise * 0.08)
    ))
    bandwidth = max(1.0,
        net["base_bandwidth"] - congestion * (net["base_bandwidth"] / 120.0) + noise * 3.0
    )

    # Health score: higher = better
    # Latency weight 50%, Jitter 30%, Loss 20%
    lat_max = net["base_latency"] * 4 + 1.0
    lat_score = max(0.0, 100.0 - (latency / lat_max) * 100.0)
    jit_score = max(0.0, 100.0 - (jitter / 60.0) * 100.0)
    loss_score = max(0.0, 100.0 - packet_loss * 12.0)
    health = lat_score * 0.50 + jit_score * 0.30 + loss_score * 0.20

    # Congestion level (0-100%)
    congestion_pct = (congestion / c["amplitude"] * 100.0) if c["amplitude"] > 0 else 0.0

    return {
        "id": network_id,
        "name": net["name"],
        "type": net["type"],
        "color": net["color"],
        "icon": net["icon"],
        "latency_ms": round(latency, 2),
        "jitter_ms": round(jitter, 2),
        "packet_loss_pct": round(packet_loss, 3),
        "bandwidth_mbps": round(bandwidth, 1),
        "health_score": round(max(0.0, min(100.0, health)), 1),
        "congestion_pct": round(max(0.0, min(100.0, congestion_pct)), 1),
        "signal_strength": round(max(0.0, min(100.0, health * 0.9 + random.uniform(-3, 3))), 1),
        "timestamp": t,
    }


def get_future_latency(network_id: str, t: float, steps: int = 30) -> List[float]:
    """
    Simulate LSTM prediction: peek at future metrics with reduced noise
    to represent what a trained model would predict.
    """
    return [
        round(get_metrics(network_id, t + i * 1.0, noise_scale=0.2)["latency_ms"], 2)
        for i in range(steps)
    ]


def get_future_health(network_id: str, t: float, horizon: int = 30) -> float:
    """Average predicted health score over the next `horizon` seconds."""
    scores = []
    for i in range(horizon):
        m = get_metrics(network_id, t + i * 1.0, noise_scale=0.15)
        scores.append(m["health_score"])
    return sum(scores) / len(scores)


def select_naive(metrics: Dict[str, Dict]) -> str:
    """Naive/reactive: pick network with best CURRENT health score."""
    return max(metrics.items(), key=lambda x: x[1]["health_score"])[0]


def select_lstm(metrics: Dict[str, Dict], t: float) -> str:
    """
    LSTM-powered predictive selection: pick network with best
    PREDICTED future health (30-second horizon).
    This is the key difference — LSTM acts proactively before
    degradation happens, while naive reacts after it occurs.
    """
    future_scores = {nid: get_future_health(nid, t) for nid in NETWORKS}
    return max(future_scores.items(), key=lambda x: x[1])[0]


def compute_trend(history: List[Dict]) -> str:
    """Determine trend from recent history."""
    if len(history) < 4:
        return "stable"
    recent = [h["health_score"] for h in history[-4:]]
    delta = recent[-1] - recent[0]
    if delta > 5:
        return "improving"
    elif delta < -5:
        return "degrading"
    return "stable"


# ─── Simulation Loop ───────────────────────────────────────────────────────────

async def simulation_loop():
    """
    Main real-time simulation loop.
    Runs every second, generates network metrics, makes selection
    decisions (LSTM vs naive), and broadcasts to all WebSocket clients.
    """
    while True:
        state.t += 1.0
        state.tick_count += 1

        # Generate metrics for all networks
        all_metrics = {nid: get_metrics(nid, state.t) for nid in NETWORKS}

        # Generate LSTM predictions (next 30 ticks)
        predictions = {nid: get_future_latency(nid, state.t) for nid in NETWORKS}

        # Make selection decisions
        lstm_pick = select_lstm(all_metrics, state.t)
        naive_pick = select_naive(all_metrics)

        # Track steering events for LSTM
        if lstm_pick != state.selected_network:
            state.lstm_switches += 1
            event = {
                "timestamp": state.t,
                "mode": "LSTM",
                "from_network": state.selected_network,
                "to_network": lstm_pick,
                "reason": f"LSTM predicts degradation on {state.selected_network} — switching proactively",
                "current_health": all_metrics[lstm_pick]["health_score"],
                "avoided_latency": round(
                    all_metrics[state.selected_network]["latency_ms"] -
                    all_metrics[lstm_pick]["latency_ms"], 1
                ),
            }
            state.steering_log.insert(0, event)
            state.steering_log = state.steering_log[:100]

        # Track naive steering events
        if naive_pick != state.naive_selected_network:
            state.naive_switches += 1
            event = {
                "timestamp": state.t,
                "mode": "Naive",
                "from_network": state.naive_selected_network,
                "to_network": naive_pick,
                "reason": f"Reactive: {state.naive_selected_network} health dropped below threshold",
                "current_health": all_metrics[naive_pick]["health_score"],
                "avoided_latency": 0.0,
            }
            state.steering_log.insert(0, event)
            state.steering_log = state.steering_log[:100]

        state.selected_network = lstm_pick
        state.naive_selected_network = naive_pick

        # Accumulate performance for comparison
        state.lstm_total_latency += all_metrics[lstm_pick]["latency_ms"]
        state.naive_total_latency += all_metrics[naive_pick]["latency_ms"]

        # Update rolling history (last 60 ticks)
        for nid, m in all_metrics.items():
            state.history[nid].append({
                "t": state.t,
                "health_score": m["health_score"],
                "latency_ms": m["latency_ms"],
            })
            if len(state.history[nid]) > 60:
                state.history[nid].pop(0)

        # Compute trends
        trends = {nid: compute_trend(state.history[nid]) for nid in NETWORKS}

        # Build comparison stats
        n = max(1, state.tick_count)
        comparison = {
            "lstm_avg_latency": round(state.lstm_total_latency / n, 2),
            "naive_avg_latency": round(state.naive_total_latency / n, 2),
            "lstm_switches": state.lstm_switches,
            "naive_switches": state.naive_switches,
            "improvement_pct": round(
                (state.naive_total_latency - state.lstm_total_latency) /
                max(1.0, state.naive_total_latency) * 100, 1
            ),
        }

        # Augment metrics with trend
        for nid in all_metrics:
            all_metrics[nid]["trend"] = trends[nid]
            all_metrics[nid]["history"] = state.history[nid][-30:]

        # Build full broadcast payload
        payload = json.dumps({
            "type": "network_update",
            "lstm_enabled": state.lstm_enabled,
            "selected_network": state.selected_network if state.lstm_enabled else state.naive_selected_network,
            "lstm_selected": state.selected_network,
            "naive_selected": state.naive_selected_network,
            "networks": all_metrics,
            "predictions": predictions,
            "steering_log": state.steering_log[:15],
            "comparison": comparison,
            "timestamp": state.t,
        })

        # Broadcast to all connected WebSocket clients
        dead = []
        for ws in list(state.active_connections):
            try:
                await ws.send_text(payload)
            except Exception:
                dead.append(ws)
        for ws in dead:
            if ws in state.active_connections:
                state.active_connections.remove(ws)

        await asyncio.sleep(1.0)


# ─── App Lifecycle ─────────────────────────────────────────────────────────────

@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(simulation_loop())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


# ─── FastAPI Application ───────────────────────────────────────────────────────

app = FastAPI(
    title="PathWise AI – Offline Backend",
    version="2.0.0",
    description="Standalone network simulation with LSTM vs Naive comparison",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# ─── REST Endpoints ─────────────────────────────────────────────────────────────

@app.get("/api/status")
async def get_status():
    """System health check and current LSTM state."""
    return {
        "status": "online",
        "lstm_enabled": state.lstm_enabled,
        "selected_network": state.selected_network,
        "uptime_seconds": state.t,
        "connected_clients": len(state.active_connections),
        "networks": list(NETWORKS.keys()),
    }


class LSTMToggleRequest(BaseModel):
    enabled: bool


@app.post("/api/lstm/toggle")
async def toggle_lstm(body: LSTMToggleRequest):
    """
    Toggle LSTM network selection on or off.
    When ON: proactive selection using predicted future health.
    When OFF: reactive selection using current health only.
    """
    state.lstm_enabled = body.enabled

    # Immediate broadcast of mode change to all clients
    all_metrics = {nid: get_metrics(nid, state.t) for nid in NETWORKS}
    payload = json.dumps({
        "type": "lstm_toggled",
        "lstm_enabled": state.lstm_enabled,
        "selected_network": state.selected_network if state.lstm_enabled else state.naive_selected_network,
        "networks": all_metrics,
        "timestamp": state.t,
    })

    dead = []
    for ws in list(state.active_connections):
        try:
            await ws.send_text(payload)
        except Exception:
            dead.append(ws)
    for ws in dead:
        if ws in state.active_connections:
            state.active_connections.remove(ws)

    return {
        "success": True,
        "lstm_enabled": state.lstm_enabled,
        "message": f"LSTM {'activated' if state.lstm_enabled else 'deactivated'} — "
                   f"{'Predictive proactive selection enabled' if state.lstm_enabled else 'Reactive greedy selection active'}",
    }


@app.get("/api/lstm/state")
async def get_lstm_state():
    """Get current LSTM toggle state."""
    return {"lstm_enabled": state.lstm_enabled}


@app.get("/api/networks")
async def get_networks():
    """Get current metrics for all networks."""
    metrics = {}
    for nid in NETWORKS:
        m = get_metrics(nid, state.t)
        m["trend"] = compute_trend(state.history[nid])
        m["history"] = state.history[nid][-30:]
        metrics[nid] = m

    return {
        "networks": metrics,
        "selected_network": state.selected_network if state.lstm_enabled else state.naive_selected_network,
        "lstm_selected": state.selected_network,
        "naive_selected": state.naive_selected_network,
        "lstm_enabled": state.lstm_enabled,
    }


@app.get("/api/predictions")
async def get_all_predictions():
    """Get 30-second latency forecasts for all networks."""
    return {
        "predictions": {
            nid: {
                "latency_forecast": get_future_latency(nid, state.t),
                "avg_future_health": round(get_future_health(nid, state.t), 1),
            }
            for nid in NETWORKS
        },
        "lstm_enabled": state.lstm_enabled,
        "timestamp": state.t,
    }


@app.get("/api/steering/history")
async def get_steering_history(limit: int = 20):
    """Get recent steering decision log."""
    return {
        "history": state.steering_log[:limit],
        "total": len(state.steering_log),
    }


@app.get("/api/comparison")
async def get_comparison():
    """Get LSTM vs Naive performance comparison statistics."""
    n = max(1, state.tick_count)
    lstm_avg = state.lstm_total_latency / n
    naive_avg = state.naive_total_latency / n
    return {
        "lstm": {
            "avg_latency_ms": round(lstm_avg, 2),
            "total_switches": state.lstm_switches,
            "switch_rate": round(state.lstm_switches / max(1, state.tick_count / 60), 2),
        },
        "naive": {
            "avg_latency_ms": round(naive_avg, 2),
            "total_switches": state.naive_switches,
            "switch_rate": round(state.naive_switches / max(1, state.tick_count / 60), 2),
        },
        "improvement_pct": round((naive_avg - lstm_avg) / max(1.0, naive_avg) * 100, 1),
        "ticks_analyzed": state.tick_count,
    }


# ─── WebSocket Endpoint ─────────────────────────────────────────────────────────

@app.websocket("/ws/live")
async def websocket_live(ws: WebSocket):
    """
    Real-time WebSocket feed.
    Broadcasts network_update every second to all connected clients.
    """
    await ws.accept()
    state.active_connections.append(ws)

    # Send current state immediately on connect
    all_metrics = {}
    for nid in NETWORKS:
        m = get_metrics(nid, state.t)
        m["trend"] = compute_trend(state.history[nid])
        m["history"] = state.history[nid][-30:]
        all_metrics[nid] = m

    await ws.send_text(json.dumps({
        "type": "initial_state",
        "lstm_enabled": state.lstm_enabled,
        "selected_network": state.selected_network if state.lstm_enabled else state.naive_selected_network,
        "lstm_selected": state.selected_network,
        "naive_selected": state.naive_selected_network,
        "networks": all_metrics,
        "predictions": {nid: get_future_latency(nid, state.t) for nid in NETWORKS},
        "steering_log": state.steering_log[:15],
        "timestamp": state.t,
    }))

    try:
        while True:
            # Keep alive — client can optionally send pings
            await asyncio.wait_for(ws.receive_text(), timeout=30.0)
    except (WebSocketDisconnect, asyncio.TimeoutError):
        pass
    except Exception:
        pass
    finally:
        if ws in state.active_connections:
            state.active_connections.remove(ws)
