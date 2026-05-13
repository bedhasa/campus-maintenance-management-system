"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import { Download, Filter, Package, TrendingDown, TrendingUp, Users, Wallet } from "lucide-react";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";
import { buildPersonName, getInventoryImageUrl, InventoryPart } from "@/lib/inventory-utils";

type ReportRange = "weekly" | "monthly" | "yearly" | "overall";

type ReportsResponse = {
  success: boolean;
  range: ReportRange;
  summary: {
    total_requests: number;
    total_issues: number;
    total_issue_cost?: number;
  };
  highlights?: {
    most_used_part?: { part?: InventoryPart | null; total_quantity?: string | number; issue_count?: string | number } | null;
    most_requested_technician?: {
      technician?: { fname?: string; lname?: string } | null;
      total_quantity?: string | number;
      request_count?: string | number;
    } | null;
    low_stock_count?: number;
  };
  most_issued_parts: Array<{ part_id: number; total_quantity: string | number; issue_count: string | number; total_cost?: string | number; part?: InventoryPart | null }>;
  most_requested_technicians?: Array<{ technician_id: number; total_quantity: string | number; request_count?: string | number; technician?: { fname?: string; lname?: string } | null }>;
  low_stock_report?: Array<{ id: number; name: string; part_code?: string; quantity_available?: number; minimum_stock?: number; image_path?: string | null; image_url?: string | null }>;
  maintenance_cost_by_department?: Array<{ department_name?: string | null; total_cost?: string | number; total_quantity?: string | number; issue_count?: string | number }>;
};

const RANGE_LABELS: Record<ReportRange, string> = {
  weekly: "Weekly",
  monthly: "Monthly",
  yearly: "Yearly",
  overall: "Overall",
};

