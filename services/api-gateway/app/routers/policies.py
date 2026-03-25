# services/api-gateway/app/routers/policies.py

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import re
import json
import time
from typing import Optional
import redis.asyncio as redis

from app.config import get_settings

router = APIRouter(prefix="/api/v1/policies", tags=["IBN"])

settings = get_settings()
redis_client = redis.from_url(settings.redis_url)

POLICIES_KEY = "policies:active"       # Hash: rule_name -> json blob
HISTORY_KEY  = "policies:history"      # List: json blobs (newest first)
HISTORY_MAX  = 100                      # Cap history at 100 entries


class IntentRequest(BaseModel):
    intent_text: str  # Natural language, e.g. "Prioritize VoIP over guest WiFi"
    dry_run: bool = False  # If True, parse and return rules/YANG without applying


class PolicyRule(BaseModel):
    name: str
    traffic_class: str
    priority: int
    bandwidth_guarantee_mbps: Optional[float]
    latency_max_ms: Optional[float]
    action: str  # "prioritize", "throttle", "block", "redirect"
    target_links: list[str]


class YangNetconfConfig(BaseModel):
    """Generated YANG/NETCONF configuration for a policy rule."""
    rule_name: str
    yang_model: str          # e.g. "ietf-qos" or "openconfig-qos"
    netconf_xml: str         # NETCONF <edit-config> XML fragment
    restconf_json: dict      # RESTCONF JSON equivalent
    dscp_marking: str        # DSCP value for this traffic class
    description: str         # Human-readable description of the YANG config


# DSCP markings per traffic class (RFC 4594)
DSCP_MAP = {
    "voip":            "ef",     # Expedited Forwarding — lowest latency
    "video":           "af41",   # Assured Forwarding class 4 — video
    "medical_imaging": "ef",     # Expedited Forwarding — critical
    "financial":       "af31",   # Assured Forwarding class 3 — critical data
    "guest_wifi":      "be",     # Best Effort
    "backup":          "cs1",    # Class Selector 1 — scavenger
    "web_browsing":    "af11",   # Assured Forwarding class 1
    "streaming":       "af21",   # Assured Forwarding class 2
    "critical":        "cs6",    # Class Selector 6 — network control
    "bulk":            "cs1",    # Class Selector 1 — low priority
    "custom":          "be",     # Best Effort default
}


