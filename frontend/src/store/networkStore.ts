import { create } from 'zustand';
import { NetworkMetrics, SteeringEvent, ComparisonStats } from '../types';

interface AppStore {
  // LSTM state
  lstmEnabled: boolean;
  setLstmEnabled: (v: boolean) => void;

  // Network data
  networks: Record<string, NetworkMetrics>;
  selectedNetwork: string;
  lstmSelected: string;
  naiveSelected: string;
  predictions: Record<string, number[]>;
  steeringLog: SteeringEvent[];
  comparison: ComparisonStats | null;
  timestamp: number;

  // WebSocket connection
  wsConnected: boolean;
  setWsConnected: (v: boolean) => void;

  // Update from WebSocket payload
  applyUpdate: (payload: {
    lstm_enabled: boolean;
    selected_network: string;
    lstm_selected: string;
    naive_selected: string;
    networks: Record<string, NetworkMetrics>;
    predictions: Record<string, number[]>;
    steering_log: SteeringEvent[];
    comparison?: ComparisonStats;
    timestamp: number;
  }) => void;
}

export const useAppStore = create<AppStore>((set) => ({
  lstmEnabled: false,
  setLstmEnabled: (v) => set({ lstmEnabled: v }),

  networks: {},
  selectedNetwork: 'fiber-primary',
  lstmSelected: 'fiber-primary',
  naiveSelected: 'fiber-primary',
  predictions: {},
  steeringLog: [],
  comparison: null,
  timestamp: 0,

  wsConnected: false,
  setWsConnected: (v) => set({ wsConnected: v }),

  applyUpdate: (payload) =>
    set({
      lstmEnabled: payload.lstm_enabled,
      selectedNetwork: payload.selected_network,
      lstmSelected: payload.lstm_selected,
      naiveSelected: payload.naive_selected,
      networks: payload.networks,
      predictions: payload.predictions,
      steeringLog: payload.steering_log,
      comparison: payload.comparison ?? null,
      timestamp: payload.timestamp,
    }),
}));
