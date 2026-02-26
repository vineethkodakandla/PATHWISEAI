import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Activity, Cpu, BarChart3, Wifi } from 'lucide-react';
import AdminDashboard from './pages/AdminDashboard';
import UserNetworkView from './pages/UserNetworkView';
import AnalyticsPage from './pages/AnalyticsPage';
import { useLiveData } from './hooks/useLiveData';
import { useAppStore } from './store/networkStore';

const NAV_ITEMS = [
  { to: '/',          label: 'Network Sim',  icon: Wifi,     end: true },
  { to: '/admin',     label: 'Admin',        icon: Cpu,      end: false },
  { to: '/analytics', label: 'Analytics',    icon: BarChart3, end: false },
];

const AppShell: React.FC = () => {
  useLiveData();
  const wsConnected = useAppStore((s) => s.wsConnected);
  const lstmEnabled = useAppStore((s) => s.lstmEnabled);

  return (
    <div className="min-h-screen bg-pw-bg bg-grid relative overflow-hidden">
      {/* Ambient orbs */}
      <div className="orb w-96 h-96 bg-pw-cyan/5 top-0 left-1/4" style={{ animationDelay: '0s' }} />
      <div className="orb w-80 h-80 bg-pw-purple/5 bottom-20 right-1/4" style={{ animationDelay: '-4s' }} />
      <div className="orb w-64 h-64 bg-pw-green/4 top-1/2 left-10" style={{ animationDelay: '-8s' }} />

      {/* Navigation */}
      <nav className="relative z-50 glass-card rounded-none border-b border-pw-border px-6">
        <div className="max-w-screen-2xl mx-auto flex items-center justify-between h-16">
          {/* Brand */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-pw-cyan to-pw-purple flex items-center justify-center shadow-glow-cyan">
                <Activity className="w-5 h-5 text-white" />
              </div>
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 rounded-full bg-pw-green border-2 border-pw-bg" />
            </div>
            <div>
              <span className="text-lg font-bold text-pw-text tracking-tight">PathWise</span>
              <span className="ml-2 text-xs text-pw-muted font-mono">AI SD-WAN</span>
            </div>
          </div>

          {/* Nav links */}
          <div className="flex items-center gap-1">
            {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
              <NavLink key={to} to={to} end={end}
                className={({ isActive }) =>
                  `flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium transition-all duration-200 ${
                    isActive
                      ? 'bg-pw-cyan/10 text-pw-cyan border border-pw-cyan/30 shadow-glow-cyan'
                      : 'text-pw-muted hover:text-pw-text hover:bg-white/5 border border-transparent'
                  }`
                }
              >
                <Icon className="w-4 h-4" />
                {label}
              </NavLink>
            ))}
          </div>

          {/* Status */}
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ opacity: 1 }}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-semibold transition-all duration-500 ${
                lstmEnabled
                  ? 'bg-pw-cyan/15 text-pw-cyan border border-pw-cyan/40'
                  : 'bg-pw-surface text-pw-muted border border-white/10'
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${lstmEnabled ? 'bg-pw-cyan animate-pulse' : 'bg-pw-muted'}`} />
              {lstmEnabled ? 'LSTM Active' : 'LSTM Off'}
            </motion.div>
            <div className="flex items-center gap-1.5 text-xs">
              <span className={`status-dot ${wsConnected ? 'live' : ''}`}
                style={!wsConnected ? { background: '#ff2d55', boxShadow: '0 0 8px rgba(255,45,85,0.6)' } : {}} />
              <span className="text-pw-muted">{wsConnected ? 'Live' : 'Offline'}</span>
            </div>
          </div>
        </div>
      </nav>

      {/* Page */}
      <main className="relative z-10 max-w-screen-2xl mx-auto px-6 py-6">
        <AnimatePresence mode="wait">
          <Routes>
            <Route path="/"          element={<UserNetworkView />} />
            <Route path="/admin"     element={<AdminDashboard />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
          </Routes>
        </AnimatePresence>
      </main>
    </div>
  );
};

const App: React.FC = () => (
  <Router>
    <AppShell />
  </Router>
);

export default App;
