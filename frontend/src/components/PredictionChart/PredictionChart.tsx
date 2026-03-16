import React, { useMemo } from "react";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useNetworkStore } from "../../store/networkStore";

type MetricKey = "latency" | "jitter" | "packet_loss";

const LINK_COLORS: Record<string, string> = {
  "fiber-primary": "#6366f1",
  "broadband-secondary": "#22d3ee",
  "satellite-backup": "#fbbf24",
  "5g-mobile": "#34d399",
};

const METRIC_LABELS: Record<MetricKey, { label: string; unit: string }> = {
  latency: { label: "Latency Forecast", unit: "ms" },
  jitter: { label: "Jitter Forecast", unit: "ms" },
  packet_loss: { label: "Packet Loss Forecast", unit: "%" },
};

interface PredictionChartProps {
  metric?: MetricKey;
  linkId?: string;
  height?: number;
  showLegend?: boolean;
  className?: string;
}

const PredictionChart: React.FC<PredictionChartProps> = ({
  metric = "latency",
  linkId,
  height = 200,
  showLegend = true,
  className = "",
}) => {
  const scoreboard = useNetworkStore((s) => s.scoreboard);
  const predictions = useNetworkStore((s) => s.predictions);

  const allLinkIds = linkId
    ? [linkId]
    : Object.keys(scoreboard).length > 0
    ? Object.keys(scoreboard)
    : Object.keys(LINK_COLORS);

  const chartData = useMemo(() => {
    const maxLen = Math.max(
      ...allLinkIds.map((id) => {
        if (metric === "latency") {
          return (scoreboard[id]?.latency_forecast || []).length;
        }
        const pred = predictions[id];
        if (!pred) return 0;
        return metric === "jitter"
          ? (pred.jitter_forecast || []).length
          : (pred.packet_loss_forecast || []).length;
      }),
      0
    );

    if (maxLen === 0) return [];

    return Array.from({ length: maxLen }, (_, i) => {
      const point: Record<string, number> = { t: i };
      allLinkIds.forEach((id) => {
        if (metric === "latency") {
          point[id] = (scoreboard[id]?.latency_forecast || [])[i] ?? 0;
        } else {
          const pred = predictions[id];
          const arr =
            metric === "jitter"
              ? pred?.jitter_forecast
              : pred?.packet_loss_forecast;
          point[id] = (arr || [])[i] ?? 0;
        }
      });
      return point;
    });
  }, [scoreboard, predictions, metric, allLinkIds]);

  const { label, unit } = METRIC_LABELS[metric];

  if (chartData.length === 0) {
    return (
      <div
        className={`${className}`}
        style={{ height }}
      >
        <div
          className="w-full h-full bg-pw-bg/50 rounded-xl animate-pulse"
        />
      </div>
    );
  }

  return (
    <div className={className}>
      <div style={{ height }}>
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={chartData}>
            <XAxis dataKey="t" hide />
            <YAxis
              domain={["auto", "auto"]}
              tick={{ fill: "#94a3b8", fontSize: 10 }}
              width={40}
              unit={unit}
            />
            <Tooltip
              contentStyle={{
                background: "#1a2035",
                border: "1px solid #1f2a40",
                borderRadius: "8px",
                fontSize: 11,
              }}
              formatter={(value: number) => [`${value.toFixed(2)}${unit}`, ""]}
            />
            {allLinkIds.map((id) => (
              <Line
                key={id}
                dataKey={id}
                stroke={LINK_COLORS[id] || "#6366f1"}
                strokeWidth={1.5}
                dot={false}
                type="monotone"
                name={id}
              />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {showLegend && (
        <div className="flex items-center gap-4 mt-3 justify-center flex-wrap">
          {allLinkIds.map((id) => (
            <span key={id} className="flex items-center gap-1.5 text-[10px] text-pw-muted">
              <div
                className="w-2 h-2 rounded-full"
                style={{ background: LINK_COLORS[id] || "#6366f1" }}
              />
              {id.split("-")[0]}
            </span>
          ))}
        </div>
      )}

      <p className="text-[10px] text-pw-muted text-center mt-1">{label}</p>
    </div>
  );
};

export default PredictionChart;
export { PredictionChart };
