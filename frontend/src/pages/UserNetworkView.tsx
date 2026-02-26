import React, { useRef, useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Wifi, Signal, Zap, ZapOff, TrendingUp, TrendingDown, Minus,
  ArrowRight, CheckCircle2, Clock, AlertTriangle, Activity,
  ChevronDown, ChevronUp, Globe, Layers,
} from 'lucide-react';
import { useAppStore } from '../store/networkStore';
import { NetworkMetrics } from '../types';
import { AreaChart, Area, ResponsiveContainer, Tooltip } from 'recharts';

const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit:    { opacity: 0, y: -20, transition: { duration: 0.2 } },
};

const LINK_ORDER = ['fiber-primary', 'broadband', '5g-mobile', 'satellite'];

const NETWORK_ICONS: Record<string, React.FC<{ className?: string; style?: React.CSSProperties }>> = {
  fiber:      ({ className, style }) => <Globe className={className} style={style} />,
  broadband:  ({ className, style }) => <Signal className={className} style={style} />,
  '5g':       ({ className, style }) => <Wifi className={className} style={style} />,
  satellite:  ({ className, style }) => <Layers className={className} style={style} />,
};

function getHealthColor(score: number): string {
  if (score >= 70) return '#00ff88';
  if (score >= 40) return '#ff8c00';
  return '#ff2d55';
}

function getHealthLabel(score: number): string {
  if (score >= 80) return 'Excellent';
  if (score >= 60) return 'Good';
  if (score >= 40) return 'Fair';
  return 'Poor';
}

function getTrendIcon(trend: string) {
  if (trend === 'improving') return <TrendingUp className="w-3 h-3 text-pw-green" />;
  if (trend === 'degrading') return <TrendingDown className="w-3 h-3 text-pw-red" />;
  return <Minus className="w-3 h-3 text-pw-muted" />;
}

// ─── Animated Signal Bars ──────────────────────────────────────────────────────
const SignalBars: React.FC<{ strength: number; color: string }> = ({ strength, color }) => {
  const bars = 5;
  const filled = Math.ceil((strength / 100) * bars);
  return (
    <div className="flex items-end gap-0.5 h-5">
      {Array.from({ length: bars }).map((_, i) => (
        <motion.div
          key={i}
          animate={{ scaleY: i < filled ? 1 : 0.3, opacity: i < filled ? 1 : 0.2 }}
          transition={{ duration: 0.3, delay: i * 0.03 }}
          className="w-2 rounded-sm origin-bottom"
          style={{
            height: `${40 + i * 15}%`,
            backgroundColor: i < filled ? color : 'rgba(255,255,255,0.15)',
            filter: i < filled ? `drop-shadow(0 0 3px ${color})` : 'none',
          }}
        />
      ))}
    </div>
  );
};

