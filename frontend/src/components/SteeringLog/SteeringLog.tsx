import React from "react";
import { motion } from "framer-motion";
import { Activity } from "lucide-react";
import { useNetworkStore } from "../../store/networkStore";
import type { SteeringEvent } from "../../types";

const ACTION_BADGE_STYLES: Record<string, string> = {
  PREEMPTIVE_SHIFT: "text-pw-emerald bg-pw-emerald/10 border border-pw-emerald/20",
  REACTIVE_FAILOVER: "text-pw-rose bg-pw-rose/10 border border-pw-rose/20",
  LOAD_BALANCE: "text-pw-cyan bg-pw-cyan/10 border border-pw-cyan/20",
  MANUAL_OVERRIDE: "text-pw-amber bg-pw-amber/10 border border-pw-amber/20",
};

interface SteeringLogProps {
  events?: SteeringEvent[];
  maxHeight?: number;
  showEmpty?: boolean;
  className?: string;
}

const SteeringLog: React.FC<SteeringLogProps> = ({
  events: propEvents,
  maxHeight = 320,
  showEmpty = true,
  className = "",
}) => {
  const storeEvents = useNetworkStore((s) => s.steeringEvents);
  const events = propEvents ?? storeEvents;

  if (events.length === 0 && showEmpty) {
    return (
      <div className={`text-center py-6 ${className}`}>
        <Activity className="w-6 h-6 text-pw-muted/30 mx-auto mb-2" />
        <p className="text-pw-muted text-xs">No steering events yet.</p>
      </div>
    );
  }

  if (events.length === 0) {
    return null;
  }

  return (
    <div
      className={`overflow-y-auto space-y-1 ${className}`}
      style={{ maxHeight }}
    >
      {events.map((evt, i) => {
        const badgeStyle =
          ACTION_BADGE_STYLES[evt.action] ||
          "text-pw-muted bg-pw-muted/10 border border-pw-muted/20";
        const timestamp = new Date(evt.timestamp * 1000).toLocaleTimeString();

        return (
          <motion.div
            key={evt.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.04 }}
            className="flex items-center gap-3 text-xs py-2 px-3 rounded-lg bg-pw-bg/50"
          >
            <div
              className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                evt.lstm_enabled ? "bg-pw-emerald" : "bg-pw-rose"
              }`}
            />
            <span
              className={`px-1.5 py-0.5 rounded text-[10px] font-semibold uppercase flex-shrink-0 ${badgeStyle}`}
            >
              {evt.action.replace(/_/g, " ")}
            </span>
            <span className="text-pw-muted flex-shrink-0">
              {evt.source_link} → {evt.target_link}
            </span>
            <span className="flex-1 text-pw-muted/60 truncate">
              {evt.reason}
            </span>
            <span className="text-pw-muted/40 flex-shrink-0 text-[10px]">
              {timestamp}
            </span>
          </motion.div>
        );
      })}
    </div>
  );
};

export default SteeringLog;
export { SteeringLog };
