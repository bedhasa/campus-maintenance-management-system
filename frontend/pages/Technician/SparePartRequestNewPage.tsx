"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";
import { useToast } from "@/lib/toast";
import { ArrowLeft, CheckCircle2, Search, Send, X } from "lucide-react";

type WorkOrderLite = {
  id: number;
  work_status: string;
  created_at: string;
  request?: { title?: string; priority?: string; status?: string } | null;
};
type SparePartLite = {
  id: number;
  name: string;
  part_code: string;
  quantity_available: number;
  unit?: string | null;
  category?: string | null;
};

type MetaResponse = {
  success: boolean;
  work_orders: WorkOrderLite[];
  spare_parts: SparePartLite[];
};

function formatWorkOrderLabel(wo: WorkOrderLite): string {
  const title = wo.request?.title?.trim();
  if (title) {
    return `WO #${wo.id} — ${title}`;
  }
  return `WO #${wo.id} (${wo.work_status})`;
}

export default function SparePartRequestNewPage() {
  const router = useRouter();
  const { showToast } = useToast();
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [busy, setBusy] = useState(false);

  const [form, setForm] = useState({
    work_order_id: "",
    title: "",
    description: "",
    urgency: "medium",
    needed_date: "",
  });

  const [partSearch, setPartSearch] = useState("");
  const [selected, setSelected] = useState<Record<number, { qty: string }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiRequest<MetaResponse>("/api/technician/spare-part-requests/meta", { method: "GET" }, true);
      setMeta(res);
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to load form metadata.", "error");
    } finally {
      setLoading(false);
    }
  }, [showToast]);

  useEffect(() => {
    void load();
  }, [load]);

  const filteredParts = useMemo(() => {
    const term = partSearch.trim().toLowerCase();
    const parts = meta?.spare_parts ?? [];
    if (!term) return parts;
    return parts.filter((p) => `${p.name} ${p.part_code} ${(p.category ?? "")}`.toLowerCase().includes(term));
  }, [meta, partSearch]);

  const selectedList = useMemo(() => Object.entries(selected).map(([id, v]) => ({ id: Number(id), qty: v.qty })), [selected]);

  const togglePart = (part: SparePartLite) => {
    setSelected((prev) => {
      if (prev[part.id]) {
        const next = { ...prev };
        delete next[part.id];
        return next;
      }
      return { ...prev, [part.id]: { qty: "1" } };
    });
  };

  const updateQty = (id: number, qty: string) => {
    setSelected((prev) => ({ ...prev, [id]: { qty } }));
  };

  const submit = async () => {
    setBusy(true);
    try {
      const items = selectedList.map((s) => ({
        spare_part_id: s.id,
        quantity: Number(s.qty || 0),
      }));

      const payload = {
        work_order_id: form.work_order_id ? Number(form.work_order_id) : null,
        title: form.title,
        description: form.description || null,
        urgency: form.urgency,
        needed_date: form.needed_date || null,
        items,
      };

      const res = await apiRequest<{ success: boolean; message?: string; request?: { id: number } }>(
        "/api/technician/spare-part-requests",
        { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) },
        true,
      );

      showToast(res.message ?? "Spare part request submitted successfully.", "success");

      const id = res.request?.id;
      if (id) router.push(`/technician/spare-part-requests/${id}`);
      else router.push("/technician/spare-part-requests");
    } catch (err) {
      showToast(err instanceof Error ? err.message : "Failed to submit request.", "error");
    } finally {
      setBusy(false);
    }
  };

  const handleWorkOrderChange = (workOrderId: string) => {
    const selectedWo = (meta?.work_orders ?? []).find((wo) => String(wo.id) === workOrderId);
    setForm((prev) => ({
      ...prev,
      work_order_id: workOrderId,
      title: prev.title.trim() ? prev.title : (selectedWo?.request?.title?.trim() ?? prev.title),
    }));
  };

  if (loading) return <PageSkeleton title="New Spare Part Request" />;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-5 px-1 sm:px-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          onClick={() => router.push("/technician/spare-part-requests")}
          className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-black text-slate-700 hover:bg-slate-50"
        >
          <ArrowLeft size={16} /> Back
        </button>
        <h1 className="text-lg font-black tracking-tight text-slate-900">New Spare Part Request</h1>
        <div className="hidden w-20 sm:block" />
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <p className="text-xs font-black uppercase tracking-widest text-slate-600">Request info</p>

          <div className="grid gap-3">
            <label className="grid gap-1">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Work order (optional)</span>
              <select
                value={form.work_order_id}
                onChange={(e) => handleWorkOrderChange(e.target.value)}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none"
              >
                <option value="">—</option>
                {(meta?.work_orders ?? []).map((wo) => (
                  <option key={wo.id} value={String(wo.id)}>
                    {formatWorkOrderLabel(wo)}
                  </option>
                ))}
              </select>
            </label>

            <label className="grid gap-1">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Title / Reason</span>
              <input
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-300"
                placeholder="e.g. Replace valve in pump"
              />
            </label>

            <label className="grid gap-1">
              <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Detailed description</span>
              <textarea
                value={form.description}
                onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                className="min-h-24 rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none focus:border-blue-300"
                placeholder="Describe why you need these parts..."
              />
            </label>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="grid gap-1">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Urgency</span>
                <select
                  value={form.urgency}
                  onChange={(e) => setForm((p) => ({ ...p, urgency: e.target.value }))}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none"
                >
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
                  <option value="critical">Critical</option>
                </select>
              </label>

              <label className="grid gap-1">
                <span className="text-[11px] font-black uppercase tracking-widest text-slate-500">Needed date</span>
                <input
                  type="date"
                  value={form.needed_date}
                  onChange={(e) => setForm((p) => ({ ...p, needed_date: e.target.value }))}
                  className="rounded-2xl border border-slate-200 bg-white px-3 py-2.5 text-sm font-bold text-slate-700 outline-none"
                />
              </label>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-4">
          <div className="flex items-center justify-between gap-3">
            <p className="text-xs font-black uppercase tracking-widest text-slate-600">Select spare parts</p>
            <div className="text-[11px] font-black text-slate-500">{selectedList.length} selected</div>
          </div>

          <label className="relative">
            <span className="sr-only">Search parts</span>
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              value={partSearch}
              onChange={(e) => setPartSearch(e.target.value)}
              placeholder="Search parts by name/code/category..."
              className="w-full rounded-2xl border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm font-bold text-slate-700 outline-none focus:border-blue-300"
            />
          </label>

          <div className="max-h-[420px] overflow-y-auto rounded-2xl border border-slate-100">
            {(filteredParts ?? []).map((p) => {
              const isSelected = !!selected[p.id];
              const unavailable = p.quantity_available <= 0;
              return (
                <div key={p.id} className={`flex items-center justify-between gap-3 border-b border-slate-100 px-3 py-2.5 ${unavailable ? "opacity-60" : ""}`}>
                  <button
                    disabled={unavailable}
                    onClick={() => togglePart(p)}
                    className={`flex-1 text-left ${unavailable ? "cursor-not-allowed" : ""}`}
                  >
                    <p className="text-sm font-black text-slate-900">
                      {p.name} <span className="text-xs font-black text-slate-400">({p.part_code})</span>
                    </p>
                    <p className="text-[11px] font-bold text-slate-600">
                      Stock: <span className="font-black">{p.quantity_available}</span>
                      {p.unit ? <span> {p.unit}</span> : null}
                      {p.category ? <span className="text-slate-400"> • {p.category}</span> : null}
                    </p>
                  </button>
                  <div className="flex items-center gap-2">
                    {isSelected ? (
                      <>
                        <input
                          value={selected[p.id]?.qty ?? "1"}
                          onChange={(e) => updateQty(p.id, e.target.value)}
                          className="w-20 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-black text-slate-700 outline-none"
                          inputMode="numeric"
                        />
                        <button
                          onClick={() => togglePart(p)}
                          className="inline-flex items-center justify-center rounded-xl border border-slate-200 bg-white p-2 text-slate-600 hover:bg-slate-50"
                          title="Remove"
                        >
                          <X size={16} />
                        </button>
                      </>
                    ) : (
                      <button
                        disabled={unavailable}
                        onClick={() => togglePart(p)}
                        className={`inline-flex items-center gap-2 rounded-xl px-3 py-2 text-xs font-black uppercase tracking-widest ${
                          unavailable ? "bg-slate-100 text-slate-400" : "bg-slate-900 text-white hover:bg-slate-800"
                        }`}
                      >
                        Select
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </div>

          <button
            disabled={busy || !form.title.trim() || selectedList.length === 0}
            onClick={() => submit()}
            className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[#003366] px-4 py-3 text-xs font-black uppercase tracking-widest text-white shadow-sm disabled:opacity-60"
          >
            {busy ? "Submitting..." : "Submit Request"} <Send size={16} />
          </button>

          <div className="flex items-center gap-2 text-[11px] font-bold text-slate-500">
            <CheckCircle2 size={16} className="text-emerald-600" />
            Inventory officer will be notified after submission.
          </div>
        </div>
      </div>
    </div>
  );
}

