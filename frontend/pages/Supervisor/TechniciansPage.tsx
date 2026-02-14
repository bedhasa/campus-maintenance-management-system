"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { apiRequest } from "@/lib/api";
import { Search, Star, Phone, Mail } from "lucide-react";

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

  useEffect(() => {
    const run = async () => {
      const data = await apiRequest<{ success: boolean; categories: Category[] }>("/api/requester/meta/categories", { method: "GET" }, true);
      setCategories(data.categories ?? []);

      const techData = await apiRequest<{ success: boolean; technicians: Technician[] }>("/api/pm/technicians", { method: "GET" }, true);
      setTechs(techData.technicians ?? []);
    };
    void run();
  }, []);

  const loadTechs = async () => {
    if (!categoryId) {
      const all = await apiRequest<{ success: boolean; technicians: Technician[] }>("/api/pm/technicians", { method: "GET" }, true);
      setTechs(all.technicians ?? []);
      return;
    }
    const filtered = await apiRequest<{ success: boolean; technicians: Technician[] }>(`/api/supervisor/technicians/by-category?category_id=${categoryId}`, { method: "GET" }, true);
    setTechs(filtered.technicians ?? []);
  };

  const filteredTechs = techs.filter((t) => {
    const haystack = [
      `${t.fname} ${t.lname}`,
      t.email ?? "",
      ...(t.specialties ?? []).map((s) => s.name),
    ].join(" ").toLowerCase();
    return haystack.includes(searchTerm.trim().toLowerCase());
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-900">Technicians</h1>
      <div className="flex flex-col md:flex-row gap-2">
        <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)} className="border rounded-lg p-2 text-sm">
          <option value="">All Categories</option>
          {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button onClick={loadTechs} className="px-4 py-2 bg-[#003366] text-white rounded-lg text-xs font-bold">Filter Technicians</button>
        <div className="relative md:ml-auto w-full md:w-80">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Search technician..."
            className="w-full pl-9 pr-3 py-2 rounded-lg border border-slate-200 text-sm font-semibold outline-none"
          />
        </div>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {filteredTechs.map((t) => (
          <Link key={t.id} href={`/supervisor/technicians/${t.id}`} className="block bg-white border border-slate-200 rounded-xl p-4 space-y-2 hover:bg-slate-50">
            {(() => {
              const rating = Number(t.avg_rating ?? 0);
              const ratingsCount = Number(t.total_ratings ?? 0);
              const workload = Number(t.open_workload ?? 0);
              return (
                <>
            <p className="font-bold text-slate-900">{t.fname} {t.lname}</p>
            <p className="text-xs text-slate-600 flex items-center gap-2"><Phone size={13} /> {t.phone ?? "-"}</p>
            <p className="text-xs text-slate-600 flex items-center gap-2"><Mail size={13} /> {t.email ?? "-"}</p>
            <p className="text-xs text-slate-600 flex items-center gap-2">
              <Star size={13} className="text-amber-500" />
              {(Number.isFinite(rating) ? rating : 0).toFixed(2)} ({Number.isFinite(ratingsCount) ? ratingsCount : 0} ratings)
            </p>
            <p className="text-xs font-bold text-slate-700">Open Workload: {Number.isFinite(workload) ? workload : 0}</p>
            <p className="text-xs text-slate-500">
              {t.specialties?.length ? t.specialties.map((s) => s.name).join(", ") : "No specialty assigned"}
            </p>
                </>
              );
            })()}
          </Link>
        ))}
      </div>
      {filteredTechs.length === 0 && <p className="text-sm text-slate-500 font-semibold">No technicians found.</p>}
    </div>
  );
}
