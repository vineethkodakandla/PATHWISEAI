import React, { useState, useEffect, useCallback, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  Send,
  Eye,
  CheckCircle2,
  XCircle,
  Trash2,
  ChevronRight,
  Tag,
  Gauge,
  Clock,
  Zap,
  Info,
  Code2,
  History,
  BarChart3,
  Network,
  ShieldCheck,
  ArrowRight,
  Braces,
  FileCode,
  RefreshCw,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { api } from "../services/api";

// ── Types ────────────────────────────────────────────────────────────────────

interface PolicyRule {
  name: string;
  traffic_class: string;
  priority: number;
  action: "prioritize" | "throttle" | "block" | "redirect";
  bandwidth_guarantee_mbps?: number;
  latency_max_ms?: number;
  target_links?: string[];
}

interface YangConfig {
  rule_name: string;
  yang_model: string;
  netconf_xml: string;
  restconf_json: Record<string, unknown>;
  dscp_marking: string;
  description: string;
}

interface IntentResult {
  status: "applied" | "preview" | "error";
  intent: string;
  dry_run: boolean;
  rules_generated: PolicyRule[];
  yang_configs: YangConfig[];
  validation: { rule: string; validated: boolean }[];
}

interface HistoryEntry {
  intent_text: string;
  timestamp: number;
  rule_count: number;
  rules: PolicyRule[];
  dry_run: boolean;
}

interface PolicyStats {
  total_active_policies: number;
  intents_applied_total: number;
  by_action: Record<string, number>;
  by_traffic_class: Record<string, number>;
  supported_traffic_classes: string[];
  supported_actions: string[];
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EXAMPLE_INTENTS = [
  { text: "Prioritize medical imaging over guest WiFi", category: "Priority", icon: "🏥" },
  { text: "Prioritize VoIP over streaming video", category: "Priority", icon: "📞" },
  { text: "Guarantee 50 Mbps for video conferencing", category: "Guarantee", icon: "📹" },
  { text: "Limit backup traffic to 5 Mbps", category: "Throttle", icon: "💾" },
  { text: "Block guest WiFi on fiber-primary", category: "Block", icon: "🚫" },
  { text: "Redirect financial traffic to fiber-primary", category: "Redirect", icon: "💳" },
  { text: "Set maximum latency for VoIP to 50ms", category: "SLA", icon: "⏱️" },
  { text: "Guarantee 10 Mbps for medical imaging", category: "Guarantee", icon: "🏥" },
];

const ACTION_COLORS: Record<string, string> = {
  prioritize: "text-pw-emerald bg-pw-emerald/10 border-pw-emerald/20",
  throttle:   "text-pw-amber  bg-pw-amber/10  border-pw-amber/20",
  block:      "text-pw-rose   bg-pw-rose/10   border-pw-rose/20",
  redirect:   "text-pw-cyan   bg-pw-cyan/10   border-pw-cyan/20",
};

const TRAFFIC_CLASS_ICONS: Record<string, string> = {
  voip:            "📞",
  video:           "📹",
  critical:        "⚡",
  bulk:            "📦",
  medical_imaging: "🏥",
  financial:       "💳",
  guest_wifi:      "📡",
  backup:          "💾",
  web_browsing:    "🌐",
  streaming:       "▶️",
  custom:          "🔧",
};

// ── IBN Dashboard Page ─────────────────────────────────────────────────────────

const IBNDashboard: React.FC = () => {
  const [intentText, setIntentText]         = useState("");
  const [isApplying, setIsApplying]         = useState(false);
  const [isPreviewing, setIsPreviewing]     = useState(false);
  const [result, setResult]                 = useState<IntentResult | null>(null);
  const [activePolicies, setActivePolicies] = useState<PolicyRule[]>([]);
  const [history, setHistory]               = useState<HistoryEntry[]>([]);
  const [stats, setStats]                   = useState<PolicyStats | null>(null);
  const [deletingPolicy, setDeletingPolicy] = useState<string | null>(null);
  const [loading, setLoading]               = useState(false);
  const [activeTab, setActiveTab]           = useState<"yang" | "json">("yang");
  const [expandedYang, setExpandedYang]     = useState<string | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const [policiesRes, historyRes, statsRes] = await Promise.allSettled([
        api.getActivePolicies(),
        api.getIntentHistory(),
        api.getPolicyStats(),
      ]);
      if (policiesRes.status === "fulfilled") setActivePolicies(policiesRes.value.policies || []);
      if (historyRes.status  === "fulfilled") setHistory(historyRes.value.history || []);
      if (statsRes.status    === "fulfilled") setStats(statsRes.value);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  const handleApplyOrPreview = useCallback(async (dryRun: boolean) => {
    if (!intentText.trim()) return;
    if (dryRun) setIsPreviewing(true); else setIsApplying(true);
    setResult(null);
    try {
      const resp = await api.applyIntent(intentText.trim(), dryRun);
      setResult({ ...resp, status: dryRun ? "preview" : "applied" });
      if (!dryRun) {
        setIntentText("");
        fetchAll();
      }
    } catch (err: any) {
      setResult({
        status:          "error" as any,
        intent:          intentText,
        dry_run:         dryRun,
        rules_generated: [],
        yang_configs:    [],
        validation:      [],
        // Carry error message via a custom field
        ...(err?.response?.data?.detail
          ? { _error: err.response.data.detail }
          : { _error: "Server error — is the backend running?" }),
      } as any);
    } finally {
      setIsPreviewing(false);
      setIsApplying(false);
    }
  }, [intentText, fetchAll]);

  const handleDeletePolicy = useCallback(async (name: string) => {
    setDeletingPolicy(name);
    try {
      await api.deletePolicy(name);
      fetchAll();
    } finally {
      setDeletingPolicy(null);
    }
  }, [fetchAll]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) handleApplyOrPreview(false);
    if (e.key === "Enter" && e.shiftKey) { e.preventDefault(); handleApplyOrPreview(true); }
  };

  const hasInput = intentText.trim().length > 0;
  const isError  = (result as any)?._error;

  return (
    <div className="p-8 space-y-8 max-w-7xl mx-auto">

      {/* ── Page Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pw-amber to-pw-accent flex items-center justify-center">
              <Network className="w-5 h-5 text-white" />
            </div>
            Intent-Based Network Management
          </h1>
          <p className="text-pw-muted text-sm mt-1 max-w-2xl">
            Express high-level business goals in plain English. PathWise AI translates them into
            YANG/NETCONF QoS configurations and pushes them to the SDN controller — no CLI required.
          </p>
        </div>
        <button
          onClick={fetchAll}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 rounded-xl text-xs text-pw-muted
            hover:text-pw-text border border-pw-border/50 hover:border-pw-border transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      {/* ── KPI Stats Bar ────────────────────────────────────────────────────── */}
      {stats && (
        <div className="grid grid-cols-4 gap-4">
          <StatCard
            icon={ShieldCheck}
            label="Active Policies"
            value={String(stats.total_active_policies)}
            color="pw-emerald"
          />
          <StatCard
            icon={History}
            label="Intents Applied"
            value={String(stats.intents_applied_total)}
            color="pw-accent"
          />
          <StatCard
            icon={BarChart3}
            label="Prioritize Rules"
            value={String(stats.by_action?.prioritize ?? 0)}
            color="pw-cyan"
          />
          <StatCard
            icon={Zap}
            label="Block / Throttle"
            value={String((stats.by_action?.block ?? 0) + (stats.by_action?.throttle ?? 0))}
            color="pw-amber"
          />
        </div>
      )}

      {/* ── Main Two-Column Layout ───────────────────────────────────────────── */}
      <div className="grid grid-cols-5 gap-6">

        {/* LEFT COLUMN — Intent Input + Results */}
        <div className="col-span-3 space-y-6">

          {/* Intent Input */}
          <div className="glass-card p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-lg bg-pw-amber/20 flex items-center justify-center">
                <Lightbulb className="w-4 h-4 text-pw-amber" />
              </div>
              <h2 className="text-sm font-semibold text-white">Natural Language Intent</h2>
              <span className="ml-auto text-[10px] text-pw-muted">
                Ctrl+Enter to apply · Shift+Enter to preview
              </span>
            </div>

            <textarea
              ref={textareaRef}
              value={intentText}
              onChange={(e) => setIntentText(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={`e.g. "Prioritize medical imaging traffic over guest WiFi"\n     "Guarantee 50 Mbps for video conferencing"\n     "Limit backup to 5 Mbps"`}
              rows={4}
              className={`w-full bg-pw-bg/60 border rounded-xl px-4 py-3 text-sm text-pw-text
                placeholder-pw-muted/40 resize-none outline-none transition-all duration-200
                focus:border-pw-accent/50 focus:bg-pw-bg/80
                ${hasInput ? "border-pw-border" : "border-pw-border/50"}`}
            />

            <div className="flex items-center gap-3 mt-4">
              <div className="flex items-center gap-1.5 text-xs text-pw-muted flex-1">
                <Info className="w-3.5 h-3.5 flex-shrink-0" />
                <span>prioritize · block · guarantee · limit · redirect · set latency</span>
              </div>
              <button
                onClick={() => handleApplyOrPreview(true)}
                disabled={!hasInput || isPreviewing || isApplying}
                className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold
                  border transition-all duration-200
                  ${hasInput && !isApplying
                    ? "border-pw-border text-pw-text hover:border-pw-accent/40 hover:text-pw-accent-light"
                    : "border-pw-border/30 text-pw-muted/40 cursor-not-allowed"}`}
              >
                <Eye className="w-3.5 h-3.5" />
                {isPreviewing ? "Previewing…" : "Preview"}
              </button>
              <button
                onClick={() => handleApplyOrPreview(false)}
                disabled={!hasInput || isApplying || isPreviewing}
                className={`flex items-center gap-2 px-5 py-2 rounded-xl text-xs font-semibold
                  transition-all duration-200
                  ${hasInput && !isApplying && !isPreviewing
                    ? "bg-gradient-to-r from-pw-accent to-pw-cyan text-white hover:opacity-90 shadow-lg shadow-pw-accent/20"
                    : "bg-pw-border text-pw-muted cursor-not-allowed"}`}
              >
                <Send className="w-3.5 h-3.5" />
                {isApplying ? "Applying…" : "Apply Intent"}
              </button>
            </div>
          </div>

          {/* Result + YANG Config Viewer */}
          <AnimatePresence>
            {result && (
              <motion.div
                initial={{ opacity: 0, y: -12 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -12 }}
                className="space-y-4"
              >
                {/* Status banner */}
                <div
                  className={`glass-card p-5 border ${
                    isError
                      ? "border-pw-rose/20 bg-pw-rose/5"
                      : result.status === "preview"
                      ? "border-pw-amber/20 bg-pw-amber/5"
                      : "border-pw-emerald/20 bg-pw-emerald/5"
                  }`}
                >
                  <div className="flex items-start gap-3">
                    {isError ? (
                      <XCircle className="w-5 h-5 text-pw-rose flex-shrink-0 mt-0.5" />
                    ) : result.status === "preview" ? (
                      <Eye className="w-5 h-5 text-pw-amber flex-shrink-0 mt-0.5" />
                    ) : (
                      <CheckCircle2 className="w-5 h-5 text-pw-emerald flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1">
                      <p className={`text-sm font-semibold ${
                        isError ? "text-pw-rose" :
                        result.status === "preview" ? "text-pw-amber" : "text-pw-emerald"
                      }`}>
                        {isError ? "Parse Failed"
                          : result.status === "preview" ? "Preview — Not Applied"
                          : `Applied — ${result.rules_generated.length} rule${result.rules_generated.length !== 1 ? "s" : ""} generated`}
                      </p>
                      {isError ? (
                        <p className="text-xs text-pw-muted mt-1">{(result as any)._error}</p>
                      ) : (
                        <>
                          <p className="text-xs text-pw-muted mt-1 font-mono">"{result.intent}"</p>
                          {/* Parsed rules summary */}
                          <div className="flex flex-wrap gap-2 mt-3">
                            {result.rules_generated.map((r) => (
                              <span
                                key={r.name}
                                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border uppercase ${
                                  ACTION_COLORS[r.action] ?? "text-pw-muted"
                                }`}
                              >
                                {TRAFFIC_CLASS_ICONS[r.traffic_class]} {r.action} · {r.traffic_class}
                              </span>
                            ))}
                          </div>
                        </>
                      )}
                    </div>
                    {result.status === "preview" && !isError && (
                      <button
                        onClick={() => handleApplyOrPreview(false)}
                        disabled={isApplying}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px]
                          font-semibold bg-pw-accent text-white hover:opacity-90 transition-opacity"
                      >
                        Apply Now <ArrowRight className="w-3 h-3" />
                      </button>
                    )}
                  </div>
                </div>

                {/* YANG / NETCONF Config Viewer */}
                {!isError && result.yang_configs.length > 0 && (
                  <div className="glass-card overflow-hidden">
                    <div className="flex items-center gap-3 px-5 py-4 border-b border-pw-border/50">
                      <Code2 className="w-4 h-4 text-pw-accent-light" />
                      <h3 className="text-sm font-semibold text-white">
                        YANG / NETCONF Configuration
                      </h3>
                      <span className="text-[10px] text-pw-muted ml-1">
                        {result.yang_configs[0].yang_model}
                      </span>
                      {/* Tab toggle */}
                      <div className="ml-auto flex rounded-lg overflow-hidden border border-pw-border/50">
                        {(["yang", "json"] as const).map((tab) => (
                          <button
                            key={tab}
                            onClick={() => setActiveTab(tab)}
                            className={`px-3 py-1 text-[10px] font-semibold uppercase tracking-wider transition-colors
                              ${activeTab === tab
                                ? "bg-pw-accent text-white"
                                : "text-pw-muted hover:text-pw-text"}`}
                          >
                            {tab === "yang" ? (
                              <span className="flex items-center gap-1"><FileCode className="w-3 h-3" /> NETCONF XML</span>
                            ) : (
                              <span className="flex items-center gap-1"><Braces className="w-3 h-3" /> RESTCONF JSON</span>
                            )}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="divide-y divide-pw-border/30">
                      {result.yang_configs.map((cfg, i) => (
                        <div key={cfg.rule_name} className="px-5 py-4">
                          <button
                            onClick={() => setExpandedYang(expandedYang === cfg.rule_name ? null : cfg.rule_name)}
                            className="w-full flex items-center gap-3 text-left"
                          >
                            <span className="text-xs font-mono text-pw-accent-light truncate flex-1">
                              {cfg.rule_name}
                            </span>
                            <span className="text-[10px] font-semibold px-2 py-0.5 rounded border
                              text-pw-cyan border-pw-cyan/30 bg-pw-cyan/5 flex-shrink-0">
                              DSCP {cfg.dscp_marking}
                            </span>
                            {expandedYang === cfg.rule_name
                              ? <ChevronUp className="w-3.5 h-3.5 text-pw-muted flex-shrink-0" />
                              : <ChevronDown className="w-3.5 h-3.5 text-pw-muted flex-shrink-0" />}
                          </button>

                          <p className="text-[10px] text-pw-muted mt-1 leading-relaxed">
                            {cfg.description}
                          </p>

                          <AnimatePresence>
                            {expandedYang === cfg.rule_name && (
                              <motion.div
                                initial={{ opacity: 0, height: 0 }}
                                animate={{ opacity: 1, height: "auto" }}
                                exit={{ opacity: 0, height: 0 }}
                                className="mt-3 overflow-hidden"
                              >
                                <pre className="text-[10px] font-mono text-pw-text leading-relaxed
                                  bg-pw-bg/80 rounded-xl p-4 overflow-x-auto border border-pw-border/30
                                  whitespace-pre-wrap break-all">
                                  {activeTab === "yang"
                                    ? cfg.netconf_xml
                                    : JSON.stringify(cfg.restconf_json, null, 2)}
                                </pre>
                              </motion.div>
                            )}
                          </AnimatePresence>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Example Intents */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Zap className="w-4 h-4 text-pw-accent-light" />
              Example Intents
            </h3>
            <div className="grid grid-cols-2 gap-2">
              {EXAMPLE_INTENTS.map((ex, i) => (
                <button
                  key={i}
                  onClick={() => { setIntentText(ex.text); textareaRef.current?.focus(); }}
                  className="text-left px-3 py-2.5 rounded-xl bg-pw-bg/50 border border-pw-border/50
                    hover:border-pw-accent/30 hover:bg-pw-surface/60 transition-all duration-200 group"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[9px] uppercase tracking-wider text-pw-muted font-medium">
                      {ex.icon} {ex.category}
                    </span>
                    <ChevronRight className="w-3 h-3 text-pw-muted group-hover:text-pw-accent-light transition-colors" />
                  </div>
                  <p className="text-[11px] text-pw-text leading-relaxed">"{ex.text}"</p>
                </button>
              ))}
            </div>
          </div>

          {/* How It Works */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <Info className="w-4 h-4 text-pw-accent-light" />
              Translation Pipeline
            </h3>
            <div className="flex items-stretch gap-3">
              {[
                {
                  icon: Lightbulb,
                  title: "Natural Language",
                  desc: "You describe the goal in plain English.",
                  color: "pw-amber",
                },
                {
                  icon: Code2,
                  title: "NLP + Rule Parser",
                  desc: "Deterministic regex engine extracts intent, class, and params.",
                  color: "pw-accent",
                },
                {
                  icon: FileCode,
                  title: "YANG Config Gen",
                  desc: "Generates NETCONF XML + RESTCONF JSON with correct DSCP markings.",
                  color: "pw-cyan",
                },
                {
                  icon: Network,
                  title: "SDN Push",
                  desc: "Rules delivered to OpenDaylight / ONOS via RESTCONF.",
                  color: "pw-emerald",
                },
              ].map(({ icon: Icon, title, desc, color }, i, arr) => (
                <React.Fragment key={title}>
                  <div className="flex-1 bg-pw-bg/50 rounded-xl p-3 border border-pw-border/50">
                    <div className={`w-7 h-7 rounded-lg bg-${color}/20 flex items-center justify-center mb-2`}>
                      <Icon className={`w-3.5 h-3.5 text-${color}-light`} />
                    </div>
                    <h4 className="text-[11px] font-semibold text-white mb-1">{title}</h4>
                    <p className="text-[10px] text-pw-muted leading-relaxed">{desc}</p>
                  </div>
                  {i < arr.length - 1 && (
                    <div className="flex items-center flex-shrink-0">
                      <ArrowRight className="w-4 h-4 text-pw-border" />
                    </div>
                  )}
                </React.Fragment>
              ))}
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN — Active Policies + History */}
        <div className="col-span-2 space-y-6">

          {/* Active Policies */}
          <div className="glass-card p-5">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-white flex items-center gap-2">
                <Tag className="w-4 h-4 text-pw-accent-light" />
                Active Policies
                {activePolicies.length > 0 && (
                  <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold
                    bg-pw-accent/20 text-pw-accent-light">
                    {activePolicies.length}
                  </span>
                )}
              </h3>
            </div>

            {activePolicies.length === 0 ? (
              <div className="text-center py-8">
                <Lightbulb className="w-8 h-8 text-pw-muted/20 mx-auto mb-2" />
                <p className="text-pw-muted text-xs">No active policies.</p>
                <p className="text-pw-muted/50 text-[10px] mt-1">Apply an intent to get started.</p>
              </div>
            ) : (
              <div className="space-y-2">
                {activePolicies.map((policy, i) => (
                  <motion.div
                    key={policy.name}
                    initial={{ opacity: 0, x: 10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.04 }}
                    className="flex items-center gap-3 px-3 py-2.5 rounded-xl
                      bg-pw-bg/50 border border-pw-border/50"
                  >
                    <span className="text-base w-6 text-center flex-shrink-0">
                      {TRAFFIC_CLASS_ICONS[policy.traffic_class] ?? "🔧"}
                    </span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[11px] font-semibold text-white truncate">
                          {policy.name}
                        </span>
                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-semibold border uppercase ${
                          ACTION_COLORS[policy.action] ?? "text-pw-muted"
                        }`}>
                          {policy.action}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1">
                        <PolicyStat icon={Gauge} label={`P${policy.priority}`} />
                        {policy.bandwidth_guarantee_mbps != null && (
                          <PolicyStat icon={Zap} label={`${policy.bandwidth_guarantee_mbps}M`} />
                        )}
                        {policy.latency_max_ms != null && (
                          <PolicyStat icon={Clock} label={`≤${policy.latency_max_ms}ms`} />
                        )}
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeletePolicy(policy.name)}
                      disabled={deletingPolicy === policy.name}
                      className="p-1.5 rounded-lg text-pw-muted hover:text-pw-rose
                        hover:bg-pw-rose/10 transition-colors disabled:opacity-40"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </motion.div>
                ))}
              </div>
            )}
          </div>

          {/* Action Distribution (mini chart) */}
          {stats && Object.keys(stats.by_action).length > 0 && (
            <div className="glass-card p-5">
              <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-pw-accent-light" />
                Policy Distribution
              </h3>
              <div className="space-y-2.5">
                {Object.entries(stats.by_action).map(([action, count]) => {
                  const total = stats.total_active_policies || 1;
                  const pct   = Math.round((count / total) * 100);
                  return (
                    <div key={action}>
                      <div className="flex items-center justify-between mb-1">
                        <span className={`text-[10px] font-semibold uppercase px-1.5 py-0.5
                          rounded border ${ACTION_COLORS[action] ?? "text-pw-muted"}`}>
                          {action}
                        </span>
                        <span className="text-[10px] text-pw-muted">{count} rule{count !== 1 ? "s" : ""}</span>
                      </div>
                      <div className="h-1.5 bg-pw-border/40 rounded-full overflow-hidden">
                        <motion.div
                          initial={{ width: 0 }}
                          animate={{ width: `${pct}%` }}
                          transition={{ duration: 0.5, ease: "easeOut" }}
                          className={`h-full rounded-full ${
                            action === "prioritize" ? "bg-pw-emerald" :
                            action === "throttle"   ? "bg-pw-amber" :
                            action === "block"      ? "bg-pw-rose" :
                            "bg-pw-cyan"
                          }`}
                        />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Intent History */}
          <div className="glass-card p-5">
            <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
              <History className="w-4 h-4 text-pw-accent-light" />
              Intent History
              {history.length > 0 && (
                <span className="ml-1 px-2 py-0.5 rounded-full text-[10px] font-semibold
                  bg-pw-border/60 text-pw-muted">
                  {history.length}
                </span>
              )}
            </h3>

            {history.length === 0 ? (
              <div className="text-center py-6">
                <History className="w-7 h-7 text-pw-muted/20 mx-auto mb-2" />
                <p className="text-[11px] text-pw-muted">No history yet.</p>
              </div>
            ) : (
              <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
                {history.map((entry, i) => (
                  <div
                    key={i}
                    className="px-3 py-2 rounded-xl bg-pw-bg/50 border border-pw-border/40
                      hover:border-pw-border/80 transition-colors cursor-pointer"
                    onClick={() => setIntentText(entry.intent_text)}
                    title="Click to re-use this intent"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-[11px] text-pw-text leading-relaxed line-clamp-2 flex-1">
                        "{entry.intent_text}"
                      </p>
                      <span className="text-[9px] text-pw-muted flex-shrink-0 mt-0.5">
                        {new Date(entry.timestamp * 1000).toLocaleTimeString([], {
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <span className="text-[9px] text-pw-muted">
                        {entry.rule_count} rule{entry.rule_count !== 1 ? "s" : ""}
                      </span>
                      {entry.dry_run && (
                        <span className="text-[9px] px-1.5 py-0.5 rounded border
                          border-pw-amber/30 text-pw-amber bg-pw-amber/5">
                          preview
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
};

// ── Helper Components ──────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ElementType;
  label: string;
  value: string;
  color: string;
}) {
  return (
    <div className="glass-card p-4 flex items-center gap-4">
      <div className={`w-10 h-10 rounded-xl bg-${color}/15 flex items-center justify-center flex-shrink-0`}>
        <Icon className={`w-5 h-5 text-${color}-light`} />
      </div>
      <div>
        <p className="text-xl font-bold text-white leading-none">{value}</p>
        <p className="text-[10px] text-pw-muted mt-0.5">{label}</p>
      </div>
    </div>
  );
}

function PolicyStat({ icon: Icon, label }: { icon: React.ElementType; label: string }) {
  return (
    <span className="flex items-center gap-1 text-[9px] text-pw-muted">
      <Icon className="w-2.5 h-2.5" />
      {label}
    </span>
  );
}

export default IBNDashboard;