// ─── Health Score Ring ─────────────────────────────────────────────────────────
const HealthRing: React.FC<{ score: number; size?: number }> = ({ score, size = 64 }) => {
  const color = getHealthColor(score);
  const r = (size - 8) / 2;
  const circ = 2 * Math.PI * r;
  const filled = (score / 100) * circ;

  return (
    <div className="relative" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="health-ring-svg">
        <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="4" />
        <motion.circle
          cx={size/2} cy={size/2} r={r}
          fill="none"
          stroke={color}
          strokeWidth="4"
          strokeLinecap="round"
          animate={{ strokeDasharray: `${filled} ${circ}` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-sm font-bold tabular-nums" style={{ color }}>
          {Math.round(score)}
        </span>
      </div>
    </div>
  );
};

// ─── Sparkline ─────────────────────────────────────────────────────────────────
const LatencySparkline: React.FC<{ data: number[]; color: string }> = ({ data, color }) => {
  const chartData = data.map((v, i) => ({ i, v }));
  return (
    <ResponsiveContainer width="100%" height={40}>
      <AreaChart data={chartData} margin={{ top: 2, right: 0, bottom: 2, left: 0 }}>
        <defs>
          <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area
          type="monotone" dataKey="v" stroke={color} strokeWidth={1.5}
          fill={`url(#grad-${color.replace('#','')})`} dot={false} isAnimationActive={false}
        />
        <Tooltip
          contentStyle={{ display: 'none' }}
          cursor={{ stroke: color, strokeWidth: 1, strokeDasharray: '3 2' }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
};

// ─── Animated Data Packet ──────────────────────────────────────────────────────
const DataPackets: React.FC<{ active: boolean; color: string }> = ({ active, color }) => {
  const COUNT = 6;
  return (
    <div className="relative h-2 w-full overflow-hidden">
      {active && Array.from({ length: COUNT }).map((_, i) => (
        <motion.div
          key={i}
          className="absolute top-0 h-1.5 w-4 rounded-full"
          style={{ backgroundColor: color, filter: `drop-shadow(0 0 4px ${color})` }}
          initial={{ left: '-5%', opacity: 0 }}
          animate={{ left: '105%', opacity: [0, 1, 1, 0] }}
          transition={{
            duration: 1.5 + Math.random(),
            repeat: Infinity,
            delay: i * (2 / COUNT) + Math.random() * 0.5,
            ease: 'linear',
          }}
        />
      ))}
      {!active && (
        <div className="h-1.5 w-full rounded-full bg-white/8" />
      )}
    </div>
  );
};

// ─── Individual Network Card ───────────────────────────────────────────────────
const NetworkCard: React.FC<{
  net: NetworkMetrics;
  isSelected: boolean;
  isLSTMWouldPick: boolean;
  lstmEnabled: boolean;
  predictions: number[];
}> = ({ net, isSelected, isLSTMWouldPick, lstmEnabled, predictions }) => {
  const [expanded, setExpanded] = useState(false);
  const color = getHealthColor(net.health_score);
  const IconComp = NETWORK_ICONS[net.type] || Wifi;

  const statusLabel = isSelected
    ? lstmEnabled ? 'LSTM ACTIVE' : 'ACTIVE'
    : isLSTMWouldPick && !lstmEnabled
    ? 'LSTM WOULD PICK'
    : net.health_score >= 70
    ? 'STANDBY'
    : 'DEGRADED';

  const statusColors: Record<string, string> = {
    'LSTM ACTIVE': '#00d4ff',
    'ACTIVE': '#00ff88',
    'LSTM WOULD PICK': '#7c3aed',
    'STANDBY': '#7a9bb5',
    'DEGRADED': '#ff2d55',
  };

  const statusColor = statusColors[statusLabel] || '#7a9bb5';

  return (
    <motion.div
      layout
      className={`glass-card overflow-hidden transition-all duration-500 cursor-pointer ${
        isSelected
          ? 'border-opacity-50 scale-100'
          : 'border-white/8 hover:border-white/20 scale-100'
      }`}
      style={isSelected ? { borderColor: `${color}50` } : {}}
      whileHover={{ scale: 1.01 }}
      onClick={() => setExpanded((e) => !e)}
    >
      {/* Active glow overlay */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            key="active-bg"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none"
            style={{ background: `radial-gradient(ellipse at center, ${color}08 0%, transparent 70%)` }}
          />
        )}
      </AnimatePresence>

      {/* Active top strip */}
      <AnimatePresence>
        {isSelected && (
          <motion.div
            key="strip"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 0 }}
            className="h-0.5 origin-left"
            style={{ background: `linear-gradient(90deg, ${color}, transparent)` }}
          />
        )}
      </AnimatePresence>

      <div className="relative p-5">
        {/* Header Row */}
        <div className="flex items-start justify-between mb-4">
          <div className="flex items-center gap-3">
            {/* Icon + signal bars */}
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 ${
              isSelected ? 'shadow-[0_0_16px_rgba(0,212,255,0.3)]' : ''
            }`}
              style={{ background: isSelected ? `${color}20` : 'rgba(255,255,255,0.05)', border: `1px solid ${isSelected ? color + '40' : 'rgba(255,255,255,0.08)'}` }}
            >
              <IconComp className="w-5 h-5" style={{ color: isSelected ? color : '#7a9bb5' }} />
            </div>

            <div>
              <div className="flex items-center gap-2 mb-1">
                <h3 className="text-sm font-bold text-pw-text">{net.name}</h3>
                {getTrendIcon(net.trend)}
              </div>
              <div className="flex items-center gap-2">
                <SignalBars strength={net.signal_strength} color={color} />
                <span className="text-xs text-pw-muted tabular-nums">
                  {net.signal_strength.toFixed(0)}%
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-col items-end gap-2">
            {/* Status badge */}
            <motion.span
              layout
              className="text-xs font-bold px-2.5 py-1 rounded-full"
              style={{
                color: statusColor,
                backgroundColor: `${statusColor}15`,
                border: `1px solid ${statusColor}40`,
                boxShadow: isSelected ? `0 0 12px ${statusColor}40` : 'none',
              }}
            >
              {statusLabel}
            </motion.span>

            {/* Health ring */}
            <HealthRing score={net.health_score} size={52} />
          </div>
        </div>

        {/* Data flow animation */}
        <div className="mb-4">
          <DataPackets active={isSelected} color={color} />
        </div>

        {/* Metrics row */}
        <div className="grid grid-cols-4 gap-2 mb-4">
          {[
            { label: 'Latency', value: `${net.latency_ms.toFixed(0)}ms`, highlight: net.latency_ms < 30 },
            { label: 'Jitter', value: `${net.jitter_ms.toFixed(1)}ms`, highlight: net.jitter_ms < 10 },
            { label: 'Loss', value: `${net.packet_loss_pct.toFixed(2)}%`, highlight: net.packet_loss_pct < 0.5 },
            { label: 'BW', value: `${net.bandwidth_mbps >= 1000 ? (net.bandwidth_mbps/1000).toFixed(1)+'G' : net.bandwidth_mbps.toFixed(0)+'M'}`, highlight: net.bandwidth_mbps > 200 },
          ].map(({ label, value, highlight }) => (
            <div key={label} className="bg-black/20 rounded-lg px-2 py-2 text-center">
              <div className={`text-xs font-bold tabular-nums ${highlight ? 'text-pw-green' : 'text-pw-text'}`}>
                {value}
              </div>
              <div className="text-xs text-pw-muted mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Congestion bar */}
        <div className="mb-3">
          <div className="flex items-center justify-between mb-1">
            <span className="text-xs text-pw-muted">Congestion</span>
            <span className="text-xs tabular-nums text-pw-muted">{net.congestion_pct.toFixed(0)}%</span>
          </div>
          <div className="h-1.5 bg-white/8 rounded-full overflow-hidden">
            <motion.div
              className="h-full rounded-full"
              animate={{ width: `${net.congestion_pct}%` }}
              transition={{ duration: 0.5 }}
              style={{
                background: net.congestion_pct > 60
                  ? 'linear-gradient(90deg, #ff8c00, #ff2d55)'
                  : net.congestion_pct > 30
                  ? 'linear-gradient(90deg, #00d4ff, #ff8c00)'
                  : 'linear-gradient(90deg, #00ff88, #00d4ff)',
              }}
            />
          </div>
        </div>

        {/* Expand toggle */}
        <button
          className="flex items-center gap-1 text-xs text-pw-muted hover:text-pw-text transition-colors w-full justify-center mt-1"
          onClick={(e) => { e.stopPropagation(); setExpanded((x) => !x); }}
        >
          {expanded ? <ChevronUp className="w-3 h-3" /> : <ChevronDown className="w-3 h-3" />}
          {expanded ? 'Less' : '30s forecast'}
        </button>
      </div>

      {/* Expanded: Prediction chart */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            className="overflow-hidden border-t border-white/8"
          >
            <div className="px-5 py-4">
              <p className="text-xs text-pw-muted mb-2">Predicted latency — next 30 seconds</p>
              <LatencySparkline data={predictions.slice(0, 30)} color={color} />
              <div className="flex justify-between text-xs text-pw-muted mt-1">
                <span>now</span>
                <span>+15s</span>
                <span>+30s</span>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Topology Diagram ──────────────────────────────────────────────────────────
const TopologyDiagram: React.FC = () => {
  const networks = useAppStore((s) => s.networks);
  const selectedNetwork = useAppStore((s) => s.selectedNetwork);
  const lstmEnabled = useAppStore((s) => s.lstmEnabled);
  const svgRef = useRef<SVGSVGElement>(null);

  const W = 780, H = 280;
  const leftX = 100, rightX = W - 100, midY = H / 2;
  const LINK_Y: Record<string, number> = {
    'fiber-primary': midY - 75,
    'broadband': midY - 25,
    '5g-mobile': midY + 25,
    'satellite': midY + 75,
  };

  return (
    <div className="glass-card p-6">
      <h3 className="text-sm font-semibold text-pw-muted uppercase tracking-wider mb-4 flex items-center gap-2">
        <Activity className="w-4 h-4" />
        Network Topology — Live View
        {lstmEnabled && (
          <span className="ml-auto text-xs text-pw-cyan bg-pw-cyan/10 px-2 py-0.5 rounded-full border border-pw-cyan/30">
            AI-Optimized Path
          </span>
        )}
      </h3>

      <svg ref={svgRef} width="100%" viewBox={`0 0 ${W} ${H}`} className="overflow-visible">
        <defs>
          {LINK_ORDER.map((nid) => {
            const net = networks[nid];
            const color = net ? getHealthColor(net.health_score) : '#7a9bb5';
            return (
              <linearGradient key={nid} id={`link-grad-${nid}`} x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor={color} stopOpacity="0.8" />
                <stop offset="100%" stopColor={color} stopOpacity="0.4" />
              </linearGradient>
            );
          })}
          <filter id="glow-filter">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {/* Left: User Device */}
        <g>
          <rect x={leftX - 35} y={midY - 22} width={70} height={44} rx={10}
            fill="rgba(13,25,50,0.9)" stroke="rgba(0,212,255,0.4)" strokeWidth={1.5} />
          <text x={leftX} y={midY - 5} textAnchor="middle" fill="#00d4ff" fontSize={10} fontWeight="bold">USER</text>
          <text x={leftX} y={midY + 8} textAnchor="middle" fill="#7a9bb5" fontSize={8}>DEVICE</text>
          {/* pulse ring */}
          <circle cx={leftX} cy={midY - 22} r="8" fill="none" stroke="#00d4ff" strokeWidth="1" opacity="0.6">
            <animate attributeName="r" values="8;16;8" dur="2s" repeatCount="indefinite" />
            <animate attributeName="opacity" values="0.6;0;0.6" dur="2s" repeatCount="indefinite" />
          </circle>
        </g>

        {/* Right: Internet Cloud */}
        <g>
          <rect x={rightX - 40} y={midY - 22} width={80} height={44} rx={10}
            fill="rgba(13,25,50,0.9)" stroke="rgba(124,58,237,0.4)" strokeWidth={1.5} />
          <text x={rightX} y={midY - 5} textAnchor="middle" fill="#a855f7" fontSize={10} fontWeight="bold">INTERNET</text>
          <text x={rightX} y={midY + 8} textAnchor="middle" fill="#7a9bb5" fontSize={8}>CLOUD</text>
        </g>

        {/* WAN Links */}
        {LINK_ORDER.map((nid) => {
          const net = networks[nid];
          if (!net) return null;
          const isActive = selectedNetwork === nid;
          const y = LINK_Y[nid];
          const color = getHealthColor(net.health_score);

          return (
            <g key={nid}>
              {/* Link line */}
              <line
                x1={leftX + 35} y1={y}
                x2={rightX - 40} y2={y}
                stroke={isActive ? color : 'rgba(255,255,255,0.08)'}
                strokeWidth={isActive ? 3 : 1.5}
                strokeDasharray={isActive ? 'none' : '6 3'}
                style={{ filter: isActive ? `drop-shadow(0 0 6px ${color})` : 'none' }}
              />

              {/* Data flow packets on active link */}
              {isActive && (
                <>
                  {[0, 0.33, 0.66].map((offset, i) => (
                    <circle key={i} r="4" fill={color} opacity="0.9"
                      style={{ filter: `drop-shadow(0 0 4px ${color})` }}>
                      <animateMotion dur="1.5s" begin={`${offset * 1.5}s`} repeatCount="indefinite">
                        <mpath href={`#path-${nid}`} />
                      </animateMotion>
                    </circle>
                  ))}
                  <path id={`path-${nid}`} d={`M${leftX + 35},${y} L${rightX - 40},${y}`} fill="none" />
                </>
              )}

              {/* Left junction dot */}
              <circle cx={leftX + 35} cy={y} r={isActive ? 5 : 3}
                fill={isActive ? color : 'rgba(255,255,255,0.15)'}
                style={{ filter: isActive ? `drop-shadow(0 0 6px ${color})` : 'none' }}
              />
              {/* Right junction dot */}
              <circle cx={rightX - 40} cy={y} r={isActive ? 5 : 3}
                fill={isActive ? color : 'rgba(255,255,255,0.15)'}
                style={{ filter: isActive ? `drop-shadow(0 0 6px ${color})` : 'none' }}
              />

              {/* Link label */}
              <text
                x={(leftX + 35 + rightX - 40) / 2}
                y={y - 10}
                textAnchor="middle"
                fill={isActive ? color : '#4a6080'}
                fontSize={9}
                fontWeight={isActive ? 'bold' : 'normal'}
              >
                {net.name}  {net.latency_ms.toFixed(0)}ms
              </text>

              {/* Connector lines from device to junction */}
              <line x1={leftX} y1={midY} x2={leftX + 35} y2={y}
                stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
              <line x1={rightX} y1={midY} x2={rightX - 40} y2={y}
                stroke="rgba(255,255,255,0.06)" strokeWidth={1} />
            </g>
          );
        })}
      </svg>
    </div>
  );
};

