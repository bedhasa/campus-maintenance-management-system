"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";
import { 
  Clock, HardHat, AlertCircle, MapPin, 
  Calendar, Phone, Mail, ChevronLeft, 
  FileText, ShieldAlert, CheckCircle2, Building2
} from "lucide-react";
import Link from "next/link";

interface Props { id: string; }

type WorkOrderDetail = {
  id: number;
  priority: string;
  work_status: string;
  completion_note?: string | null;
  delay_reason?: string | null;
  assignee?: { fname?: string; lname?: string; phone?: string; email?: string };
  request?: { 
    title?: string; 
    description?: string; 
    status?: string; 
    due_date?: string | null; 
    category?: { name?: string }; 
    building?: { name?: string }; 
    room?: { name?: string } 
  };
};

const priorityMap: Record<string, string> = {
  urgent: "bg-rose-100 text-rose-700 border-rose-200",
  high: "bg-orange-100 text-orange-700 border-orange-200",
  medium: "bg-blue-100 text-blue-700 border-blue-200",
  low: "bg-slate-100 text-slate-700 border-slate-200",
};

export default function WorkOrderDetailPage({ id }: Props) {
  const params = useSearchParams();
  const delayRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<WorkOrderDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const run = async () => {
      try {
        setError(null);
        const res = await apiRequest<{ success: boolean; work_order: WorkOrderDetail }>(
          `/api/supervisor/work-orders/${id}`, { method: "GET" }, true
        );
        setData(res.work_order);
      } catch (err) {
        const message = err instanceof Error ? err.message : "Failed to load work order details.";
        setError(message);
      }
    };
    void run();
  }, [id]);

 useEffect(() => {
    // We add the ?. check to 'params'
    if (params?.get("scroll") === "delay" && delayRef.current) {
      delayRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [params, data]);

  if (error) {
    return (
      <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 text-sm font-semibold text-rose-700">
        {error}
      </div>
    );
  }

  if (!data) return <PageSkeleton cards={2} rows={3} />;

  return (
    <div className="max-w-6xl mx-auto space-y-6 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* TOP NAVIGATION */}
      <div className="flex items-center justify-between">
        <Link href="/supervisor/work-orders" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-slate-400 hover:text-[#003366] transition-colors">
          <ChevronLeft size={16} /> Back to List
        </Link>
        <div className="flex items-center gap-3">
          <span className={`px-4 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${priorityMap[data.priority] || priorityMap.medium}`}>
            {data.priority} Priority
          </span>
          <span className="px-4 py-1 bg-slate-900 text-white rounded-full text-[10px] font-black uppercase tracking-widest">
            {data.work_status.replace('_', ' ')}
          </span>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* LEFT COLUMN: MAIN CONTENT */}
        <div className="lg:col-span-2 space-y-6">
          
          {/* Header Card */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
            <div className="flex items-start justify-between mb-6">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-blue-500 uppercase tracking-[0.2em]">Work Order Assignment</p>
                <h1 className="text-3xl font-black text-slate-900 tracking-tight">#{data.id}: {data.request?.title || "Direct Work Order"}</h1>
              </div>
            </div>

            <div className="bg-slate-50/50 border border-slate-100 rounded-2rem p-6">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                <FileText size={14}/> Problem Description
              </p>
              <p className="text-sm text-slate-700 leading-relaxed">
                {data.request?.description ?? "No detailed description provided for this work order."}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-4 mt-6">
              <div className="p-4 bg-white border border-slate-100 rounded-2xl">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Building</p>
                <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <Building2 size={14} className="text-blue-500"/> {data.request?.building?.name || "Global"}
                </p>
              </div>
              <div className="p-4 bg-white border border-slate-100 rounded-2xl">
                <p className="text-[9px] font-black text-slate-400 uppercase mb-1">Location / Room</p>
                <p className="text-sm font-bold text-slate-800 flex items-center gap-2">
                  <MapPin size={14} className="text-emerald-500"/> {data.request?.room?.name || "General Area"}
                </p>
              </div>
            </div>
          </div>

          {/* DELAY REASON SECTION */}
          <div 
            ref={delayRef} 
            className={`rounded-[2.5rem] p-8 border-2 transition-all duration-500 ${
              data.delay_reason 
                ? "bg-rose-50 border-rose-100 shadow-lg shadow-rose-900/5" 
                : "bg-white border-slate-100 opacity-60"
            }`}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className={`p-2 rounded-xl ${data.delay_reason ? "bg-rose-500 text-white" : "bg-slate-100 text-slate-400"}`}>
                <ShieldAlert size={20} />
              </div>
              <h3 className={`text-sm font-black uppercase tracking-widest ${data.delay_reason ? "text-rose-800" : "text-slate-500"}`}>
                Blockers & Delay Log
              </h3>
            </div>
            
            {data.delay_reason ? (
              <div className="space-y-2">
                <p className="text-sm text-rose-700 font-medium leading-relaxed bg-white/50 p-4 rounded-2xl border border-rose-200/50">
                  {data.delay_reason}
                </p>
                <p className="text-[10px] font-bold text-rose-400 uppercase pl-2">Reported by assigned technician</p>
              </div>
            ) : (
              <p className="text-sm text-slate-400 italic">No delays have been reported for this work order yet.</p>
            )}
          </div>

          {/* COMPLETION NOTE */}
          {data.work_status === 'completed' && (
             <div className="bg-emerald-50 rounded-[2.5rem] border border-emerald-100 p-8">
                <div className="flex items-center gap-3 mb-4 text-emerald-800">
                  <CheckCircle2 size={20}/>
                  <h3 className="text-sm font-black uppercase tracking-widest">Completion Summary</h3>
                </div>
                <p className="text-sm text-emerald-700 bg-white/50 p-4 rounded-2xl border border-emerald-200/50">
                  {data.completion_note || "Technician marked as complete without additional notes."}
                </p>
             </div>
          )}
        </div>

        {/* RIGHT COLUMN: ASSIGNEE & METRICS */}
        <div className="space-y-6">
          
          {/* Technician Card */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <HardHat size={16}/> Assigned Specialist
            </h3>
            
            {data.assignee ? (
              <div className="space-y-6">
                <div className="flex items-center gap-4">
                  <div className="w-16 h-16 rounded-1.5rem bg-[#003366] text-white flex items-center justify-center text-2xl font-black shadow-lg shadow-blue-900/20">
                    {data.assignee.fname?.[0]}{data.assignee.lname?.[0]}
                  </div>
                  <div>
                    <p className="text-lg font-black text-slate-900 leading-tight">
                      {data.assignee.fname} {data.assignee.lname}
                    </p>
                    <p className="text-[10px] font-bold text-blue-500 uppercase tracking-widest">Field Technician</p>
                  </div>
                </div>

                <div className="space-y-2">
                  <a href={`tel:${data.assignee.phone}`} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 text-slate-600 hover:bg-blue-50 transition-all">
                    <div className="p-2 bg-white rounded-xl shadow-sm"><Phone size={14} className="text-blue-500" /></div>
                    <span className="text-xs font-bold">{data.assignee.phone || "No phone linked"}</span>
                  </a>
                  <a href={`mailto:${data.assignee.email}`} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 text-slate-600 hover:bg-blue-50 transition-all truncate">
                    <div className="p-2 bg-white rounded-xl shadow-sm"><Mail size={14} className="text-blue-500" /></div>
                    <span className="text-xs font-bold truncate">{data.assignee.email || "No email linked"}</span>
                  </a>
                </div>
              </div>
            ) : (
              <div className="text-center py-6">
                <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-3 text-slate-300">
                  <AlertCircle size={24}/>
                </div>
                <p className="text-xs font-bold text-slate-400 uppercase">Unassigned Work Order</p>
              </div>
            )}
          </div>

          {/* Timeline / Dates */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <Calendar size={16}/> Schedule
            </h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase">Due Date</span>
                <span className="text-sm font-bold text-slate-700">{data.request?.due_date ? new Date(data.request.due_date).toLocaleDateString() : "Not Set"}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-[10px] font-black text-slate-400 uppercase">Expected Category</span>
                <span className="text-sm font-bold text-slate-700">{data.request?.category?.name || "General"}</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
