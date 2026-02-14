"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import { AlertCircle, ArrowRight, Bell, Calendar, Clock, PlusCircle, Wrench } from "lucide-react";

type DashboardPayload = {
  success: boolean;
  summary: {
    new_requests: number;
    approved_pending_assignment: number;
    in_progress: number;
    completed_waiting_closure: number;
    overdue: number;
  };
  urgent_alerts: {
    overdue_work_orders: Array<{ id: number; title: string; technician: string; days_late: number; priority: string }>;
    late_completion_reports: Array<{ id: number; title: string; technician: string; delay_reason: string }>;
  };
  technician_workload: Array<{
    id: number;
    fname: string;
    lname: string;
    active_jobs?: number;
    overdue_jobs?: number;
    avg_rating: number | string;
  }>;
  pm_overview: {
    upcoming_this_week: number;
    overdue_preventive: number;
  };
  recent_requests: Array<{
    id: number;
    title: string;
    priority: string;
    status: string;
    created_at: string;
    department?: { name?: string };
  }>;
};

export default function SupervisorDashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);

  useEffect(() => {
    const run = async () => {
      const res = await apiRequest<DashboardPayload>("/api/supervisor/dashboard", { method: "GET" }, true);
      setData(res);
    };
    void run();
  }, []);

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-[280px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#003366]" />
      </div>
    );
  }

  const cards = [
    { label: "New Requests", value: data.summary.new_requests, href: "/supervisor/requests?status=submitted", color: "text-amber-700 bg-amber-50 border-amber-100" },
    { label: "Approved (Pending Assignment)", value: data.summary.approved_pending_assignment, href: "/supervisor/requests?status=approved", color: "text-emerald-700 bg-emerald-50 border-emerald-100" },
    { label: "In Progress", value: data.summary.in_progress, href: "/supervisor/work-orders?status=in_progress", color: "text-blue-700 bg-blue-50 border-blue-100" },
    { label: "Completed (Waiting Closure)", value: data.summary.completed_waiting_closure, href: "/supervisor/work-orders?status=completed", color: "text-violet-700 bg-violet-50 border-violet-100" },
    { label: "Overdue", value: data.summary.overdue, href: "/supervisor/work-orders?filter=overdue", color: "text-red-700 bg-red-50 border-red-200" },
  ];
  const topWorkloadTechs = (data.technician_workload ?? [])
    .filter((t) => Number(t.active_jobs ?? 0) > 0)
    .slice(0, 5);

  return (
    <div className="space-y-8 pb-12">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900">Supervisor Dashboard</h1>
          <p className="text-sm text-slate-500 font-semibold">Operational command center</p>
        </div>
        <div className="bg-blue-50 px-4 py-2 rounded-2xl flex items-center gap-2 text-[#003366]">
          <Calendar size={16} />
          <span className="text-[10px] font-black uppercase tracking-widest">
            {new Date().toLocaleDateString("en-US", { month: "long", year: "numeric" })}
          </span>
        </div>
      </div>

      <div className="grid sm:grid-cols-2 xl:grid-cols-5 gap-4">
        {cards.map((card) => (
          <Link key={card.label} href={card.href} className={`rounded-2xl border p-4 ${card.color} hover:shadow-md transition-all`}>
            <p className="text-[10px] font-black uppercase tracking-widest">{card.label}</p>
            <p className="text-3xl font-black mt-2">{card.value}</p>
          </Link>
        ))}
      </div>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-4 flex items-center gap-2">
            <Bell size={16} className="text-red-600" /> Overdue Work Orders (Top 5)
          </h3>
          <div className="space-y-3">
            {data.urgent_alerts.overdue_work_orders.map((wo) => (
              <Link key={wo.id} href={`/supervisor/work-orders/${wo.id}`} className="block rounded-xl border border-slate-100 bg-slate-50 p-3 hover:bg-white">
                <p className="text-sm font-black text-slate-900">{wo.title}</p>
                <p className="text-[11px] text-slate-600 font-semibold">{wo.technician || "Unassigned"} • {wo.days_late} day(s) late • {wo.priority}</p>
              </Link>
            ))}
            {data.urgent_alerts.overdue_work_orders.length === 0 && <p className="text-sm text-slate-500">No overdue work orders.</p>}
          </div>
        </div>

        <div className="bg-white rounded-2xl border border-slate-200 p-5">
          <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-4 flex items-center gap-2">
            <AlertCircle size={16} className="text-orange-500" /> Late Completion Reports
          </h3>
          <div className="space-y-3">
            {data.urgent_alerts.late_completion_reports.map((wo) => (
              <Link key={wo.id} href={`/supervisor/work-orders/${wo.id}?scroll=delay`} className="block rounded-xl border border-orange-100 bg-orange-50/60 p-3 hover:bg-orange-50">
                <p className="text-sm font-black text-slate-900">{wo.title}</p>
                <p className="text-[11px] text-slate-600 font-semibold">{wo.technician}</p>
                <p className="text-[11px] text-orange-700 font-bold mt-1">View Reason</p>
              </Link>
            ))}
            {data.urgent_alerts.late_completion_reports.length === 0 && <p className="text-sm text-slate-500">No late completion reports.</p>}
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-2xl border border-slate-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-sm font-black uppercase tracking-widest text-slate-900">Technician Overview (Top 5 Workload)</h3>
            <Link href="/supervisor/technicians" className="text-xs font-black text-blue-700 hover:underline">View All</Link>
          </div>
          <div className="space-y-2">
            {topWorkloadTechs.map((t) => (
              <Link key={t.id} href={`/supervisor/technicians/${t.id}`} className="grid grid-cols-4 items-center rounded-xl border border-slate-100 p-3 text-sm hover:bg-slate-50">
                <span className="font-bold text-slate-900">{t.fname} {t.lname}</span>
                <span className="font-semibold text-slate-700">{t.active_jobs ?? 0}</span>
                <span className="font-semibold text-red-600">{t.overdue_jobs ?? 0}</span>
                <span className="font-semibold text-slate-700">{(Number(t.avg_rating ?? 0) || 0).toFixed(2)}</span>
              </Link>
            ))}
            {topWorkloadTechs.length === 0 && <p className="text-sm text-slate-500">No active technician workload right now.</p>}
          </div>
        </div>

        <div className="space-y-4">
          <Link href="/supervisor/preventive?filter=upcoming" className="block rounded-2xl border border-emerald-100 bg-emerald-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Upcoming This Week</p>
            <p className="text-3xl font-black text-emerald-900 mt-2">{data.pm_overview.upcoming_this_week}</p>
          </Link>
          <Link href="/supervisor/preventive?filter=overdue" className="block rounded-2xl border border-red-200 bg-red-50 p-5">
            <p className="text-[10px] font-black uppercase tracking-widest text-red-700">Overdue Preventive</p>
            <p className="text-3xl font-black text-red-900 mt-2">{data.pm_overview.overdue_preventive}</p>
          </Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-4">Quick Actions</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <Link href="/supervisor/work-orders/create" className="rounded-xl bg-[#003366] text-white p-3 text-sm font-bold flex items-center justify-between">Create Manual Work Order <PlusCircle size={14} /></Link>
          <Link href="/supervisor/requests" className="rounded-xl bg-slate-100 text-slate-900 p-3 text-sm font-bold flex items-center justify-between">View All Requests <ArrowRight size={14} /></Link>
          <Link href="/supervisor/preventive" className="rounded-xl bg-slate-100 text-slate-900 p-3 text-sm font-bold flex items-center justify-between">Manage Preventive Plans <Clock size={14} /></Link>
          <Link href="/supervisor/analytics" className="rounded-xl bg-slate-100 text-slate-900 p-3 text-sm font-bold flex items-center justify-between">View Analytics <Wrench size={14} /></Link>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 p-5">
        <h3 className="text-sm font-black uppercase tracking-widest text-slate-900 mb-4">Request Overview (Last 10)</h3>
        <div className="space-y-2">
          {data.recent_requests.map((req) => (
            <Link key={req.id} href={`/supervisor/requests/${req.id}`} className="grid grid-cols-5 items-center rounded-xl border border-slate-100 p-3 text-sm hover:bg-slate-50">
              <span className="font-bold text-slate-900 truncate">{req.title}</span>
              <span className="font-semibold text-slate-700">{req.department?.name ?? "-"}</span>
              <span className="font-semibold text-slate-700 uppercase">{req.priority}</span>
              <span className="font-semibold text-slate-700 uppercase">{req.status}</span>
              <span className="font-semibold text-slate-500">{new Date(req.created_at).toLocaleString()}</span>
            </Link>
          ))}
          {data.recent_requests.length === 0 && <p className="text-sm text-slate-500">No recent requests.</p>}
        </div>
      </div>
    </div>
  );
}
