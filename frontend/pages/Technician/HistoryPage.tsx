"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { Calendar, ChevronRight, MapPin, Star } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { ListSkeleton } from "@/components/PageSkeleton";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import {
  TechnicianWorkOrder,
  formatDate,
  getPriorityLabel,
  getPriorityTone,
  getTaskLocation,
  getTaskTitle,
  getTechnicianLifecycleMeta,
} from "./technician-utils";

type Props = {
  initialTab?: "waiting_approval" | "completed";
};

export default function HistoryPage({ initialTab = "waiting_approval" }: Props) {
  const [items, setItems] = useState<TechnicianWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"waiting_approval" | "completed">(initialTab);

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const data = await apiRequest<{ work_orders: { data: TechnicianWorkOrder[] } }>(
        "/api/technician/work-orders",
        { method: "GET" },
        true,
      );
      setItems(data.work_orders?.data ?? []);
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);
  useLiveRefresh(() => load(true), { enabled: true, intervalMs: 8000 });

  const filteredItems = useMemo(() => {
    if (activeTab === "completed") {
      return items.filter((task) => task.request?.status === "closed");
    }

    return items.filter(
      (task) =>
        task.request?.status !== "closed" &&
        (
          task.work_status === "completed" ||
          task.request?.status === "completed" ||
          Boolean(task.completed_by_technician_at) ||
          Boolean(task.completed_at)
        ),
    );
  }, [activeTab, items]);

  return (
    <div className="mx-auto max-w-2xl space-y-6 px-4 pb-24">
      <header className="py-6">
        <h1 className="text-3xl font-black tracking-tight text-slate-900">History</h1>
        <p className="text-sm font-bold uppercase tracking-widest text-blue-600">
          Review submitted work, pending approvals, and fully closed jobs.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 rounded-[2rem] border border-slate-200 bg-white p-2 shadow-sm">
        <button
          type="button"
          onClick={() => setActiveTab("waiting_approval")}
          className={`rounded-[1.25rem] px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === "waiting_approval" ? "bg-[#003366] text-white shadow-lg" : "bg-slate-50 text-slate-600"
          }`}
        >
          Waiting Approval
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("completed")}
          className={`rounded-[1.25rem] px-4 py-3 text-xs font-black uppercase tracking-widest transition-all ${
            activeTab === "completed" ? "bg-[#003366] text-white shadow-lg" : "bg-slate-50 text-slate-600"
          }`}
        >
          Complete
        </button>
      </div>

      {loading ? (
        <ListSkeleton rows={3} />
      ) : (
        <div className="space-y-4">
          {filteredItems.map((task) => {
            const lifecycle = getTechnicianLifecycleMeta(task);
            const hasRating = Boolean(task.request?.rating?.rating);

            return (
              <Link
                key={task.id}
                href={`/technician/work-orders/${task.id}`}
                className="block overflow-hidden rounded-[2rem] border border-slate-100 bg-white p-6 shadow-sm transition-all hover:shadow-md"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="space-y-3">
                    <h2 className="text-xl font-black leading-tight text-slate-900">{getTaskTitle(task)}</h2>
                    <div className="flex flex-wrap gap-2">
                      <span className={`rounded-lg border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${lifecycle.tone}`}>
                        {lifecycle.label}
                      </span>
                      <span className={`rounded-lg border px-3 py-1 text-[10px] font-black uppercase tracking-widest ${getPriorityTone(task.request?.priority)}`}>
                        {getPriorityLabel(task.request?.priority)}
                      </span>
                    </div>
                  </div>
                  <ChevronRight size={18} className="text-slate-400" />
                </div>

                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <MapPin size={16} className="text-blue-600" />
                    <p className="text-xs font-bold text-slate-900">{getTaskLocation(task)}</p>
                  </div>
                  <div className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-slate-50 p-3">
                    <Calendar size={16} className="text-emerald-600" />
                    <p className="text-xs font-bold text-slate-900">
                      {task.request?.status === "closed" ? "Closed" : "Updated"} {formatDate(task.completed_at ?? task.updated_at)}
                    </p>
                  </div>
                </div>

                {hasRating && (
                  <div className="mt-4 flex items-center gap-2 rounded-2xl border border-amber-100 bg-amber-50 px-4 py-3 text-amber-800">
                    <Star size={16} className="fill-current" />
                    <p className="text-xs font-black uppercase tracking-widest">
                      Rated {Number(task.request?.rating?.rating ?? 0).toFixed(1)} / 5
                    </p>
                  </div>
                )}
              </Link>
            );
          })}

          {filteredItems.length === 0 && (
            <div className="rounded-[3rem] border-2 border-dashed border-slate-200 bg-slate-50 py-20 text-center">
              <p className="text-sm font-black uppercase tracking-widest text-slate-400">
                {activeTab === "completed" ? "No closed work yet" : "No work orders waiting for approval yet"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
