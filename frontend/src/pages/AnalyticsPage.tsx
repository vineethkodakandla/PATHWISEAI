import React from 'react';
import { motion } from 'framer-motion';
import { BarChart3, TrendingUp, Activity, Zap } from 'lucide-react';
import { useAppStore } from '../store/networkStore';
import {
  LineChart, Line, AreaChart, Area, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip, Legend,
  ResponsiveContainer, RadarChart, Radar, PolarGrid,
  PolarAngleAxis, PolarRadiusAxis,
} from 'recharts';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit:    { opacity: 0, y: -20, transition: { duration: 0.2 } },
};

const LINK_ORDER = ['fiber-primary', 'broadband', '5g-mobile', 'satellite'];
const COLORS: Record<string, string> = {
  'fiber-primary': '#00d4ff',
  'broadband':     '#7c3aed',
  '5g-mobile':     '#00ff88',
  'satellite':     '#ff8c00',
};

const customTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card p-3 text-xs border border-pw-border">
      <p className="text-pw-muted mb-2 font-mono">{label}</p>
      {payload.map((p: any) => (
        <div key={p.name} className="flex items-center gap-2 mb-1">
          <span style={{ color: p.color }}>●</span>
          <span className="text-pw-muted">{p.name}:</span>
          <span className="text-pw-text font-semibold">{typeof p.value === 'number' ? p.value.toFixed(1) : p.value}</span>
        </div>
      ))}
    </div>
  );
};

