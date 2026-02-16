"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";
import { 
  AlertCircle, ArrowRight, Bell, Calendar, Clock, 
  PlusCircle, Wrench, Info, Users, Activity, ChevronRight 
} from "lucide-react";

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

  if (!data) return <PageSkeleton cards={5} rows={6} />;

  const statusCards = [
    { label: "New Requests", value: data.summary.new_requests, href: "/supervisor/requests?status=submitted", color: "bg-amber-500", text: "text-amber-900", sub: "Awaiting review", tip: "Requests submitted by users that need your approval to proceed." },
    { label: "Approved", value: data.summary.approved_pending_assignment, href: "/supervisor/requests?status=approved", color: "bg-emerald-500", text: "text-emerald-900", sub: "Needs technician", tip: "Requests you approved but haven't assigned to a technician yet." },
    { label: "In Progress", value: data.summary.in_progress, href: "/supervisor/work-orders?status=in_progress", color: "bg-blue-500", text: "text-blue-900", sub: "Currently active", tip: "Work orders currently being handled by the maintenance team." },
    { label: "Pending Closure", value: data.summary.completed_waiting_closure, href: "/supervisor/work-orders?status=completed", color: "bg-violet-500", text: "text-violet-900", sub: "Ready for review", tip: "Technicians marked these as done. They need your final sign-off." },
    { label: "Critical Overdue", value: data.summary.overdue, href: "/supervisor/work-orders?filter=overdue", color: "bg-rose-500", text: "text-rose-900", sub: "Past deadline", tip: "Work orders that have exceeded their expected completion date." },
  ];

  const topWorkloadTechs = (data.technician_workload ?? [])
    .filter((t) => Number(t.active_jobs ?? 0) > 0)
    .slice(0, 5);

  const TooltipTag = ({ tip }: { tip: string }) => (
    <div className="absolute left-1/2 -translate-x-1/2 -top-9 px-2 py-1 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded opacity-0 invisible group-hover/tt:opacity-100 group-hover/tt:visible transition-all duration-200 z-1000 pointer-events-none whitespace-nowrap hidden lg:block">
      {tip}
      <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-slate-900" />
    </div>
  );

  return (
    <div className="space-y-6 pb-12 animate-in fade-in duration-500">
      {/* --- HEADER --- */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2rem border border-slate-100 shadow-sm">
        <div className="flex items-center gap-4">
          <div className="bg-[#003366] p-3 rounded-2xl text-white shadow-lg shadow-blue-900/20">
            <Activity size={24} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-slate-900 tracking-tight">Supervisor Command Center</h1>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest">Hawassa University Maintenance</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
            <div className="text-right hidden md:block">
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Current Session</p>
                <p className="text-xs font-bold text-slate-900">{new Date().toLocaleDateString("en-US", { weekday: 'long', month: 'short', day: 'numeric' })}</p>
            </div>
            <div className="h-10 w-px bg-slate-100 mx-2 hidden md:block"></div>
            <div className="group/tt relative">
              <Link
                href="/supervisor/work-orders/create"
                title="Create a manual work order when a request is urgent or submitted offline."
                className="flex items-center gap-2 bg-[#003366] hover:bg-blue-900 text-white px-5 py-2.5 rounded-xl text-xs font-black transition-all active:scale-95 shadow-lg shadow-blue-900/20"
              >
                  <PlusCircle size={16} /> NEW WORK ORDER
              </Link>
              <TooltipTag tip="Create Manual Work Order" />
            </div>
        </div>
      </div>

      {/* --- URGENT ALERTS (TOP PRIORITY) --- */}
      <div className="grid lg:grid-cols-2 gap-6">
        <div className="group relative bg-white rounded-[2.5rem] border-2 border-rose-100 p-6 shadow-xl shadow-rose-900/5 overflow-hidden">
          <div className="absolute top-0 right-0 p-8 opacity-5 group-hover:opacity-10 transition-opacity">
             <Bell size={80} className="text-rose-600" />
          </div>
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-rose-600 mb-6 flex items-center gap-2">
            <Bell size={16} /> Critical Overdue List
          </h3>
          <div className="space-y-3 relative z-10">
            {data.urgent_alerts.overdue_work_orders.slice(0, 4).map((wo) => (
              <Link key={wo.id} href={`/supervisor/work-orders/${wo.id}`} className="group/item flex items-center justify-between rounded-2xl border border-rose-50 bg-rose-50/30 p-4 hover:bg-white hover:border-rose-200 transition-all">
                <div className="flex-1">
                  <p className="text-sm font-black text-slate-900 truncate pr-4">{wo.title}</p>
                  <p className="text-[10px] text-rose-600 font-bold uppercase tracking-widest mt-1">{wo.technician || "Unassigned"} • {wo.days_late} Days Late</p>
                </div>
                <ChevronRight size={18} className="text-rose-300 group-hover/item:translate-x-1 transition-transform" />
              </Link>
            ))}
            {data.urgent_alerts.overdue_work_orders.length === 0 && <p className="text-sm text-slate-400 italic">No critical delays detected.</p>}
          </div>
        </div>

        <div className="bg-white rounded-[2.5rem] border border-orange-100 p-6 shadow-xl shadow-orange-900/5">
          <h3 className="text-xs font-black uppercase tracking-[0.2em] text-orange-600 mb-6 flex items-center gap-2">
            <AlertCircle size={16} /> Late Completion Reports
          </h3>
          <div className="space-y-3">
            {data.urgent_alerts.late_completion_reports.slice(0, 4).map((wo) => (
              <Link key={wo.id} href={`/supervisor/work-orders/${wo.id}?scroll=delay`} className="flex items-center justify-between rounded-2xl border border-orange-50 bg-orange-50/30 p-4 hover:bg-white hover:border-orange-200 transition-all">
                <div>
                  <p className="text-sm font-black text-slate-900">{wo.title}</p>
                  <p className="text-[10px] text-orange-600 font-bold uppercase tracking-widest mt-1">{wo.technician} • Waiting for Reason</p>
                </div>
                <Info size={18} className="text-orange-300" />
              </Link>
            ))}
            {data.urgent_alerts.late_completion_reports.length === 0 && <p className="text-sm text-slate-400 italic">All reports submitted on time.</p>}
          </div>
        </div>
      </div>

      {/* --- STATUS CARDS WITH TOOLTIPS --- */}
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {statusCards.map((card) => (
          <Link
            key={card.label}
            href={card.href}
            title={card.tip}
            className="group relative bg-white rounded-3xl border border-slate-100 p-5 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
          >
            <div className="absolute top-2 right-2 group/tt">
              <Info size={14} className="text-slate-300 cursor-help" />
              <div className="absolute bottom-full right-0 mb-2 w-56 p-2 bg-slate-900 text-white text-[10px] rounded-lg pointer-events-none opacity-0 invisible group-hover/tt:opacity-100 group-hover/tt:visible transition-all z-50 shadow-2xl hidden lg:block">
                {card.tip}
              </div>
            </div>
            
            <div className={`w-10 h-10 ${card.color} rounded-xl mb-4 flex items-center justify-center text-white shadow-inner`}>
                <p className="text-sm font-black">{card.value}</p>
            </div>
            <p className="text-[10px] font-black uppercase tracking-widest text-slate-400 leading-none">{card.label}</p>
            <p className="text-[9px] font-bold text-slate-500 mt-1">{card.sub}</p>
            <div className={`absolute bottom-0 left-0 h-1 w-full ${card.color} opacity-20`} />
          </Link>
        ))}
      </div>

      {/* --- MIDDLE SECTION: TECH WORKLOAD & PREVENTIVE --- */}
      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-xl shadow-slate-200/50">
          <div className="flex items-center justify-between mb-8">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-900 flex items-center gap-2">
                <Users size={16} className="text-blue-600" /> Technician Performance
            </h3>
            <div className="group/tt relative">
              <Link
                href="/supervisor/technicians"
                title="Open technician list with workload and profile details."
                className="text-[10px] font-black text-blue-700 bg-blue-50 px-3 py-1 rounded-full uppercase tracking-widest hover:bg-blue-100 transition-colors"
              >
                View Directory
              </Link>
              <TooltipTag tip="Browse Technician Profiles" />
            </div>
          </div>
          
          <div className="overflow-hidden">
            <table className="w-full text-left">
              <thead>
                <tr className="text-[9px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-50">
                  <th className="pb-4">Technician</th>
                  <th className="pb-4">Active Jobs</th>
                  <th className="pb-4">Overdue</th>
                  <th className="pb-4">Avg Rating</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {topWorkloadTechs.map((t) => (
                  <tr key={t.id} className="group hover:bg-slate-50 transition-colors">
                    <td className="py-4">
                        <Link href={`/supervisor/technicians/${t.id}`} className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                                {t.fname[0]}{t.lname[0]}
                            </div>
                            <span className="text-sm font-black text-slate-900">{t.fname} {t.lname}</span>
                        </Link>
                    </td>
                    <td className="py-4 text-sm font-bold text-slate-600">{t.active_jobs ?? 0}</td>
                    <td className="py-4">
                        <span className={`text-xs font-black ${Number(t.overdue_jobs) > 0 ? 'text-rose-600' : 'text-slate-300'}`}>
                            {t.overdue_jobs ?? 0}
                        </span>
                    </td>
                    <td className="py-4">
                        <div className="flex items-center gap-1">
                            <span className="text-sm font-black text-[#003366]">{(Number(t.avg_rating ?? 0) || 0).toFixed(1)}</span>
                            <span className="text-amber-400 text-xs">★</span>
                        </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        <div className="space-y-4">
          <div className="bg-white rounded-[2.5rem] p-1 border border-slate-100 shadow-xl">
              <Link href="/supervisor/preventive?filter=upcoming" title="Show preventive maintenance tasks due this week." className="block group rounded-[2.2rem] bg-emerald-50/50 p-6 border border-emerald-50 hover:bg-emerald-50 transition-all">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-emerald-500 rounded-2xl text-white shadow-lg shadow-emerald-500/20">
                        <Clock size={20} />
                    </div>
                    <ArrowRight size={16} className="text-emerald-300 group-hover:translate-x-1 transition-transform" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-emerald-700">Upcoming PM</p>
                <p className="text-4xl font-black text-emerald-900 mt-1">{data.pm_overview.upcoming_this_week}</p>
                <p className="text-[10px] font-bold text-emerald-600 mt-2 italic">Due this week</p>
              </Link>
          </div>
          
          <div className="bg-white rounded-[2.5rem] p-1 border border-slate-100 shadow-xl">
              <Link href="/supervisor/preventive?filter=overdue" title="Show preventive tasks that missed their due date." className="block group rounded-[2.2rem] bg-rose-50/50 p-6 border border-rose-50 hover:bg-rose-50 transition-all">
                <div className="flex justify-between items-start mb-4">
                    <div className="p-3 bg-rose-500 rounded-2xl text-white shadow-lg shadow-rose-500/20">
                        <Wrench size={20} />
                    </div>
                    <ArrowRight size={16} className="text-rose-300 group-hover:translate-x-1 transition-transform" />
                </div>
                <p className="text-[10px] font-black uppercase tracking-widest text-rose-700">Missed PM Tasks</p>
                <p className="text-4xl font-black text-rose-900 mt-1">{data.pm_overview.overdue_preventive}</p>
                <p className="text-[10px] font-bold text-rose-600 mt-2 italic">Immediate Action Required</p>
              </Link>
          </div>
        </div>
      </div>

      {/* --- RECENT REQUESTS --- */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-xl shadow-slate-200/50">
        <div className="flex items-center justify-between mb-8">
            <h3 className="text-xs font-black uppercase tracking-[0.2em] text-slate-900 flex items-center gap-2">
                <Activity size={16} className="text-indigo-600" /> Recent Stream
            </h3>
            <div className="flex gap-2">
                 <div className="group/tt relative">
                  <Link
                    href="/supervisor/requests"
                    title="Open complete request history and older records."
                    className="text-[10px] font-black text-slate-500 bg-slate-100 px-3 py-1 rounded-full uppercase tracking-widest hover:bg-slate-200 transition-colors"
                  >
                    Historical Logs
                  </Link>
                  <TooltipTag tip="Open Request History" />
                 </div>
            </div>
        </div>
        
        <div className="space-y-3">
          {data.recent_requests.map((req) => (
            <Link key={req.id} href={`/supervisor/requests/${req.id}`} className="grid grid-cols-2 md:grid-cols-5 items-center rounded-2xl border border-slate-50 bg-slate-50/30 p-4 hover:bg-white hover:border-slate-200 hover:shadow-md transition-all group">
              <div className="col-span-1 md:col-span-1">
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Title</span>
                <span className="text-xs font-black text-slate-900 truncate block group-hover:text-blue-700">{req.title}</span>
              </div>
              <div className="hidden md:block">
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Origin</span>
                <span className="text-xs font-bold text-slate-700 truncate block">{req.department?.name ?? "General"}</span>
              </div>
              <div className="hidden md:block">
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Priority</span>
                <span className={`text-[9px] font-black px-2 py-0.5 rounded-md inline-block ${req.priority === 'urgent' ? 'bg-rose-100 text-rose-700' : 'bg-blue-100 text-blue-700'}`}>
                    {req.priority.toUpperCase()}
                </span>
              </div>
              <div className="hidden md:block">
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Status</span>
                <span className="text-xs font-bold text-slate-600 uppercase">{req.status}</span>
              </div>
              <div className="text-right">
                <span className="text-[10px] font-black text-slate-400 uppercase block mb-1">Received</span>
                <span className="text-[10px] font-bold text-slate-500 block">{new Date(req.created_at).toLocaleDateString()}</span>
              </div>
            </Link>
          ))}
          {data.recent_requests.length === 0 && <p className="text-sm text-center py-12 text-slate-400 italic">No incoming requests in the current stream.</p>}
        </div>
      </div>
    </div>
  );
}
