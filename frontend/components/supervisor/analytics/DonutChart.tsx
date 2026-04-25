"use client";

import { useState } from "react";

type Slice = { name: string; total: number; percentage: number };

type Props = {
  title: string;
  slices: Slice[];
  mode: "number" | "percentage";
};

const colors = ["#003366", "#0ea5e9", "#22c55e", "#f59e0b", "#ef4444", "#64748b", "#a855f7"];

export default function DonutChart({ title, slices, mode }: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const total = slices.reduce((sum, s) => sum + s.total, 0);
  const radius = 56;
  const circumference = 2 * Math.PI * radius;
  const active = activeIndex !== null ? slices[activeIndex] : null;

  const ringSlices = slices.reduce<Array<Slice & { i: number; dash: string; offset: number; color: string; segment: number }>>(
    (acc, slice, i) => {
      const previous = acc[acc.length - 1];
      const runningOffset = previous ? previous.offset + previous.segment : 0;
      const ratio = total > 0 ? slice.total / total : 0;
      const segment = ratio * circumference;
      acc.push({
        ...slice,
        i,
        segment,
        dash: `${segment} ${circumference - segment}`,
        offset: runningOffset,
        color: colors[i % colors.length],
      });
      return acc;
    },
    []
  );

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      {title ? <p className="mb-3 text-sm font-black uppercase tracking-wider text-slate-700">{title}</p> : null}
      <div className="grid gap-4 md:grid-cols-[170px_1fr]">
        <div className="flex items-center justify-center">
          {slices.length === 0 || total <= 0 ? (
            <div className="relative flex h-40 w-40 items-center justify-center rounded-full bg-slate-100">
              <span className="text-xs font-black uppercase tracking-wider text-slate-400">No Data</span>
            </div>
          ) : (
            <div className="relative h-40 w-40">
              <svg viewBox="0 0 160 160" className="h-40 w-40">
                <circle cx="80" cy="80" r={radius} fill="none" stroke="#e2e8f0" strokeWidth="20" />
                {ringSlices.map((slice) => (
                  <circle
                    key={slice.name}
                    cx="80"
                    cy="80"
                    r={radius}
                    fill="none"
                    stroke={slice.color}
                    strokeWidth={activeIndex === slice.i ? 24 : 20}
                    strokeLinecap="round"
                    strokeDasharray={slice.dash}
                    strokeDashoffset={-slice.offset}
                    transform="rotate(-90 80 80)"
                    className="cursor-pointer transition-all duration-150"
                    onMouseEnter={() => setActiveIndex(slice.i)}
                    onMouseLeave={() => setActiveIndex(null)}
                  />
                ))}
              </svg>
              <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {active ? active.name : "Total"}
                </p>
                <p className="text-lg font-black text-slate-900">
                  {active ? (mode === "number" ? active.total : `${active.percentage}%`) : total}
                </p>
              </div>
            </div>
          )}
        </div>
        <div className="space-y-2">
          {slices.map((s, i) => (
            <div
              key={s.name}
              className={`flex items-center justify-between rounded-lg px-2 py-1 text-sm transition ${
                activeIndex === i ? "bg-slate-100" : ""
              }`}
              onMouseEnter={() => setActiveIndex(i)}
              onMouseLeave={() => setActiveIndex(null)}
            >
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: colors[i % colors.length] }} />
                <span className="font-bold text-slate-700">{s.name}</span>
              </div>
              <span className="font-black text-slate-900">{mode === "number" ? s.total : `${s.percentage}%`}</span>
            </div>
          ))}
          {slices.length === 0 && <p className="text-sm font-semibold text-slate-400">No status data.</p>}
        </div>
      </div>
    </div>
  );
}
