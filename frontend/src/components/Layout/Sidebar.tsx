import React from "react";
import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ShieldCheck,
  Network,
  Activity,
  Wifi,
  FlaskConical,
  Lightbulb,
  BrainCircuit,
} from "lucide-react";
import { useNetworkStore } from "../../store/networkStore";

const NAV_ITEMS = [
  { to: "/dashboard",  icon: LayoutDashboard, label: "Dashboard" },
  { to: "/ibn",        icon: BrainCircuit,    label: "IBN Management" },
  { to: "/simulation", icon: Network,         label: "Network Simulation" },
  { to: "/sandbox",    icon: FlaskConical,    label: "Sandbox" },
  { to: "/intent",     icon: Lightbulb,       label: "Intent Policy" },
  { to: "/admin",      icon: ShieldCheck,     label: "Admin Panel" },
];

interface SidebarProps {
  className?: string;
}

const Sidebar: React.FC<SidebarProps> = ({ className = "" }) => {
  const wsConnected = useNetworkStore((s) => s.wsConnected);
  const lstmEnabled = useNetworkStore((s) => s.lstmEnabled);

  return (
    <aside
      className={`w-64 flex-shrink-0 bg-pw-surface/50 border-r border-pw-border flex flex-col ${className}`}
    >
      {/* Brand */}
      <div className="p-6 border-b border-pw-border">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-pw-accent to-pw-cyan flex items-center justify-center">
            <Activity className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-white tracking-tight">
              PathWise
            </h1>
            <p className="text-[10px] uppercase tracking-[0.2em] text-pw-accent-light">
              AI-Powered SD-WAN
            </p>
          </div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1">
        {NAV_ITEMS.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              isActive ? "nav-item-active" : "nav-item"
            }
          >
            <Icon className="w-4 h-4" />
            {label}
          </NavLink>
        ))}
      </nav>

      {/* Status Footer */}
      <div className="p-4 border-t border-pw-border space-y-3">
        <div className="flex items-center justify-between text-xs">
          <span className="text-pw-muted">Server</span>
          <div className="flex items-center gap-1.5">
            <div
              className={wsConnected ? "status-dot-green" : "status-dot-red"}
            />
            <span
              className={wsConnected ? "text-pw-emerald" : "text-pw-rose"}
            >
              {wsConnected ? "Connected" : "Offline"}
            </span>
          </div>
        </div>
        <div className="flex items-center justify-between text-xs">
          <span className="text-pw-muted">LSTM Model</span>
          <div className="flex items-center gap-1.5">
            <div
              className={
                lstmEnabled ? "status-dot-green" : "status-dot-amber"
              }
            />
            <span
              className={lstmEnabled ? "text-pw-emerald" : "text-pw-amber"}
            >
              {lstmEnabled ? "Active" : "Inactive"}
            </span>
          </div>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-pw-muted/60">
          <Wifi className="w-3 h-3" />
          <span>Offline Mode — No Docker Required</span>
        </div>
      </div>
    </aside>
  );
};

export default Sidebar;
