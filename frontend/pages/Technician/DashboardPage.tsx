"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";

type WorkOrder = {
  id: number;
  work_status: string;
  request?: { title?: string; due_date?: string | null };
};

type Dashboard = {
  success: boolean;
  summary: Record<string, number>;
  assigned_jobs: { data: WorkOrder[] };
};

export default function TechnicianDashboardPage() {
  const [data, setData] = useState<Dashboard | null>(null);

  useEffect(() => {
    const run = async () => {
      const res = await apiRequest<Dashboard>("/api/technician/dashboard", { method: "GET" }, true);
      setData(res);
    };
    void run();
  }, []);

  if (!data) return <p className="text-sm text-slate-500">Loading jobs...</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-900">Technician Dashboard</h1>
      <div className="grid md:grid-cols-4 gap-4">
        {Object.entries(data.summary).map(([k, v]) => (
          <div key={k} className="bg-white border rounded-xl p-4">
            <p className="text-[10px] uppercase font-black text-slate-400">{k}</p>
            <p className="text-2xl font-black">{v}</p>
          </div>
        ))}
      </div>
      <div className="space-y-3">
        {data.assigned_jobs.data.map((w) => (
          <div key={w.id} className="bg-white border rounded-xl p-4 flex justify-between">
            <div>
              <p className="font-bold">{w.request?.title ?? `Work Order #${w.id}`}</p>
              <p className="text-xs text-slate-500">{w.work_status}</p>
            </div>
            <Link href={`/technician/work-orders/${w.id}`} className="text-xs font-bold text-blue-700">Open</Link>
          </div>
        ))}
      </div>
    </div>
  );
}

