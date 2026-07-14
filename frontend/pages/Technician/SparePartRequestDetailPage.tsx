"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";
import { useToast } from "@/lib/toast";
import { ArrowLeft, Download, Printer } from "lucide-react";

type Item = {
  id: number;
  requested_quantity: number;
  approved_quantity?: number | null;
  part_name_snapshot?: string | null;
  part_code_snapshot?: string | null;
  unit_snapshot?: string | null;
  category_snapshot?: string | null;
};

type Detail = {
  id: number;
  request_number: string;
  title: string;
  description?: string | null;
  urgency: "low" | "medium" | "high" | "critical";
  status: "pending" | "approved" | "rejected" | "expired" | "collected";
  needed_date?: string | null;
  created_at: string;
  pickup_deadline?: string | null;
  approved_at?: string | null;
  approval_note?: string | null;
  rejection_reason?: string | null;
  expired_at?: string | null;
  collected_at?: string | null;
  approver?: { fname: string; lname: string } | null;
  items: Item[];
  work_order_id?: number | null;
};

type ShowResponse = { success: boolean; request: Detail };

const tone = (status: Detail["status"]) => {
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
  const [data, setData] = useState<Detail | null>(null);

  const load = useCallback(async () => {
    if (!id) return;
    setLoading(true);
    try {
      const res = await apiRequest<ShowResponse>(`/api/technician/spare-part-requests/${id}`, { method: "GET" }, true);
      setData(res.request);
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

  const receiptDisabled = useMemo(() => data?.status === "expired", [data?.status]);

  const printReceipt = () => {
    window.print();
  };

  const downloadReceipt = () => {
    // Minimal: print-to-PDF via browser.
    window.print();
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
    <div className="mx-auto w-full max-w-6xl space-y-5 px-1 sm:px-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <button
          onClick={() => router.push("/technician/spare-part-requests")}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <div className="flex items-center gap-2">
          <span className="text-xs font-black uppercase tracking-widest text-slate-500">Status</span>
          <span className={`inline-flex rounded-full border px-2 py-1 text-[10px] font-black uppercase tracking-widest ${tone(data.status)}`}>
            {data.status}
          </span>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h1 className="text-xl font-black tracking-tight text-slate-900">{data.title}</h1>
              <p className="text-xs font-bold text-slate-500">Request #{data.request_number}</p>
            </div>
            {data.work_order_id ? (
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black text-slate-700">
                Work Order #{data.work_order_id}
              </div>
            ) : null}
          </div>

          {data.description ? <p className="text-sm font-bold text-slate-700 whitespace-pre-wrap">{data.description}</p> : null}

          <div className="rounded-2xl border border-slate-100">
            <div className="border-b border-slate-100 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-slate-600">
              Requested items
            </div>
            <div className="divide-y divide-slate-100">
              {data.items.map((it) => (
                <div key={it.id} className="grid gap-2 px-4 py-3 sm:grid-cols-[1fr_120px_140px]">
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
                    Approved:{" "}
                    <span className="font-black text-slate-900">{data.status === "pending" ? "—" : String(it.approved_quantity ?? 0)}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {data.status === "rejected" ? (
            <div className="rounded-2xl border border-rose-200 bg-rose-50 p-4 text-sm font-bold text-rose-700">
              Rejection reason: {data.rejection_reason ?? "—"}
            </div>
          ) : null}
        </div>

        <div className={`rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3 ${receiptDisabled ? "opacity-70" : ""}`}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-black uppercase tracking-widest text-slate-600">Digital receipt</p>
            <div className="flex items-center gap-2">
              <button
                disabled={!data || data.status !== "approved" || receiptDisabled}
                onClick={printReceipt}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <Printer size={16} /> Print
              </button>
              <button
                disabled={!data || data.status !== "approved" || receiptDisabled}
                onClick={downloadReceipt}
                className="inline-flex items-center gap-2 rounded-xl bg-[#003366] px-3 py-2 text-xs font-black text-white disabled:opacity-60"
              >
                <Download size={16} /> Download
              </button>
            </div>
          </div>

          <div className={`${data.status === "expired" ? "line-through text-slate-500" : ""}`}>
            <div className="grid gap-2 text-sm font-bold text-slate-700">
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Receipt / Request #</span>
                <span className="font-black">{data.request_number}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Approval date</span>
                <span className="font-black">{data.approved_at ? new Date(data.approved_at).toLocaleString() : "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Pickup deadline</span>
                <span className="font-black">{data.pickup_deadline ? new Date(data.pickup_deadline).toLocaleString() : "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Inventory officer</span>
                <span className="font-black">{data.approver ? `${data.approver.fname} ${data.approver.lname}` : "—"}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-500">Work order ref</span>
                <span className="font-black">{data.work_order_id ? `#${data.work_order_id}` : "—"}</span>
              </div>
            </div>
          </div>

          {data.status === "approved" ? (
            <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-xs font-black text-emerald-800">
              Approved. Collect before the pickup deadline.
            </div>
          ) : null}

          {data.status === "expired" ? (
            <div className="rounded-2xl border border-slate-200 bg-slate-100 p-4 text-xs font-black text-slate-700">
              Expired. This receipt is no longer valid.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

