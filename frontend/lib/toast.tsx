"use client";

import React, { createContext, useCallback, useContext, useMemo, useState } from "react";
import { CheckCircle2, Info, XCircle } from "lucide-react";

export type ToastVariant = "success" | "error" | "info";

type ToastItem = {
  id: string;
  message: string;
  variant: ToastVariant;
};

type ToastContextValue = {
  showToast: (message: string, variant?: ToastVariant) => void;
};

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

const variantStyles: Record<ToastVariant, string> = {
  success: "border-emerald-200 bg-emerald-50 text-emerald-800 shadow-emerald-100/60",
  error: "border-rose-200 bg-rose-50 text-rose-800 shadow-rose-100/60",
  info: "border-blue-200 bg-blue-50 text-blue-800 shadow-blue-100/60",
};

const variantIcon: Record<ToastVariant, React.ReactNode> = {
  success: <CheckCircle2 size={18} className="shrink-0 text-emerald-600" />,
  error: <XCircle size={18} className="shrink-0 text-rose-600" />,
  info: <Info size={18} className="shrink-0 text-blue-600" />,
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const showToast = useCallback((message: string, variant: ToastVariant = "info") => {
    const trimmed = message.trim();
    if (!trimmed) return;

    const id = `${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
    setToasts((prev) => [...prev, { id, message: trimmed, variant }]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 5000);
  }, []);

  const value = useMemo(() => ({ showToast }), [showToast]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        suppressHydrationWarning
        className="pointer-events-none fixed top-4 right-4 z-[9999] flex w-[min(100vw-2rem,22rem)] flex-col gap-2"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            className={`pointer-events-auto flex items-start gap-2 rounded-2xl border px-4 py-3 text-sm font-bold shadow-lg animate-in slide-in-from-top-2 fade-in duration-200 ${variantStyles[toast.variant]}`}
            role="status"
          >
            {variantIcon[toast.variant]}
            <span className="leading-snug">{toast.message}</span>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("useToast called outside ToastProvider; falling back to a no-op toast.");
    }
    return {
      showToast: () => {},
    };
  }
  return ctx;
}
