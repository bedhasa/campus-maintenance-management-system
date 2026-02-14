"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";

type RequestItem = { id: number; title: string; status: string; priority: string; due_date?: string | null };

export default function SupervisorRequestsPage() {
  const params = useSearchParams();
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const status = params.get("status");
    const suffix = status ? `?status=${encodeURIComponent(status)}` : "";
    const data = await apiRequest<{ success: boolean; requests: { data: RequestItem[] } }>(`/api/supervisor/requests${suffix}`, { method: "GET" }, true);
    setItems(data.requests.data ?? []);
    setLoading(false);
  };

  useEffect(() => {
    let ignore = false;
    (async () => {
      setLoading(true);
      const data = await apiRequest<{ success: boolean; requests: { data: RequestItem[] } }>("/api/supervisor/requests", { method: "GET" }, true);
      if (!ignore) {
        setItems(data.requests.data ?? []);
        setLoading(false);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [params]);

  const review = async (id: number, action: "approve" | "reject") => {
    await apiRequest(`/api/supervisor/requests/${id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }, true);
    await load();
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-900">Request Review</h1>
      {loading ? <p className="text-sm text-slate-500">Loading requests...</p> : (
        <div className="space-y-3">
          {items.map((r) => (
            <div key={r.id} className="bg-white border border-slate-200 rounded-xl p-4 flex justify-between items-center gap-4">
              <div>
                <Link href={`/supervisor/requests/${r.id}`} className="font-bold text-slate-900 hover:text-blue-700">
                  {r.title}
                </Link>
                <p className="text-xs text-slate-500">#{r.id} - {r.status} - {r.priority}</p>
              </div>
              <div className="flex gap-2">
                <button onClick={() => review(r.id, "approve")} className="px-3 py-2 bg-emerald-600 text-white rounded-lg text-xs font-bold">Approve</button>
                <button onClick={() => review(r.id, "reject")} className="px-3 py-2 bg-rose-600 text-white rounded-lg text-xs font-bold">Reject</button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
