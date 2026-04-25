"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";
import { 
  Phone, Mail, Star, CheckCircle2, AlertCircle, 
  Clock, Award, Briefcase, History, ChevronLeft,
  ShieldCheck, TrendingUp
} from "lucide-react";
import Link from "next/link";

interface Props { id: string; }

type TechProfile = {
  success: boolean;
  technician: {
    id: number; fname: string; lname: string; phone: string; email: string;
    avg_rating: number; total_ratings: number; active_jobs: number;
    completed_jobs: number; overdue_jobs: number; completion_rate: number;
    specialties: Array<{ id: number; name: string }>;
    history: Array<{ id: number; work_status: string; completed_at?: string | null; request?: { title?: string } }>;
  };
};

export default function TechnicianProfilePage({ id }: Props) {
  const [data, setData] = useState<TechProfile["technician"] | null>(null);

  useEffect(() => {
    const run = async () => {
      const res = await apiRequest<TechProfile>(`/api/supervisor/technicians/${id}`, { method: "GET" }, true);
      setData(res.technician);
    };
    void run();
  }, [id]);

  if (!data) return <PageSkeleton cards={2} rows={5} />;

  return (
    <div className="max-w-6xl mx-auto space-y-8 pb-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
      
      {/* HEADER & BACK NAV */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div className="space-y-1">
          <Link href="/supervisor/technicians" className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 hover:text-[#003366] transition-colors mb-2">
            <ChevronLeft size={14} /> Personnel Directory
          </Link>
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">
            {data.fname} {data.lname}
          </h1>
          <div className="flex flex-wrap gap-2">
            {data.specialties.map((s) => (
              <span key={s.id} className="px-3 py-1 bg-blue-50 text-[#003366] rounded-full text-[10px] font-black uppercase tracking-wider border border-blue-100">
                {s.name}
              </span>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-3 p-4 bg-white rounded-2rem border border-slate-100 shadow-sm">
           <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Trust Score</p>
              <div className="flex items-center gap-1.5 justify-end">
                <Star size={16} className="fill-amber-400 text-amber-400" />
                <span className="text-xl font-black text-slate-900">{Number(data.avg_rating ?? 0).toFixed(1)}</span>
              </div>
           </div>
           <div className="w-1px h-10 bg-slate-100 mx-2" />
           <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center">
              <Award size={24} />
           </div>
        </div>
      </div>

      {/* KPI GRID */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {[
          { label: "Active", value: data.active_jobs, icon: Briefcase, color: "text-blue-600", bg: "bg-blue-50" },
          { label: "Completed", value: data.completed_jobs, icon: CheckCircle2, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Overdue", value: data.overdue_jobs, icon: AlertCircle, color: "text-rose-600", bg: "bg-rose-50" },
          { label: "Completion", value: `${data.completion_rate}%`, icon: TrendingUp, color: "text-[#003366]", bg: "bg-slate-50" },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-2rem border border-slate-100 shadow-sm hover:shadow-md transition-shadow">
            <div className={`w-10 h-10 ${stat.bg} ${stat.color} rounded-xl flex items-center justify-center mb-4`}>
              <stat.icon size={20} />
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">{stat.label}</p>
            <p className={`text-2xl font-black ${stat.color} mt-1`}>{stat.value}</p>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        
        {/* CONTACT & BIO */}
        <div className="space-y-6">
          <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <ShieldCheck size={16}/> Verified Credentials
            </h3>
            <div className="space-y-4">
              <div className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100 flex items-center gap-4 hover:bg-blue-50 transition-colors group">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm group-hover:scale-110 transition-transform">
                  <Phone size={18} />
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase">Direct Line</p>
                  <p className="text-sm font-bold text-slate-700">{data.phone || "Unlisted"}</p>
                </div>
              </div>
              <div className="p-4 rounded-2xl bg-slate-50/50 border border-slate-100 flex items-center gap-4 hover:bg-blue-50 transition-colors group">
                <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-500 shadow-sm group-hover:scale-110 transition-transform">
                  <Mail size={18} />
                </div>
                <div>
                  <p className="text-[9px] font-black text-slate-400 uppercase">Official Email</p>
                  <p className="text-sm font-bold text-slate-700 truncate">{data.email || "Unlisted"}</p>
                </div>
              </div>
            </div>

            <div className="mt-8 pt-8 border-t border-slate-50">
               <div className="flex justify-between items-end mb-2">
                 <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Efficiency Goal</p>
                 <span className="text-xs font-black text-[#003366]">{data.completion_rate}%</span>
               </div>
               <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden">
                  <div 
                    className="h-full bg-[#003366] transition-all duration-1000" 
                    style={{ width: `${data.completion_rate}%` }}
                  />
               </div>
               <p className="text-[9px] text-slate-400 mt-2 font-medium italic">Measured by on-time completion vs scheduled tasks.</p>
            </div>
          </div>
        </div>

        {/* WORK HISTORY LOG */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm min-h-full">
            <div className="flex items-center justify-between mb-8">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 flex items-center gap-2">
                <History size={16}/> Assignment Archive
              </h3>
              <span className="text-[10px] font-black text-slate-300 uppercase">{data.history.length} Total Records</span>
            </div>

            <div className="space-y-4">
              {data.history.map((h) => (
                <div key={h.id} className="group flex items-center justify-between p-5 rounded-3xl border border-slate-50 bg-slate-50/20 hover:bg-white hover:border-blue-100 hover:shadow-lg hover:shadow-blue-900/5 transition-all duration-300">
                  <div className="flex items-center gap-4">
                    <div className={`w-10 h-10 rounded-xl flex items-center justify-center ${h.work_status === 'completed' ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                      {h.work_status === 'completed' ? <CheckCircle2 size={18} /> : <Clock size={18} />}
                    </div>
                    <div>
                      <p className="text-sm font-black text-slate-800 group-hover:text-[#003366] transition-colors">
                        {h.request?.title ?? `Work Order #${h.id}`}
                      </p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                        WO-{h.id} • {h.completed_at ? new Date(h.completed_at).toLocaleDateString() : "In Progress"}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className={`px-3 py-1 rounded-lg text-[9px] font-black uppercase tracking-tighter border ${
                      h.work_status === 'completed' 
                        ? 'bg-emerald-50 text-emerald-600 border-emerald-100' 
                        : 'bg-amber-50 text-amber-600 border-amber-100'
                    }`}>
                      {h.work_status}
                    </span>
                  </div>
                </div>
              ))}

              {data.history.length === 0 && (
                <div className="py-20 text-center">
                  <History size={40} className="mx-auto text-slate-100 mb-4" strokeWidth={1}/>
                  <p className="text-sm font-black text-slate-300 uppercase tracking-widest">No service history found</p>
                </div>
              )}
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}