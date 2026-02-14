"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";

type Plan = { id: number; title: string; status: string; next_due_date: string; priority: string };

export default function PreventiveMaintenancePage() {
  const params = useSearchParams();
  const [plans, setPlans] = useState<Plan[]>([]);

  const load = async () => {
    const data = await apiRequest<{ success: boolean; plans: { data: Plan[] } }>("/api/pm/plans", { method: "GET" }, true);
    setPlans(data.plans.data ?? []);
  };

  useEffect(() => {
    let ignore = false;
    (async () => {
      const data = await apiRequest<{ success: boolean; plans: { data: Plan[] } }>("/api/pm/plans", { method: "GET" }, true);
      if (!ignore) {
        setPlans(data.plans.data ?? []);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const trigger = async () => {
    await apiRequest("/api/pm/trigger-due", { method: "POST" }, true);
    await load();
  };

  const filter = params.get("filter");
  const today = new Date();
  const weekAhead = new Date();
  weekAhead.setDate(today.getDate() + 7);

  const visiblePlans = plans.filter((p) => {
    if (!filter) return true;
    const due = new Date(p.next_due_date);
    if (filter === "upcoming") return due >= today && due <= weekAhead;
    if (filter === "overdue") return due < today;
    return true;
  });

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-black text-slate-900">Preventive Maintenance</h1>
        <button onClick={trigger} className="px-4 py-2 bg-[#003366] text-white rounded-lg text-xs font-bold">Trigger Due Plans</button>
      </div>
      <div className="space-y-3">
        {visiblePlans.map((p) => (
          <Link key={p.id} href={`/supervisor/preventive?plan=${p.id}`} className="block bg-white border border-slate-200 rounded-xl p-4 hover:bg-slate-50">
            <p className="font-bold text-slate-900">{p.title}</p>
            <p className="text-xs text-slate-500">{p.status} - {p.priority} - next due {p.next_due_date}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
