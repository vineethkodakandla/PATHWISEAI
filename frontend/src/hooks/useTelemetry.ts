import { useState, useEffect, useRef } from "react";
import { api } from "../services/api";
import type { TelemetryPoint } from "../types";

interface UseTelemetryOptions {
  window?: number;
  interval?: number;
  enabled?: boolean;
}

interface UseTelemetryResult {
  data: TelemetryPoint[];
  loading: boolean;
  error: Error | null;
}

export function useTelemetry(
  linkId: string,
  options: UseTelemetryOptions = {}
): UseTelemetryResult {
  const { window = 60, interval = 5000, enabled = true } = options;

  const [data, setData] = useState<TelemetryPoint[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval>>();

  useEffect(() => {
    if (!enabled || !linkId) return;

    let cancelled = false;

    const fetchData = async () => {
      setLoading(true);
      try {
        const result = await api.getTelemetry(linkId, window);
        if (!cancelled) {
          const points: TelemetryPoint[] = Array.isArray(result)
            ? result
            : (result.points ?? []);
          setData(points);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err : new Error(String(err)));
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    fetchData();
    timerRef.current = setInterval(fetchData, interval);

    return () => {
      cancelled = true;
      clearInterval(timerRef.current);
    };
  }, [linkId, window, interval, enabled]);

  return { data, loading, error };
}
