"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

type WorkOrder = {
  id: number;
  priority: string;
  work_status: string;
  delay_reason?: string | null;
  days_late?: number;
  request?: { title?: string | null; status?: string | null; due_date?: string | null };
  assignee?: { fname?: string; lname?: string };
};

export default function WorkOrdersPage() {
  const params = useSearchParams();
  const [items, setItems] = useState<WorkOrder[]>([]);

  useEffect(() => {
    const run = async () => {
      const qs = new URLSearchParams();
      const status = params.get("status");
      const filter = params.get("filter");
      if (status) qs.set("status", status);
      if (filter) qs.set("filter", filter);
      const suffix = qs.toString() ? `?${qs.toString()}` : "";
      const data = await apiRequest<{ success: boolean; work_orders: { data: WorkOrder[] } }>(`/api/supervisor/work-orders${suffix}`, { method: "GET" }, true);
      setItems(data.work_orders.data ?? []);
    };
    void run();
  }, [params]);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-900">Work Orders</h1>
      <div className="space-y-2">
        {items.map((wo) => (
          <Link key={wo.id} href={`/supervisor/work-orders/${wo.id}`} className="grid grid-cols-5 rounded-xl border border-slate-200 p-3 hover:bg-slate-50 text-sm">
            <span className="font-bold">{wo.request?.title ?? `Work Order #${wo.id}`}</span>
            <span className="font-semibold uppercase">{wo.priority}</span>
            <span className="font-semibold uppercase">{wo.work_status}</span>
            <span className="font-semibold">{wo.assignee ? `${wo.assignee.fname} ${wo.assignee.lname}` : "Unassigned"}</span>
            <span className="font-semibold text-red-600">{wo.days_late ? `${wo.days_late} day(s)` : "-"}</span>
          </Link>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-500">No work orders found.</p>}
      </div>
    </div>
  );
}

