"use client";

import { useEffect, useRef } from "react";

type UseLiveRefreshOptions = {
  enabled?: boolean;
  intervalMs?: number;
};

export function useLiveRefresh(
  refresh: () => void | Promise<void>,
  { enabled = true, intervalMs = 8000 }: UseLiveRefreshOptions = {},
) {
  const refreshRef = useRef(refresh);

  useEffect(() => {
    refreshRef.current = refresh;
  }, [refresh]);

  useEffect(() => {
    if (!enabled || typeof window === "undefined") return;

    const runRefresh = () => {
      void refreshRef.current();
    };

    const intervalId = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        runRefresh();
      }
    }, intervalMs);

    const handleFocus = () => {
      runRefresh();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        runRefresh();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [enabled, intervalMs]);
}
