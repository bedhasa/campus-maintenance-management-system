"use client";

import { useEffect, useRef } from "react";
import { subscribeRealtime } from "@/lib/realtime";

type UseLiveRefreshOptions = {
  enabled?: boolean;
  intervalMs?: number | null;
  topics?: string[];
  refreshOnFocus?: boolean;
};

export function useLiveRefresh(
  refresh: () => void | Promise<void>,
  { enabled = true, intervalMs = null, topics = [], refreshOnFocus = false }: UseLiveRefreshOptions = {},
) {
  const refreshRef = useRef(refresh);
  const lastRunRef = useRef(0);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const runRefresh = () => {
      const now = Date.now();
      if (now - lastRunRef.current < 600) return;
      lastRunRef.current = now;
      void refreshRef.current();
    };

    const intervalId =
      typeof intervalMs === "number" && intervalMs > 0
        ? window.setInterval(() => {
            if (document.visibilityState === "visible") {
              runRefresh();
            }
          }, intervalMs)
        : null;

    const handleFocus = () => {
      runRefresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        runRefresh();
      }
    };

    if (refreshOnFocus) {
      window.addEventListener("focus", handleFocus);
      document.addEventListener("visibilitychange", handleVisibilityChange);
    }
    const unsubscribeRealtime = subscribeRealtime((payload) => {
      if (topics.length === 0 || payload.topics.some((topic) => topics.includes(topic))) {
        runRefresh();
      }
    });

    return () => {
      if (intervalId !== null) {
        window.clearInterval(intervalId);
      }
      if (refreshOnFocus) {
        window.removeEventListener("focus", handleFocus);
        document.removeEventListener("visibilitychange", handleVisibilityChange);
      }
      unsubscribeRealtime();
    };
  }, [enabled, intervalMs, refreshOnFocus, topics]);
}
