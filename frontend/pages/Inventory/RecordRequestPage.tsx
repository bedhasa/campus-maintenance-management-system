"use client";

import { useCallback, useEffect, useState } from "react";
import type { FormEvent, InputHTMLAttributes, ReactNode, SelectHTMLAttributes } from "react";
import { useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";
import { AlertTriangle, CheckCircle2, ClipboardList, Package, PackageX, PlayCircle, ShieldCheck, Truck } from "lucide-react";
import {
  InventoryPart,
  InventoryTechnician,
  InventoryWorkOrder,
  PartRequestRecord,
  buildPersonName,
  isLowStock,
  requestStatusTone,
} from "./inventory-utils";

type MetaResponse = {
  success: boolean;
  work_orders: InventoryWorkOrder[];
  technicians: InventoryTechnician[];
  spare_parts: InventoryPart[];
};

type RequestsResponse = {
  success: boolean;
  part_requests: { data: PartRequestRecord[] };
};

export default function RecordRequestPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [meta, setMeta] = useState<MetaResponse | null>(null);
  const [requests, setRequests] = useState<PartRequestRecord[]>([]);
  const [requestsLoading, setRequestsLoading] = useState(true);
  const [toast, setToast] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [activeTab, setActiveTab] = useState<"form" | "queue">("form");
  const [queueFilter, setQueueFilter] = useState<"all" | "pending" | "approved" | "rejected">("all");
  const [form, setForm] = useState({
    work_order_id: "",
    technician_id: "",
    part_id: "",
    quantity: "1",
    urgency: "low",
    note: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest<MetaResponse>("/api/inventory/meta", { method: "GET" }, true);
      setMeta(response);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to load request form data.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadRequests = useCallback(async () => {
    setRequestsLoading(true);
    try {
      const response = await apiRequest<RequestsResponse>(
        `/api/inventory/part-requests${queueFilter === "all" ? "" : `?status=${queueFilter}`}`,
        { method: "GET" },
        true,
      );
      setRequests(response.part_requests?.data ?? []);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to load request queue.");
    } finally {
      setRequestsLoading(false);
    }
  }, [queueFilter]);

  useEffect(() => { void load(); }, [load]);
  useEffect(() => { void loadRequests(); }, [loadRequests]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const selectedWorkOrder = meta?.work_orders.find((wo) => String(wo.id) === form.work_order_id) ?? null;
  const selectedPart = meta?.spare_parts.find((p) => String(p.id) === form.part_id) ?? null;
  const selectedTechnician = meta?.technicians.find((t) => String(t.id) === form.technician_id) ?? null;
  
  const requestedQuantity = Number(form.quantity || 0);
  const availableQuantity = Number(selectedPart?.quantity_available ?? 0);
  const needsAttention = !!selectedPart && (requestedQuantity > availableQuantity || isLowStock(availableQuantity, selectedPart.minimum_stock));

  const previewRequest = (request: PartRequestRecord) => {
    setForm({
      work_order_id: request.work_order_id ? String(request.work_order_id) : "",
      technician_id: String(request.technician_id ?? ""),
      part_id: String(request.part_id ?? ""),
      quantity: String(request.quantity ?? 1),
      urgency: request.urgency ?? "low",
      note: request.note ?? "",
    });
  };

  const submit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setBusy(true);
    try {
      await apiRequest("/api/inventory/part-requests", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            work_order_id: Number(form.work_order_id),
            technician_id: Number(form.technician_id),
            part_id: Number(form.part_id),
            quantity: Number(form.quantity),
            urgency: form.urgency,
            note: form.note.trim() || undefined,
          }),
        }, true);
      setToast("Request recorded successfully.");
      router.push("/inventory/requests");
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to record request.");
    } finally {
      setBusy(false);
    }
  };

  if (loading) return <PageSkeleton cards={2} rows={4} />;

  return (
    <div className="max-w-4xl mx-auto space-y-6 px-4 pb-12 pt-6">
      {toast && (
        <div className="fixed inset-x-0 top-6 z-50 flex justify-center px-4 animate-in fade-in slide-in-from-top-2">
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-900 shadow-2xl">
            {toast}
          </div>
        </div>
      )}

      <header className="flex flex-col gap-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-600">Inventory Module</p>
        <h1 className="text-4xl font-black text-slate-900 tracking-tight">Record Request</h1>
      </header>

      {/* Main Tabs */}
      <div className="flex p-1 bg-slate-100 rounded-2xl w-fit">
        {([
          { key: "form", label: "New Request", icon: <ClipboardList size={14} /> },
          { key: "queue", label: "View Queue", icon: <Package size={14} /> },
        ] as const).map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
              activeTab === tab.key ? "bg-white text-[#003366] shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {tab.icon} {tab.label}
          </button>
        ))}
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatusBox label="Work Order" value={selectedWorkOrder ? `#${selectedWorkOrder.id}` : "---"} icon={<Truck size={16} />} />
        <StatusBox label="Technician" value={selectedTechnician ? `${selectedTechnician.fname} ${selectedTechnician.lname}` : "---"} icon={<ShieldCheck size={16} />} />
        <StatusBox 
            label="Stock Status" 
            value={selectedPart ? `${availableQuantity} Available` : "---"} 
            icon={<Package size={16} />} 
            danger={needsAttention}
        />
      </div>

      {activeTab === "form" ? (
        <form onSubmit={submit} className="bg-white rounded-[2.5rem] border border-slate-100 p-6 md:p-8 shadow-sm space-y-6">
          {selectedPart && needsAttention && (
            <div className="flex items-center gap-3 rounded-2xl bg-rose-50 px-4 py-3 text-rose-700 border border-rose-100">
              <AlertTriangle size={18} />
              <p className="text-xs font-black uppercase tracking-widest">
                {requestedQuantity > availableQuantity ? "Insufficient Stock" : "Low Stock Warning"}
              </p>
            </div>
          )}

          <div className="grid md:grid-cols-2 gap-6">
            <SelectField label="Link Work Order" required value={form.work_order_id} onChange={(v) => setForm({...form, work_order_id: v})}>
              <option value="">Choose an active order</option>
              {meta?.work_orders.map(wo => (
                <option key={wo.id} value={wo.id}>#{wo.id} {wo.request?.title}</option>
              ))}
            </SelectField>

            <SelectField label="Technician" required value={form.technician_id} onChange={(v) => setForm({...form, technician_id: v})}>
              <option value="">Select personnel</option>
              {meta?.technicians.map(t => (
                <option key={t.id} value={t.id}>{t.fname} {t.lname}</option>
              ))}
            </SelectField>

            <SelectField label="Spare Part" required value={form.part_id} onChange={(v) => setForm({...form, part_id: v})}>
              <option value="">Select component</option>
              {meta?.spare_parts.map(p => (
                <option key={p.id} value={p.id}>{p.name} {p.part_code && `(${p.part_code})`}</option>
              ))}
            </SelectField>

            <div className="grid grid-cols-2 gap-4">
               <InputField label="Quantity" type="number" min="1" value={form.quantity} onChange={(v) => setForm({...form, quantity: v})} />
               <SelectField label="Urgency" value={form.urgency} onChange={(v) => setForm({...form, urgency: v})}>
                  <option value="low">Low</option>
                  <option value="medium">Medium</option>
                  <option value="high">High</option>
               </SelectField>
            </div>
          </div>

          <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">Additional Notes</span>
            <textarea
              className="w-full min-h-[100px] rounded-2xl border border-slate-200 p-4 text-sm outline-none focus:border-[#003366] transition-colors"
              placeholder="Technician details or request reason..."
              value={form.note}
              onChange={(e) => setForm({...form, note: e.target.value})}
            />
          </label>

          <button
            type="submit"
            disabled={busy}
            className="w-full py-4 rounded-2xl bg-[#003366] text-white text-[10px] font-black uppercase tracking-[0.2em] shadow-lg hover:shadow-xl transition-all active:scale-[0.98] disabled:opacity-50"
          >
            {busy ? "Processing..." : "Submit Part Request"}
          </button>
        </form>
      ) : (
        <div className="space-y-4">
            <div className="flex gap-2 overflow-x-auto pb-2">
                {(["all", "pending", "approved", "rejected"] as const).map((f) => (
                    <button
                        key={f}
                        onClick={() => setQueueFilter(f)}
                        className={`px-5 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all ${
                            queueFilter === f ? "bg-slate-900 text-white border-slate-900" : "bg-white text-slate-500 border-slate-200"
                        }`}
                    >
                        {f}
                    </button>
                ))}
            </div>

            <div className="space-y-3">
                {requestsLoading ? (
                    <div className="p-12 text-center text-slate-400 font-bold border-2 border-dashed rounded-[2rem]">Loading queue...</div>
                ) : requests.length === 0 ? (
                    <div className="p-12 text-center text-slate-400 font-bold border-2 border-dashed rounded-[2rem]">No requests found.</div>
                ) : (
                    requests.map((req) => (
                        <div
                            key={req.id}
                            role={req.status === "pending" || req.status === "approved" ? "button" : undefined}
                            tabIndex={req.status === "pending" || req.status === "approved" ? 0 : -1}
                            onClick={req.status === "pending" || req.status === "approved" ? () => previewRequest(req) : undefined}
                            onKeyDown={
                                req.status === "pending" || req.status === "approved"
                                    ? (event) => {
                                          if (event.key === "Enter" || event.key === " ") {
                                              event.preventDefault();
                                              previewRequest(req);
                                          }
                                      }
                                    : undefined
                            }
                            className={`bg-white border border-slate-100 p-5 rounded-[2rem] shadow-sm transition-all ${
                                req.status === "pending" || req.status === "approved"
                                    ? "cursor-pointer hover:border-[#003366] hover:shadow-md"
                                    : ""
                            }`}
                        >
                            <div className="flex justify-between items-start">
                                <div>
                                    <h3 className="font-black text-slate-900">{req.part?.name}</h3>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-tighter mt-1">
                                        {buildPersonName(req.technician)} • WO #{req.work_order_id}
                                    </p>
                                </div>
                                <div className={`px-3 py-1 rounded-full text-[8px] font-black uppercase tracking-[0.15em] border ${requestStatusTone(req.status)}`}>
                                    {req.status}
                                </div>
                            </div>
                            
                            <div className="mt-4 flex gap-2">
                                {req.status === "pending" && (
                                    <>
                                        <ActionButton icon={<CheckCircle2 size={12}/>} label="Approve" onClick={() => reviewRequest(req.id, "approved")} color="bg-emerald-600" />
                                        <ActionButton icon={<PackageX size={12}/>} label="Reject" onClick={() => reviewRequest(req.id, "rejected")} color="bg-rose-600" />
                                    </>
                                )}
                                {req.status === "approved" && !req.issue && (
                                    <ActionButton icon={<PlayCircle size={12}/>} label="Issue Parts" onClick={() => issueRequest(req.id)} color="bg-[#003366]" />
                                )}
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
      )}
    </div>
  );

  async function reviewRequest(id: number, status: "approved" | "rejected") {
    try {
      await apiRequest(`/api/inventory/part-requests/${id}/review`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      }, true);
      setToast(`Request ${status}.`);
      await loadRequests();
    } catch {
      setToast("Review failed.");
    }
  }

  async function issueRequest(id: number) {
    try {
      await apiRequest(`/api/inventory/part-requests/${id}/issue`, { method: "POST" }, true);
      setToast("Parts issued.");
      await loadRequests();
    } catch {
      setToast("Issue failed.");
    }
  }
}

/* Reusable UI Components */

function StatusBox({ label, value, icon, danger }: { label: string, value: string, icon: ReactNode, danger?: boolean }) {
    return (
        <div className={`p-4 rounded-3xl border transition-all ${danger ? "bg-rose-500 text-white border-rose-500" : "bg-white text-slate-900 border-slate-100 shadow-sm"}`}>
            <div className="flex justify-between items-center opacity-70 mb-2">
                <span className="text-[9px] font-black uppercase tracking-widest">{label}</span>
                {icon}
            </div>
            <p className="font-black truncate">{value}</p>
        </div>
    );
}

type SelectFieldProps = {
  label: string;
  children: ReactNode;
  onChange: (value: string) => void;
} & Omit<SelectHTMLAttributes<HTMLSelectElement>, "children" | "onChange">;

function SelectField({ label, children, onChange, ...props }: SelectFieldProps) {
    return (
        <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{label}</span>
            <select className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-[#003366] transition-all" {...props} onChange={(e) => onChange(e.target.value)}>
                {children}
            </select>
        </label>
    );
}

type InputFieldProps = {
  label: string;
  onChange: (value: string) => void;
} & Omit<InputHTMLAttributes<HTMLInputElement>, "onChange">;

function InputField({ label, onChange, ...props }: InputFieldProps) {
    return (
        <label className="block space-y-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-slate-400 ml-1">{label}</span>
            <input className="w-full bg-slate-50 border border-slate-200 rounded-2xl px-4 py-3 text-sm font-bold text-slate-700 outline-none focus:bg-white focus:border-[#003366] transition-all" {...props} onChange={(e) => onChange(e.target.value)} />
        </label>
    );
}

function ActionButton({ label, icon, onClick, color }: { label: string, icon: ReactNode, onClick: () => void, color: string }) {
    return (
        <button onClick={onClick} className={`flex items-center gap-2 px-4 py-2 rounded-xl text-white text-[9px] font-black uppercase tracking-widest ${color} hover:brightness-110 active:scale-95 transition-all`}>
            {icon} {label}
        </button>
    );
}
