"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest, readAuthToken } from "@/lib/api";
import { buildApiUrl } from "@/lib/runtime-config";
import { Download, Filter, Search, X } from "lucide-react";

type Log = {
  id: number;
  module: string;
  action: string;
  status?: string | null;
  reference_id?: number | null;
  description?: string | null;
  ip_address?: string | null;
  meta?: Record<string, unknown> | null;
  created_at: string;
  user?: { fname: string; lname: string; email?: string; roles?: Array<{ id: number; name: string }> } | null;
};

export default function SystemLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Log | null>(null);

  const [search, setSearch] = useState("");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [module, setModule] = useState("");
  const [action, setAction] = useState("");
  const [status, setStatus] = useState("");
  const [userId, setUserId] = useState("");
  const [page, setPage] = useState(1);

  const load = async (opts?: { exportExcel?: boolean }) => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (userId) query.set("user_id", userId);
      if (module.trim()) query.set("module", module.trim());
      if (action.trim()) query.set("action", action.trim());
      if (status.trim()) query.set("status", status.trim());
      if (from) query.set("from", from);
      if (to) query.set("to", to);

      if (opts?.exportExcel) {
        query.set("export", "excel");
        const token = readAuthToken();
        const res = await fetch(buildApiUrl(`/api/admin/system-logs?${query.toString()}`), {
          method: "GET",
          headers: {
            Accept: "application/vnd.ms-excel",
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
        });
        if (!res.ok) {
          const text = await res.text().catch(() => "");
          throw new Error(text || `Export failed with status ${res.status}.`);
        }
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        const now = new Date();
        const datePart = now.toISOString().slice(0, 10);
        const timePart = [now.getHours(), now.getMinutes(), now.getSeconds()].map((v) => String(v).padStart(2, "0")).join("-");
        a.download = `system-logs-${datePart}_${timePart}.xls`;
        document.body.appendChild(a);
        a.click();
        a.remove();
        URL.revokeObjectURL(url);
        return;
      }

      const data = await apiRequest<{ success: boolean; logs: { data: Log[] } }>(`/api/admin/system-logs?${query.toString()}`, { method: "GET" }, true);
      setLogs(data.logs.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load logs.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  useEffect(() => {
    const h = window.setTimeout(() => {
      void load();
    }, 350);
    return () => window.clearTimeout(h);
  }, [action, from, module, status, to, userId]);

  const visibleLogs = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return logs;
    return logs.filter((l) => {
      const userName = l.user ? `${l.user.fname ?? ""} ${l.user.lname ?? ""}`.trim() : "system";
      const hay = [l.module, l.action, l.status ?? "", l.description ?? "", userName, l.ip_address ?? ""].join(" ").toLowerCase();
      return hay.includes(term);
    });
  }, [logs, search]);
  const pageSize = 25;
  const totalPages = Math.max(1, Math.ceil(visibleLogs.length / pageSize));
  const pagedLogs = useMemo(
    () => visibleLogs.slice((page - 1) * pageSize, page * pageSize),
    [page, visibleLogs]
  );

  useEffect(() => {
    setPage(1);
  }, [search, from, to, module, action, status, userId, logs.length]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div>
            <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">System</p>
            <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">System Logs</h1>
            <p className="mt-2 text-sm font-semibold text-slate-500">
              Track logins, asset updates, warnings, and other important activities. Click a row to see full detail.
            </p>
          </div>
          <button
            type="button"
            onClick={() => void load({ exportExcel: true })}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#003366] px-4 py-3 text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#0b4480]"
          >
            <Download size={16} /> Export Excel
          </button>
        </div>
      </div>

      {error ? <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div> : null}

      <div className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-3 flex items-center gap-2 text-slate-900">
          <Filter size={16} />
          <p className="text-sm font-black uppercase tracking-[0.14em]">Filters</p>
        </div>
        <div className="grid gap-3 md:grid-cols-6">
          <div className="relative md:col-span-2">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search text (live)..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm font-semibold text-slate-900"
            />
          </div>
          <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900" />
          <input type="date" value={to} onChange={(e) => setTo(e.target.value)} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900" />
          <input value={userId} onChange={(e) => setUserId(e.target.value)} placeholder="User ID" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900" />
          <input value={module} onChange={(e) => setModule(e.target.value)} placeholder="Module" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900" />
          <input value={action} onChange={(e) => setAction(e.target.value)} placeholder="Action" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900" />
          <input value={status} onChange={(e) => setStatus(e.target.value)} placeholder="Status (success/failed)" className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-900" />
          <button
            type="button"
            onClick={() => {
              setSearch("");
              setFrom("");
              setTo("");
              setModule("");
              setAction("");
              setStatus("");
              setUserId("");
              void load();
            }}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-black text-slate-900"
          >
            <X size={14} /> Reset
          </button>
        </div>
        <p className="mt-3 text-xs font-bold text-slate-500">{loading ? "Loading..." : `${visibleLogs.length} logs shown`}</p>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left">
          <thead className="bg-slate-50 text-[11px] font-black uppercase tracking-[0.14em] text-slate-600">
            <tr>
              <th className="px-4 py-3">Date & Time</th>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Module</th>
              <th className="px-4 py-3">Action</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Description</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {pagedLogs.map((l) => {
              const userName = l.user ? `${l.user.fname ?? ""} ${l.user.lname ?? ""}`.trim() : "System";
              return (
                <tr key={l.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelected(l)}>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{new Date(l.created_at).toLocaleString()}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{userName}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{l.module}</td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{l.action}</td>
                  <td className="px-4 py-3">
                    <span className={`rounded-full px-3 py-1 text-[11px] font-black uppercase tracking-wider ${
                      (l.status ?? "").toLowerCase() === "success"
                        ? "bg-emerald-50 text-emerald-700"
                        : (l.status ?? "").toLowerCase() === "failed"
                        ? "bg-rose-50 text-rose-700"
                        : "bg-slate-100 text-slate-700"
                    }`}>
                      {l.status ?? "n/a"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-sm font-semibold text-slate-900">{l.description ?? "-"}</td>
                </tr>
              );
            })}
            {pagedLogs.length === 0 && !loading ? (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-sm font-semibold text-slate-500">
                  No logs match your filters.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
        <p className="text-xs font-semibold text-slate-500">
          {visibleLogs.length} logs - page {page} / {totalPages}
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-700 disabled:opacity-40"
          >
            Prev
          </button>
          <button
            type="button"
            onClick={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-700 disabled:opacity-40"
          >
            Next
          </button>
        </div>
      </div>

      {selected ? (
        <div className="fixed inset-0 z-50 bg-slate-900/50 p-4">
          <div className="mx-auto max-w-2xl rounded-3xl bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h2 className="text-xl font-black text-slate-900">Log Detail</h2>
                <p className="mt-1 text-sm font-semibold text-slate-600">ID #{selected.id}</p>
              </div>
              <button type="button" onClick={() => setSelected(null)} className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-black text-slate-900">
                Close
              </button>
            </div>

            <div className="mt-5 grid gap-3 md:grid-cols-2">
              <DetailRow label="Date & Time" value={new Date(selected.created_at).toLocaleString()} />
              <DetailRow label="Status" value={selected.status ?? "n/a"} />
              <DetailRow label="Module" value={selected.module} />
              <DetailRow label="Action" value={selected.action} />
              <DetailRow label="User" value={selected.user ? `${selected.user.fname ?? ""} ${selected.user.lname ?? ""}`.trim() : "System"} />
              <DetailRow label="Roles" value={(selected.user?.roles ?? []).map((r) => r.name).join(", ") || "n/a"} />
              <DetailRow label="IP Address" value={selected.ip_address ?? "n/a"} />
              <DetailRow label="Reference ID" value={selected.reference_id ? String(selected.reference_id) : "n/a"} />
            </div>

            <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-700">Description</p>
              <p className="mt-2 text-sm font-semibold text-slate-900">{selected.description ?? "-"}</p>
            </div>

            {selected.meta ? (
              <div className="mt-4 rounded-2xl border border-slate-200 bg-white p-4">
                <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-700">Meta</p>
                <pre className="mt-2 overflow-auto rounded-xl bg-slate-50 p-3 text-xs font-semibold text-slate-900">
                  {JSON.stringify(selected.meta, null, 2)}
                </pre>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-3">
      <p className="text-[11px] font-black uppercase tracking-[0.14em] text-slate-600">{label}</p>
      <p className="mt-1 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}