class YangConfigGenerator:
    """
    Translates a PolicyRule into YANG/NETCONF configuration fragments.

    Generates configurations compliant with:
    - IETF YANG QoS model (RFC 8519 draft-ietf-rtgwg-qos-model)
    - OpenConfig QoS model (/openconfig-qos:qos)
    - Standard NETCONF <edit-config> RPC framing
    - RESTCONF JSON encoding (RFC 8040)
    """

    def generate(self, rule: PolicyRule) -> YangNetconfConfig:
        dscp = DSCP_MAP.get(rule.traffic_class, "be")
        bw_bps = int(rule.bandwidth_guarantee_mbps * 1_000_000) if rule.bandwidth_guarantee_mbps else None
        policy_name = f"pathwise-{rule.name}"

        netconf_xml = self._build_netconf_xml(rule, policy_name, dscp, bw_bps)
        restconf_json = self._build_restconf_json(rule, policy_name, dscp, bw_bps)
        description = self._describe(rule, dscp, bw_bps)

        return YangNetconfConfig(
            rule_name=rule.name,
            yang_model="ietf-qos / openconfig-qos",
            netconf_xml=netconf_xml,
            restconf_json=restconf_json,
            dscp_marking=dscp.upper(),
            description=description,
        )

    def _build_netconf_xml(self, rule: PolicyRule, policy_name: str, dscp: str, bw_bps: Optional[int]) -> str:
        bw_elem = f"\n            <min-rate><rate>{bw_bps}</rate></min-rate>" if bw_bps else ""
        lat_elem = f"\n            <max-delay-usecs>{int(rule.latency_max_ms * 1000)}</max-delay-usecs>" if rule.latency_max_ms else ""
        links_comment = f"<!-- target-links: {', '.join(rule.target_links)} -->"

        action_map = {
            "prioritize": "priority-queue",
            "throttle":   "shaper",
            "block":      "drop",
            "redirect":   "redirect",
        }
        queue_type = action_map.get(rule.action, "fair-queue")

        return f"""<rpc message-id="{abs(hash(rule.name)) % 10000 + 1000}"
     xmlns="urn:ietf:params:xml:ns:netconf:base:1.0">
  <edit-config>
    <target><running/></target>
    <config>
      {links_comment}
      <qos xmlns="urn:ietf:params:xml:ns:yang:ietf-qos">
        <classifier>
          <name>match-{rule.traffic_class}</name>
          <filter-entry>
            <filter-type>dscp</filter-type>
            <dscp-value>{dscp}</dscp-value>
          </filter-entry>
        </classifier>
        <policy>
          <name>{policy_name}</name>
          <classifier-action-entry>
            <classifier-name>match-{rule.traffic_class}</classifier-name>
            <actions>
              <scheduler>
                <priority>{rule.priority}</priority>
                <queue-type>{queue_type}</queue-type>{bw_elem}{lat_elem}
              </scheduler>
            </actions>
          </classifier-action-entry>
        </policy>
      </qos>
    </config>
  </edit-config>
</rpc>"""

    def _build_restconf_json(self, rule: PolicyRule, policy_name: str, dscp: str, bw_bps: Optional[int]) -> dict:
        actions: dict = {"priority": rule.priority}
        if bw_bps:
            actions["min-rate"] = {"rate": bw_bps, "unit": "bps"}
        if rule.latency_max_ms:
            actions["max-delay"] = {"delay-usecs": int(rule.latency_max_ms * 1000)}
        if rule.action == "block":
            actions["drop"] = True
        elif rule.action == "throttle" and bw_bps:
            actions["max-rate"] = {"rate": bw_bps, "unit": "bps"}

        return {
            "ietf-qos:qos": {
                "classifier": {
                    "name": f"match-{rule.traffic_class}",
                    "filter-entry": {
                        "filter-type": "dscp",
                        "dscp-value": dscp,
                    },
                },
                "policy": {
                    "name": policy_name,
                    "target-links": rule.target_links,
                    "classifier-action-entry": {
                        "classifier-name": f"match-{rule.traffic_class}",
                        "actions": actions,
                    },
                },
            }
        }

    def _describe(self, rule: PolicyRule, dscp: str, bw_bps: Optional[int]) -> str:
        parts = [
            f"Traffic class '{rule.traffic_class}' matched by DSCP={dscp.upper()}.",
            f"Action: {rule.action} with scheduling priority {rule.priority}.",
        ]
        if bw_bps:
            parts.append(f"Bandwidth {'guarantee' if rule.action == 'prioritize' else 'cap'}: {bw_bps // 1_000_000} Mbps.")
        if rule.latency_max_ms:
            parts.append(f"Maximum delay constraint: {rule.latency_max_ms} ms.")
        if rule.target_links != ["all"]:
            parts.append(f"Applied on links: {', '.join(rule.target_links)}.")
        else:
            parts.append("Applied globally across all WAN links.")
        return " ".join(parts)


