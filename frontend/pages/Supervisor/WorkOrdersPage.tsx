"use client";

import Link from "next/link";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
import { useEffect, useState, useCallback, useMemo } from "react";
import { apiRequest } from "@/lib/api";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import { 
  Search, Filter, ChevronRight, Clock, AlertTriangle, 
  CheckCircle2, User, MoreHorizontal, LayoutGrid, ListFilter
} from "lucide-react";

type WorkOrder = {
  id: number;
  priority: string;
  work_status: string;
  delay_reason?: string | null;
  days_late?: number;
  request?: { title?: string | null; status?: string | null; due_date?: string | null };
  assignee?: { fname?: string; lname?: string };
};

const statusStyles: Record<string, string> = {
  assigned: "bg-amber-100 text-amber-700 border-amber-200",
  in_progress: "bg-blue-100 text-blue-700 border-blue-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  draft: "bg-slate-100 text-slate-700 border-slate-200",
};

const allowedStatusFilters = new Set(["assigned", "in_progress", "completed", "draft"]);

export default function WorkOrdersPage() {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const [items, setItems] = useState<WorkOrder[]>([]);
  const [loading, setLoading] = useState(true);

  // Stats Logic
  const stats = useMemo(() => ({
    total: items.length,
    late: items.filter(i => (i.days_late ?? 0) > 0).length,
    inProgress: items.filter(i => i.work_status === 'in_progress').length
  }), [items]);

  const fetchOrders = useCallback(async () => {
    setLoading(true);
    const qs = new URLSearchParams(params?.toString() ?? "");
    const currentStatus = qs.get("status");
    if (currentStatus && !allowedStatusFilters.has(currentStatus)) {
      qs.delete("status");
    }
    const suffix = qs.toString() ? `?${qs.toString()}` : "";
    
    try {
      const data = await apiRequest<{ success: boolean; work_orders: { data: WorkOrder[] } }>(
        `/api/supervisor/work-orders${suffix}`, 
        { method: "GET" }, 
        true
      );
      setItems(data.work_orders.data ?? []);
    } catch (error) {
      console.error("Fetch error", error);
    } finally {
      setLoading(false);
    }
  }, [params]);

  useEffect(() => {
    fetchOrders();
  }, [fetchOrders]);

  useLiveRefresh(fetchOrders, {
    enabled: true,
    topics: ['work-orders', 'supervisor.work-orders', 'supervisor.dashboard', 'requests'],
    refreshOnFocus: false,
  });

  const updateFilter = (key: string, value: string) => {
    const newParams = new URLSearchParams(params?.toString() ?? "");
    if (value === "all") {
      newParams.delete(key);
    } else {
      newParams.set(key, value);
    }
    const query = newParams.toString();
    const nextPath = pathname ?? "/supervisor/work-orders";
    router.push(query ? `${nextPath}?${query}` : nextPath);
  };

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 animate-in fade-in duration-500">
      
      {/* HEADER & STATS */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Work Orders</h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest">Facility Operations Management</p>
        </div>

        <div className="flex gap-4">
          <div className="px-6 py-4 bg-white rounded-2rem border border-slate-100 shadow-sm flex items-center gap-4">
            <div className="p-3 bg-rose-50 text-rose-600 rounded-2xl"><AlertTriangle size={20}/></div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">Delayed</p>
              <p className="text-xl font-black text-slate-900">{stats.late}</p>
            </div>
          </div>
          <div className="px-6 py-4 bg-[#003366] rounded-2rem text-white shadow-lg shadow-blue-900/20 flex items-center gap-4">
            <div className="p-3 bg-white/10 rounded-2xl"><Clock size={20}/></div>
            <div>
              <p className="text-[10px] font-black uppercase tracking-widest leading-none opacity-60">Active</p>
              <p className="text-xl font-black">{stats.inProgress}</p>
            </div>
          </div>
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="bg-white rounded-2rem border border-slate-100 p-4 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex-1 min-w-200px relative">
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={18}/>
          <input 
            type="text" 
            placeholder="Search by title..." 
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm focus:ring-2 focus:ring-[#003366]/5 outline-none"
            onChange={(e) => updateFilter("filter", e.target.value)}
          />
        </div>

        <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-2xl">
          <ListFilter size={16} className="ml-3 text-slate-400"/>
          {[
            { label: "All Status", value: "all" },
            { label: "Assigned", value: "assigned" },
            { label: "In Progress", value: "in_progress" },
            { label: "Completed", value: "completed" },
            { label: "Draft", value: "draft" },
          ].map((opt) => (
            <button
              key={opt.value}
              onClick={() => updateFilter("status", opt.value)}
              className={`px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${
                (params?.get("status") || "all") === opt.value 
                  ? "bg-white text-[#003366] shadow-sm" 
                  : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      {/* TABLE LISTING */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="grid grid-cols-12 px-8 py-5 border-b border-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">
          <div className="col-span-4">Work Order Details</div>
          <div className="col-span-2">Priority</div>
          <div className="col-span-2">Status</div>
          <div className="col-span-2">Assignee</div>
          <div className="col-span-2 text-right">Deadline</div>
        </div>

        <div className="divide-y divide-slate-50">
          {items.map((wo) => (
            <Link 
              key={wo.id} 
              href={`/supervisor/work-orders/${wo.id}`}
              className="grid grid-cols-12 px-8 py-6 items-center hover:bg-slate-50/50 transition-colors group"
            >
              {/* Title & ID */}
              <div className="col-span-4 space-y-1">
                <p className="text-sm font-black text-slate-900 group-hover:text-[#003366] transition-colors">
                  {wo.request?.title ?? `Maintenance #${wo.id}`}
                </p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                  <Hash size={12}/> WO-{wo.id}
                </p>
              </div>

              {/* Priority */}
              <div className="col-span-2">
                <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-wider border ${
                  wo.priority === 'urgent' ? 'bg-rose-50 text-rose-600 border-rose-100' : 'bg-blue-50 text-blue-600 border-blue-100'
                }`}>
                  {wo.priority}
                </span>
              </div>

              {/* Status */}
              <div className="col-span-2">
                <div className="flex items-center gap-2">
                  <div className={`w-2 h-2 rounded-full ${statusStyles[wo.work_status]?.split(' ')[0] || 'bg-slate-300'}`} />
                  <span className="text-[11px] font-black text-slate-600 uppercase tracking-tight">
                    {wo.work_status.replace('_', ' ')}
                  </span>
                </div>
              </div>

              {/* Assignee */}
              <div className="col-span-2 flex items-center gap-3">
                <div className="w-8 h-8 rounded-xl bg-slate-100 flex items-center justify-center text-[10px] font-black text-slate-400 border border-slate-200 shadow-sm">
                  {wo.assignee?.fname?.[0] || <User size={14}/>}
                </div>
                <p className="text-xs font-bold text-slate-700">
                  {wo.assignee ? `${wo.assignee.fname} ${wo.assignee.lname}` : "Unassigned"}
                </p>
              </div>

              {/* Urgency/Late */}
              <div className="col-span-2 text-right">
                {wo.days_late ? (
                  <div className="inline-flex flex-col items-end">
                    <span className="text-xs font-black text-rose-600">{wo.days_late} Day(s) Late</span>
                    <span className="text-[9px] font-bold text-rose-300 uppercase leading-none">Urgent Attention</span>
                  </div>
                ) : (
                  <span className="text-xs font-bold text-slate-400">On Track</span>
                )}
              </div>
            </Link>
          ))}

          {items.length === 0 && !loading && (
            <div className="py-20 text-center space-y-4">
              <div className="w-20 h-20 bg-slate-50 rounded-2rem flex items-center justify-center mx-auto border border-slate-100">
                <LayoutGrid size={32} className="text-slate-200" strokeWidth={1}/>
              </div>
              <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No matching work orders found</p>
            </div>
          )}
          
          {loading && (
            <div className="p-12 text-center">
              <div className="w-8 h-8 border-4 border-slate-100 border-t-[#003366] rounded-full animate-spin mx-auto" />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Hash({ size }: { size: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <line x1="4" y1="9" x2="20" y2="9" /><line x1="4" y1="15" x2="20" y2="15" /><line x1="10" y1="3" x2="8" y2="21" /><line x1="16" y1="3" x2="14" y2="21" />
    </svg>
  );
}
