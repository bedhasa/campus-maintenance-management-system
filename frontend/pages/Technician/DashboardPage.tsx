"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertTriangle, CheckCircle2, ClipboardList, Clock3, PlayCircle, ChevronRight } from "lucide-react";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";
import { TechnicianDashboardResponse, formatDate, getStatusLabel, getTaskLocation, getTaskTitle } from "./technician-utils";

export default function TechnicianDashboardPage() {
  const router = useRouter();
  const [data, setData] = useState<TechnicianDashboardResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [starting, setStarting] = useState<number | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await apiRequest<TechnicianDashboardResponse>("/api/technician/dashboard", { method: "GET" }, true);
        setData(res);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load dashboard.");
      }
    };
    void run();
  }, []);

  if (!data && !error) return <PageSkeleton cards={4} rows={4} />;

  const recentTasks = (data?.assigned_jobs?.data ?? []).slice(0, 5);
  const firstAssigned = recentTasks.find((task) => task.work_status === "assigned");

  const startTask = async (taskId?: number) => {
    const targetId = taskId ?? firstAssigned?.id;
    if (!targetId) {
      router.push("/technician/tasks");
      return;
    }
    try {
      setStarting(targetId);
      await apiRequest(`/api/technician/work-orders/${targetId}/start`, { method: "PATCH" }, true);
      router.push(`/technician/work-orders/${targetId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start selected task.");
    } finally {
      setStarting(null);
    }
  };

  const stats = [
    { label: "Assigned", value: data?.summary.assigned, icon: ClipboardList, color: "text-blue-600", bg: "bg-blue-50" },
    { label: "Active", value: data?.summary.in_progress, icon: Clock3, color: "text-amber-600", bg: "bg-amber-50" },
    { label: "Done", value: data?.summary.completed, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
    { label: "Delayed", value: data?.summary.overdue, icon: AlertTriangle, color: "text-rose-600", bg: "bg-rose-50" },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-6 pb-20 px-1">
      {/* Header Section */}
      <header className="px-2 pt-4">
        <h1 className="text-2xl font-bold text-slate-900">Hello, Technician</h1>
        <p className="text-slate-500 text-sm">Here is your schedule for today.</p>
      </header>

      {error && (
        <div className="mx-2 rounded-xl bg-rose-50 p-4 text-sm font-medium text-rose-700 flex items-center gap-3">
          <AlertTriangle size={18} />
          {error}
        </div>
      )}

      {/* Primary Action Card */}
      <div className="mx-2 overflow-hidden rounded-2xl bg-[#003366] p-6 text-white shadow-lg shadow-blue-900/20">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-blue-100/80 text-xs font-bold uppercase tracking-wider">Next Priority</p>
            <h2 className="mt-1 text-xl font-semibold">
              {firstAssigned ? getTaskTitle(firstAssigned) : "No Pending Tasks"}
            </h2>
            <p className="mt-1 text-sm text-blue-100/70">
              {firstAssigned ? getTaskLocation(firstAssigned) : "You're all caught up!"}
            </p>
          </div>
          <PlayCircle className="text-blue-300/50" size={32} />
        </div>
        
        <button
          onClick={() => void startTask()}
          disabled={starting !== null}
          className="mt-6 w-full rounded-xl bg-white py-4 text-center text-sm font-bold text-[#003366] transition-transform active:scale-[0.98] disabled:opacity-70"
        >
          {starting ? "Starting..." : firstAssigned ? "Start Work Now" : "View All Tasks"}
        </button>
      </div>

      {/* Stats Grid - Cleaner 2x2 for mobile */}
      <div className="grid grid-cols-2 gap-3 px-2">
        {stats.map((item) => (
          <div key={item.label} className="flex items-center gap-3 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm">
            <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${item.bg} ${item.color}`}>
              <item.icon size={20} />
            </div>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-tight text-slate-400">{item.label}</p>
              <p className="text-lg font-bold text-slate-900 leading-tight">{item.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Task List */}
      <section className="px-2">
        <div className="flex items-center justify-between mb-4 px-1">
          <h3 className="font-bold text-slate-900">Recent Tasks</h3>
          <Link href="/technician/tasks" className="text-xs font-bold text-blue-600 flex items-center gap-1">
            VIEW ALL <ChevronRight size={14} />
          </Link>
        </div>

        <div className="space-y-3">
          {recentTasks.length === 0 ? (
            <div className="rounded-2xl border-2 border-dashed border-slate-100 p-8 text-center">
              <p className="text-sm text-slate-400">No tasks assigned yet.</p>
            </div>
          ) : (
            recentTasks.map((task) => (
              <Link
                key={task.id}
                href={`/technician/work-orders/${task.id}`}
                className="group flex items-center justify-between rounded-2xl border border-slate-100 bg-white p-4 transition-colors active:bg-slate-50 shadow-sm"
              >
                <div className="min-w-0 pr-4">
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`h-2 w-2 rounded-full ${task.work_status === 'assigned' ? 'bg-blue-500' : 'bg-amber-500'}`} />
                    <h4 className="truncate text-sm font-bold text-slate-800">{getTaskTitle(task)}</h4>
                  </div>
                  <p className="truncate text-xs text-slate-500">{getTaskLocation(task)}</p>
                  <p className="mt-2 text-[10px] font-medium text-slate-400 uppercase tracking-tight">
                    Added {formatDate(task.request?.created_at || task.created_at)}
                  </p>
                </div>
                <ChevronRight className="text-slate-300 group-active:text-slate-500" size={20} />
              </Link>
            ))
          )}
        </div>
      </section>
    </div>
  );
}