export default function ReportsPage() {
  const [data, setData] = useState<ReportsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [range, setRange] = useState<ReportRange>("overall");

  const load = useCallback(async (selectedRange: ReportRange) => {
    setLoading(true);
    try {
      const response = await apiRequest<ReportsResponse>(`/api/inventory/reports?range=${selectedRange}`, { method: "GET" }, true);
      setData(response);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load(range);
  }, [load, range]);

  const topDepartment = useMemo(() => data?.maintenance_cost_by_department?.[0] ?? null, [data]);
  const topPart = data?.highlights?.most_used_part ?? null;
  const topTechnician = data?.highlights?.most_requested_technician ?? null;

  const downloadReport = () => {
    if (!data) return;

    const rows: Array<Array<string | number>> = [
      ["Inventory Report"],
      ["Range", RANGE_LABELS[range]],
      ["Generated At", new Date().toLocaleString()],
      [],
      ["Summary"],
      ["Total Requests", data.summary.total_requests],
      ["Total Issued", data.summary.total_issues],
      ["Total Cost", toCurrency(data.summary.total_issue_cost)],
      [],
      ["Most Used Parts"],
      ["Part", "Quantity", "Issue Count", "Total Cost"],
    ];

    data.most_issued_parts.forEach((row) => {
      rows.push([
        row.part?.name || "Unknown Part",
        Number(row.total_quantity ?? 0),
        Number(row.issue_count ?? 0),
        toCurrency(row.total_cost),
      ]);
    });

    rows.push([]);
    rows.push(["Most Requested Technician / Person"]);
    rows.push(["Technician", "Requested Quantity", "Request Count"]);
    (data.most_requested_technicians ?? []).forEach((row) => {
      rows.push([
        buildPersonName(row.technician),
        Number(row.total_quantity ?? 0),
        Number(row.request_count ?? 0),
      ]);
    });

    rows.push([]);
    rows.push(["Cost By Department"]);
    rows.push(["Department", "Total Cost", "Issued Qty", "Issue Count"]);
    (data.maintenance_cost_by_department ?? []).forEach((row) => {
      rows.push([
        row.department_name || "Unknown",
        toCurrency(row.total_cost),
        Number(row.total_quantity ?? 0),
        Number(row.issue_count ?? 0),
      ]);
    });

    const csv = rows
      .map((line) => line.map((value) => `"${String(value ?? "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `inventory-report-${range}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    URL.revokeObjectURL(url);
  };

  if (loading) return <PageSkeleton cards={4} rows={8} />;

  return (
    <div className="mx-auto max-w-7xl space-y-8 px-4 pb-16 pt-8">
      <header className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
        <div className="space-y-2">
          <p className="text-[10px] font-black uppercase tracking-[0.35em] text-amber-600">Inventory Reports</p>
          <h1 className="text-4xl font-black tracking-tight text-slate-900">Usage and Cost Analytics</h1>
          <p className="max-w-3xl text-sm font-medium text-slate-500">
            Review total requests, issued parts, total cost, most used parts, low stock, department costs, and the most requested technician or person.
          </p>
        </div>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <div className="flex flex-wrap gap-2 rounded-2xl border border-slate-200 bg-white p-2 shadow-sm">
            {(["weekly", "monthly", "yearly", "overall"] as ReportRange[]).map((option) => (
              <button
                key={option}
                type="button"
                onClick={() => setRange(option)}
                className={`rounded-xl px-4 py-2 text-[10px] font-black uppercase tracking-widest transition-all ${
                  range === option ? "bg-[#003366] text-white shadow-lg" : "bg-slate-50 text-slate-600"
                }`}
              >
                {RANGE_LABELS[option]}
              </button>
            ))}
          </div>

          <button
            type="button"
            onClick={downloadReport}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#003366] px-5 py-3 text-[10px] font-black uppercase tracking-widest text-white shadow-lg"
          >
            <Download size={14} />
            Download
          </button>
        </div>
      </header>

      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <KpiCard label="Total Requests" value={String(data?.summary.total_requests ?? 0)} icon={<Filter size={18} />} tone="bg-slate-900 text-white" />
        <KpiCard label="Total Issued" value={String(data?.summary.total_issues ?? 0)} icon={<Package size={18} />} tone="bg-blue-600 text-white" />
        <KpiCard label="Total Cost" value={toCurrency(data?.summary.total_issue_cost)} icon={<Wallet size={18} />} tone="bg-emerald-600 text-white" />
        <KpiCard label="Low Stock" value={String(data?.highlights?.low_stock_count ?? 0)} icon={<TrendingDown size={18} />} tone="bg-rose-500 text-white" />
      </section>

      <section className="grid gap-4 lg:grid-cols-3">
        <HighlightCard
          title="Most Used Part"
          icon={<TrendingUp size={16} />}
          body={
            topPart?.part ? (
              <div className="space-y-4">
                <div className="flex items-center gap-4">
                  <div className="flex h-16 w-16 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
                    {getInventoryImageUrl(topPart.part) ? (
                      <Image
                        src={getInventoryImageUrl(topPart.part)}
                        alt={topPart.part.name}
                        width={64}
                        height={64}
                        unoptimized
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <Package size={22} className="text-slate-300" />
                    )}
                  </div>
                  <div>
                    <p className="text-lg font-black text-slate-900">{topPart.part.name}</p>
                    <p className="text-[10px] font-black uppercase tracking-widest text-slate-400">{topPart.part.part_code || "No code"}</p>
                  </div>
                </div>
                <p className="text-sm font-bold text-slate-600">
                  {Number(topPart.total_quantity ?? 0)} units issued in {Number(topPart.issue_count ?? 0)} transactions.
                </p>
              </div>
            ) : (
              <EmptyText text="No usage data available for this filter." />
            )
          }
        />

        <HighlightCard
          title="Most Requested Technician / Person"
          icon={<Users size={16} />}
          body={
            topTechnician ? (
              <div className="space-y-2">
                <p className="text-lg font-black text-slate-900">{buildPersonName(topTechnician.technician)}</p>
                <p className="text-sm font-bold text-slate-600">
                  {Number(topTechnician.total_quantity ?? 0)} requested units across {Number(topTechnician.request_count ?? 0)} requests.
                </p>
              </div>
            ) : (
              <EmptyText text="No requester activity available for this filter." />
            )
          }
        />

        <HighlightCard
          title="Top Department By Cost"
          icon={<Wallet size={16} />}
          body={
            topDepartment ? (
              <div className="space-y-2">
                <p className="text-lg font-black text-slate-900">{topDepartment.department_name || "Unknown"}</p>
                <p className="text-sm font-bold text-slate-600">{toCurrency(topDepartment.total_cost)} total issue cost.</p>
                <p className="text-xs font-bold uppercase tracking-widest text-slate-400">
                  {Number(topDepartment.total_quantity ?? 0)} units · {Number(topDepartment.issue_count ?? 0)} issues
                </p>
              </div>
            ) : (
              <EmptyText text="No department cost data available for this filter." />
            )
          }
        />
      </section>

      <section className="grid gap-6 xl:grid-cols-2">
        <Panel title="Most Used Parts">
          {(data?.most_issued_parts ?? []).length === 0 ? (
            <EmptyText text="No parts issued in this range." />
          ) : (
            <div className="space-y-3">
              {(data?.most_issued_parts ?? []).map((row) => (
                <MetricRow
                  key={row.part_id}
                  label={row.part?.name || "Unknown Part"}
                  sublabel={row.part?.part_code || "No code"}
                  value={`${Number(row.total_quantity ?? 0)} units`}
                  meta={`${Number(row.issue_count ?? 0)} issues · ${toCurrency(row.total_cost)}`}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Low Stock">
          {(data?.low_stock_report ?? []).length === 0 ? (
            <EmptyText text="No low stock items right now." />
          ) : (
            <div className="space-y-3">
              {(data?.low_stock_report ?? []).map((row) => (
                <MetricRow
                  key={row.id}
                  label={row.name}
                  sublabel={row.part_code || "No code"}
                  value={`${row.quantity_available ?? 0} left`}
                  meta={`Min ${row.minimum_stock ?? 0}`}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Cost By Department">
          {(data?.maintenance_cost_by_department ?? []).length === 0 ? (
            <EmptyText text="No department cost records in this range." />
          ) : (
            <div className="space-y-3">
              {(data?.maintenance_cost_by_department ?? []).map((row, index) => (
                <MetricRow
                  key={`${row.department_name ?? "unknown"}-${index}`}
                  label={row.department_name || "Unknown"}
                  value={toCurrency(row.total_cost)}
                  meta={`${Number(row.total_quantity ?? 0)} units · ${Number(row.issue_count ?? 0)} issues`}
                />
              ))}
            </div>
          )}
        </Panel>

        <Panel title="Most Requested Technician / Person">
          {(data?.most_requested_technicians ?? []).length === 0 ? (
            <EmptyText text="No technician requests in this range." />
          ) : (
            <div className="space-y-3">
              {(data?.most_requested_technicians ?? []).map((row) => (
                <MetricRow
                  key={row.technician_id}
                  label={buildPersonName(row.technician)}
                  value={`${Number(row.total_quantity ?? 0)} requested`}
                  meta={`${Number(row.request_count ?? 0)} requests`}
                />
              ))}
            </div>
          )}
        </Panel>
      </section>
    </div>
  );
}

function KpiCard({ label, value, icon, tone }: { label: string; value: string; icon: React.ReactNode; tone: string }) {
  return (
    <div className={`rounded-[2rem] p-6 shadow-sm ${tone}`}>
      <div className="flex items-start justify-between gap-4">
        <div className="rounded-xl bg-white/10 p-2">{icon}</div>
        <p className="text-[10px] font-black uppercase tracking-[0.25em] opacity-70 text-right">{label}</p>
      </div>
      <p className="mt-6 text-4xl font-black tracking-tight">{value}</p>
    </div>
  );
}

function HighlightCard({ title, icon, body }: { title: string; icon: React.ReactNode; body: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
      <div className="mb-4 flex items-center gap-2 text-[#003366]">
        {icon}
        <h2 className="text-[10px] font-black uppercase tracking-widest">{title}</h2>
      </div>
      {body}
    </section>
  );
}

function Panel({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm">
      <h2 className="mb-4 text-[10px] font-black uppercase tracking-widest text-slate-400">{title}</h2>
      {children}
    </section>
  );
}

function MetricRow({
  label,
  value,
  sublabel,
  meta,
}: {
  label: string;
  value: string;
  sublabel?: string;
  meta?: string;
}) {
  return (
    <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-slate-900">{label}</p>
          {sublabel ? <p className="mt-1 text-[10px] font-black uppercase tracking-widest text-slate-400">{sublabel}</p> : null}
        </div>
        <p className="text-sm font-black text-[#003366]">{value}</p>
      </div>
      {meta ? <p className="mt-2 text-xs font-medium text-slate-500">{meta}</p> : null}
    </div>
  );
}

function EmptyText({ text }: { text: string }) {
  return <p className="text-sm font-medium text-slate-500">{text}</p>;
}

function toCurrency(value?: string | number | null) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return "0.00";
  return parsed.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
