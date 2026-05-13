"use client";

import React from "react";
import { AlertCircle, CheckCircle2, Info } from "lucide-react";

type OverlayMessageProps = {
  message: string | null;
  tone?: "success" | "error" | "info";
};

export default function OverlayMessage({ message, tone = "info" }: OverlayMessageProps) {
  if (!message) return null;

  const styles = {
    success: {
      icon: CheckCircle2,
      shell: "border-emerald-200 bg-white text-emerald-700",
      badge: "bg-emerald-50 text-emerald-600",
    },
    error: {
      icon: AlertCircle,
      shell: "border-rose-200 bg-white text-rose-700",
      badge: "bg-rose-50 text-rose-600",
    },
    info: {
      icon: Info,
      shell: "border-blue-200 bg-white text-blue-700",
      badge: "bg-blue-50 text-blue-600",
    },
  } as const;

  const current = styles[tone];
  const Icon = current.icon;

  return (
    <div className="fixed inset-0 z-[300] pointer-events-none flex items-center justify-center p-4">
      <div className={`pointer-events-auto max-w-md w-full rounded-[2rem] border-2 shadow-2xl px-6 py-5 ${current.shell}`}>
        <div className="flex items-center gap-4">
          <div className={`h-12 w-12 rounded-2xl flex items-center justify-center ${current.badge}`}>
            <Icon size={24} />
          </div>
          <p className="text-sm font-black leading-relaxed">{message}</p>
        </div>
      </div>
    </div>
  );
}
