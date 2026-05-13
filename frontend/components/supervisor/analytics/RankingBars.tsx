"use client";

import type { ReactNode } from "react";
import ChartFrame from "./ChartFrame";

type Item = {
  name: string;
  value: number;
  subtitle?: string;
  color?: string;
  secondaryValue?: number;
  secondaryColor?: string;
};

type Props = {
  title: string;
  subtitle?: string;
  items: Item[];
  horizontal?: boolean;
  footer?: ReactNode;
  valueFormatter?: (value: number) => string;
};

export default function RankingBars({
  title,
  subtitle,
  items,
  horizontal = false,
  footer,
  valueFormatter = (value) => String(value),
}: Props) {
  const peak = Math.max(1, ...items.map((item) => item.value), 1);

  return (
    <ChartFrame title={title} subtitle={subtitle} footer={footer}>
      {items.length === 0 ? (
        <p className="text-sm font-semibold text-slate-400">No data available.</p>
      ) : horizontal ? (
        <div className="space-y-3">
          {items.map((item) => {
            const width = Math.max(4, (item.value / peak) * 100);
            const secondaryWidth = item.secondaryValue ? Math.max(3, (item.secondaryValue / peak) * 100) : 0;

            return (
              <div key={item.name} className="rounded-2xl border border-slate-100 p-3">
                <div className="mb-2 flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-black text-slate-800">{item.name}</p>
                    {item.subtitle ? <p className="text-xs font-semibold text-slate-500">{item.subtitle}</p> : null}
                  </div>
                  <p className="text-sm font-black text-slate-900">{valueFormatter(item.value)}</p>
                </div>
                <div className="space-y-1.5">
                  <div className="h-3 rounded-full bg-slate-100">
                    <div className="h-3 rounded-full" style={{ width: `${width}%`, backgroundColor: item.color ?? "#003366" }} />
                  </div>
                  {item.secondaryValue !== undefined ? (
                    <div className="h-2 rounded-full bg-slate-100">
                      <div
                        className="h-2 rounded-full"
                        style={{ width: `${secondaryWidth}%`, backgroundColor: item.secondaryColor ?? "#f59e0b" }}
                      />
                    </div>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="flex min-h-[260px] items-end gap-3 overflow-x-auto pb-2">
          {items.map((item) => {
            const height = Math.max(18, (item.value / peak) * 210);

            return (
              <div key={item.name} className="flex min-w-[72px] flex-1 flex-col items-center gap-2">
                <p className="text-xs font-black text-slate-700">{valueFormatter(item.value)}</p>
                <div
                  className="w-full rounded-t-[1.25rem] transition-all duration-300"
                  style={{
                    height,
                    background: `linear-gradient(180deg, ${item.color ?? "#003366"} 0%, rgba(0,51,102,0.35) 100%)`,
                  }}
                />
                <p className="text-center text-[11px] font-black uppercase tracking-wide text-slate-500">{item.name}</p>
              </div>
            );
          })}
        </div>
      )}
    </ChartFrame>
  );
}