// ─── Active Connection Banner ──────────────────────────────────────────────────
const ActiveConnectionBanner: React.FC = () => {
  const selectedNetwork = useAppStore((s) => s.selectedNetwork);
  const networks = useAppStore((s) => s.networks);
  const lstmEnabled = useAppStore((s) => s.lstmEnabled);

  const net = networks[selectedNetwork];
  if (!net) return null;
  const color = getHealthColor(net.health_score);

  return (
    <motion.div
      key={selectedNetwork}
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      className="glass-card p-5 border-opacity-40 relative overflow-hidden"
      style={{ borderColor: `${color}40` }}
    >
      {/* Background gradient */}
      <div className="absolute inset-0 pointer-events-none"
        style={{ background: `radial-gradient(ellipse at left, ${color}06 0%, transparent 60%)` }} />

      <div className="relative flex items-center gap-6">
        {/* Left: Status */}
        <div className="flex items-center gap-3">
          <div className="relative">
            <div className="w-14 h-14 rounded-2xl flex items-center justify-center"
              style={{ background: `${color}20`, border: `1px solid ${color}40`, boxShadow: `0 0 16px ${color}30` }}>
              <Wifi className="w-7 h-7" style={{ color }} />
            </div>
            <span className="absolute -bottom-1 -right-1 w-4 h-4 rounded-full bg-pw-green border-2 border-pw-bg"
              style={{ boxShadow: '0 0 8px rgba(0,255,136,0.6)' }} />
          </div>
          <div>
            <p className="text-xs text-pw-muted mb-0.5 uppercase tracking-wide">
              {lstmEnabled ? 'AI-Selected Network' : 'Active Connection'}
            </p>
            <h2 className="text-xl font-bold" style={{ color }}>{net.name}</h2>
            <p className="text-xs text-pw-muted">{getHealthLabel(net.health_score)} — {net.health_score.toFixed(0)}% health</p>
          </div>
        </div>

        {/* Divider */}
        <div className="h-12 w-px bg-white/10" />

        {/* Center: Key stats */}
        <div className="flex items-center gap-6 flex-1">
          {[
            { label: 'Latency', value: `${net.latency_ms.toFixed(0)}ms`, sub: net.latency_ms < 30 ? 'Excellent' : net.latency_ms < 80 ? 'Good' : 'High' },
            { label: 'Bandwidth', value: net.bandwidth_mbps >= 1000 ? `${(net.bandwidth_mbps/1000).toFixed(1)} Gbps` : `${net.bandwidth_mbps.toFixed(0)} Mbps`, sub: 'Available' },
            { label: 'Packet Loss', value: `${net.packet_loss_pct.toFixed(3)}%`, sub: net.packet_loss_pct < 0.1 ? 'Negligible' : 'Moderate' },
          ].map(({ label, value, sub }) => (
            <div key={label}>
              <p className="text-xs text-pw-muted">{label}</p>
              <p className="text-lg font-bold tabular-nums text-pw-text">{value}</p>
              <p className="text-xs text-pw-muted">{sub}</p>
            </div>
          ))}
        </div>

        {/* Right: AI badge */}
        {lstmEnabled && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            className="flex flex-col items-center gap-1 px-4 py-3 rounded-xl"
            style={{ background: `${color}10`, border: `1px solid ${color}30` }}
          >
            <Zap className="w-5 h-5" style={{ color }} />
            <span className="text-xs font-bold" style={{ color }}>AI Optimized</span>
            <span className="text-xs text-pw-muted">LSTM v2</span>
          </motion.div>
        )}
      </div>
    </motion.div>
  );
};

