"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";
import { useToast } from "@/lib/toast";
import { ArrowRight, Search, SlidersHorizontal } from "lucide-react";

type Row = {
  id: number;
  request_number: string;
  urgency: "low" | "medium" | "high" | "critical";
  status: "pending" | "approved" | "rejected" | "expired" | "collected";
  created_at: string;
  pickup_deadline?: string | null;
  technician?: { fname: string; lname: string } | null;
  work_order_id?: number | null;
};

type IndexResponse = { success: boolean; requests: { data: Row[] } };
type DashResponse = {
  success: boolean;
  summary: { pending: number; approved: number; rejected: number; expired: number; collected: number; critical: number };
};

const badge = (status: Row["status"]) => {
  switch (status) {
    case "pending":
      return "bg-amber-50 text-amber-700 border-amber-200";
    case "approved":
      return "bg-emerald-50 text-emerald-700 border-emerald-200";
    case "rejected":
      return "bg-rose-50 text-rose-700 border-rose-200";
    case "expired":
      return "bg-slate-100 text-slate-600 border-slate-200";
    case "collected":
      return "bg-blue-50 text-blue-700 border-blue-200";
  }
};

const urgencyBadge = (u: Row["urgency"]) => {
  switch (u) {
    case "low":
      return "bg-slate-50 text-slate-700 border-slate-200";
    case "medium":
      return "bg-sky-50 text-sky-700 border-sky-200";
    case "high":
      return "bg-orange-50 text-orange-700 border-orange-200";
    case "critical":
      return "bg-red-50 text-red-700 border-red-200";
  }
};

export default function SparePartRequestsPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<DashResponse["summary"] | null>(null);
  const [rows, setRows] = useState<Row[]>([]);

  const [status, setStatus] = useState("");
  const [urgency, setUrgency] = useState("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (urgency) params.set("urgency", urgency);
      if (search.trim()) params.set("search", search.trim());
      const listPath = `/api/inventory/spare-part-requests${params.toString() ? `?${params.toString()}` : ""}`;

      const [dash, list] = await Promise.all([
        apiRequest<DashResponse>("/api/inventory/spare-part-requests/dashboard", { method: "GET" }, true),
        apiRequest<IndexResponse>(listPath, { method: "GET" }, true),
      ]);
      setSummary(dash.summary);
      setRows(list.requests?.data ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load requests.", "error");
    } finally {
      setLoading(false);
    }
  }, [status, urgency, search, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const cards = useMemo(() => {
    if (!summary) return [];
    return [
      { label: "Pending", value: summary.pending, tone: "border-amber-200 bg-amber-50 text-amber-800" },
      { label: "Approved", value: summary.approved, tone: "border-emerald-200 bg-emerald-50 text-emerald-800" },
      { label: "Expired", value: summary.expired, tone: "border-slate-200 bg-slate-100 text-slate-800" },
      { label: "Collected", value: summary.collected, tone: "border-blue-200 bg-blue-50 text-blue-800" },
      { label: "Critical (open)", value: summary.critical, tone: "border-red-200 bg-red-50 text-red-800" },
    ];
  }, [summary]);

  if (loading) return <PageSkeleton title="Spare Part Requests" />;

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl font-black tracking-tight text-slate-900">Spare Part Request Management</h1>
        <p className="text-xs font-bold text-slate-500">Review, approve, reject, expire, and confirm collection.</p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {cards.map((c) => (
          <div key={c.label} className={`rounded-2xl border p-4 shadow-sm ${c.tone}`}>
            <p className="text-[11px] font-black uppercase tracking-widest opacity-70">{c.label}</p>
            <p className="mt-2 text-2xl font-black">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
        <label className="relative">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search request #, title, technician..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-300"
          />
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none"
        >
          <option value="">All statuses</option>
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="rejected">Rejected</option>
          <option value="expired">Expired</option>
          <option value="collected">Collected</option>
        </select>
        <select
          value={urgency}
          onChange={(e) => setUrgency(e.target.value)}
          className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none"
        >
          <option value="">All urgency</option>
          <option value="low">Low</option>
          <option value="medium">Medium</option>
          <option value="high">High</option>
          <option value="critical">Critical</option>
        </select>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3">
          <div className="flex items-center gap-2">
            <SlidersHorizontal size={16} className="text-slate-400" />
            <p className="text-xs font-black uppercase tracking-widest text-slate-600">Incoming queue ({rows.length})</p>
          </div>
          <button onClick={() => load()} className="text-xs font-black text-slate-600 hover:text-slate-900">
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-4 py-3">Request #</th>
                <th className="px-4 py-3">Technician</th>
                <th className="px-4 py-3">Work order</th>
                <th className="px-4 py-3">Urgency</th>
                <th className="px-4 py-3">Request date</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Pickup deadline</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-8 text-center text-sm font-bold text-slate-500">
                    No requests found.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-black text-slate-900">{r.request_number}</td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-700">
                      {r.technician ? `${r.technician.fname} ${r.technician.lname}` : "—"}
                    </td>
                    <td className="px-4 py-3 text-xs font-black text-slate-700">{r.work_order_id ? `#${r.work_order_id}` : "—"}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${urgencyBadge(r.urgency)}`}>
                        {r.urgency}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-600">{new Date(r.created_at).toLocaleString()}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${badge(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-600">
                      {r.pickup_deadline ? new Date(r.pickup_deadline).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => router.push(`/inventory/spare-part-requests/${r.id}`)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
                      >
                        View <ArrowRight size={14} />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

