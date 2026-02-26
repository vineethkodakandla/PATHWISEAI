// PathWise AI v2 – Type Definitions

export type NetworkType = 'fiber' | 'broadband' | '5g' | 'satellite';
export type TrendDirection = 'improving' | 'stable' | 'degrading';
export type NetworkMode = 'lstm' | 'naive';

export interface HistoryPoint {
  t: number;
  health_score: number;
  latency_ms: number;
}

export interface NetworkMetrics {
  id: string;
  name: string;
  type: NetworkType;
  color: string;
  icon: string;
  latency_ms: number;
  jitter_ms: number;
  packet_loss_pct: number;
  bandwidth_mbps: number;
  health_score: number;
  congestion_pct: number;
  signal_strength: number;
  trend: TrendDirection;
  history: HistoryPoint[];
  timestamp: number;
}

export interface SteeringEvent {
  timestamp: number;
  mode: 'LSTM' | 'Naive';
  from_network: string;
  to_network: string;
  reason: string;
  current_health: number;
  avoided_latency: number;
}

export interface ComparisonStats {
  lstm_avg_latency: number;
  naive_avg_latency: number;
  lstm_switches: number;
  naive_switches: number;
  improvement_pct: number;
}

export interface NetworkUpdatePayload {
  type: 'network_update' | 'initial_state' | 'lstm_toggled';
  lstm_enabled: boolean;
  selected_network: string;
  lstm_selected: string;
  naive_selected: string;
  networks: Record<string, NetworkMetrics>;
  predictions: Record<string, number[]>;
  steering_log: SteeringEvent[];
  comparison?: ComparisonStats;
  timestamp: number;
}
