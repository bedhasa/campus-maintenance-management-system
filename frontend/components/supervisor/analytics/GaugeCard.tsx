"use client";

import type { ReactNode } from "react";
import ChartFrame from "./ChartFrame";

type Props = {
  title: string;
  subtitle?: string;
  value: number;
  footer?: ReactNode;
};

export default function GaugeCard({ title, subtitle, value, footer }: Props) {
  const safe = Math.max(0, Math.min(100, value));
  const angle = 180 * (safe / 100);
  const tone = safe >= 85 ? "#0f766e" : safe >= 70 ? "#f59e0b" : "#ef4444";

  return (
    <ChartFrame title={title} subtitle={subtitle} footer={footer}>
      <div className="flex items-center justify-center">
        <div className="relative h-40 w-72">
          <svg viewBox="0 0 240 140" className="h-40 w-72">
            <path d="M 30 120 A 90 90 0 0 1 210 120" fill="none" stroke="#e2e8f0" strokeWidth="18" strokeLinecap="round" />
            <path
              d="M 30 120 A 90 90 0 0 1 210 120"
              fill="none"
              stroke={tone}
              strokeWidth="18"
              strokeLinecap="round"
              pathLength={100}
              strokeDasharray={`${safe} 100`}
            />
            <line
              x1="120"
              y1="120"
              x2={120 + 64 * Math.cos(((angle - 180) * Math.PI) / 180)}
              y2={120 + 64 * Math.sin(((angle - 180) * Math.PI) / 180)}
              stroke="#0f172a"
              strokeWidth="5"
              strokeLinecap="round"
            />
            <circle cx="120" cy="120" r="8" fill="#0f172a" />
          </svg>
          <div className="absolute inset-x-0 bottom-4 text-center">
            <p className="text-3xl font-black text-slate-900">{safe}%</p>
            <p className="text-xs font-semibold text-slate-500">
              {safe >= 85 ? "Strong compliance" : safe >= 70 ? "Watch closely" : "Immediate action needed"}
            </p>
          </div>
        </div>
      </div>
    </ChartFrame>
  );
}
