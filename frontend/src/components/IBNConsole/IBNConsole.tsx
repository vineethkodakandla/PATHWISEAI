import React, { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Lightbulb,
  Send,
  CheckCircle2,
  XCircle,
  Trash2,
  ChevronRight,
  Tag,
  Gauge,
  Clock,
  Zap,
  Info,
} from "lucide-react";
import { api } from "../../services/api";

// ── Types ─────────────────────────────────────────────────────────────────────

interface PolicyRule {
  name: string;
  traffic_class: string;
  priority: number;
  action: "prioritize" | "throttle" | "block" | "redirect";
  bandwidth_guarantee_mbps?: number;
  latency_max_ms?: number;
  target_links?: string[];
}

interface ApplyResult {
  status: "success" | "error";
  message: string;
  rule?: PolicyRule;
}

// ── Constants ─────────────────────────────────────────────────────────────────

const EXAMPLE_INTENTS = [
  { text: "Prioritize VoIP over streaming video", category: "Priority" },
  { text: "Block guest WiFi on fiber-primary", category: "Block" },
  { text: "Guarantee 10 Mbps for medical imaging", category: "Guarantee" },
  { text: "Limit backup traffic to 5 Mbps", category: "Throttle" },
  { text: "Redirect financial traffic to fiber-primary", category: "Redirect" },
  { text: "Set maximum latency for VoIP to 50ms", category: "SLA" },
  { text: "Prioritize Teams conferencing over bulk transfers", category: "Priority" },
  { text: "Block torrents on satellite-backup", category: "Block" },
];

const ACTION_COLORS: Record<string, string> = {
  prioritize: "text-pw-emerald bg-pw-emerald/10 border-pw-emerald/20",
  throttle: "text-pw-amber bg-pw-amber/10 border-pw-amber/20",
  block: "text-pw-rose bg-pw-rose/10 border-pw-rose/20",
  redirect: "text-pw-cyan bg-pw-cyan/10 border-pw-cyan/20",
};

const TRAFFIC_CLASS_ICONS: Record<string, string> = {
  voip: "📞",
  video: "📹",
  critical: "⚡",
  bulk: "📦",
  medical_imaging: "🏥",
  financial: "💳",
  guest_wifi: "📡",
  backup: "💾",
  web_browsing: "🌐",
  streaming: "▶️",
  custom: "🔧",
};

// ── Helper Components ─────────────────────────────────────────────────────────

function PolicyBadge({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-pw-bg rounded-lg px-3 py-2">
      <p className="text-[9px] uppercase tracking-wider text-pw-muted mb-0.5">{label}</p>
      <p className="text-xs font-semibold text-pw-text">{value}</p>
    </div>
  );
}

function PolicyStat({
  icon: Icon,
  label,
}: {
  icon: React.ElementType;
  label: string;
}) {
  return (
    <span className="flex items-center gap-1 text-[10px] text-pw-muted">
      <Icon className="w-3 h-3" />
      {label}
    </span>
  );
}

// ── IBNConsole Component ──────────────────────────────────────────────────────

interface IBNConsoleProps {
  className?: string;
  compact?: boolean;
  fetchOnMount?: boolean;
}

