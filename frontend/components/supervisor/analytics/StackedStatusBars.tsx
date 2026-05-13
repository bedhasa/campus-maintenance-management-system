"use client";

import type { ReactNode } from "react";
import ChartFrame from "./ChartFrame";

type Item = {
  name: string;
  completed: number;
  overdue: number;
  open: number;
};

type Props = {
  title: string;
  subtitle?: string;
  items: Item[];
  footer?: ReactNode;
};

const colors = {
  completed: "#0f766e",
  overdue: "#ef4444",
  open: "#3b82f6",
};

export default function StackedStatusBars({ title, subtitle, items, footer }: Props) {
  const max = Math.max(1, ...items.map((item) => item.completed + item.overdue + item.open), 1);

  return (
    <ChartFrame title={title} subtitle={subtitle} footer={footer}>
      <div className="space-y-4">
        {items.length === 0 ? <p className="text-sm font-semibold text-slate-400">No status comparison data available.</p> : null}
        {items.map((item) => {
          const total = item.completed + item.overdue + item.open;
          return (
            <div key={item.name}>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <p className="text-sm font-black text-slate-800">{item.name}</p>
                  <p className="text-xs font-semibold text-slate-500">
                    Completed {item.completed} | Overdue {item.overdue} | Open {item.open}
                  </p>
                </div>
                <p className="text-sm font-black text-slate-900">{total}</p>
              </div>
              <div className="flex h-4 overflow-hidden rounded-full bg-slate-100">
                <div style={{ width: `${(item.completed / max) * 100}%`, backgroundColor: colors.completed }} />
                <div style={{ width: `${(item.overdue / max) * 100}%`, backgroundColor: colors.overdue }} />
                <div style={{ width: `${(item.open / max) * 100}%`, backgroundColor: colors.open }} />
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        {Object.entries(colors).map(([key, color]) => (
          <div key={key} className="inline-flex items-center gap-2 rounded-full bg-slate-50 px-3 py-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: color }} />
            <span className="text-xs font-black capitalize text-slate-700">{key}</span>
          </div>
        ))}
      </div>
    </ChartFrame>
  );
}
