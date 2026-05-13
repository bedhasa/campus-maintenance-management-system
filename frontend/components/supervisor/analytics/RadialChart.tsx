"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import ChartFrame from "./ChartFrame";

type Slice = {
  name: string;
  value: number;
  percentage?: number;
  color?: string;
};

type Props = {
  title: string;
  subtitle?: string;
  slices: Slice[];
  variant?: "donut" | "pie";
  valueMode?: "number" | "percentage";
  onSliceClick?: (slice: Slice) => void;
  footer?: ReactNode;
};

const palette = ["#003366", "#0f766e", "#f59e0b", "#ef4444", "#3b82f6", "#8b5cf6", "#64748b", "#10b981"];

export default function RadialChart({
  title,
  subtitle,
  slices,
  variant = "donut",
  valueMode = "number",
  onSliceClick,
  footer,
}: Props) {
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const total = slices.reduce((sum, slice) => sum + Math.max(0, slice.value), 0);
  const radius = 72;
  const center = 96;
  const active = activeIndex !== null ? slices[activeIndex] : null;

  const toPoint = (angle: number, useRadius = radius) => {
    const radians = ((angle - 90) * Math.PI) / 180;
    return {
      x: center + useRadius * Math.cos(radians),
      y: center + useRadius * Math.sin(radians),
    };
  };

  const arcs = slices.reduce<Array<Slice & { path: string; color: string; index: number }>>((acc, slice, index) => {
    const ratio = total > 0 ? slice.value / total : 0;
    const angle = ratio * 360;
    const start = acc.length === 0 ? 0 : (acc[acc.length - 1] as Slice & { endAngle?: number }).endAngle ?? 0;
    const end = start + angle;

    const startPoint = toPoint(start);
    const endPoint = toPoint(end);
    const largeArc = angle > 180 ? 1 : 0;
    const color = slice.color ?? palette[index % palette.length];

    const path =
      variant === "pie"
        ? `M ${center} ${center} L ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${largeArc} 1 ${endPoint.x} ${endPoint.y} Z`
        : `M ${startPoint.x} ${startPoint.y} A ${radius} ${radius} 0 ${largeArc} 1 ${endPoint.x} ${endPoint.y}`;

    acc.push({ ...slice, path, color, index, endAngle: end } as Slice & { path: string; color: string; index: number });
    return acc;
  }, []);

  return (
    <ChartFrame title={title} subtitle={subtitle} footer={footer}>
      <div className="grid gap-4 lg:grid-cols-[220px_1fr]">
        <div className="flex items-center justify-center">
          {total <= 0 ? (
            <div className="flex h-48 w-48 items-center justify-center rounded-full bg-slate-100 text-xs font-black uppercase tracking-[0.18em] text-slate-400">
              No Data
            </div>
          ) : (
            <div className="relative h-48 w-48">
              <svg viewBox="0 0 192 192" className="h-48 w-48">
                {variant === "donut" ? (
                  <circle cx={center} cy={center} r={radius} fill="none" stroke="#e2e8f0" strokeWidth="26" />
                ) : null}
                {arcs.map((arc) => (
                  <path
                    key={arc.name}
                    d={arc.path}
                    fill={variant === "pie" ? arc.color : "none"}
                    stroke={arc.color}
                    strokeWidth={variant === "donut" ? (activeIndex === arc.index ? 30 : 26) : 1}
                    strokeLinecap="round"
                    className="cursor-pointer transition-all duration-200"
                    onMouseEnter={() => setActiveIndex(arc.index)}
                    onMouseLeave={() => setActiveIndex(null)}
                    onClick={() => onSliceClick?.(arc)}
                    opacity={activeIndex === null || activeIndex === arc.index ? 1 : 0.35}
                  />
                ))}
                {variant === "donut" ? <circle cx={center} cy={center} r={44} fill="white" /> : null}
              </svg>
              {variant === "donut" ? (
                <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center text-center">
                  <p className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-400">
                    {active?.name ?? "Total"}
                  </p>
                  <p className="mt-1 text-2xl font-black text-slate-900">
                    {active
                      ? valueMode === "percentage"
                        ? `${active.percentage ?? 0}%`
                        : active.value
                      : total}
                  </p>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {slices.map((slice, index) => {
            const color = slice.color ?? palette[index % palette.length];
            const percent = total > 0 ? Number(((slice.value / total) * 100).toFixed(2)) : 0;

            return (
              <button
                key={slice.name}
                type="button"
                onClick={() => onSliceClick?.({ ...slice, percentage: slice.percentage ?? percent, color })}
                onMouseEnter={() => setActiveIndex(index)}
                onMouseLeave={() => setActiveIndex(null)}
                className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2 text-left transition ${
                  activeIndex === index ? "border-slate-300 bg-slate-50" : "border-slate-100 bg-white hover:bg-slate-50"
                }`}
              >
                <div className="flex items-center gap-3">
                  <span className="h-3 w-3 rounded-full" style={{ backgroundColor: color }} />
                  <div>
                    <p className="text-sm font-black text-slate-800">{slice.name}</p>
                    <p className="text-xs font-semibold text-slate-500">{percent}% of selected volume</p>
                  </div>
                </div>
                <p className="text-sm font-black text-slate-900">
                  {valueMode === "percentage" ? `${slice.percentage ?? percent}%` : slice.value}
                </p>
              </button>
            );
          })}
          {slices.length === 0 ? <p className="text-sm font-semibold text-slate-400">No distribution data available.</p> : null}
        </div>
      </div>
    </ChartFrame>
  );
}
