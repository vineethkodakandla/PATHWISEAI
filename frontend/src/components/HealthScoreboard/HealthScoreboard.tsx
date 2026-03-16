import React from "react";
import { Activity } from "lucide-react";
import { AreaChart, Area, ResponsiveContainer } from "recharts";
import { useNetworkStore } from "../../store/networkStore";

interface HealthCardProps {
  linkId: string;
  health: {
    health_score: number;
    confidence: number;
    latency_current: number;
    jitter_current: number;
    packet_loss_current: number;
    trend: string;
    brownout_active: boolean;
    latency_forecast?: number[];
  };
}

function HealthCard({ linkId, health }: HealthCardProps) {
  const score = health.health_score;
  const scoreColor =
    score >= 70 ? "text-pw-emerald" : score >= 40 ? "text-pw-amber" : "text-pw-rose";
  const ringColor =
    score >= 70 ? "#34d399" : score >= 40 ? "#fbbf24" : "#f43f5e";

  const sparkData = (health.latency_forecast || []).slice(0, 10).map((v, i) => ({
    t: i,
    v,
  }));

  return (
    <div
      className={`bg-pw-bg/60 rounded-xl p-4 border transition-all duration-300 ${
        health.brownout_active
          ? "border-pw-rose/40 shadow-lg shadow-pw-rose/5"
          : "border-pw-border/50 hover:border-pw-border"
      }`}
    >
      <div className="flex items-center justify-between mb-3">
        <div>
          <p className="text-xs font-semibold text-white">
            {linkId.replace("-", " ").replace(/\b\w/g, (c) => c.toUpperCase())}
          </p>
          <p className="text-[10px] text-pw-muted capitalize">{health.trend}</p>
        </div>
        {/* Circular score */}
        <div className="relative w-12 h-12">
          <svg className="w-12 h-12 -rotate-90" viewBox="0 0 48 48">
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke="#1f2a40"
              strokeWidth="3"
            />
            <circle
              cx="24"
              cy="24"
              r="20"
              fill="none"
              stroke={ringColor}
              strokeWidth="3"
              strokeDasharray={`${(score / 100) * 125.6} 125.6`}
              strokeLinecap="round"
            />
          </svg>
          <span
            className={`absolute inset-0 flex items-center justify-center text-xs font-bold ${scoreColor}`}
          >
            {score.toFixed(0)}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center text-[10px]">
        <div>
          <p className="text-pw-muted">Latency</p>
          <p className="text-pw-text font-semibold">
            {health.latency_current.toFixed(0)}ms
          </p>
        </div>
        <div>
          <p className="text-pw-muted">Jitter</p>
          <p className="text-pw-text font-semibold">
            {health.jitter_current.toFixed(1)}ms
          </p>
        </div>
        <div>
          <p className="text-pw-muted">Loss</p>
          <p className="text-pw-text font-semibold">
            {health.packet_loss_current.toFixed(2)}%
          </p>
        </div>
      </div>

      {sparkData.length > 2 && (
        <div className="h-8 mt-2 -mx-1">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={sparkData}>
              <defs>
                <linearGradient id={`hs-${linkId}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={ringColor} stopOpacity={0.3} />
                  <stop offset="100%" stopColor={ringColor} stopOpacity={0} />
                </linearGradient>
              </defs>
              <Area
                type="monotone"
                dataKey="v"
                stroke={ringColor}
                strokeWidth={1}
                fill={`url(#hs-${linkId})`}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

interface HealthScoreboardProps {
  className?: string;
  showTitle?: boolean;
}

const HealthScoreboard: React.FC<HealthScoreboardProps> = ({
  className = "",
  showTitle = true,
}) => {
  const scoreboard = useNetworkStore((s) => s.scoreboard);
  const links = Object.entries(scoreboard);

  return (
    <div className={`glass-card p-6 ${className}`}>
      {showTitle && (
        <div className="flex items-center gap-2 mb-4">
          <Activity className="w-4 h-4 text-pw-accent-light" />
          <h2 className="text-sm font-semibold text-white">
            Link Health Scoreboard
          </h2>
        </div>
      )}
      {links.length === 0 ? (
        <p className="text-pw-muted text-sm text-center py-8">
          Waiting for telemetry…
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {links.map(([linkId, health]) => (
            <HealthCard key={linkId} linkId={linkId} health={health} />
          ))}
        </div>
      )}
    </div>
  );
};

export default HealthScoreboard;
export { HealthScoreboard };
