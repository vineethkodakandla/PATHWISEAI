import React from "react";
import { Network, Cable, Wifi, Satellite, Radio } from "lucide-react";
import { useNetworkStore } from "../../store/networkStore";
import type { LinkHealth, ActiveRoutingRule } from "../../types";

const LINK_META: Record<
  string,
  { label: string; icon: React.ElementType; color: string; gradient: string }
> = {
  "fiber-primary": {
    label: "Fiber Primary",
    icon: Cable,
    color: "#6366f1",
    gradient: "from-indigo-500 to-indigo-600",
  },
  "broadband-secondary": {
    label: "Broadband",
    icon: Wifi,
    color: "#22d3ee",
    gradient: "from-cyan-500 to-cyan-600",
  },
  "satellite-backup": {
    label: "Satellite",
    icon: Satellite,
    color: "#fbbf24",
    gradient: "from-amber-500 to-amber-600",
  },
  "5g-mobile": {
    label: "5G Mobile",
    icon: Radio,
    color: "#34d399",
    gradient: "from-emerald-500 to-emerald-600",
  },
};

const LINK_STAGGER_DURATIONS = ["2.0s", "2.4s", "2.8s", "3.2s"];
const LINK_STAGGER_DURATIONS_2 = ["2.5s", "2.9s", "3.3s", "3.7s"];

interface TopologyMapProps {
  scoreboard?: Record<string, LinkHealth>;
  lstmEnabled?: boolean;
  activeRules?: ActiveRoutingRule[];
  className?: string;
  showTitle?: boolean;
}

