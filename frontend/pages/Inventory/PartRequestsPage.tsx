"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";
import { CheckCircle2, PackageX, PlayCircle } from "lucide-react";
import {
  PartRequestRecord,
  buildPersonName,
  formatDateTime,
  requestStatusTone,
  urgencyTone,
} from "./inventory-utils";

type RequestsResponse = {
  success: boolean;
  part_requests: { data: PartRequestRecord[] };
};

export default function PartRequestsPage() {
  const [data, setData] = useState<PartRequestRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [filter, setFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest<RequestsResponse>(
        `/api/inventory/part-requests${filter === "all" ? "" : `?status=${filter}`}`,
        { method: "GET" },
        true,
      );
      setData(response.part_requests?.data ?? []);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to load requests.");
    } finally {
      setLoading(false);
    }
  }, [filter]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const approve = async (id: number) => {
    setBusyId(id);
    try {
      await apiRequest(`/api/inventory/part-requests/${id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "approved" }),
      }, true);
      setToast("Request approved.");
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to approve request.");
    } finally {
      setBusyId(null);
    }
  };

  const reject = async (id: number) => {
    setBusyId(id);
    try {
      await apiRequest(`/api/inventory/part-requests/${id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "rejected" }),
      }, true);
      setToast("Request rejected.");
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to reject request.");
    } finally {
      setBusyId(null);
    }
  };

  const issue = async (id: number) => {
    setBusyId(id);
    try {
      const quantityInput = window.prompt("Enter quantity to issue (leave empty to use requested quantity):");
      const quantity = quantityInput && quantityInput.trim() !== "" ? Number(quantityInput) : undefined;
      if (quantityInput && (Number.isNaN(quantity) || !Number.isFinite(quantity) || (quantity ?? 0) <= 0)) {
        setToast("Quantity must be a positive number.");
        setBusyId(null);
        return;
      }

      await apiRequest(
        `/api/inventory/part-requests/${id}/issue`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            quantity_issued: quantity,
          }),
        },
        true,
      );
      setToast("Parts issued.");
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to issue parts.");
    } finally {
      setBusyId(null);
    }
  };

  const activeCount = useMemo(() => data.filter((item) => item.status === "approved").length, [data]);

  if (loading) return <PageSkeleton cards={3} rows={4} />;

  return (
    <div className="space-y-5 px-4 pb-12 pt-4">
      {toast && (
        <div className="fixed left-1/2 top-6 z-50 w-[90%] max-w-sm -translate-x-1/2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-center text-sm font-bold text-slate-900 shadow-xl">
          {toast}
        </div>
      )}

      <header className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">Request Queue</p>
        <h1 className="text-3xl font-black text-slate-900">Requests Waiting for Review</h1>
        <p className="text-sm font-medium text-slate-500">Approve, reject, and issue spare parts from one mobile-friendly queue.</p>
        <p className="text-xs font-black uppercase tracking-widest text-slate-400">Approved ready to issue: {activeCount}</p>
      </header>

      <div className="flex gap-2 overflow-x-auto pb-1">
        {[
          ["all", "All"],
          ["pending", "Pending"],
          ["approved", "Approved"],
          ["rejected", "Rejected"],
        ].map(([key, label]) => {
          const active = filter === key;
          return (
            <button
              key={key}
              onClick={() => setFilter(key as typeof filter)}
              className={`shrink-0 rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.2em] ${
                active ? "border-[#003366] bg-[#003366] text-white" : "border-slate-200 bg-white text-slate-500"
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      <div className="space-y-3">
        {data.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm font-medium text-slate-400">
            No requests found.
          </div>
        ) : (
          data.map((request) => (
            <article key={request.id} className="rounded-[1.75rem] border border-slate-100 bg-white p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900">{request.part?.name || "Part Request"}</h2>
                  <p className="text-xs font-medium text-slate-500">
                    {buildPersonName(request.technician)} · WO #{request.work_order_id}
                  </p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${requestStatusTone(request.status)}`}>
                  {request.status}
                </span>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <Info label="Quantity" value={String(request.quantity)} />
                <Info label="Urgency" value={request.urgency} tone={urgencyTone(request.urgency)} />
              </div>

              {request.note && <p className="mt-4 text-sm leading-relaxed text-slate-600">{request.note}</p>}
              <p className="mt-4 text-xs font-medium text-slate-400">{formatDateTime(request.request_date)}</p>

              <div className="mt-4 flex flex-wrap gap-2">
                {request.status === "pending" && (
                  <>
                    <button
                      type="button"
                      onClick={() => void approve(request.id)}
                      disabled={busyId === request.id}
                      className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
                    >
                      <CheckCircle2 size={14} />
                      Approve
                    </button>
                    <button
                      type="button"
                      onClick={() => void reject(request.id)}
                      disabled={busyId === request.id}
                      className="inline-flex items-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
                    >
                      <PackageX size={14} />
                      Reject
                    </button>
                  </>
                )}
                {request.status === "approved" && !request.issue && (
                  <button
                    type="button"
                    onClick={() => void issue(request.id)}
                    disabled={busyId === request.id}
                    className="inline-flex items-center gap-2 rounded-2xl bg-[#003366] px-4 py-3 text-[10px] font-black uppercase tracking-widest text-white disabled:opacity-50"
                  >
                    <PlayCircle size={14} />
                    Issue Parts
                  </button>
                )}
              </div>

              {request.issue && (
                <div className="mt-4 rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
                  <p className="text-xs font-black uppercase tracking-widest text-emerald-700">Issued</p>
                  <p className="mt-2 text-sm font-medium text-emerald-800">
                    Qty {request.issue.quantity_issued} issued by {buildPersonName(request.issue.issuedBy)}
                  </p>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}

function Info({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div className={`rounded-2xl border p-4 ${tone ?? "border-slate-100 bg-slate-50"}`}>
      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-black text-slate-900">{value}</p>
    </div>
  );
}