const IBNConsole: React.FC<IBNConsoleProps> = ({
  className = "",
  compact = false,
  fetchOnMount = true,
}) => {
  const [intentText, setIntentText] = useState("");
  const [isApplying, setIsApplying] = useState(false);
  const [result, setResult] = useState<ApplyResult | null>(null);
  const [activePolicies, setActivePolicies] = useState<PolicyRule[]>([]);
  const [deletingPolicy, setDeletingPolicy] = useState<string | null>(null);
  const [loadingPolicies, setLoadingPolicies] = useState(false);

  const fetchPolicies = useCallback(async () => {
    setLoadingPolicies(true);
    try {
      const data = await api.getActivePolicies();
      setActivePolicies(data.policies || []);
    } catch {
      // server might not have policies endpoint in offline mode
    } finally {
      setLoadingPolicies(false);
    }
  }, []);

  useEffect(() => {
    if (fetchOnMount) {
      fetchPolicies();
    }
  }, [fetchPolicies, fetchOnMount]);

  const handleApplyIntent = useCallback(async () => {
    if (!intentText.trim()) return;
    setIsApplying(true);
    setResult(null);
    try {
      const resp = await api.applyIntent(intentText.trim());
      if (resp.rule || resp.status === "ok") {
        setResult({
          status: "success",
          message: resp.message || "Policy applied successfully",
          rule: resp.rule,
        });
        setIntentText("");
        fetchPolicies();
      } else {
        setResult({ status: "error", message: resp.message || "Failed to parse intent" });
      }
    } catch (err: any) {
      setResult({
        status: "error",
        message: err?.response?.data?.detail || "Server error — is the server running?",
      });
    } finally {
      setIsApplying(false);
    }
  }, [intentText, fetchPolicies]);

  const handleDeletePolicy = useCallback(async (name: string) => {
    setDeletingPolicy(name);
    try {
      await api.deletePolicy(name);
      fetchPolicies();
    } catch {
      // ignore
    } finally {
      setDeletingPolicy(null);
    }
  }, [fetchPolicies]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
      handleApplyIntent();
    }
  };

  return (
    <div className={`space-y-6 ${className}`}>
      {/* Intent Input Card */}
      <div className="glass-card p-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-pw-amber/20 flex items-center justify-center">
            <Lightbulb className="w-4 h-4 text-pw-amber" />
          </div>
          <h2 className="text-sm font-semibold text-white">
            Natural Language Intent
          </h2>
          <span className="ml-auto text-xs text-pw-muted">
            Press Ctrl+Enter to apply
          </span>
        </div>

        <div className="relative">
          <textarea
            value={intentText}
            onChange={(e) => setIntentText(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder='e.g. "Prioritize VoIP over bulk traffic" or "Guarantee 10 Mbps for medical imaging"'
            rows={compact ? 2 : 3}
            className={`w-full bg-pw-bg/60 border rounded-xl px-4 py-3 text-sm text-pw-text
              placeholder-pw-muted/50 resize-none outline-none transition-all duration-200
              focus:border-pw-accent/50 focus:bg-pw-bg/80
              ${intentText ? "border-pw-border" : "border-pw-border/50"}`}
          />
        </div>

        <div className="flex items-center justify-between mt-4">
          <div className="flex items-center gap-2 text-xs text-pw-muted">
            <Info className="w-3.5 h-3.5" />
            <span>
              Supports: prioritize, block, guarantee, limit, redirect, set latency
            </span>
          </div>
          <button
            onClick={handleApplyIntent}
            disabled={!intentText.trim() || isApplying}
            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-semibold
              transition-all duration-200
              ${intentText.trim() && !isApplying
                ? "bg-gradient-to-r from-pw-accent to-pw-cyan text-white hover:opacity-90 shadow-lg shadow-pw-accent/20"
                : "bg-pw-border text-pw-muted cursor-not-allowed"
              }`}
          >
            <Send className="w-4 h-4" />
            {isApplying ? "Applying…" : "Apply Intent"}
          </button>
        </div>

        {/* Result Banner */}
        <AnimatePresence>
          {result && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              className="mt-4"
            >
              <div
                className={`flex items-start gap-3 p-4 rounded-xl border ${
                  result.status === "success"
                    ? "bg-pw-emerald/5 border-pw-emerald/20"
                    : "bg-pw-rose/5 border-pw-rose/20"
                }`}
              >
                {result.status === "success" ? (
                  <CheckCircle2 className="w-5 h-5 text-pw-emerald flex-shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="w-5 h-5 text-pw-rose flex-shrink-0 mt-0.5" />
                )}
                <div>
                  <p className={`text-sm font-medium ${
                    result.status === "success" ? "text-pw-emerald" : "text-pw-rose"
                  }`}>
                    {result.status === "success" ? "Policy Applied" : "Failed to Parse"}
                  </p>
                  <p className="text-xs text-pw-muted mt-1">{result.message}</p>
                  {result.rule && (
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                      <PolicyBadge label="Traffic Class" value={
                        `${TRAFFIC_CLASS_ICONS[result.rule.traffic_class] || "🔧"} ${result.rule.traffic_class}`
                      } />
                      <PolicyBadge label="Action" value={result.rule.action} />
                      <PolicyBadge label="Priority" value={String(result.rule.priority)} />
                      {result.rule.bandwidth_guarantee_mbps && (
                        <PolicyBadge label="Bandwidth" value={`${result.rule.bandwidth_guarantee_mbps} Mbps`} />
                      )}
                      {result.rule.latency_max_ms && (
                        <PolicyBadge label="Max Latency" value={`${result.rule.latency_max_ms}ms`} />
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Example Intents */}
      <div className="glass-card p-6">
        <h3 className="text-sm font-semibold text-white mb-4 flex items-center gap-2">
          <Zap className="w-4 h-4 text-pw-accent-light" />
          Example Intents
        </h3>
        {compact ? (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {EXAMPLE_INTENTS.map((ex, i) => (
              <button
                key={i}
                onClick={() => setIntentText(ex.text)}
                className="flex-shrink-0 text-left px-3 py-2 rounded-xl bg-pw-bg/50 border border-pw-border/50
                  hover:border-pw-accent/30 hover:bg-pw-surface/60 transition-all duration-200 group"
              >
                <span className="text-[9px] uppercase tracking-wider text-pw-muted font-medium block mb-0.5">
                  {ex.category}
                </span>
                <p className="text-[10px] text-pw-text leading-relaxed max-w-[140px]">"{ex.text}"</p>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-2 gap-2">
            {EXAMPLE_INTENTS.map((ex, i) => (
              <button
                key={i}
                onClick={() => setIntentText(ex.text)}
                className="text-left px-4 py-3 rounded-xl bg-pw-bg/50 border border-pw-border/50
                  hover:border-pw-accent/30 hover:bg-pw-surface/60 transition-all duration-200 group"
              >
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[10px] uppercase tracking-wider text-pw-muted font-medium">
                    {ex.category}
                  </span>
                  <ChevronRight className="w-3 h-3 text-pw-muted group-hover:text-pw-accent-light transition-colors" />
                </div>
                <p className="text-xs text-pw-text leading-relaxed">"{ex.text}"</p>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Active Policies */}
      <div className="glass-card p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-white flex items-center gap-2">
            <Tag className="w-4 h-4 text-pw-accent-light" />
            Active Policies
          </h3>
          <button
            onClick={fetchPolicies}
            className="text-xs text-pw-muted hover:text-pw-text transition-colors"
          >
            Refresh
          </button>
        </div>

        {loadingPolicies ? (
          <p className="text-pw-muted text-sm text-center py-4">Loading policies…</p>
        ) : activePolicies.length === 0 ? (
          <div className="text-center py-8">
            <Lightbulb className="w-8 h-8 text-pw-muted/30 mx-auto mb-2" />
            <p className="text-pw-muted text-sm">No active policies.</p>
            <p className="text-pw-muted/60 text-xs mt-1">
              Apply a natural language intent above to get started.
            </p>
          </div>
        ) : (
          <div className="space-y-3">
            {activePolicies.map((policy, i) => (
              <motion.div
                key={policy.name}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: i * 0.05 }}
                className="flex items-center gap-4 px-4 py-3 rounded-xl bg-pw-bg/50 border border-pw-border/50"
              >
                <span className="text-lg w-8 text-center flex-shrink-0">
                  {TRAFFIC_CLASS_ICONS[policy.traffic_class] || "🔧"}
                </span>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-semibold text-white truncate">
                      {policy.name}
                    </span>
                    <span
                      className={`px-2 py-0.5 rounded-md text-[10px] font-semibold border uppercase ${
                        ACTION_COLORS[policy.action] || "text-pw-muted"
                      }`}
                    >
                      {policy.action}
                    </span>
                    <span className="text-[10px] text-pw-muted">
                      {policy.traffic_class}
                    </span>
                  </div>
                  <div className="flex items-center gap-4 mt-1.5">
                    <PolicyStat icon={Gauge} label={`Priority ${policy.priority}`} />
                    {policy.bandwidth_guarantee_mbps && (
                      <PolicyStat icon={Zap} label={`${policy.bandwidth_guarantee_mbps} Mbps`} />
                    )}
                    {policy.latency_max_ms && (
                      <PolicyStat icon={Clock} label={`≤ ${policy.latency_max_ms}ms`} />
                    )}
                    {policy.target_links && policy.target_links.length > 0 && (
                      <span className="text-[10px] text-pw-muted">
                        → {policy.target_links.join(", ")}
                      </span>
                    )}
                  </div>
                </div>

                <button
                  onClick={() => handleDeletePolicy(policy.name)}
                  disabled={deletingPolicy === policy.name}
                  className="p-2 rounded-lg text-pw-muted hover:text-pw-rose hover:bg-pw-rose/10
                    transition-colors disabled:opacity-40"
                  title="Remove policy"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </motion.div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default IBNConsole;
export { IBNConsole };
