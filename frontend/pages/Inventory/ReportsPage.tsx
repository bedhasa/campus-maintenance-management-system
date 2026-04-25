"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";
import { buildPersonName, InventoryPart } from "./inventory-utils";

type ReportsResponse = {
  success: boolean;
  summary: { total_requests: number; total_issues: number; total_issue_cost?: number };
  most_issued_parts: Array<{ part_id: number; total_quantity: string | number; issue_count: string | number; part?: InventoryPart | null }>;
  monthly_usage: Array<{ year: number; month: number; total_quantity: string | number }>;
  technician_usage: Array<{ technician_id: number; total_quantity: string | number; technician?: { fname?: string; lname?: string } | null }>;
  parts_usage_by_work_order?: Array<{ work_order_id: number; total_quantity: string | number; total_cost?: string | number; work_order?: { created_at?: string; request?: { title?: string } | null } | null }>;
  low_stock_report?: Array<{ id: number; name: string; part_code?: string; quantity_available?: number; minimum_stock?: number }>;
  maintenance_cost_by_department?: Array<{ department_name?: string | null; total_cost?: string | number; total_quantity?: string | number; issue_count?: string | number }>;
};

export default function ReportsPage() {
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest<ReportsResponse>("/api/inventory/reports", { method: "GET" }, true);
      setData(response);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  if (loading) return <PageSkeleton cards={1} rows={10} />;

  return (
    <div className="max-w-3xl mx-auto px-6 py-12 space-y-12 bg-white min-h-screen">
      {/* Clean Header */}
      <header className="border-b-2 border-slate-900 pb-8">
        <h1 className="text-3xl font-black text-slate-900 uppercase tracking-tight">Inventory Report</h1>
        <p className="text-slate-500 text-sm font-medium mt-2">Detailed breakdown of stock movement and personnel activity.</p>
      </header>

      {/* Stats Summary Table-Style */}
      <div className="grid grid-cols-2 border border-slate-200 rounded-xl overflow-hidden">
        <div className="p-6 border-r border-slate-200 bg-slate-50/50">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Total Requests</p>
          <p className="text-3xl font-black text-slate-900">{data?.summary.total_requests}</p>
        </div>
        <div className="p-6 bg-slate-50/50">
          <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Total Issued</p>
          <p className="text-3xl font-black text-[#003366]">{data?.summary.total_issues}</p>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-slate-50/50 p-6">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-1">Total Inventory Cost</p>
        <p className="text-3xl font-black text-emerald-700">{toCurrency(data?.summary.total_issue_cost)}</p>
      </div>

      {/* Sections */}
      <div className="space-y-12">
        <ReportSection title="Most Issued Parts">
          {data?.most_issued_parts.map((row, idx) => (
            <ReportRow 
              key={row.part_id} 
              label={row.part?.name || "Unknown Part"} 
              value={`${row.total_quantity} Units`} 
              isOdd={idx % 2 !== 0}
            />
          ))}
        </ReportSection>

        <ReportSection title="Technician Activity">
          {data?.technician_usage.map((row, idx) => (
            <ReportRow 
              key={row.technician_id} 
              label={buildPersonName(row.technician)} 
              value={`${row.total_quantity} Units`} 
              isOdd={idx % 2 !== 0}
            />
          ))}
        </ReportSection>

        <ReportSection title="Monthly Distribution">
          {data?.monthly_usage.map((row, idx) => (
            <ReportRow 
              key={`${row.year}-${row.month}`} 
              label={new Date(row.year, row.month - 1).toLocaleString('default', { month: 'long', year: 'numeric' })} 
              value={String(row.total_quantity)} 
              isOdd={idx % 2 !== 0}
            />
          ))}
        </ReportSection>

        <ReportSection title="Parts Usage by Work Order">
          {(data?.parts_usage_by_work_order ?? []).map((row, idx) => (
            <ReportRow
              key={row.work_order_id}
              label={`${toWorkOrderCode(row.work_order_id, row.work_order?.created_at)} ${row.work_order?.request?.title ? `- ${row.work_order.request.title}` : ""}`}
              value={`${row.total_quantity} units / ${toCurrency(row.total_cost)}`}
              isOdd={idx % 2 !== 0}
            />
          ))}
        </ReportSection>

        <ReportSection title="Low Stock Report">
          {(data?.low_stock_report ?? []).map((row, idx) => (
            <ReportRow
              key={row.id}
              label={`${row.name} (${row.part_code || "N/A"})`}
              value={`${row.quantity_available ?? 0} left (min ${row.minimum_stock ?? 0})`}
              isOdd={idx % 2 !== 0}
            />
          ))}
        </ReportSection>

        <ReportSection title="Maintenance Cost by Department">
          {(data?.maintenance_cost_by_department ?? []).map((row, idx) => (
            <ReportRow
              key={`${row.department_name ?? "unknown"}-${idx}`}
              label={row.department_name || "Unknown"}
              value={`${toCurrency(row.total_cost)} / ${(row.total_quantity ?? 0)} units`}
              isOdd={idx % 2 !== 0}
            />
          ))}
        </ReportSection>
      </div>
    </div>
  );
}

/* Simple, Classic Components for Readability */

function ReportSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-4">
      <h2 className="text-xs font-black uppercase tracking-[0.2em] text-[#003366] border-l-4 border-[#003366] pl-3">
        {title}
      </h2>
      <div className="border border-slate-100 rounded-lg overflow-hidden">
        {children}
      </div>
    </section>
  );
}

function ReportRow({ label, value, isOdd }: { label: string; value: string; isOdd: boolean }) {
  return (
    <div className={`flex justify-between items-center px-4 py-3.5 transition-colors ${isOdd ? 'bg-slate-50/50' : 'bg-white'}`}>
      <span className="text-sm font-bold text-slate-700">{label}</span>
      <span className="text-sm font-black text-slate-900 tabular-nums">{value}</span>
    </div>
  );
}

function toCurrency(value?: string | number | null) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return "0.00";
  return parsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function toWorkOrderCode(id?: number | null, createdAt?: string) {
  if (!id) return "WO-UNKNOWN";
  const date = createdAt ? new Date(createdAt) : new Date();
  const year = Number.isNaN(date.getTime()) ? new Date().getFullYear() : date.getFullYear();
  return `WO-${year}-${String(id).padStart(3, "0")}`;
}