// ─── LSTM vs Naive Split View ──────────────────────────────────────────────────
const SplitComparison: React.FC = () => {
  const lstmEnabled = useAppStore((s) => s.lstmEnabled);
  const lstmSelected = useAppStore((s) => s.lstmSelected);
  const naiveSelected = useAppStore((s) => s.naiveSelected);
  const networks = useAppStore((s) => s.networks);
  const comparison = useAppStore((s) => s.comparison);

  if (!comparison) return null;

  const lstmNet = networks[lstmSelected];
  const naiveNet = networks[naiveSelected];
  if (!lstmNet || !naiveNet) return null;

  const sameNetwork = lstmSelected === naiveSelected;

  return (
    <div className="glass-card p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-pw-muted uppercase tracking-wider flex items-center gap-2">
          <Zap className="w-4 h-4" />
          Decision Comparison
        </h3>
        {sameNetwork && (
          <span className="text-xs text-pw-muted bg-pw-surface px-2 py-1 rounded-full">
            Both agree on same network
          </span>
        )}
      </div>

      <div className="grid grid-cols-2 gap-4">
        {/* LSTM */}
        <div className={`rounded-xl p-4 ${lstmEnabled ? 'bg-pw-cyan/8 border border-pw-cyan/30' : 'bg-white/3 border border-white/8'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Zap className={`w-4 h-4 ${lstmEnabled ? 'text-pw-cyan' : 'text-pw-muted'}`} />
            <span className={`text-xs font-bold uppercase tracking-wide ${lstmEnabled ? 'text-pw-cyan' : 'text-pw-muted'}`}>
              LSTM Decision
            </span>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <HealthRing score={lstmNet.health_score} size={44} />
            <div>
              <p className="text-sm font-semibold text-pw-text">{lstmNet.name}</p>
              <p className="text-xs text-pw-muted">Predicted optimal</p>
            </div>
          </div>
          <p className="text-xs text-pw-cyan">
            {comparison.lstm_avg_latency.toFixed(1)}ms avg latency • {comparison.lstm_switches} switches
          </p>
        </div>

        {/* Naive */}
        <div className={`rounded-xl p-4 ${!lstmEnabled ? 'bg-pw-orange/8 border border-pw-orange/30' : 'bg-white/3 border border-white/8'}`}>
          <div className="flex items-center gap-2 mb-3">
            <ZapOff className={`w-4 h-4 ${!lstmEnabled ? 'text-pw-orange' : 'text-pw-muted'}`} />
            <span className={`text-xs font-bold uppercase tracking-wide ${!lstmEnabled ? 'text-pw-orange' : 'text-pw-muted'}`}>
              Naive Decision
            </span>
          </div>
          <div className="flex items-center gap-3 mb-2">
            <HealthRing score={naiveNet.health_score} size={44} />
            <div>
              <p className="text-sm font-semibold text-pw-text">{naiveNet.name}</p>
              <p className="text-xs text-pw-muted">Current best</p>
            </div>
          </div>
          <p className="text-xs text-pw-orange">
            {comparison.naive_avg_latency.toFixed(1)}ms avg latency • {comparison.naive_switches} switches
          </p>
        </div>
      </div>

      {/* Improvement */}
      {comparison.improvement_pct > 0 && (
        <motion.div
          layout
          className="mt-3 p-3 rounded-xl bg-pw-green/8 border border-pw-green/30 flex items-center gap-2"
        >
          <CheckCircle2 className="w-4 h-4 text-pw-green shrink-0" />
          <p className="text-xs text-pw-green">
            LSTM reduces average latency by <strong>{comparison.improvement_pct.toFixed(1)}%</strong> over naive selection
          </p>
        </motion.div>
      )}
    </div>
  );
};

// ─── User Network View Page ────────────────────────────────────────────────────
const UserNetworkView: React.FC = () => {
  const networks = useAppStore((s) => s.networks);
  const lstmSelected = useAppStore((s) => s.lstmSelected);
  const naiveSelected = useAppStore((s) => s.naiveSelected);
  const selectedNetwork = useAppStore((s) => s.selectedNetwork);
  const lstmEnabled = useAppStore((s) => s.lstmEnabled);
  const predictions = useAppStore((s) => s.predictions);

  return (
    <motion.div
      variants={pageVariants}
      initial="initial"
      animate="animate"
      exit="exit"
      className="space-y-6"
    >
      {/* Page header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-pw-text flex items-center gap-2">
            <Globe className="w-6 h-6 text-pw-green" />
            Network Simulation
          </h1>
          <p className="text-sm text-pw-muted mt-1">
            {lstmEnabled
              ? 'LSTM AI is actively optimizing your network selection in real time'
              : 'Reactive mode — network selected based on current conditions'
            }
          </p>
        </div>
        <div className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition-all duration-500 ${
          lstmEnabled
            ? 'bg-pw-cyan/10 text-pw-cyan border border-pw-cyan/30'
            : 'bg-pw-surface text-pw-muted border border-white/10'
        }`}>
          {lstmEnabled ? <Zap className="w-4 h-4" /> : <ZapOff className="w-4 h-4" />}
          {lstmEnabled ? 'AI Enhanced' : 'Standard Mode'}
        </div>
      </div>

      {/* Active connection banner */}
      <ActiveConnectionBanner />

      {/* Topology diagram */}
      <TopologyDiagram />

      {/* Network cards grid */}
      <div>
        <h2 className="text-sm font-semibold text-pw-muted uppercase tracking-wider mb-4 flex items-center gap-2">
          <Signal className="w-4 h-4" />
          Available Networks
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
          {LINK_ORDER.map((nid) => {
            const net = networks[nid];
            if (!net) return (
              <div key={nid} className="glass-card p-6 flex items-center justify-center h-48">
                <div className="w-5 h-5 border-2 border-pw-cyan/40 border-t-pw-cyan rounded-full animate-spin" />
              </div>
            );
            return (
              <NetworkCard
                key={nid}
                net={net}
                isSelected={selectedNetwork === nid}
                isLSTMWouldPick={lstmSelected === nid}
                lstmEnabled={lstmEnabled}
                predictions={predictions[nid] || []}
              />
            );
          })}
        </div>
      </div>

      {/* Split comparison */}
      <SplitComparison />
    </motion.div>
  );
};

export default UserNetworkView;