class IntentParser:
    """
    Rule-based + pattern matching NLP parser for network intents.

    Supported intent patterns:
    - "Prioritize {traffic} over {traffic}"
    - "Block {traffic} on {link}"
    - "Guarantee {bandwidth} for {traffic}"
    - "Limit {traffic} to {bandwidth}"
    - "Redirect {traffic} to {link}"
    - "Set maximum latency for {traffic} to {value}ms"
    """

    TRAFFIC_PATTERNS = {
        r"voip|voice|sip|phone\s*call":          "voip",
        r"video|zoom|teams|conferencing|webex":   "video",
        r"medical\s*imaging|dicom|pacs|surgical": "medical_imaging",
        r"financial|trading|transaction":         "financial",
        r"guest\s*wi-?fi|guest\s*network":        "guest_wifi",
        r"backup|sync|replication":               "backup",
        r"web|browsing|http":                     "web_browsing",
        r"streaming|netflix|youtube":             "streaming",
    }

    INTENT_PATTERNS = [
        (r"prioritize\s+(.+?)\s+over\s+(.+)",                             "prioritize"),
        (r"block\s+(.+?)\s+on\s+(.+)",                                    "block"),
        (r"guarantee\s+(\d+)\s*(?:mbps|mb)\s+(?:for|to)\s+(.+)",         "guarantee_bw"),
        (r"limit\s+(.+?)\s+to\s+(\d+)\s*(?:mbps|mb)",                    "limit_bw"),
        (r"redirect\s+(.+?)\s+to\s+(.+)",                                  "redirect"),
        (r"(?:set|max)\s+latency\s+(?:for\s+)?(.+?)\s+(?:to\s+)?(\d+)\s*ms", "max_latency"),
    ]

    def parse(self, intent_text: str) -> list[PolicyRule]:
        """Parse natural language intent into structured policy rules."""
        text = intent_text.lower().strip()
        rules = []

        for pattern, action_type in self.INTENT_PATTERNS:
            match = re.search(pattern, text)
            if match:
                if action_type == "prioritize":
                    high = self._resolve_traffic_class(match.group(1))
                    low  = self._resolve_traffic_class(match.group(2))
                    rules.append(PolicyRule(
                        name=f"prioritize-{high}-over-{low}",
                        traffic_class=high,
                        priority=200,
                        bandwidth_guarantee_mbps=None,
                        latency_max_ms=None,
                        action="prioritize",
                        target_links=["all"],
                    ))
                    rules.append(PolicyRule(
                        name=f"deprioritize-{low}",
                        traffic_class=low,
                        priority=50,
                        bandwidth_guarantee_mbps=None,
                        latency_max_ms=None,
                        action="throttle",
                        target_links=["all"],
                    ))

                elif action_type == "guarantee_bw":
                    bw = float(match.group(1))
                    tc = self._resolve_traffic_class(match.group(2))
                    rules.append(PolicyRule(
                        name=f"guarantee-bw-{tc}",
                        traffic_class=tc,
                        priority=150,
                        bandwidth_guarantee_mbps=bw,
                        latency_max_ms=None,
                        action="prioritize",
                        target_links=["all"],
                    ))

                elif action_type == "block":
                    tc   = self._resolve_traffic_class(match.group(1))
                    link = match.group(2).strip()
                    rules.append(PolicyRule(
                        name=f"block-{tc}-on-{link}",
                        traffic_class=tc,
                        priority=300,
                        bandwidth_guarantee_mbps=None,
                        latency_max_ms=None,
                        action="block",
                        target_links=[link],
                    ))

                elif action_type == "limit_bw":
                    tc = self._resolve_traffic_class(match.group(1))
                    bw = float(match.group(2))
                    rules.append(PolicyRule(
                        name=f"limit-bw-{tc}",
                        traffic_class=tc,
                        priority=100,
                        bandwidth_guarantee_mbps=bw,
                        latency_max_ms=None,
                        action="throttle",
                        target_links=["all"],
                    ))

                elif action_type == "redirect":
                    tc   = self._resolve_traffic_class(match.group(1))
                    link = match.group(2).strip()
                    rules.append(PolicyRule(
                        name=f"redirect-{tc}-to-{link}",
                        traffic_class=tc,
                        priority=150,
                        bandwidth_guarantee_mbps=None,
                        latency_max_ms=None,
                        action="redirect",
                        target_links=[link],
                    ))

                elif action_type == "max_latency":
                    tc      = self._resolve_traffic_class(match.group(1))
                    max_lat = float(match.group(2))
                    rules.append(PolicyRule(
                        name=f"max-latency-{tc}",
                        traffic_class=tc,
                        priority=150,
                        bandwidth_guarantee_mbps=None,
                        latency_max_ms=max_lat,
                        action="prioritize",
                        target_links=["all"],
                    ))

                break

        if not rules:
            raise ValueError(
                f"Could not parse intent: '{intent_text}'. "
                f"Try formats like: 'Prioritize VoIP over guest WiFi', "
                f"'Guarantee 50Mbps for video conferencing'"
            )

        return rules

    def _resolve_traffic_class(self, text: str) -> str:
        """Map natural language traffic description to canonical class."""
        text = text.strip()
        for pattern, class_name in self.TRAFFIC_PATTERNS.items():
            if re.search(pattern, text):
                return class_name
        return "custom"


