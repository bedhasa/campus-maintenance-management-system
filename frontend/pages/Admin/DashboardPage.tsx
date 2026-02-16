"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";

type Counts = { users: number; active_users: number; technicians: number; supervisors: number };

export default function AdminDashboardPage() {
  const [counts, setCounts] = useState<Counts | null>(null);

  useEffect(() => {
    const run = async () => {
      const data = await apiRequest<{ success: boolean; counts: Counts }>("/api/admin/dashboard", { method: "GET" }, true);
      setCounts(data.counts);
    };
    void run();
  }, []);

  if (!counts) return <PageSkeleton cards={4} rows={2} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-900">Admin Dashboard</h1>
      <div className="grid md:grid-cols-4 gap-4">
        {Object.entries(counts).map(([k, v]) => (
          <div key={k} className="bg-white border rounded-xl p-4">
            <p className="text-[10px] uppercase font-black text-slate-400">{k}</p>
            <p className="text-2xl font-black">{v}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