const TopologyMap: React.FC<TopologyMapProps> = (props) => {
  const storeScoreboard = useNetworkStore((s) => s.scoreboard);
  const storeLstm = useNetworkStore((s) => s.lstmEnabled);
  const storeRules = useNetworkStore((s) => s.activeRoutingRules);

  const scoreboard = props.scoreboard ?? storeScoreboard;
  const lstmEnabled = props.lstmEnabled ?? storeLstm;
  const activeRules = props.activeRules ?? storeRules;

  const { showTitle = true, className = "" } = props;

  return (
    <div className={`relative ${className}`}>
      {showTitle && (
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Network className="w-4 h-4 text-pw-accent-light" />
            SD-WAN Topology — Live Status
          </h3>
          <div className="flex items-center gap-4 text-xs text-pw-muted">
            <span className="flex items-center gap-1.5">
              <div className="w-3 h-1 rounded-full bg-pw-emerald" /> Healthy
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-3 h-1 rounded-full bg-pw-amber" /> Degraded
            </span>
            <span className="flex items-center gap-1.5">
              <div className="w-3 h-1 rounded-full bg-pw-rose" /> Critical
            </span>
          </div>
        </div>
      )}

      <svg viewBox="0 0 900 260" className="w-full" style={{ maxHeight: 280 }}>
        {/* Background grid */}
        <defs>
          <pattern id="topo-grid" width="20" height="20" patternUnits="userSpaceOnUse">
            <path d="M 20 0 L 0 0 0 20" fill="none" stroke="#1f2a40" strokeWidth="0.3" />
          </pattern>
          <filter id="topo-glow-green">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
          <filter id="topo-node-shadow">
            <feDropShadow dx="0" dy="2" stdDeviation="4" floodOpacity="0.3" />
          </filter>
        </defs>
        <rect width="900" height="260" fill="url(#topo-grid)" rx="12" />

        {/* Switch nodes */}
        <g filter="url(#topo-node-shadow)">
          <rect x="120" y="100" width="100" height="50" rx="12" fill="#1a2035" stroke="#6366f1" strokeWidth="1.5" />
          <text x="170" y="122" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="600">Switch 1</text>
          <text x="170" y="138" textAnchor="middle" fill="#94a3b8" fontSize="9">Edge Router</text>
        </g>
        <g filter="url(#topo-node-shadow)">
          <rect x="680" y="100" width="100" height="50" rx="12" fill="#1a2035" stroke="#6366f1" strokeWidth="1.5" />
          <text x="730" y="122" textAnchor="middle" fill="#e2e8f0" fontSize="11" fontWeight="600">Switch 2</text>
          <text x="730" y="138" textAnchor="middle" fill="#94a3b8" fontSize="9">Edge Router</text>
        </g>

        {/* Host nodes */}
        <g filter="url(#topo-node-shadow)">
          <circle cx="50" cy="125" r="22" fill="#1a2035" stroke="#818cf8" strokeWidth="1.5" />
          <text x="50" y="128" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="600">H1</text>
        </g>
        <g filter="url(#topo-node-shadow)">
          <circle cx="850" cy="125" r="22" fill="#1a2035" stroke="#818cf8" strokeWidth="1.5" />
          <text x="850" y="128" textAnchor="middle" fill="#e2e8f0" fontSize="10" fontWeight="600">H2</text>
        </g>

        {/* Host-to-switch connections */}
        <line x1="72" y1="125" x2="120" y2="125" stroke="#4b5563" strokeWidth="1.5" strokeDasharray="4 2" />
        <line x1="780" y1="125" x2="828" y2="125" stroke="#4b5563" strokeWidth="1.5" strokeDasharray="4 2" />

        {/* WAN Links */}
        {[
          { id: "fiber-primary", y: 55 },
          { id: "broadband-secondary", y: 105 },
          { id: "satellite-backup", y: 155 },
          { id: "5g-mobile", y: 205 },
        ].map(({ id, y }, idx) => {
          const h = scoreboard[id];
          const score = h?.health_score ?? 75;
          const brownout = h?.brownout_active ?? false;
          const meta = LINK_META[id];
          const linkColor =
            score >= 70 ? "#34d399" : score >= 40 ? "#fbbf24" : "#f43f5e";
          const isActive = !brownout || lstmEnabled;

          return (
            <g key={id}>
              {/* Link line */}
              <line
                x1="220"
                y1={y}
                x2="680"
                y2={y}
                stroke={linkColor}
                strokeWidth={isActive ? 2.5 : 1.5}
                strokeOpacity={isActive ? 0.8 : 0.3}
                strokeDasharray={brownout && !lstmEnabled ? "6 4" : "none"}
              />
              {/* Animated flow particles */}
              {isActive && (
                <>
                  <circle r="3" fill={linkColor} opacity="0.9">
                    <animateMotion
                      dur={LINK_STAGGER_DURATIONS[idx]}
                      repeatCount="indefinite"
                      path={`M220,${y} L680,${y}`}
                    />
                  </circle>
                  <circle r="3" fill={linkColor} opacity="0.6">
                    <animateMotion
                      dur={LINK_STAGGER_DURATIONS_2[idx]}
                      repeatCount="indefinite"
                      path={`M220,${y} L680,${y}`}
                      begin="0.8s"
                    />
                  </circle>
                </>
              )}
              {/* Label */}
              <text
                x="450"
                y={y - 8}
                textAnchor="middle"
                fill={linkColor}
                fontSize="9"
                fontWeight="600"
              >
                {meta?.label} — {score.toFixed(0)}
                {brownout && !lstmEnabled ? " ⚠" : ""}
              </text>
              {/* Brownout warning */}
              {brownout && (
                <text
                  x="450"
                  y={y + 14}
                  textAnchor="middle"
                  fill={lstmEnabled ? "#34d399" : "#f43f5e"}
                  fontSize="8"
                >
                  {lstmEnabled ? "✓ Brownout avoided (LSTM)" : "⚠ BROWNOUT ACTIVE"}
                </text>
              )}
            </g>
          );
        })}

        {/* Reroute arcs for active routing rules */}
        {activeRules.map((rule) => {
          const linkYMap: Record<string, number> = {
            "fiber-primary": 55,
            "broadband-secondary": 105,
            "satellite-backup": 155,
            "5g-mobile": 205,
          };
          const yFrom = linkYMap[rule.source_link];
          const yTo = linkYMap[rule.target_link];
          if (yFrom == null || yTo == null) return null;
          const midY = (yFrom + yTo) / 2;
          const curveX = 780;
          return (
            <g key={`reroute-${rule.id}`}>
              <path
                d={`M700,${yFrom} Q${curveX},${midY} 700,${yTo}`}
                fill="none"
                stroke="#10b981"
                strokeWidth="2"
                strokeDasharray="5 3"
                opacity="0.7"
              >
                <animate attributeName="stroke-dashoffset" from="16" to="0" dur="0.8s" repeatCount="indefinite" />
              </path>
              <circle r="4" fill="#10b981">
                <animateMotion
                  dur="1.5s"
                  repeatCount="indefinite"
                  path={`M700,${yFrom} Q${curveX},${midY} 700,${yTo}`}
                />
              </circle>
              <text x={curveX + 8} y={midY + 4} fill="#10b981" fontSize="8" fontWeight="600">
                REROUTE
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
};

export default TopologyMap;
export { TopologyMap };
