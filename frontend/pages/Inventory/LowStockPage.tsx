"use client";

import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";
import { AlertTriangle } from "lucide-react";
import { InventoryPart, isLowStock, stockTone } from "./inventory-utils";

type LowStockResponse = {
  success: boolean;
  parts: InventoryPart[];
};

export default function LowStockPage() {
  const [parts, setParts] = useState<InventoryPart[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const response = await apiRequest<LowStockResponse>("/api/inventory/low-stock", { method: "GET" }, true);
      setParts(response.parts ?? []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) return <PageSkeleton cards={3} rows={4} />;

  return (
    <div className="space-y-5 px-4 pb-12 pt-4">
      <header className="space-y-2">
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-rose-600">Low Stock</p>
        <h1 className="text-3xl font-black text-slate-900">Alert List</h1>
        <p className="text-sm font-medium text-slate-500">This page highlights parts that are below the operational threshold.</p>
      </header>

      <div className="space-y-3">
        {parts.length === 0 ? (
          <div className="rounded-3xl border border-dashed border-slate-200 bg-white p-8 text-center text-sm font-medium text-slate-400">
            No low stock alerts at the moment.
          </div>
        ) : (
          parts.map((part) => (
            <article key={part.id} className="rounded-[1.75rem] border border-rose-100 bg-rose-50 p-5 shadow-sm">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-lg font-black text-slate-900">{part.name}</h2>
                  <p className="text-xs font-bold uppercase tracking-widest text-slate-400">{part.part_code}</p>
                </div>
                <span className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${stockTone(part.quantity_available, part.minimum_stock)}`}>
                  {part.quantity_available ?? 0} left
                </span>
              </div>
              {isLowStock(part.quantity_available, part.minimum_stock) && (
                <div className="mt-4 flex items-center gap-2 rounded-2xl bg-white px-4 py-3 text-rose-700">
                  <AlertTriangle size={16} />
                  <p className="text-xs font-black uppercase tracking-widest">Below threshold</p>
                </div>
              )}
            </article>
          ))
        )}
      </div>
    </div>
  );
}
