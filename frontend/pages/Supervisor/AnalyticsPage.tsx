"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

type DataPoint = { name: string; total: number };
type Analytics = {
  issues_by_category: DataPoint[];
  issues_by_building: DataPoint[];
  top_departments: DataPoint[];
  completion_rate: number;
  overdue_rate: number;
};

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);

  useEffect(() => {
    const run = async () => {
      const res = await apiRequest<{ success: boolean } & Analytics>("/api/supervisor/analytics", { method: "GET" }, true);
      setData(res);
    };
    void run();
  }, []);

  const chart = (title: string, points: DataPoint[]) => (
    <div className="bg-white border border-slate-200 rounded-xl p-4">
      <p className="font-black text-slate-900 mb-3">{title}</p>
      <div className="space-y-2">
        {points.map((p) => (
          <div key={p.name}>
            <div className="flex justify-between text-xs"><span>{p.name}</span><span>{p.total}</span></div>
            <div className="h-2 rounded bg-slate-100 overflow-hidden">
              <div className="h-full bg-[#003366]" style={{ width: `${Math.min(100, p.total * 10)}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  if (!data) return <p className="text-sm text-slate-500">Loading analytics...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-900">Analytics</h1>
      <div className="grid md:grid-cols-2 gap-4">
        {chart("Issues by Category", data.issues_by_category)}
        {chart("Issues by Building", data.issues_by_building)}
        {chart("Top 5 Departments", data.top_departments)}
        <div className="bg-white border border-slate-200 rounded-xl p-4">
          <p className="font-black text-slate-900">Performance</p>
          <p className="text-sm mt-3">Completion Rate: <span className="font-black">{data.completion_rate}%</span></p>
          <p className="text-sm">Overdue Rate: <span className="font-black">{data.overdue_rate}%</span></p>
        </div>
      </div>
    </div>
  );
}