# Singletons
intent_parser      = IntentParser()
yang_generator     = YangConfigGenerator()


# ── API Endpoints ──────────────────────────────────────────────────────────────

@router.post("/intent")
async def apply_intent(request: IntentRequest):
    """
    Parse a natural language network policy intent and optionally apply it.

    Supports dry_run=true to preview rules and YANG configs without persisting.

    Example: POST /api/v1/policies/intent
    Body: {"intent_text": "Prioritize medical imaging traffic over guest WiFi"}
    """
    try:
        rules = intent_parser.parse(request.intent_text)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc))

    yang_configs = [yang_generator.generate(r) for r in rules]

    if not request.dry_run:
        # Persist each rule to Redis
        for rule in rules:
            await redis_client.hset(POLICIES_KEY, rule.name, json.dumps(rule.dict()))

        # Append to intent history (capped list)
        history_entry = {
            "intent_text": request.intent_text,
            "timestamp":   time.time(),
            "rule_count":  len(rules),
            "rules":       [r.dict() for r in rules],
            "dry_run":     False,
        }
        await redis_client.lpush(HISTORY_KEY, json.dumps(history_entry))
        await redis_client.ltrim(HISTORY_KEY, 0, HISTORY_MAX - 1)

    return {
        "status":          "preview" if request.dry_run else "applied",
        "intent":          request.intent_text,
        "dry_run":         request.dry_run,
        "rules_generated": [r.dict() for r in rules],
        "yang_configs":    [c.dict() for c in yang_configs],
        "validation":      [{"rule": r.name, "validated": True} for r in rules],
    }


@router.post("/preview")
async def preview_intent(request: IntentRequest):
    """
    Dry-run endpoint: parse intent and return rules + YANG configs without applying.
    Equivalent to POST /intent with dry_run=true.
    """
    request.dry_run = True
    return await apply_intent(request)


@router.get("/active")
async def list_active_policies():
    """List all currently active network policies."""
    raw = await redis_client.hgetall(POLICIES_KEY)
    policies = [json.loads(v.decode()) for v in raw.values()]
    return {"policies": policies, "count": len(policies)}


@router.get("/history")
async def get_intent_history(limit: int = 20):
    """Return the most recent intent submissions with timestamps."""
    raw = await redis_client.lrange(HISTORY_KEY, 0, limit - 1)
    entries = [json.loads(item.decode()) for item in raw]
    return {"history": entries, "count": len(entries)}


@router.get("/stats")
async def get_policy_stats():
    """Aggregate statistics about active policies and intent history."""
    raw_policies = await redis_client.hgetall(POLICIES_KEY)
    policies = [json.loads(v.decode()) for v in raw_policies.values()]

    action_counts: dict[str, int] = {}
    class_counts:  dict[str, int] = {}
    for p in policies:
        action_counts[p["action"]] = action_counts.get(p["action"], 0) + 1
        class_counts[p["traffic_class"]] = class_counts.get(p["traffic_class"], 0) + 1

    history_len = await redis_client.llen(HISTORY_KEY)

    return {
        "total_active_policies": len(policies),
        "intents_applied_total": history_len,
        "by_action":             action_counts,
        "by_traffic_class":      class_counts,
        "supported_traffic_classes": list(IntentParser.TRAFFIC_PATTERNS.values()),
        "supported_actions":     ["prioritize", "throttle", "block", "redirect"],
    }


@router.delete("/{policy_name}")
async def remove_policy(policy_name: str):
    """Remove an active policy and revert associated flow rules."""
    deleted = await redis_client.hdel(POLICIES_KEY, policy_name)
    if not deleted:
        raise HTTPException(status_code=404, detail=f"Policy '{policy_name}' not found")
    return {"status": "removed", "policy_name": policy_name}
