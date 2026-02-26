import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Cpu, Zap, ZapOff, TrendingUp, TrendingDown, Minus,
  ArrowRightLeft, Clock, Shield, Activity, ChevronRight,
  ToggleLeft, ToggleRight, AlertTriangle, CheckCircle2,
} from 'lucide-react';
import { useAppStore } from '../store/networkStore';
import { toggleLSTM } from '../hooks/useLiveData';
import { NetworkMetrics, SteeringEvent } from '../types';
import {
  AreaChart, Area, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, LineChart, Line, Legend,
} from 'recharts';

// ─── Page Wrapper ──────────────────────────────────────────────────────────────
const pageVariants = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: { duration: 0.4 } },
  exit:    { opacity: 0, y: -20, transition: { duration: 0.2 } },
};

// ─── LSTM Toggle Section ───────────────────────────────────────────────────────
const LSTMToggleCard: React.FC = () => {
  const lstmEnabled = useAppStore((s) => s.lstmEnabled);
  const setLstmEnabled = useAppStore((s) => s.setLstmEnabled);
  const [toggling, setToggling] = useState(false);

  const handleToggle = async () => {
    if (toggling) return;
    setToggling(true);
    const next = !lstmEnabled;
    const ok = await toggleLSTM(next);
    if (ok) setLstmEnabled(next);
    setToggling(false);
  };

  return (
    <motion.div
      layout
      className={`glass-card p-8 relative overflow-hidden transition-all duration-700 ${
        lstmEnabled ? 'border-pw-cyan/40' : 'border-white/10'
      }`}
    >
      {/* Background glow when active */}
      <AnimatePresence>
        {lstmEnabled && (
          <motion.div
            key="glow"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 bg-gradient-to-br from-pw-cyan/5 via-transparent to-pw-purple/5 pointer-events-none"
          />
        )}
      </AnimatePresence>

      <div className="relative z-10 flex flex-col lg:flex-row items-start lg:items-center gap-8">
        {/* Left: Info */}
        <div className="flex-1">
          <div className="flex items-center gap-3 mb-3">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-500 ${
              lstmEnabled
                ? 'bg-pw-cyan/20 shadow-glow-cyan'
                : 'bg-white/5'
            }`}>
              <Cpu className={`w-6 h-6 transition-colors duration-300 ${lstmEnabled ? 'text-pw-cyan' : 'text-pw-muted'}`} />
            </div>
            <div>
              <h2 className="text-xl font-bold text-pw-text">LSTM Network Intelligence</h2>
              <p className="text-sm text-pw-muted">Long Short-Term Memory Predictive Engine</p>
            </div>
          </div>

          <p className="text-pw-muted text-sm leading-relaxed max-w-2xl">
            When <strong className="text-pw-cyan">enabled</strong>, the LSTM engine analyzes time-series
            telemetry to forecast network conditions 30 seconds ahead — switching proactively before
            degradation occurs. When <strong className="text-pw-text">disabled</strong>, the system
            reacts only to current conditions (greedy/naive selection).
          </p>

          {/* State description */}
          <motion.div
            key={lstmEnabled ? 'on' : 'off'}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            className={`mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium ${
              lstmEnabled
                ? 'bg-pw-green/10 text-pw-green border border-pw-green/30'
                : 'bg-pw-orange/10 text-pw-orange border border-pw-orange/30'
            }`}
          >
            {lstmEnabled ? (
              <><CheckCircle2 className="w-4 h-4" /> Proactive — predicts & prevents degradation</>
            ) : (
              <><AlertTriangle className="w-4 h-4" /> Reactive — responds after degradation occurs</>
            )}
          </motion.div>
        </div>

        {/* Right: Toggle */}
        <div className="flex flex-col items-center gap-4">
          {/* Big animated toggle */}
          <motion.button
            onClick={handleToggle}
            disabled={toggling}
            whileTap={{ scale: 0.97 }}
            className={`relative w-32 h-16 rounded-full cursor-pointer transition-all duration-500 focus:outline-none focus:ring-2 focus:ring-pw-cyan/50 ${
              lstmEnabled
                ? 'bg-gradient-to-r from-pw-cyan/30 to-pw-purple/30 border-2 border-pw-cyan shadow-glow-cyan'
                : 'bg-pw-surface border-2 border-white/15'
            } ${toggling ? 'opacity-70' : ''}`}
          >
            {/* Track label OFF */}
            <span className={`absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold transition-opacity duration-300 ${lstmEnabled ? 'opacity-0' : 'opacity-60 text-pw-muted'}`}>
              OFF
            </span>
            {/* Track label ON */}
            <span className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-bold transition-opacity duration-300 ${lstmEnabled ? 'opacity-100 text-pw-cyan' : 'opacity-0'}`}>
              ON
            </span>
            {/* Thumb */}
            <motion.div
              animate={{ x: lstmEnabled ? 64 : 4 }}
              transition={{ type: 'spring', stiffness: 500, damping: 30 }}
              className={`absolute top-1/2 -translate-y-1/2 w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300 ${
                lstmEnabled
                  ? 'bg-gradient-to-br from-pw-cyan to-[#0099cc] shadow-glow-cyan'
                  : 'bg-gradient-to-br from-slate-600 to-slate-700'
              }`}
              style={{ left: 0 }}
            >
              {lstmEnabled
                ? <Zap className="w-5 h-5 text-white" />
                : <ZapOff className="w-5 h-5 text-slate-400" />
              }
            </motion.div>
          </motion.button>

          <div className="text-center">
            <p className={`text-sm font-semibold transition-colors duration-300 ${lstmEnabled ? 'neon-cyan' : 'text-pw-muted'}`}>
              {lstmEnabled ? 'AI ENABLED' : 'AI DISABLED'}
            </p>
            <p className="text-xs text-pw-muted mt-0.5">
              {toggling ? 'Applying...' : 'Click to toggle'}
            </p>
          </div>
        </div>
      </div>

      {/* Active pulse strip at top */}
      <AnimatePresence>
        {lstmEnabled && (
          <motion.div
            key="strip"
            initial={{ scaleX: 0 }}
            animate={{ scaleX: 1 }}
            exit={{ scaleX: 0 }}
            className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-pw-cyan via-pw-purple to-pw-green origin-left"
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
};

// ─── Comparison Stat Card ──────────────────────────────────────────────────────
const ComparisonCard: React.FC = () => {
  const comparison = useAppStore((s) => s.comparison);
  const lstmEnabled = useAppStore((s) => s.lstmEnabled);

  if (!comparison) {
    return (
      <div className="glass-card p-6 flex items-center justify-center h-48">
        <p className="text-pw-muted text-sm">Collecting performance data...</p>
      </div>
    );
  }

  const { lstm_avg_latency, naive_avg_latency, lstm_switches, naive_switches, improvement_pct } = comparison;
  const lstmBetter = lstm_avg_latency <= naive_avg_latency;

  return (
    <motion.div layout className="glass-card p-6">
      <h3 className="text-sm font-semibold text-pw-muted uppercase tracking-wider mb-5 flex items-center gap-2">
        <ArrowRightLeft className="w-4 h-4" />
        LSTM vs Naive — Performance Comparison
      </h3>

      <div className="grid grid-cols-2 gap-4 mb-5">
        {/* LSTM column */}
        <div className={`rounded-xl p-4 ${lstmEnabled ? 'bg-pw-cyan/10 border border-pw-cyan/30' : 'bg-white/3 border border-white/10'}`}>
          <div className="flex items-center gap-2 mb-3">
            <Zap className={`w-4 h-4 ${lstmEnabled ? 'text-pw-cyan' : 'text-pw-muted'}`} />
            <span className={`text-xs font-bold uppercase ${lstmEnabled ? 'text-pw-cyan' : 'text-pw-muted'}`}>LSTM</span>
            {lstmEnabled && <span className="ml-auto text-xs text-pw-cyan bg-pw-cyan/10 px-2 py-0.5 rounded-full">Active</span>}
          </div>
          <div className="tabular-nums">
            <div className="text-3xl font-bold text-pw-text mb-1">
              {lstm_avg_latency.toFixed(1)}<span className="text-sm text-pw-muted ml-1">ms</span>
            </div>
            <p className="text-xs text-pw-muted">avg latency</p>
            <div className="mt-3 flex items-center gap-1.5">
              <ArrowRightLeft className="w-3 h-3 text-pw-muted" />
              <span className="text-xs text-pw-muted">{lstm_switches} switches</span>
            </div>
          </div>
        </div>

        {/* Naive column */}
        <div className={`rounded-xl p-4 ${!lstmEnabled ? 'bg-pw-orange/10 border border-pw-orange/30' : 'bg-white/3 border border-white/10'}`}>
          <div className="flex items-center gap-2 mb-3">
            <ZapOff className={`w-4 h-4 ${!lstmEnabled ? 'text-pw-orange' : 'text-pw-muted'}`} />
            <span className={`text-xs font-bold uppercase ${!lstmEnabled ? 'text-pw-orange' : 'text-pw-muted'}`}>Naive</span>
            {!lstmEnabled && <span className="ml-auto text-xs text-pw-orange bg-pw-orange/10 px-2 py-0.5 rounded-full">Active</span>}
          </div>
          <div className="tabular-nums">
            <div className="text-3xl font-bold text-pw-text mb-1">
              {naive_avg_latency.toFixed(1)}<span className="text-sm text-pw-muted ml-1">ms</span>
            </div>
            <p className="text-xs text-pw-muted">avg latency</p>
            <div className="mt-3 flex items-center gap-1.5">
              <ArrowRightLeft className="w-3 h-3 text-pw-muted" />
              <span className="text-xs text-pw-muted">{naive_switches} switches</span>
            </div>
          </div>
        </div>
      </div>

      {/* Improvement banner */}
      <div className={`rounded-xl p-4 flex items-center gap-3 ${
        lstmBetter ? 'bg-pw-green/10 border border-pw-green/30' : 'bg-pw-red/10 border border-pw-red/30'
      }`}>
        {lstmBetter
          ? <TrendingUp className="w-5 h-5 text-pw-green shrink-0" />
          : <TrendingDown className="w-5 h-5 text-pw-red shrink-0" />
        }
        <div>
          <p className={`text-sm font-bold ${lstmBetter ? 'text-pw-green' : 'text-pw-red'}`}>
            {lstmBetter
              ? `LSTM reduces latency by ${improvement_pct.toFixed(1)}%`
              : `Insufficient data — collecting baseline...`
            }
          </p>
          <p className="text-xs text-pw-muted mt-0.5">
            {lstm_switches} proactive vs {naive_switches} reactive switches
          </p>
        </div>
      </div>
    </motion.div>
  );
};

// ─── Network Health Grid ───────────────────────────────────────────────────────
const NetworkHealthGrid: React.FC = () => {
  const networks = useAppStore((s) => s.networks);
  const lstmSelected = useAppStore((s) => s.lstmSelected);
  const naiveSelected = useAppStore((s) => s.naiveSelected);
  const lstmEnabled = useAppStore((s) => s.lstmEnabled);

  const LINK_ORDER = ['fiber-primary', 'broadband', '5g-mobile', 'satellite'];

  const getHealthColor = (score: number) =>
    score >= 70 ? '#00ff88' : score >= 40 ? '#ff8c00' : '#ff2d55';

  const getTrendIcon = (trend: string) => {
    if (trend === 'improving') return <TrendingUp className="w-3 h-3 text-pw-green" />;
    if (trend === 'degrading') return <TrendingDown className="w-3 h-3 text-pw-red" />;
    return <Minus className="w-3 h-3 text-pw-muted" />;
  };

  return (
    <div className="glass-card p-6">
      <h3 className="text-sm font-semibold text-pw-muted uppercase tracking-wider mb-5 flex items-center gap-2">
        <Activity className="w-4 h-4" />
        Network Health — Live Status
      </h3>

      <div className="space-y-3">
        {LINK_ORDER.map((nid) => {
          const net = networks[nid];
          if (!net) return null;
          const color = getHealthColor(net.health_score);
          const isLSTMPick = lstmSelected === nid;
          const isNaivePick = naiveSelected === nid;
          const isActive = lstmEnabled ? isLSTMPick : isNaivePick;

          return (
            <motion.div
              key={nid}
              layout
              className={`rounded-xl p-4 flex items-center gap-4 border transition-all duration-500 ${
                isActive
                  ? 'border-opacity-60 bg-opacity-15'
                  : 'border-white/8 bg-white/3'
              }`}
              style={isActive ? { borderColor: color, backgroundColor: `${color}10` } : {}}
            >
              {/* Health ring */}
              <div className="relative w-12 h-12 shrink-0">
                <svg className="w-12 h-12 health-ring-svg" viewBox="0 0 48 48">
                  <circle cx="24" cy="24" r="20" fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="3" />
                  <circle cx="24" cy="24" r="20" fill="none"
                    stroke={color}
                    strokeWidth="3"
                    strokeDasharray={`${(net.health_score / 100) * 125.6} 125.6`}
                    strokeLinecap="round"
                    style={{ filter: `drop-shadow(0 0 4px ${color})` }}
                  />
                </svg>
                <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums" style={{ color }}>
                  {Math.round(net.health_score)}
                </span>
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-sm font-semibold text-pw-text truncate">{net.name}</span>
                  {getTrendIcon(net.trend)}
                  {isActive && (
                    <span className="ml-auto text-xs font-bold px-2 py-0.5 rounded-full"
                      style={{ color, backgroundColor: `${color}15`, border: `1px solid ${color}40` }}>
                      {lstmEnabled ? 'LSTM' : 'Active'}
                    </span>
                  )}
                  {!isActive && isLSTMPick && lstmEnabled === false && (
                    <span className="ml-auto text-xs text-pw-muted">LSTM would pick</span>
                  )}
                </div>
                {/* Mini bar chart */}
                <div className="flex items-end gap-0.5 h-5">
                  {(net.history || []).slice(-20).map((h, i) => (
                    <div
                      key={i}
                      className="w-1.5 rounded-sm transition-all duration-200"
                      style={{
                        height: `${Math.max(10, (h.health_score / 100) * 100)}%`,
                        backgroundColor: color,
                        opacity: 0.3 + (i / 20) * 0.7,
                      }}
                    />
                  ))}
                </div>
              </div>

              {/* Metrics */}
              <div className="grid grid-cols-3 gap-3 text-center text-xs shrink-0">
                {[
                  { label: 'Latency', value: `${net.latency_ms.toFixed(0)}ms` },
                  { label: 'Jitter', value: `${net.jitter_ms.toFixed(1)}ms` },
                  { label: 'Loss', value: `${net.packet_loss_pct.toFixed(2)}%` },
                ].map(({ label, value }) => (
                  <div key={label} className="bg-black/20 rounded-lg px-2 py-1.5">
                    <div className="tabular-nums font-semibold text-pw-text">{value}</div>
                    <div className="text-pw-muted">{label}</div>
                  </div>
                ))}
              </div>
            </motion.div>
          );
        })}
      </div>
    </div>
  );
};

// ─── Decision Log ──────────────────────────────────────────────────────────────
const DecisionLog: React.FC = () => {
  const steeringLog = useAppStore((s) => s.steeringLog);

  const formatTime = (t: number) => {
    const d = new Date(Date.now() - (Date.now() % 1000));
    return d.toLocaleTimeString('en-US', { hour12: false });
  };

  return (
    <div className="glass-card p-6">
      <h3 className="text-sm font-semibold text-pw-muted uppercase tracking-wider mb-5 flex items-center gap-2">
        <Clock className="w-4 h-4" />
        AI Decision Log
        <span className="ml-auto text-xs bg-pw-surface px-2 py-0.5 rounded-full font-mono">
          {steeringLog.length} events
        </span>
      </h3>

      <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
        <AnimatePresence initial={false}>
          {steeringLog.length === 0 ? (
            <p className="text-pw-muted text-sm text-center py-8">
              Waiting for steering events...
            </p>
          ) : (
            steeringLog.map((ev, i) => (
              <motion.div
                key={`${ev.timestamp}-${i}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.3, delay: i * 0.02 }}
                className={`flex items-start gap-3 p-3 rounded-xl border text-xs ${
                  ev.mode === 'LSTM'
                    ? 'bg-pw-cyan/5 border-pw-cyan/20'
                    : 'bg-pw-orange/5 border-pw-orange/20'
                }`}
              >
                <div className={`mt-0.5 w-1.5 h-1.5 rounded-full shrink-0 ${
                  ev.mode === 'LSTM' ? 'bg-pw-cyan' : 'bg-pw-orange'
                }`} />
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5 mb-0.5">
                    <span className={`font-bold ${ev.mode === 'LSTM' ? 'text-pw-cyan' : 'text-pw-orange'}`}>
                      {ev.mode}
                    </span>
                    <span className="text-pw-muted">→</span>
                    <span className="text-pw-text truncate">
                      {ev.from_network} <span className="text-pw-muted">→</span> {ev.to_network}
                    </span>
                  </div>
                  <p className="text-pw-muted truncate">{ev.reason}</p>
                </div>
                <div className="tabular-nums text-pw-muted shrink-0">
                  {Math.round(ev.timestamp)}s
                </div>
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── Latency Comparison Chart ──────────────────────────────────────────────────
const LatencyChart: React.FC = () => {
  const networks = useAppStore((s) => s.networks);
  const lstmSelected = useAppStore((s) => s.lstmSelected);
  const naiveSelected = useAppStore((s) => s.naiveSelected);
  const predictions = useAppStore((s) => s.predictions);

  // Build prediction chart data: next 30s for LSTM pick vs Naive pick
  const lstmPred = predictions[lstmSelected] || [];
  const naivePred = predictions[naiveSelected] || [];
  const chartData = lstmPred.map((v, i) => ({
    t: `+${i}s`,
    lstm: parseFloat(v.toFixed(1)),
    naive: parseFloat((naivePred[i] ?? v).toFixed(1)),
  }));

  const customTooltip = ({ active, payload, label }: any) => {
    if (!active || !payload?.length) return null;
    return (
      <div className="glass-card p-3 text-xs border border-pw-border">
        <p className="text-pw-muted mb-1">{label}</p>
        {payload.map((p: any) => (
          <div key={p.name} className="flex items-center gap-2">
            <span style={{ color: p.color }}>●</span>
            <span className="text-pw-text">{p.name}: {p.value}ms</span>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="glass-card p-6">
      <h3 className="text-sm font-semibold text-pw-muted uppercase tracking-wider mb-5 flex items-center gap-2">
        <Shield className="w-4 h-4" />
        30-Second Latency Forecast
        <span className="ml-2 text-xs text-pw-muted">(LSTM vs Naive selected path)</span>
      </h3>
      <ResponsiveContainer width="100%" height={200}>
        <LineChart data={chartData} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
          <XAxis dataKey="t" tick={{ fill: '#7a9bb5', fontSize: 10 }} tickLine={false} axisLine={false} interval={4} />
          <YAxis tick={{ fill: '#7a9bb5', fontSize: 10 }} tickLine={false} axisLine={false} width={40} />
          <Tooltip content={customTooltip} />
          <Legend wrapperStyle={{ fontSize: '11px', color: '#7a9bb5' }} />
          <Line type="monotone" dataKey="lstm" stroke="#00d4ff" strokeWidth={2} dot={false} name="LSTM Path" />
          <Line type="monotone" dataKey="naive" stroke="#ff8c00" strokeWidth={2} dot={false} strokeDasharray="4 2" name="Naive Path" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
};

// ─── Admin Dashboard Page ──────────────────────────────────────────────────────
const AdminDashboard: React.FC = () => {
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
            <Cpu className="w-6 h-6 text-pw-cyan" />
            Admin Control Panel
          </h1>
          <p className="text-sm text-pw-muted mt-1">
            Toggle LSTM intelligence and monitor AI network selection in real time
          </p>
        </div>
        <div className="flex items-center gap-2 text-xs text-pw-muted">
          <span className="status-dot live" />
          Live simulation
        </div>
      </div>

      {/* LSTM Toggle — primary feature */}
      <LSTMToggleCard />

      {/* Grid: Comparison + Forecast */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <ComparisonCard />
        <LatencyChart />
      </div>

      {/* Grid: Network Health + Decision Log */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <NetworkHealthGrid />
        <DecisionLog />
      </div>
    </motion.div>
  );
};

export default AdminDashboard;
