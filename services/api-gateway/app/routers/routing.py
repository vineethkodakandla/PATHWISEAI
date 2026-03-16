# services/api-gateway/app/routers/routing.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from typing import Optional
import redis.asyncio as redis
import json
import uuid
import time

from app.config import get_settings

router = APIRouter(prefix="/api/v1/routing", tags=["Routing Rules"])

settings = get_settings()
redis_client = redis.from_url(settings.redis_url)

RULES_KEY = "routing:rules"       # Hash: rule_id -> json blob
HISTORY_STREAM = "routing:history"


class RoutingRuleRequest(BaseModel):
    sandbox_report_id: str
    source_link: str
    target_link: str
    traffic_classes: list[str]
    reason: Optional[str] = "Manual routing rule"


@router.post("/apply")
async def apply_routing_rule(request: RoutingRuleRequest):
    """
    Persist a validated routing rule and dispatch it to the steering engine.

    The caller must supply a ``sandbox_report_id`` from a prior
    ``POST /api/v1/sandbox/validate`` call to confirm pre-flight
    validation was performed.
    """
    rule_id = str(uuid.uuid4())
    rule = {
        "id": rule_id,
        "sandbox_report_id": request.sandbox_report_id,
        "source_link": request.source_link,
        "target_link": request.target_link,
        "traffic_classes": request.traffic_classes,
        "reason": request.reason,
        "created_at": time.time(),
        "status": "active",
    }

    # Store in the active rules hash
    await redis_client.hset(RULES_KEY, rule_id, json.dumps(rule))

    # Record in history stream
    await redis_client.xadd(HISTORY_STREAM, {
        "rule_id": rule_id,
        "action": "apply",
        "source_link": request.source_link,
        "target_link": request.target_link,
        "traffic_classes": json.dumps(request.traffic_classes),
    })

    # Forward to the steering engine request stream for execution
    await redis_client.xadd("steering:requests", {
        "source_link": request.source_link,
        "target_link": request.target_link,
        "traffic_classes": json.dumps(request.traffic_classes),
        "reason": request.reason or "Manual routing rule",
        "type": "manual",
        "rule_id": rule_id,
    })

    return {"status": "applied", "rule_id": rule_id, "rule": rule}


@router.get("/active")
async def get_active_rules():
    """List routing rules that are currently active."""
    raw = await redis_client.hgetall(RULES_KEY)
    rules = [
        json.loads(v.decode()) for v in raw.values()
        if json.loads(v.decode()).get("status") == "active"
    ]
    return {"rules": rules, "count": len(rules)}


@router.get("/all")
async def get_all_rules():
    """List all routing rules including rolled-back ones."""
    raw = await redis_client.hgetall(RULES_KEY)
    rules = [json.loads(v.decode()) for v in raw.values()]
    rules.sort(key=lambda r: r.get("created_at", 0), reverse=True)
    return {"rules": rules, "count": len(rules)}


@router.delete("/{rule_id}")
async def rollback_rule(rule_id: str):
    """
    Roll back (deactivate) an active routing rule.

    Marks the rule as rolled-back in the persistent store and publishes
    a counter-steering request to restore the previous path.
    """
    raw = await redis_client.hget(RULES_KEY, rule_id)
    if not raw:
        raise HTTPException(status_code=404, detail=f"Rule {rule_id} not found")

    rule = json.loads(raw.decode())
    if rule.get("status") != "active":
        raise HTTPException(status_code=409, detail=f"Rule {rule_id} is not active")

    rule["status"] = "rolled_back"
    rule["rolled_back_at"] = time.time()
    await redis_client.hset(RULES_KEY, rule_id, json.dumps(rule))

    # Record rollback in history
    await redis_client.xadd(HISTORY_STREAM, {
        "rule_id": rule_id,
        "action": "rollback",
        "source_link": rule.get("source_link", ""),
        "target_link": rule.get("target_link", ""),
    })

    return {"status": "rolled_back", "rule_id": rule_id}
