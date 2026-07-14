"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { MapPin, Calendar, Clock, ChevronRight, PlayCircle } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { ListSkeleton } from "@/components/PageSkeleton";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import {
  TechnicianWorkOrder,
  formatDate,
  getTaskLocation,
  getTaskTitle,
} from "@/lib/technician-utils";

export default function TaskCollectionPage({
  title,
  subtitle,
  query,
  emptyTitle = "No Tasks Found",
  emptyCopy,
}: {
  title: string;
  subtitle: string;
  query?: string;
  emptyTitle?: string;
  emptyCopy?: string;
}) {
  const [items, setItems] = useState<TechnicianWorkOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [priorityFilter, setPriorityFilter] = useState<"all" | "urgent" | "high" | "medium" | "low">("all");
  const [sortOrder, setSortOrder] = useState<"newest" | "oldest">("newest");

  const load = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);
    try {
      const queryParams = new URLSearchParams(query ?? "");
      if (priorityFilter !== "all") {
        queryParams.set("priority", priorityFilter);
      } else {
        queryParams.delete("priority");
      }
      const suffix = queryParams.toString();
      const data = await apiRequest<{ work_orders: { data: TechnicianWorkOrder[] } }>(
        `/api/technician/work-orders${suffix ? `?${suffix}` : ""}`,
        { method: "GET" },
        true
      );
      setItems(data.work_orders?.data ?? []);
    } finally {
      if (!silent) setLoading(false);
    }
  }, [priorityFilter, query]);

  useEffect(() => { void load(); }, [load]);
  useLiveRefresh(() => load(true), { enabled: true, intervalMs: 8000 });

  const sortedItems = useMemo(() => {
    const list = [...items];
    list.sort((a, b) => {
      const aTime = new Date(a.created_at ?? "").getTime();
      const bTime = new Date(b.created_at ?? "").getTime();
      const safeA = Number.isFinite(aTime) ? aTime : 0;
      const safeB = Number.isFinite(bTime) ? bTime : 0;
      return sortOrder === "newest" ? safeB - safeA : safeA - safeB;
    });
    return list;
  }, [items, sortOrder]);

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6 pb-20 px-3 sm:px-4">
      {/* Simple Header */}
      <header className="py-6">
        <h1 className="text-3xl font-black text-slate-900 tracking-tight">{title}</h1>
        <p className="text-sm font-bold text-blue-600 uppercase tracking-widest">{subtitle}</p>
      </header>

      <div className="flex flex-wrap items-center gap-2 rounded-2xl border border-slate-100 bg-white p-3 shadow-sm">
        {(["all", "urgent", "high", "medium", "low"] as const).map((priority) => (
          <button
            key={priority}
            type="button"
            onClick={() => setPriorityFilter(priority)}
            className={`rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-widest transition ${
              priorityFilter === priority
                ? "bg-[#003366] text-white"
                : "bg-slate-50 text-slate-500 hover:bg-slate-100"
            }`}
          >
            {priority === "all" ? "All priorities" : priority}
          </button>
        ))}
        <div className="ml-auto flex items-center gap-2">
          <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Sort</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value as "newest" | "oldest")}
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-[11px] font-black uppercase tracking-widest text-slate-700"
          >
            <option value="newest">New to old</option>
            <option value="oldest">Old to new</option>
          </select>
        </div>
      </div>

      {loading ? (
        <ListSkeleton rows={3} />
      ) : (
        <div className="space-y-4">
          {sortedItems.map((task) => {
            const isPriority = task.request?.priority === "urgent" || task.request?.priority === "high";
            
            return (
              <div 
                key={task.id}
                className={`relative overflow-hidden rounded-2rem border-2 transition-all bg-white p-6 ${
                  isPriority ? "border-amber-200 shadow-md" : "border-slate-100 shadow-sm"
                }`}
              >
                {/* Priority Glow Effect */}
                {isPriority && (
                  <div className="absolute top-0 right-0 px-4 py-1 bg-amber-100 text-amber-700 text-[10px] font-black uppercase rounded-bl-2xl border-l border-b border-amber-200 animate-pulse">
                    High Priority
                  </div>
                )}

                <div className="flex flex-col gap-4">
                  {/* Title & Description */}
                  <div>
                    <h2 className="text-xl font-black text-slate-900 leading-tight">
                      {getTaskTitle(task)}
                    </h2>
                    <p className="mt-2 text-sm text-slate-500 font-medium leading-relaxed">
                      {task.request?.description || task.description || "No description provided."}
                    </p>
                  </div>

                  {/* Task Metadata Grid */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {/* Location */}
                    <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div className="p-2 bg-white rounded-xl shadow-sm text-blue-600">
                        <MapPin size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-600 uppercase">Location</p>
                        <p className="text-xs font-bold text-slate-900">{getTaskLocation(task)}</p>
                      </div>
                    </div>

                    {/* Timeline */}
                    <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-100">
                      <div className="p-2 bg-white rounded-xl shadow-sm text-emerald-600">
                        <Calendar size={16} />
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-slate-600 uppercase">Assigned On</p>
                        <p className="text-xs font-bold text-slate-900">{formatDate(task.created_at)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Expected Completion Date */}
                  {(task.scheduled_start_date || task.scheduled_end_date) && (
                    <div className="flex items-center gap-3 bg-indigo-50/60 p-3 rounded-2xl border border-indigo-100">
                      <Clock size={16} className="text-indigo-600" />
                      <p className="text-xs font-bold text-indigo-900">
                        Scheduled:{" "}
                        <span className="font-black">
                          {task.scheduled_start_date ?? "-"} {task.scheduled_start_time ?? ""}
                          {"  "}to{"  "}
                          {task.scheduled_end_date ?? "-"} {task.scheduled_end_time ?? ""}
                        </span>
                      </p>
                    </div>
                  )}
                  {task.schedule_note ? (
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-3 text-xs font-semibold text-slate-700">
                      Note: {task.schedule_note}
                    </div>
                  ) : null}

                  {/* Expected Completion Date */}
                  {task.expected_completion_date && (
                    <div className="flex items-center gap-3 bg-rose-50/50 p-3 rounded-2xl border border-rose-100">
                      <Clock size={16} className="text-rose-600" />
                      <p className="text-xs font-bold text-rose-900">
                        Deadline: <span className="font-black">{formatDate(task.expected_completion_date)}</span>
                      </p>
                    </div>
                  )}

                  {/* Action Button */}
                  <Link
                    href={`/technician/work-orders/${task.id}`}
                    className="w-full mt-2 group flex items-center justify-between bg-slate-900 hover:bg-blue-700 text-white p-4 rounded-2xl transition-all shadow-lg shadow-slate-200"
                  >
                    <span className="flex items-center gap-2 text-xs font-black uppercase tracking-widest">
                      <PlayCircle size={18} />
                      Open Task Details
                    </span>
                    <ChevronRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </Link>
                </div>
              </div>
            );
          })}

          {items.length === 0 && (
            <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">{emptyTitle}</p>
              {emptyCopy && (
                <p className="mt-3 mx-auto max-w-md text-sm font-medium leading-relaxed text-slate-500">
                  {emptyCopy}
                </p>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
