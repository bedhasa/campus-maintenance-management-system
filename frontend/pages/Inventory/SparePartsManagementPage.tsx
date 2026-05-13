"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";
import Image from "next/image";
import { AlertTriangle, Edit2, ImagePlus, Plus, RefreshCw, Save, Search, X, Package } from "lucide-react";
import { InventoryPart, InventoryPartFormValues, getInventoryImageUrl, isLowStock, stockTone } from "@/lib/inventory-utils";

type PartsResponse = {
  success: boolean;
  spare_parts: InventoryPart[];
};

type SavePartResponse = {
  success: boolean;
  message?: string;
  spare_part: InventoryPart;
};

const EMPTY_FORM: InventoryPartFormValues = {
  name: "",
  part_code: "",
  unit_price: "",
  quantity_available: "0",
  minimum_stock: "5",
  image: null,
};

export default function SparePartsManagementPage() {
  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [loading, setLoading] = useState(true);
  const [query, setQuery] = useState("");
  const [toast, setToast] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingPartId, setEditingPartId] = useState<number | null>(null);
  const [form, setForm] = useState<InventoryPartFormValues>(EMPTY_FORM);
  const [imagePreview, setImagePreview] = useState<string>("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest<PartsResponse>("/api/inventory/spare-parts", { method: "GET" }, true);
      setParts(response.spare_parts ?? []);
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Failed to load spare parts.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return parts;
    return parts.filter((part) =>
      [part.name, part.part_code].some((value) =>
        (value ?? "").toLowerCase().includes(q)
      )
    );
  }, [parts, query]);

  const lowStockCount = useMemo(
    () => parts.filter((part) => isLowStock(part.quantity_available, part.minimum_stock)).length,
    [parts]
  );

  const openCreate = () => {
    setEditingPartId(null);
    setForm(EMPTY_FORM);
    setImagePreview("");
    setEditorOpen(true);
  };

  const openEdit = (part: InventoryPart) => {
    setEditingPartId(part.id);
    setForm({
      name: part.name ?? "",
      part_code: part.part_code ?? "",
      unit_price: part.unit_price != null ? String(part.unit_price) : "",
      quantity_available: String(part.quantity_available ?? 0),
      minimum_stock: String(part.minimum_stock ?? 5),
      image: null,
    });
    setImagePreview(getInventoryImageUrl(part));
    setEditorOpen(true);
  };

  const closeEditor = () => {
    if (saving) return;
    setEditorOpen(false);
    setEditingPartId(null);
    setImagePreview("");
  };

  const submitForm = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = new FormData();
      payload.append("name", form.name.trim());
      payload.append("part_code", form.part_code.trim());
      payload.append("unit_price", String(Number(form.unit_price || 0)));
      payload.append("quantity_available", String(Number(form.quantity_available)));
      payload.append("minimum_stock", String(Number(form.minimum_stock || 0)));
      if (form.image) {
        payload.append("image", form.image);
      }

      const response = await apiRequest<SavePartResponse>(
        editingPartId ? `/api/inventory/spare-parts/${editingPartId}` : "/api/inventory/spare-parts",
        {
          method: editingPartId ? "PUT" : "POST",
          body: payload,
        },
        true
      );

      setToast(response.message ?? "Inventory record saved.");
      setEditorOpen(false);
      setImagePreview("");
      await load();
    } catch (err) {
      setToast(err instanceof Error ? err.message : "Unable to save.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <PageSkeleton cards={1} rows={10} />;

  return (
    <div className="max-w-7xl mx-auto space-y-6 px-4 pb-16 pt-8">
      {/* Toast Notification */}
      {toast && (
        <div className="fixed inset-x-0 top-6 z-[100] flex justify-center px-4 animate-in fade-in slide-in-from-top-2">
          <div className="rounded-2xl border border-slate-200 bg-white px-6 py-3 font-bold text-slate-900 shadow-2xl">
            {toast}
          </div>
        </div>
      )}

      {/* Header Area */}
      <header className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-[10px] font-black uppercase tracking-[0.3em] text-amber-600">Spare Parts Management</p>
          <h1 className="text-4xl font-black text-slate-900">Inventory Catalog</h1>
          <p className="text-slate-500 font-medium">Maintain the master list of components and stock thresholds.</p>
        </div>
        <div className="flex gap-2">
           <MiniCard label="Items" value={parts.length} tone="bg-slate-900 text-white" />
           <MiniCard label="Low Stock" value={lowStockCount} tone="bg-rose-500 text-white" />
        </div>
      </header>

      {/* Search & Actions Bar */}
      <div className="flex flex-col gap-3 md:flex-row md:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18} />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by part name or code..."
            className="w-full rounded-2xl border border-slate-200 bg-white py-4 pl-12 pr-4 text-sm font-bold text-slate-900 shadow-sm outline-none focus:border-[#003366] focus:ring-1 focus:ring-[#003366]"
          />
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => void load()}
            className="flex h-14 items-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 text-[10px] font-black uppercase tracking-widest text-slate-600 shadow-sm transition-active active:scale-95"
          >
            <RefreshCw size={14} />
            <span className="hidden md:inline">Refresh</span>
          </button>
          <button
            onClick={openCreate}
            className="flex h-14 flex-1 items-center justify-center gap-2 rounded-2xl bg-[#003366] px-6 text-[10px] font-black uppercase tracking-widest text-white shadow-lg transition-active active:scale-95 md:flex-none"
          >
            <Plus size={18} />
            Add New Part
          </button>
        </div>
      </div>

      {/* Table Section */}
      <div className="overflow-hidden rounded-[2rem] border border-slate-100 bg-white shadow-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 border-b border-slate-100">
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Part Details</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Stock Status</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Cost (UGX)</th>
                <th className="px-6 py-5 text-[10px] font-black uppercase tracking-widest text-slate-400">Threshold</th>
                <th className="px-6 py-5 text-right text-[10px] font-black uppercase tracking-widest text-slate-400">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center text-sm font-bold text-slate-400">
                    No parts found matching your criteria.
                  </td>
                </tr>
              ) : (
                filtered.map((part) => (
                  <tr key={part.id} className="group hover:bg-slate-50/30 transition-colors">
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-4">
                        <div className="flex h-14 w-14 items-center justify-center overflow-hidden rounded-2xl border border-slate-100 bg-slate-50">
                          {getInventoryImageUrl(part) ? (
                            <Image
                              src={getInventoryImageUrl(part)}
                              alt={part.name}
                              width={56}
                              height={56}
                              unoptimized
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            <Package size={18} className="text-slate-300" />
                          )}
                        </div>
                        <div>
                          <p className="font-black text-slate-900">{part.name}</p>
                          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{part.part_code}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <div className="flex items-center gap-2">
                        <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${stockTone(part.quantity_available, part.minimum_stock)}`}>
                          {part.quantity_available ?? 0} In Stock
                        </span>
                        {isLowStock(part.quantity_available, part.minimum_stock) && (
                          <AlertTriangle size={14} className="text-rose-500" />
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm font-bold text-slate-600">
                        {part.unit_price ? part.unit_price.toLocaleString() : "N/A"}
                      </p>
                    </td>
                    <td className="px-6 py-5">
                      <p className="text-sm font-bold text-slate-400 italic">
                        Min: {part.minimum_stock ?? 0}
                      </p>
                    </td>
                    <td className="px-6 py-5 text-right">
                      <button
                        onClick={() => openEdit(part)}
                        className="inline-flex items-center gap-2 rounded-xl border border-slate-100 bg-white px-4 py-2 text-[10px] font-black uppercase tracking-widest text-slate-600 transition-all hover:border-[#003366] hover:text-[#003366]"
                      >
                        <Edit2 size={12} />
                        Edit
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Editor Modal */}
      {editorOpen && (
        <div className="fixed inset-0 z-[60] flex items-end justify-center bg-slate-900/60 p-4 backdrop-blur-sm sm:items-center">
          <form
            onSubmit={submitForm}
            className="flex max-h-[90vh] w-full max-w-2xl flex-col animate-in fade-in slide-in-from-bottom-4 rounded-[2.5rem] bg-white p-6 shadow-2xl md:p-7"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-amber-100 p-2 text-amber-600">
                  <Package size={20} />
                </div>
                <h2 className="text-2xl font-black text-slate-900">
                  {editingPartId ? "Update Part" : "New Part"}
                </h2>
              </div>
              <button onClick={closeEditor} type="button" className="rounded-full bg-slate-100 p-2 text-slate-500 hover:bg-slate-200">
                <X size={20} />
              </button>
            </div>

            <div className="mt-6 flex-1 overflow-y-auto pr-1">
              <div className="grid gap-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <FormField label="Part Name">
                    <input
                      required
                      value={form.name}
                      onChange={(e) => setForm({ ...form, name: e.target.value })}
                      placeholder="e.g. Hydraulic Filter"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-bold text-slate-900 outline-none focus:border-[#003366]"
                    />
                  </FormField>

                  <FormField label="Part Code">
                    <input
                      required
                      value={form.part_code}
                      onChange={(e) => setForm({ ...form, part_code: e.target.value })}
                      placeholder="e.g. PRT-990-X"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-bold text-slate-900 outline-none focus:border-[#003366]"
                    />
                  </FormField>
                </div>

                <div className="grid gap-4 sm:grid-cols-3">
                  <FormField label="Cost (UGX)">
                    <input
                      required
                      type="number"
                      min={0}
                      step="0.01"
                      value={form.unit_price}
                      onChange={(e) => setForm({ ...form, unit_price: e.target.value })}
                      placeholder="e.g. 100.95"
                      className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-bold text-slate-900 outline-none focus:border-[#003366]"
                    />
                  </FormField>
                  <FormField label="Quantity">
                    <input
                      required
                      type="number"
                      value={form.quantity_available}
                      onChange={(e) => setForm({ ...form, quantity_available: e.target.value })}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-bold text-slate-900 outline-none focus:border-[#003366]"
                    />
                  </FormField>
                  <FormField label="Minimum Stock">
                    <input
                      type="number"
                      value={form.minimum_stock}
                      onChange={(e) => setForm({ ...form, minimum_stock: e.target.value })}
                      className="w-full rounded-2xl border border-slate-200 px-4 py-4 text-sm font-bold text-slate-900 outline-none focus:border-[#003366]"
                    />
                  </FormField>
                </div>

                <FormField label="Part Image">
                  <label className="flex cursor-pointer flex-col gap-4 rounded-[1.5rem] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm font-bold text-slate-600">
                    <div className="flex items-center gap-3">
                      <div className="rounded-2xl bg-slate-100 p-3">
                        <ImagePlus size={18} className="text-slate-400" />
                      </div>
                      <p className="text-sm font-black text-slate-900">{form.image ? form.image.name : "Upload part photo"}</p>
                    </div>
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={(e) => {
                        const file = e.target.files?.[0] ?? null;
                        setForm({ ...form, image: file });
                        setImagePreview(file ? URL.createObjectURL(file) : imagePreview);
                      }}
                    />
                    <div className="flex items-center justify-center overflow-hidden rounded-[1.5rem] border border-slate-200 bg-white">
                      {imagePreview ? (
                        <Image
                          src={imagePreview}
                          alt="Part preview"
                          width={640}
                          height={220}
                          unoptimized
                          className="h-48 w-full object-cover"
                        />
                      ) : (
                        <p className="px-6 py-10 text-sm font-medium text-slate-400">No image selected</p>
                      )}
                    </div>
                  </label>
                </FormField>
              </div>
            </div>

            <div className="mt-6 flex gap-3">
              <button
                type="submit"
                disabled={saving}
                className="flex-1 rounded-2xl bg-[#003366] py-4 text-[10px] font-black uppercase tracking-widest text-white shadow-xl transition-active active:scale-95 disabled:opacity-50"
              >
                {saving ? "Saving..." : <span className="flex items-center justify-center gap-2"><Save size={16} /> Save Record</span>}
              </button>
              <button
                type="button"
                onClick={closeEditor}
                className="flex-1 rounded-2xl border border-slate-200 py-4 text-[10px] font-black uppercase tracking-widest text-slate-600"
              >
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

/* Helper Components */

function MiniCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className={`rounded-2xl px-4 py-2 shadow-sm ${tone}`}>
      <p className="text-[8px] font-black uppercase tracking-widest opacity-70">{label}</p>
      <p className="text-xl font-black">{value}</p>
    </div>
  );
}

function FormField({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="space-y-2">
      <label className="ml-1 text-[10px] font-black uppercase tracking-[0.15em] text-slate-400">{label}</label>
      {children}
    </div>
  );
}
