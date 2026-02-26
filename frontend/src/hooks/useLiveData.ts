import { useEffect, useRef, useCallback } from 'react';
import { useAppStore } from '../store/networkStore';
import { NetworkUpdatePayload } from '../types';
import axios from 'axios';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:8000';
const WS_BASE = API_BASE.replace(/^http/, 'ws');

/**
 * useLiveData — connects to the PathWise AI backend WebSocket
 * and keeps the Zustand store up to date in real time.
 * Auto-reconnects with exponential backoff.
 */
export function useLiveData() {
  const wsRef = useRef<WebSocket | null>(null);
  const retryDelay = useRef(1000);
  const retryTimer = useRef<NodeJS.Timeout | null>(null);
  const mounted = useRef(true);

  const applyUpdate = useAppStore((s) => s.applyUpdate);
  const setWsConnected = useAppStore((s) => s.setWsConnected);

  const connect = useCallback(() => {
    if (!mounted.current) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const ws = new WebSocket(`${WS_BASE}/ws/live`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (!mounted.current) return;
      setWsConnected(true);
      retryDelay.current = 1000;
    };

    ws.onmessage = (ev: MessageEvent) => {
      try {
        const payload = JSON.parse(ev.data) as NetworkUpdatePayload;
        if (
          payload.type === 'network_update' ||
          payload.type === 'initial_state' ||
          payload.type === 'lstm_toggled'
        ) {
          applyUpdate(payload);
        }
      } catch {
        // malformed message — ignore
      }
    };

    ws.onclose = () => {
      setWsConnected(false);
      if (!mounted.current) return;
      retryTimer.current = setTimeout(() => {
        retryDelay.current = Math.min(retryDelay.current * 2, 16000);
        connect();
      }, retryDelay.current);
    };

    ws.onerror = () => ws.close();
  }, [applyUpdate, setWsConnected]);

  useEffect(() => {
    mounted.current = true;
    connect();
    return () => {
      mounted.current = false;
      if (retryTimer.current) clearTimeout(retryTimer.current);
      wsRef.current?.close();
    };
  }, [connect]);
}

/**
 * Toggle LSTM mode via REST API and update local state.
 */
export async function toggleLSTM(enabled: boolean): Promise<boolean> {
  try {
    const res = await axios.post(`${API_BASE}/api/lstm/toggle`, { enabled });
    return res.data.success === true;
  } catch {
    return false;
  }
}
