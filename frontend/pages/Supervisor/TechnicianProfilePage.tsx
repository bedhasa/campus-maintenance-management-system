"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";

interface Props {
  id: string;
}

type TechProfile = {
  success: boolean;
  technician: {
    id: number;
    fname: string;
    lname: string;
    phone: string;
    email: string;
    avg_rating: number;
    total_ratings: number;
    active_jobs: number;
    completed_jobs: number;
    overdue_jobs: number;
    completion_rate: number;
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
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-900">{data.fname} {data.lname}</h1>
      <div className="grid md:grid-cols-2 gap-4 text-sm">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p><span className="font-black">Phone:</span> {data.phone || "-"}</p>
          <p><span className="font-black">Email:</span> {data.email || "-"}</p>
          <p><span className="font-black">Specialties:</span> {data.specialties.map((s) => s.name).join(", ") || "-"}</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p><span className="font-black">Rating:</span> {Number(data.avg_rating ?? 0).toFixed(2)} ({data.total_ratings})</p>
          <p><span className="font-black">Active Jobs:</span> {data.active_jobs}</p>
          <p><span className="font-black">Completed Jobs:</span> {data.completed_jobs}</p>
          <p><span className="font-black">Overdue:</span> {data.overdue_jobs}</p>
          <p><span className="font-black">Completion Rate:</span> {data.completion_rate}%</p>
        </div>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="font-black text-sm mb-3">History</p>
        <div className="space-y-2 text-sm">
          {data.history.map((h) => (
            <div key={h.id} className="rounded-lg border border-slate-100 p-3">
              <p className="font-bold">{h.request?.title ?? `Work Order #${h.id}`}</p>
              <p className="text-xs text-slate-600 uppercase">{h.work_status}</p>
            </div>
          ))}
          {data.history.length === 0 && <p className="text-sm text-slate-500">No history.</p>}
        </div>
      </div>
    </div>
  );
}
