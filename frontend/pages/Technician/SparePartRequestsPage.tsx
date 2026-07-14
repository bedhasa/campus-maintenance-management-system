"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";
import { useToast } from "@/lib/toast";
import { ArrowRight, Plus, Search } from "lucide-react";

type SparePartRequestRow = {
  id: number;
  request_number: string;
  title: string;
  urgency: "low" | "medium" | "high" | "critical";
  status: "pending" | "approved" | "rejected" | "expired" | "collected";
  created_at: string;
  pickup_deadline?: string | null;
};

type IndexResponse = {
  success: boolean;
  requests: { data: SparePartRequestRow[] };
};

const tone = (status: SparePartRequestRow["status"]) => {
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

const urgencyTone = (u: SparePartRequestRow["urgency"]) => {
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
  const [rows, setRows] = useState<SparePartRequestRow[]>([]);
  const [status, setStatus] = useState<string>("");
  const [urgency, setUrgency] = useState<string>("");
  const [search, setSearch] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (urgency) params.set("urgency", urgency);
      if (search.trim()) params.set("search", search.trim());
      const path = `/api/technician/spare-part-requests${params.toString() ? `?${params.toString()}` : ""}`;
      const res = await apiRequest<IndexResponse>(path, { method: "GET" }, true);
      setRows(res.requests?.data ?? []);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load spare part requests.", "error");
    } finally {
      setLoading(false);
    }
  }, [status, urgency, search, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredCount = useMemo(() => rows.length, [rows]);

  if (loading) return <PageSkeleton title="Spare Part Requests" />;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-1 sm:px-2">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl font-black tracking-tight text-slate-900">Spare Part Requests</h1>
          <p className="text-xs font-bold text-slate-500">Submit and track digital inventory requests.</p>
        </div>
        <button
          onClick={() => router.push("/technician/spare-part-requests/new")}
          className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[#003366] px-4 py-2.5 text-xs font-black uppercase tracking-widest text-white shadow-sm active:scale-[0.99]"
        >
          <Plus size={16} />
          New Request
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-[1fr_180px_180px]">
        <label className="relative">
          <span className="sr-only">Search</span>
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by request number/title..."
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
          <p className="text-xs font-black uppercase tracking-widest text-slate-600">Requests ({filteredCount})</p>
          <button onClick={() => load()} className="text-xs font-black text-slate-600 hover:text-slate-900">
            Refresh
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full text-left text-sm">
            <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-widest text-slate-500">
              <tr>
                <th className="px-4 py-3">Request #</th>
                <th className="px-4 py-3">Title</th>
                <th className="px-4 py-3">Urgency</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">Pickup deadline</th>
                <th className="px-4 py-3">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-sm font-bold text-slate-500">
                    No requests found.
                  </td>
                </tr>
              ) : (
                rows.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/60">
                    <td className="px-4 py-3 font-black text-slate-900">{r.request_number}</td>
                    <td className="px-4 py-3 font-bold text-slate-700">{r.title}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${urgencyTone(r.urgency)}`}>
                        {r.urgency}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${tone(r.status)}`}>
                        {r.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs font-bold text-slate-600">
                      {r.pickup_deadline ? new Date(r.pickup_deadline).toLocaleString() : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        onClick={() => router.push(`/technician/spare-part-requests/${r.id}`)}
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

