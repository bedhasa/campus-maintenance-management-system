"use client";

import { useCallback, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { DollarSign, Package, Shapes, ShieldAlert } from "lucide-react";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";
import {
  PartRequestRecord,
  buildPersonName,
  formatDateTime,
  requestStatusTone,
  urgencyTone,
  isLowStock,
} from "@/lib/inventory-utils";

type DashboardResponse = {
  success: boolean;
  summary: {
    total_parts: number;
    categories: number;
    low_stock: number;
    total_inventory_value: number;
  };
  recent_requests: PartRequestRecord[];
};

export default function DashboardPage() {
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest<DashboardResponse>("/api/inventory/dashboard", { method: "GET" }, true);
      setData(response);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <PageSkeleton cards={3} rows={5} />;

  const summary = data?.summary;
  const recentRequests = (data?.recent_requests ?? []).slice(0, 5);

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 pb-16 pt-8">
      {toast && (
        <div className="fixed inset-x-0 top-6 z-50 flex justify-center px-4">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-6 py-3 font-bold text-rose-700 shadow-2xl">
            {toast}
          </div>
        </div>
      )}

      <header className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-600">
          Inventory Officer
        </p>
        <h1 className="text-4xl font-black tracking-tight text-slate-900">Dashboard</h1>
        <p className="max-w-2xl text-sm font-medium text-slate-500">
          Quick view of spare part stock, categories, total inventory cost, low stock alerts, and the five most recent requests.
        </p>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard
          label="Total Parts"
          value={summary?.total_parts ?? 0}
          icon={<Package size={18} />}
          tone="bg-slate-900 text-white"
        />
        <StatCard
          label="Categories"
          value={summary?.categories ?? 0}
          icon={<Shapes size={18} />}
          tone="bg-blue-600 text-white"
        />
        <StatCard
          label="Total Cost"
          value={summary?.total_inventory_value ?? 0}
          icon={<DollarSign size={18} />}
          tone="bg-emerald-600 text-white"
          formatter={formatCurrency}
        />
        <StatCard
          label="Low Stock"
          value={summary?.low_stock ?? 0}
          icon={<ShieldAlert size={18} />}
          tone="bg-rose-500 text-white"
        />
      </section>

      <section className="rounded-2rem border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-black text-slate-900">Recent Requests</h2>
            <p className="text-sm font-medium text-slate-500">Top 5 latest technician requests recorded in the system.</p>
          </div>
          <div className="rounded-full bg-slate-100 px-3 py-1 text-[10px] font-black uppercase tracking-widest text-slate-500">
            Last 5
          </div>
        </div>

        <div className="mt-6 overflow-hidden rounded-1.5rem border border-slate-200">
          {recentRequests.length === 0 ? (
            <EmptyState message="No recent requests available." />
          ) : (
            <div className="divide-y divide-slate-100">
              {recentRequests.map((request) => (
                <RequestRow key={request.id} request={request} />
              ))}
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  tone,
  icon,
  formatter,
}: {
  label: string;
  value: number;
  tone: string;
  icon: ReactNode;
  formatter?: (value: number) => string;
}) {
  return (
    <div className={`rounded-2rem p-6 shadow-sm ${tone}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-xl bg-white/10 p-2">{icon}</div>
        <p className="text-[10px] font-black uppercase tracking-[0.25em] opacity-70 text-right">{label}</p>
      </div>
      <p className="mt-6 text-4xl font-black tracking-tight">{formatter ? formatter(value) : value}</p>
    </div>
  );
}

function formatCurrency(value: number) {
  return Number(value ?? 0).toLocaleString(undefined, { maximumFractionDigits: 2 });
}

function RequestRow({ request }: { request: PartRequestRecord }) {
  const partName = request.part?.name ?? "Unknown part";
  const technicianName = buildPersonName(request.technician);
  const partCode = request.part?.part_code ?? "No code";
  const quantity = request.quantity ?? 0;
  const isLow = isLowStock(request.part?.quantity_available, request.part?.minimum_stock);

  return (
    <div className="grid gap-4 px-4 py-4 md:grid-cols-[1.4fr_1fr_auto] md:items-center">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <p className="truncate text-sm font-black text-slate-900">{partName}</p>
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${requestStatusTone(request.status)}`}>
            {request.status}
          </span>
          <span className={`rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-widest ${urgencyTone(request.urgency)}`}>
            {request.urgency}
          </span>
        </div>
        <p className="mt-1 text-xs font-medium text-slate-500">
          {technicianName} · WO #{request.work_order_id ?? "N/A"} · {partCode}
        </p>
      </div>

      <div className="flex flex-wrap gap-3 text-xs font-medium text-slate-500">
        <span>Qty: <span className="font-black text-slate-900">{quantity}</span></span>
        <span>
          Stock:{" "}
          <span className={`font-black ${isLow ? "text-rose-600" : "text-emerald-600"}`}>
            {request.part?.quantity_available ?? 0}
          </span>
        </span>
      </div>

      <div className="text-left md:text-right">
        <p className="text-xs font-medium text-slate-400">{formatDateTime(request.request_date)}</p>
      </div>
    </div>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex h-36 items-center justify-center bg-slate-50 px-6 text-center">
      <p className="text-xs font-black uppercase tracking-[0.3em] text-slate-400">{message}</p>
    </div>
  );
}
