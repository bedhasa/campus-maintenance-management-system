"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { 
  Search, Star, Phone, Mail, HardHat, 
  Briefcase, Filter, UserCheck, Award, 
  ChevronRight, Activity
} from "lucide-react";

type Category = { id: number; name: string };
type Technician = {
  id: number;
  fname: string;
  lname: string;
  phone?: string;
  email?: string;
  avg_rating?: number;
  total_ratings?: number;
  open_workload: number;
  specialties?: Array<{ id: number; name: string; category_id?: number }>;
};

export default function TechniciansPage() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoryId, setCategoryId] = useState<string>("");
  const [searchTerm, setSearchTerm] = useState("");
  const [techs, setTechs] = useState<Technician[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      try {
        const [catData, techData] = await Promise.all([
          apiRequest<{ success: boolean; categories: Category[] }>("/api/requester/meta/categories", { method: "GET" }, true),
          apiRequest<{ success: boolean; technicians: Technician[] }>("/api/pm/technicians", { method: "GET" }, true)
        ]);
        setCategories(catData.categories ?? []);
        setTechs(techData.technicians ?? []);
      } catch (err) {
        console.error("Initialization failed", err);
      } finally {
        setIsLoading(false);
      }
    };
    void run();
  }, []);

  const loadTechs = async () => {
    setIsLoading(true);
    try {
      // Use one stable endpoint, then filter by specialty category on the client.
      const data = await apiRequest<{ success: boolean; technicians: Technician[] }>(
        "/api/pm/technicians",
        { method: "GET" },
        true
      );

      const allTechs = data.technicians ?? [];
      if (!categoryId) {
        setTechs(allTechs);
      } else {
        const targetCategoryId = Number(categoryId);
        setTechs(
          allTechs.filter((t) =>
            (t.specialties ?? []).some((s) => Number(s.category_id) === targetCategoryId)
          )
        );
      }
    } catch (err) {
      console.error("Technician filtering failed", err);
      setTechs([]);
    } finally {
      setIsLoading(false);
    }
  };

  const filteredTechs = useMemo(() => {
    return techs.filter((t) => {
      const haystack = [
        `${t.fname} ${t.lname}`,
        t.email ?? "",
        ...(t.specialties ?? []).map((s) => s.name),
      ].join(" ").toLowerCase();
      return haystack.includes(searchTerm.trim().toLowerCase());
    });
  }, [techs, searchTerm]);

  return (
    <div className="max-w-7xl mx-auto space-y-8 pb-12 animate-in fade-in duration-500">
      
      {/* HEADER SECTION */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
        <div className="space-y-1">
          <h1 className="text-4xl font-black text-slate-900 tracking-tight">Technicians</h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest flex items-center gap-2">
            <UserCheck size={16} className="text-blue-500" /> Personnel & Resource Management
          </p>
        </div>

        <div className="bg-white p-2 rounded-1.5rem border border-slate-100 shadow-sm flex items-center gap-2">
           <div className="px-4 py-2 bg-slate-50 rounded-xl">
              <p className="text-[10px] font-black text-slate-400 uppercase leading-none">Total Staff</p>
              <p className="text-lg font-black text-[#003366]">{techs.length}</p>
           </div>
           <div className="px-4 py-2 bg-blue-50 rounded-xl">
              <p className="text-[10px] font-black text-blue-400 uppercase leading-none">Specialties</p>
              <p className="text-lg font-black text-blue-600">{categories.length}</p>
           </div>
        </div>
      </div>

      {/* SEARCH & FILTER BAR */}
      <div className="bg-white rounded-2rem border border-slate-100 p-4 shadow-sm flex flex-wrap items-center gap-4">
        <div className="flex items-center gap-3 bg-slate-50 p-1.5 rounded-2xl border border-slate-100">
          <Filter size={16} className="ml-3 text-slate-400"/>
          <select 
            value={categoryId} 
            onChange={(e) => setCategoryId(e.target.value)} 
            className="bg-transparent border-none text-xs font-black uppercase tracking-wider text-slate-700 focus:ring-0 outline-none pr-8"
          >
            <option value="">All Disciplines</option>
            {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <button 
            onClick={loadTechs} 
            className="px-6 py-2 bg-[#003366] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:opacity-90 transition-all active:scale-95 shadow-lg shadow-blue-900/20"
          >
            Apply
          </button>
        </div>

        <div className="flex-1 min-w-280px relative group">
          <Search size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-[#003366] transition-colors" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search by name, email, or skill..."
            className="w-full pl-12 pr-4 py-3 bg-slate-50 border-none rounded-2xl text-sm font-semibold text-slate-900 caret-slate-900 placeholder:text-slate-400 focus:ring-2 focus:ring-[#003366]/5 outline-none transition-all"
          />
        </div>
      </div>

      {/* TECHNICIAN GRID */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
        {filteredTechs.map((t) => {
          const rating = Number(t.avg_rating ?? 0);
          const workload = Number(t.open_workload ?? 0);
          const workloadColor = workload > 5 ? "text-rose-500" : workload > 2 ? "text-amber-500" : "text-emerald-500";
          
          return (
            <Link 
              key={t.id} 
              href={`/supervisor/technicians/${t.id}`} 
              className="group relative bg-white border border-slate-100 rounded-[2.5rem] p-6 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all duration-300 overflow-hidden"
            >
              {/* Background Accent */}
              <div className="absolute top-0 right-0 w-32 h-32 bg-slate-50 rounded-full -mr-16 -mt-16 group-hover:bg-blue-50 transition-colors" />

              <div className="relative space-y-6">
                {/* Profile Header */}
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-xl font-black text-[#003366] group-hover:bg-[#003366] group-hover:text-white transition-all duration-300">
                      {t.fname[0]}{t.lname[0]}
                    </div>
                    <div>
                      <h3 className="text-lg font-black text-slate-900 group-hover:text-[#003366] transition-colors">
                        {t.fname} {t.lname}
                      </h3>
                      <div className="flex items-center gap-1.5 mt-1">
                        <Star size={12} className="fill-amber-400 text-amber-400" />
                        <span className="text-xs font-black text-slate-700">{rating.toFixed(1)}</span>
                        <span className="text-[10px] font-bold text-slate-400 uppercase">({t.total_ratings || 0} reviews)</span>
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={20} className="text-slate-300 group-hover:text-[#003366] transition-all transform group-hover:translate-x-1" />
                </div>

                {/* Info Pills */}
                <div className="space-y-2">
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-50 group-hover:border-blue-100 transition-all">
                    <Phone size={14} className="text-blue-500" />
                    <span className="text-xs font-bold text-slate-600">{t.phone ?? "No Phone Listed"}</span>
                  </div>
                  <div className="flex items-center gap-3 p-2.5 rounded-xl bg-slate-50 border border-slate-100 group-hover:border-blue-100 transition-all">
                    <Mail size={14} className="text-blue-500" />
                    <span className="text-xs font-bold text-slate-600 truncate">{t.email ?? "No Email"}</span>
                  </div>
                </div>

                {/* Workload Indicator */}
                <div className="pt-4 border-t border-slate-50">
                   <div className="flex justify-between items-end mb-2">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Active Workload</p>
                      <p className={`text-sm font-black ${workloadColor}`}>{workload} Tasks</p>
                   </div>
                   <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                      <div 
                        className={`h-full rounded-full transition-all duration-500 ${workload > 5 ? 'bg-rose-500' : 'bg-[#003366]'}`}
                        style={{ width: `${Math.min((workload / 8) * 100, 100)}%` }}
                      />
                   </div>
                </div>

                {/* Specialties Tags */}
                <div className="flex flex-wrap gap-2">
                  {t.specialties?.length ? (
                    t.specialties.slice(0, 3).map((s) => (
                      <span key={s.id} className="px-3 py-1 bg-blue-50 text-blue-600 rounded-lg text-[9px] font-black uppercase tracking-wider">
                        {s.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-[10px] font-bold text-slate-400 italic">No Specialties</span>
                  )}
                  {(t.specialties?.length ?? 0) > 3 && (
                    <span className="text-[9px] font-black text-slate-300">+{t.specialties!.length - 3} MORE</span>
                  )}
                </div>
              </div>
            </Link>
          );
        })}
      </div>

      {/* EMPTY STATE */}
      {filteredTechs.length === 0 && !isLoading && (
        <div className="py-20 text-center space-y-4 bg-white rounded-[2.5rem] border border-dashed border-slate-200">
          <div className="w-20 h-20 bg-slate-50 rounded-full flex items-center justify-center mx-auto">
            <HardHat size={32} className="text-slate-200" />
          </div>
          <p className="text-sm font-black text-slate-400 uppercase tracking-widest">No technicians match your search</p>
        </div>
      )}

      {/* LOADING STATE */}
      {isLoading && (
        <div className="flex flex-col items-center justify-center py-20 gap-4">
           <div className="w-10 h-10 border-4 border-slate-100 border-t-[#003366] rounded-full animate-spin" />
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Accessing Resource Database...</p>
        </div>
      )}
    </div>
  );
}