const AnalyticsPage: React.FC = () => {
  const networks = useAppStore((s) => s.networks);
  const predictions = useAppStore((s) => s.predictions);
  const comparison = useAppStore((s) => s.comparison);
  const lstmEnabled = useAppStore((s) => s.lstmEnabled);

  // History latency chart data (last 30 ticks)
  const historyLength = Math.max(
    ...LINK_ORDER.map((nid) => (networks[nid]?.history || []).length)
  );

  const historyData = Array.from({ length: Math.min(historyLength, 30) }).map((_, i) => {
    const entry: Record<string, number | string> = { t: `t-${29 - i}` };
    for (const nid of LINK_ORDER) {
      const hist = networks[nid]?.history || [];
      const idx = Math.max(0, hist.length - 30 + i);
      entry[nid] = hist[idx]?.latency_ms ?? 0;
    }
    return entry;
  });

  // Prediction chart (next 30s)
  const predData = Array.from({ length: 30 }).map((_, i) => {
    const entry: Record<string, number | string> = { t: `+${i}s` };
    for (const nid of LINK_ORDER) {
      entry[nid] = (predictions[nid]?.[i] ?? 0);
    }
    return entry;
  });

  // Radar chart: current health metrics per network
  const radarData = [
    { metric: 'Health', ...Object.fromEntries(LINK_ORDER.map((nid) => [nid, networks[nid]?.health_score ?? 0])) },
    { metric: 'Signal', ...Object.fromEntries(LINK_ORDER.map((nid) => [nid, networks[nid]?.signal_strength ?? 0])) },
    { metric: 'Low Loss', ...Object.fromEntries(LINK_ORDER.map((nid) => [nid, Math.max(0, 100 - (networks[nid]?.packet_loss_pct ?? 0) * 20)])) },
    { metric: 'Low Jitter', ...Object.fromEntries(LINK_ORDER.map((nid) => [nid, Math.max(0, 100 - (networks[nid]?.jitter_ms ?? 0) * 2)])) },
    { metric: 'Bandwidth', ...Object.fromEntries(LINK_ORDER.map((nid) => [nid, Math.min(100, ((networks[nid]?.bandwidth_mbps ?? 0) / 10))])) },
  ];

  // Comparison bar chart
  const compBarData = comparison ? [
    { name: 'Avg Latency (ms)', LSTM: comparison.lstm_avg_latency, Naive: comparison.naive_avg_latency },
    { name: 'Switch Count', LSTM: comparison.lstm_switches, Naive: comparison.naive_switches },
  ] : [];

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pw-text flex items-center gap-2">
            <BarChart3 className="w-6 h-6 text-pw-purple" />
            Analytics
          </h1>
          <p className="text-sm text-pw-muted mt-1">
            Deep telemetry analysis and LSTM prediction accuracy
          </p>
        </div>
      </div>

      {/* Top stats */}
      {comparison && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[
            { label: 'LSTM Avg Latency', value: `${comparison.lstm_avg_latency.toFixed(1)}ms`, color: '#00d4ff', icon: Zap },
            { label: 'Naive Avg Latency', value: `${comparison.naive_avg_latency.toFixed(1)}ms`, color: '#ff8c00', icon: Activity },
            { label: 'Latency Improvement', value: `${comparison.improvement_pct.toFixed(1)}%`, color: '#00ff88', icon: TrendingUp },
            { label: 'Total Switches', value: `${comparison.lstm_switches + comparison.naive_switches}`, color: '#7c3aed', icon: BarChart3 },
          ].map(({ label, value, color, icon: Icon }) => (
            <div key={label} className="glass-card p-5">
              <div className="flex items-center gap-2 mb-2">
                <Icon className="w-4 h-4" style={{ color }} />
                <span className="text-xs text-pw-muted uppercase tracking-wide">{label}</span>
              </div>
              <p className="text-2xl font-bold tabular-nums" style={{ color }}>{value}</p>
            </div>
          ))}
        </div>
      )}

      {/* Historical latency chart */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-pw-muted uppercase tracking-wider mb-5">
          Historical Latency — All Networks (last 30 ticks)
        </h3>
        <ResponsiveContainer width="100%" height={240}>
          <LineChart data={historyData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
            <XAxis dataKey="t" tick={{ fill: '#7a9bb5', fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
            <YAxis tick={{ fill: '#7a9bb5', fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
            <Tooltip content={customTooltip} />
            <Legend wrapperStyle={{ fontSize: '11px', color: '#7a9bb5' }} />
            {LINK_ORDER.map((nid) => (
              <Line key={nid} type="monotone" dataKey={nid} stroke={COLORS[nid]} strokeWidth={1.5} dot={false}
                name={networks[nid]?.name || nid} isAnimationActive={false} />
            ))}
          </LineChart>
        </ResponsiveContainer>
      </div>

      {/* Grid: Predictions + Radar */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Prediction chart */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-pw-muted uppercase tracking-wider mb-5">
            LSTM Latency Forecast — Next 30 Seconds
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <AreaChart data={predData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
              <defs>
                {LINK_ORDER.map((nid) => (
                  <linearGradient key={nid} id={`ag-${nid}`} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor={COLORS[nid]} stopOpacity={0.2} />
                    <stop offset="95%" stopColor={COLORS[nid]} stopOpacity={0} />
                  </linearGradient>
                ))}
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
              <XAxis dataKey="t" tick={{ fill: '#7a9bb5', fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fill: '#7a9bb5', fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
              <Tooltip content={customTooltip} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#7a9bb5' }} />
              {LINK_ORDER.map((nid) => (
                <Area key={nid} type="monotone" dataKey={nid} stroke={COLORS[nid]} strokeWidth={1.5}
                  fill={`url(#ag-${nid})`} dot={false} name={networks[nid]?.name || nid} isAnimationActive={false} />
              ))}
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Radar chart */}
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-pw-muted uppercase tracking-wider mb-5">
            Network Quality Profile
          </h3>
          <ResponsiveContainer width="100%" height={220}>
            <RadarChart data={radarData}>
              <PolarGrid stroke="rgba(255,255,255,0.08)" />
              <PolarAngleAxis dataKey="metric" tick={{ fill: '#7a9bb5', fontSize: 10 }} />
              <PolarRadiusAxis angle={30} domain={[0, 100]} tick={false} axisLine={false} />
              {LINK_ORDER.map((nid) => (
                <Radar key={nid} name={networks[nid]?.name || nid} dataKey={nid}
                  stroke={COLORS[nid]} fill={COLORS[nid]} fillOpacity={0.08} strokeWidth={1.5} />
              ))}
              <Legend wrapperStyle={{ fontSize: '11px', color: '#7a9bb5' }} />
              <Tooltip content={customTooltip} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Comparison bar chart */}
      {comparison && compBarData.length > 0 && (
        <div className="glass-card p-6">
          <h3 className="text-sm font-semibold text-pw-muted uppercase tracking-wider mb-5">
            LSTM vs Naive — Side-by-Side
          </h3>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={compBarData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }} barCategoryGap="30%">
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
              <XAxis dataKey="name" tick={{ fill: '#7a9bb5', fontSize: 11 }} tickLine={false} axisLine={false} />
              <YAxis tick={{ fill: '#7a9bb5', fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
              <Tooltip content={customTooltip} />
              <Legend wrapperStyle={{ fontSize: '11px', color: '#7a9bb5' }} />
              <Bar dataKey="LSTM" fill="#00d4ff" radius={[4,4,0,0]} />
              <Bar dataKey="Naive" fill="#ff8c00" radius={[4,4,0,0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </motion.div>
  );
};

export default AnalyticsPage;
