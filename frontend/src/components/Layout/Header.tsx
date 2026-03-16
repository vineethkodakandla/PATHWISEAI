import React from "react";
import { BrainCircuit } from "lucide-react";
import { useNetworkStore } from "../../store/networkStore";

interface HeaderProps {
  title: string;
  subtitle?: string;
  showLstm?: boolean;
  children?: React.ReactNode;
  className?: string;
}

const Header: React.FC<HeaderProps> = ({
  title,
  subtitle,
  showLstm = false,
  children,
  className = "",
}) => {
  const wsConnected = useNetworkStore((s) => s.wsConnected);
  const lstmEnabled = useNetworkStore((s) => s.lstmEnabled);

  return (
    <div className={`flex items-center justify-between ${className}`}>
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {subtitle && (
          <p className="text-pw-muted text-sm mt-1">{subtitle}</p>
        )}
      </div>
      <div className="flex items-center gap-3">
        <div
          className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm ${
            wsConnected
              ? "bg-pw-emerald/10 text-pw-emerald border border-pw-emerald/20"
              : "bg-pw-rose/10 text-pw-rose border border-pw-rose/20"
          }`}
        >
          <div
            className={`w-1.5 h-1.5 rounded-full ${
              wsConnected ? "bg-pw-emerald animate-pulse" : "bg-pw-rose"
            }`}
          />
          {wsConnected ? "Live" : "Disconnected"}
        </div>

        {showLstm && (
          <div
            className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm border ${
              lstmEnabled
                ? "bg-pw-emerald/10 text-pw-emerald border-pw-emerald/20"
                : "bg-pw-rose/10 text-pw-rose border-pw-rose/20"
            }`}
          >
            <BrainCircuit className="w-4 h-4" />
            {lstmEnabled ? "LSTM Active" : "LSTM Off"}
          </div>
        )}

        {children}
      </div>
    </div>
  );
};

export default Header;
