"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";
import { useToast } from "@/lib/toast";
import { AlertTriangle, ArrowLeft, CheckCircle2, Clock, PackageCheck, XCircle } from "lucide-react";

type Item = {
  id: number;
  spare_part_id: number;
  requested_quantity: number;
  approved_quantity?: number | null;
  part_name_snapshot?: string | null;
  part_code_snapshot?: string | null;
  unit_snapshot?: string | null;
  category_snapshot?: string | null;
  unit_price_snapshot?: number;
};

type Detail = {
  id: number;
  request_number: string;
  title: string;
  description?: string | null;
  urgency: "low" | "medium" | "high" | "critical";
  status: "pending" | "approved" | "rejected" | "expired" | "collected";
  created_at: string;
  pickup_deadline?: string | null;
  approval_note?: string | null;
  rejection_reason?: string | null;
  technician?: { fname: string; lname: string; phone?: string | null } | null;
  work_order_id?: number | null;
  items: Item[];
};

type ShowResponse = { success: boolean; request: Detail };

const badge = (status: Detail["status"]) => {
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

export default function SparePartRequestDetailPage() {
  const router = useRouter();
  const params = useParams<{ id: string }>();
  const id = params?.id;
  const { showToast } = useToast();

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [data, setData] = useState<Detail | null>(null);

  const [pickupDeadline, setPickupDeadline] = useState("");
  const [approvalNote, setApprovalNote] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");
  const [approvedMap, setApprovedMap] = useState<Record<number, string>>({});

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiRequest<ShowResponse>(`/api/inventory/spare-part-requests/${id}`, { method: "GET" }, true);
      setData(res.request);
      setPickupDeadline(res.request.pickup_deadline ? res.request.pickup_deadline.slice(0, 16) : "");
      setApprovalNote(res.request.approval_note ?? "");
      setRejectionReason(res.request.rejection_reason ?? "");
      const init: Record<number, string> = {};
      for (const it of res.request.items ?? []) {
        init[it.id] = String(it.approved_quantity ?? it.requested_quantity ?? 0);
      }
      setApprovedMap(init);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load request.", "error");
      setData(null);
    } finally {
      setLoading(false);
    }
  }, [id, showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const canApprove = data?.status === "pending";
  const canReject = data?.status === "pending";
  const canCollect = data?.status === "approved";
  const canExpire = data?.status === "pending" || data?.status === "approved";

  const approvePayload = useMemo(() => {
    return {
      pickup_deadline: pickupDeadline ? new Date(pickupDeadline).toISOString() : "",
      approval_note: approvalNote || null,
      items: Object.entries(approvedMap).map(([itemId, qty]) => ({
        id: Number(itemId),
        approved_quantity: Number(qty || 0),
      })),
    };
  }, [pickupDeadline, approvalNote, approvedMap]);

  const approve = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const res = await apiRequest<{ success: boolean; message?: string }>(`/api/inventory/spare-part-requests/${id}/approve`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(approvePayload),
      }, true);
      showToast(res.message ?? "Request approved and stock deducted.", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Approval failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const reject = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const res = await apiRequest<{ success: boolean; message?: string }>(`/api/inventory/spare-part-requests/${id}/reject`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rejection_reason: rejectionReason }),
      }, true);
      showToast(res.message ?? "Request rejected.", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Rejection failed.", "error");
    } finally {
      setBusy(false);
    }
  };

  const collect = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const res = await apiRequest<{ success: boolean; message?: string }>(`/api/inventory/spare-part-requests/${id}/collect`, { method: "PATCH" }, true);
      showToast(res.message ?? "Request marked as collected.", "success");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to mark as collected.", "error");
    } finally {
      setBusy(false);
    }
  };

  const expire = async () => {
    if (!id) return;
    setBusy(true);
    try {
      const res = await apiRequest<{ success: boolean; message?: string }>(`/api/inventory/spare-part-requests/${id}/expire`, { method: "PATCH" }, true);
      showToast(res.message ?? "Request expired.", "info");
      await load();
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to mark as expired.", "error");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageSkeleton title="Spare Part Request" />;
  if (!data) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm font-bold text-slate-600">
        Request not found.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <button
          onClick={() => router.push("/inventory/spare-part-requests")}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${badge(data.status)}`}>
          {data.status}
        </span>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div>
            <h1 className="text-xl font-black tracking-tight text-slate-900">{data.title}</h1>
            <p className="text-xs font-bold text-slate-500">Request #{data.request_number}</p>
          </div>

          <div className="grid gap-2 text-xs font-bold text-slate-700 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Technician</p>
              <p className="mt-1 font-black">{data.technician ? `${data.technician.fname} ${data.technician.lname}` : "—"}</p>
            </div>
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
              <p className="text-[10px] font-black uppercase tracking-widest text-slate-500">Work order</p>
              <p className="mt-1 font-black">{data.work_order_id ? `#${data.work_order_id}` : "—"}</p>
            </div>
          </div>

          {data.description ? <p className="text-sm font-bold text-slate-700 whitespace-pre-wrap">{data.description}</p> : null}

          <div className="rounded-2xl border border-slate-100">
            <div className="border-b border-slate-100 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-slate-600">
              Request items
            </div>
            <div className="divide-y divide-slate-100">
              {data.items.map((it) => (
                <div key={it.id} className="grid gap-2 px-4 py-3 md:grid-cols-[1fr_140px_160px]">
                  <div>
                    <p className="text-sm font-black text-slate-900">
                      {it.part_name_snapshot ?? "Spare part"}{" "}
                      {it.part_code_snapshot ? <span className="text-xs font-black text-slate-400">({it.part_code_snapshot})</span> : null}
                    </p>
                    <p className="text-[11px] font-bold text-slate-500">
                      {it.category_snapshot ? <span>{it.category_snapshot}</span> : null}
                      {it.unit_snapshot ? <span className="text-slate-400">{it.category_snapshot ? " • " : ""}{it.unit_snapshot}</span> : null}
                    </p>
                  </div>
                  <div className="text-xs font-bold text-slate-600">
                    Requested: <span className="font-black text-slate-900">{it.requested_quantity}</span>
                  </div>
                  <div className="text-xs font-bold text-slate-600">
                    Approved: <span className="font-black text-slate-900">{it.approved_quantity ?? "—"}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <p className="text-xs font-black uppercase tracking-widest text-slate-600">Actions</p>

          {canApprove ? (
            <div className="rounded-2xl border border-slate-100 bg-slate-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-black text-slate-700">
                <CheckCircle2 size={16} className="text-emerald-600" />
                Approve (deduct stock immediately)
              </div>

              <label className="grid gap-1">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Pickup deadline</span>
                <input
                  type="datetime-local"
                  value={pickupDeadline}
                  onChange={(e) => setPickupDeadline(e.target.value)}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none"
                />
              </label>

              <label className="grid gap-1">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Approval note (optional)</span>
                <textarea
                  value={approvalNote}
                  onChange={(e) => setApprovalNote(e.target.value)}
                  className="min-h-20 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none"
                />
              </label>

              <div className="rounded-2xl border border-slate-200 bg-white">
                <div className="border-b border-slate-100 px-3 py-2 text-[11px] font-black uppercase tracking-widest text-slate-600">
                  Approved quantities
                </div>
                <div className="divide-y divide-slate-100">
                  {data.items.map((it) => (
                    <div key={it.id} className="flex items-center justify-between gap-3 px-3 py-2.5">
                      <div className="min-w-0">
                        <p className="truncate text-xs font-black text-slate-800">{it.part_name_snapshot ?? "Part"}</p>
                        <p className="text-[11px] font-bold text-slate-500">
                          Requested: {it.requested_quantity}
                        </p>
                      </div>
                      <input
                        value={approvedMap[it.id] ?? "0"}
                        onChange={(e) => setApprovedMap((p) => ({ ...p, [it.id]: e.target.value }))}
                        className="w-24 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 outline-none"
                        inputMode="numeric"
                      />
                    </div>
                  ))}
                </div>
              </div>

              <button
                disabled={busy || !pickupDeadline}
                onClick={() => approve()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white shadow-sm disabled:opacity-60"
              >
                Approve & Deduct Stock <PackageCheck size={16} />
              </button>
            </div>
          ) : null}

          {canReject ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 space-y-3">
              <div className="flex items-center gap-2 text-xs font-black text-rose-700">
                <XCircle size={16} />
                Reject
              </div>
              <textarea
                value={rejectionReason}
                onChange={(e) => setRejectionReason(e.target.value)}
                className="min-h-20 w-full rounded-2xl border border-rose-200 bg-white px-3 py-2.5 text-sm font-bold text-rose-900 outline-none"
                placeholder="Rejection reason..."
              />
              <button
                disabled={busy || !rejectionReason.trim()}
                onClick={() => reject()}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-rose-600 px-4 py-3 text-xs font-black uppercase tracking-widest text-white shadow-sm disabled:opacity-60"
              >
                Reject Request <XCircle size={16} />
              </button>
            </div>
          ) : null}

          {canCollect ? (
            <button
              disabled={busy}
              onClick={() => collect()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#003366] px-4 py-3 text-xs font-black uppercase tracking-widest text-white shadow-sm disabled:opacity-60"
            >
              Mark as Collected <CheckCircle2 size={16} />
            </button>
          ) : null}

          {canExpire ? (
            <button
              disabled={busy}
              onClick={() => expire()}
              className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-slate-700 hover:bg-slate-50 disabled:opacity-60"
            >
              Mark as Expired <Clock size={16} />
            </button>
          ) : null}

          {data.status === "approved" && data.pickup_deadline ? (
            <div className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-xs font-black text-amber-800">
              Pickup deadline: {new Date(data.pickup_deadline).toLocaleString()}
            </div>
          ) : null}

          {data.status === "expired" ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 text-xs font-black text-slate-700 flex items-start gap-2">
              <AlertTriangle size={16} className="mt-0.5" />
              Expired requests are locked. If it was approved earlier, stock was rolled back automatically.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

