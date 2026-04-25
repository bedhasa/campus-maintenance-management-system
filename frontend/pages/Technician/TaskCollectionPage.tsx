"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, Clock3, Eye, MapPin, PlayCircle, Calendar, ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { ListSkeleton } from "@/components/PageSkeleton";
import {
  TechnicianWorkOrder,
  formatDate,
  getPriorityLabel,
  getPriorityTone,
  getStatusLabel,
  getStatusTone,
  getTaskLocation,
  getTaskTitle,
  isDelayedTask,
} from "./technician-utils";

type WorkOrderListResponse = {
  success: boolean;
  work_orders: {
    data: TechnicianWorkOrder[];
  };
};

type TaskCollectionPageProps = {
  title: string;
  subtitle: string;
  query?: string;
  emptyTitle: string;
  emptyCopy: string;
  showFilters?: boolean;
};

export default function TaskCollectionPage({
  title,
  subtitle,
  query,
  emptyTitle,
  emptyCopy,
  showFilters = !query,
}: TaskCollectionPageProps) {
  const router = useRouter();
  const [items, setItems] = useState<TechnicianWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [toast, setToast] = useState<{ type: "error" | "success"; message: string } | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [nowMs, setNowMs] = useState<number | null>(null);
  const [activeFilter, setActiveFilter] = useState<"overall" | "not_started" | "in_progress" | "completed" | "delayed">("overall");

  useEffect(() => {
    setNowMs(Date.now());
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 5000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiRequest<WorkOrderListResponse>(
        `/api/technician/work-orders${query ? `?${query}` : ""}`,
        { method: "GET" },
        true
      );
      setItems(data.work_orders?.data ?? []);
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to load tasks." });
    } finally {
      setLoading(false);
    }
  }, [query]);

  useEffect(() => {
    void load();
  }, [load]);

  const startTask = async (e: React.MouseEvent, workOrderId: number) => {
    e.stopPropagation(); // Prevents the card click event from firing
    try {
      setBusyId(workOrderId);
      await apiRequest(`/api/technician/work-orders/${workOrderId}/start`, { method: "PATCH" }, true);
      setItems((prev) =>
        prev.map((item) => (item.id === workOrderId ? { ...item, work_status: "in_progress" } : item))
      );
      router.push(`/technician/work-orders/${workOrderId}`);
    } catch (err) {
      setToast({ type: "error", message: err instanceof Error ? err.message : "Failed to start task." });
    } finally {
      setBusyId(null);
    }
  };

  const handleCardClick = (workOrderId: number) => {
    router.push(`/technician/work-orders/${workOrderId}`);
  };

  const priorityWeight = (priority?: string | null) => {
    switch (priority) {
      case "urgent":
        return 0;
      case "high":
        return 1;
      case "medium":
        return 2;
      case "low":
        return 3;
      default:
        return 4;
    }
  };

  const sortedItems = [...items].sort((a, b) => {
    const priorityDiff = priorityWeight(a.request?.priority) - priorityWeight(b.request?.priority);
    if (priorityDiff !== 0) return priorityDiff;

    const aTime = new Date(a.created_at || a.request?.created_at || 0).getTime();
    const bTime = new Date(b.created_at || b.request?.created_at || 0).getTime();
    return aTime - bTime;
  });

  const filteredItems = sortedItems.filter((task) => {
    if (!showFilters || activeFilter === "overall") return true;
    if (activeFilter === "delayed") return isDelayedTask(task, nowMs);
    if (activeFilter === "not_started") return task.work_status === "assigned";
    if (activeFilter === "in_progress") return task.work_status === "in_progress" || task.work_status === "paused";
    if (activeFilter === "completed") return task.work_status === "completed";
    return true;
  });

  return (
    <div className="space-y-6 pb-12 px-2">
      <header className="px-1 pt-4">
        <h1 className="text-2xl font-black text-slate-900 leading-tight">{title}</h1>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-600 mt-1">{subtitle}</p>
      </header>

      {showFilters && (
        <div className="px-1">
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
            {[
              { key: "overall", label: "Overall" },
              { key: "not_started", label: "Not Started" },
              { key: "in_progress", label: "In Progress" },
              { key: "completed", label: "Completed" },
              { key: "delayed", label: "Delayed" },
            ].map((item) => {
              const active = activeFilter === item.key;
              return (
                <button
                  key={item.key}
                  onClick={() => setActiveFilter(item.key as typeof activeFilter)}
                  className={`shrink-0 rounded-full px-4 py-2 text-[10px] font-black uppercase tracking-[0.15em] border transition-all ${
                    active
                      ? "bg-[#003366] text-white border-[#003366] shadow-lg shadow-blue-900/20"
                      : "bg-white text-slate-500 border-slate-200"
                  }`}
                >
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {toast && (
        <div className="fixed right-4 top-4 z-50 animate-in fade-in zoom-in-95">
          <div
            className={`rounded-xl border px-4 py-3 text-sm font-bold shadow-xl ${
              toast.type === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {toast.message}
          </div>
        </div>
      )}

      {loading ? (
        <ListSkeleton rows={3} />
      ) : filteredItems.length === 0 ? (
        <div className="rounded-[2.5rem] border-2 border-dashed border-slate-200 bg-white py-20 text-center px-10">
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">{emptyTitle}</p>
          <p className="mt-2 text-xs font-medium text-slate-400 leading-relaxed">{emptyCopy}</p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredItems.map((task) => {
            const delayed = isDelayedTask(task, nowMs);
            return (
              <article 
                key={task.id} 
                onClick={() => handleCardClick(task.id)}
                className="group relative rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm active:scale-[0.97] active:bg-slate-50 transition-all cursor-pointer"
              >
                {/* Status Badges */}
                <div className="flex justify-between items-center mb-4">
                  <div className="flex gap-1.5">
                    <span className={`rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-wider border ${getPriorityTone(task.request?.priority)}`}>
                      {getPriorityLabel(task.request?.priority)}
                    </span>
                    <span className={`rounded-lg px-2.5 py-1 text-[9px] font-black uppercase tracking-wider border ${getStatusTone(task.work_status)}`}>
                      {getStatusLabel(task.work_status)}
                    </span>
                  </div>
                  <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-500 transition-colors" />
                </div>

                {/* Content */}
                <div className="space-y-1.5 mb-5">
                  <h2 className="text-lg font-black text-slate-900 leading-tight group-hover:text-blue-900">
                    {getTaskTitle(task)}
                  </h2>
                  <p className="text-xs text-slate-500 line-clamp-2 leading-relaxed font-medium">
                    {task.request?.description || "No further details provided."}
                  </p>
                </div>

                {/* Meta Info */}
                <div className="grid grid-cols-2 gap-2.5 mb-5">
                  <div className="flex items-center gap-2 bg-blue-50/50 p-2.5 rounded-xl border border-blue-100/50">
                    <MapPin size={14} className="text-blue-600 shrink-0" />
                    <span className="text-[11px] font-bold text-blue-900 truncate">{getTaskLocation(task)}</span>
                  </div>
                  <div className="flex items-center gap-2 bg-slate-50 p-2.5 rounded-xl border border-slate-100">
                    <Calendar size={14} className="text-slate-400 shrink-0" />
                    <span className="text-[11px] font-bold text-slate-600">{formatDate(task.request?.created_at || task.created_at)}</span>
                  </div>
                </div>

                {/* Delay Warning */}
                {delayed && (
                  <div className="mb-5 flex items-center gap-3 rounded-2xl bg-amber-50 p-3.5 text-amber-800 border border-amber-200/50">
                    <AlertTriangle size={16} className="shrink-0 text-amber-600" />
                    <p className="text-[11px] font-bold leading-snug">
                      {task.delay_reason || "Delayed: Priority attention needed."}
                    </p>
                  </div>
                )}

                {/* Primary Action Button */}
                <div className="pt-2">
                  {task.work_status === "assigned" || task.work_status === "paused" ? (
                    <button
                      onClick={(e) => void startTask(e, task.id)}
                      disabled={busyId === task.id}
                      className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-[#003366] py-4 text-[10px] font-black uppercase tracking-[0.15em] text-white shadow-lg shadow-blue-900/20 active:bg-blue-900 disabled:opacity-50"
                    >
                      <PlayCircle size={14} />
                      {busyId === task.id ? "INITIALIZING..." : task.work_status === "paused" ? "RESUME WORK ORDER" : "START WORK ORDER"}
                    </button>
                  ) : (
                    <div className="w-full inline-flex items-center justify-center gap-2 rounded-2xl bg-slate-100 py-4 text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
                      {task.work_status === "in_progress" ? (
                        <span className="text-emerald-700 flex items-center gap-2">
                          <Clock3 size={14} /> ACTIVE IN PROGRESS
                        </span>
                      ) : (
                        <span className="flex items-center gap-2 italic">
                          <Eye size={14} /> VIEW COMPLETED TASK
                        </span>
                      )}
                    </div>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
