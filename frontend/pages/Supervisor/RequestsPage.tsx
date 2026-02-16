"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { apiRequest } from "@/lib/api";
import { ListSkeleton } from "@/components/PageSkeleton";
import RequestDetailPage from "./RequestDetailPage";
import { 
  CheckCircle, XCircle, ChevronRight, 
  Clock, AlertTriangle, Hash, X, UserCheck
} from "lucide-react";

type RequestItem = { 
  id: number; 
  title: string; 
  status: string; 
  priority: string; 
  created_at: string;
};

export default function SupervisorRequestsPage() {
  const params = useSearchParams();
  const router = useRouter();
  const [items, setItems] = useState<RequestItem[]>([]);
  const [loading, setLoading] = useState(true);

  const activeStatus = params?.get("status") || "all";
  const selectedRequestRaw = params?.get("request");
  const selectedRequestId = selectedRequestRaw ? Number(selectedRequestRaw) : NaN;
  const hasOpenRequestModal = Number.isFinite(selectedRequestId) && selectedRequestId > 0;

  const setRequestModal = (requestId: number | null) => {
    const nextParams = new URLSearchParams(params?.toString() ?? "");
    if (requestId === null) {
      nextParams.delete("request");
    } else {
      nextParams.set("request", String(requestId));
    }

    const query = nextParams.toString();
    router.push(`/supervisor/requests${query ? `?${query}` : ""}`);
  };

  const load = useCallback(async () => {
    setLoading(true);
    const status = params?.get("status");
    const suffix = status && status !== "all" ? `?status=${encodeURIComponent(status)}` : "";
    const data = await apiRequest<{ success: boolean; requests: { data: RequestItem[] } }>(
      `/api/supervisor/requests${suffix}`, 
      { method: "GET" }, 
      true
    );
    setItems(data.requests.data ?? []);
    setLoading(false);
  }, [params]);

  useEffect(() => {
    const run = async () => {
      await load();
    };
    void run();
  }, [load]);

  const review = async (id: number, action: "approve" | "reject") => {
    await apiRequest(`/api/supervisor/requests/${id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }, true);
    load();
  };

  const statusFilters = [
    { label: "All Requests", value: "all" },
    { label: "Pending Review", value: "submitted" },
    { label: "Approved", value: "approved" },
    { label: "Rejected", value: "rejected" },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Request Review</h1>
          <p className="text-sm text-slate-500 font-medium">Verify and approve incoming facility maintenance requests</p>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="flex bg-slate-100 p-1 rounded-2xl w-fit">
        {statusFilters.map((f) => (
          <button
            key={f.value}
            onClick={() => router.push(`/supervisor/requests${f.value === 'all' ? '' : `?status=${f.value}`}`)}
            className={`px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest transition-all ${
              activeStatus === f.value ? "bg-white text-[#003366] shadow-sm" : "text-slate-500 hover:text-slate-700"
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <ListSkeleton rows={5} />
      ) : (
        <div className="grid gap-3">
          {items.map((r) => (
            <div key={r.id} className="group bg-white border border-slate-100 rounded-3xl p-5 flex flex-col md:flex-row justify-between items-start md:items-center gap-4 hover:shadow-xl hover:shadow-slate-200/50 transition-all duration-300">
              <div className="flex gap-4 items-start">
                <div className={`mt-1 p-2 rounded-xl ${
                    r.priority === 'urgent' ? 'bg-rose-50 text-rose-600' : 'bg-blue-50 text-blue-600'
                }`}>
                    {r.priority === 'urgent' ? <AlertTriangle size={20} /> : <Clock size={20} />}
                </div>
                <div>
                  <button
                    type="button"
                    onClick={() => setRequestModal(r.id)}
                    className="font-black text-slate-900 text-lg hover:text-blue-700 transition-colors block text-left"
                  >
                    {r.title}
                  </button>
                  <div className="flex flex-wrap gap-2 mt-1 items-center">
                    <span className="flex items-center gap-1 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        <Hash size={10} /> {r.id}
                    </span>
                    <span className="h-1 w-1 bg-slate-200 rounded-full" />
                    <span className={`text-[10px] font-black uppercase tracking-widest ${
                        r.status === 'submitted' ? 'text-amber-600' : 'text-emerald-600'
                    }`}>
                        {r.status}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="flex items-center gap-2 w-full md:w-auto">
                {r.status === "submitted" && (
                  <div className="flex gap-2 w-full md:w-auto">
                    <button 
                      onClick={() => review(r.id, "approve")} 
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white rounded-xl text-xs font-black transition-all"
                    >
                      <CheckCircle size={14} /> APPROVE
                    </button>
                    <button 
                      onClick={() => review(r.id, "reject")} 
                      className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-rose-50 text-rose-700 hover:bg-rose-600 hover:text-white rounded-xl text-xs font-black transition-all"
                    >
                      <XCircle size={14} /> REJECT
                    </button>
                  </div>
                )}
                {r.status === "approved" && (
                  <button
                    type="button"
                    onClick={() => setRequestModal(r.id)}
                    className="flex-1 md:flex-none flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-50 text-blue-700 hover:bg-blue-600 hover:text-white rounded-xl text-xs font-black transition-all"
                  >
                    <UserCheck size={14} /> ASSIGN
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setRequestModal(r.id)}
                  className="p-2.5 bg-slate-50 text-slate-400 rounded-xl hover:bg-slate-900 hover:text-white transition-all"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            </div>
          ))}
          {items.length === 0 && (
            <div className="text-center py-20 bg-slate-50 rounded-[3rem] border-2 border-dashed border-slate-200">
                <p className="text-slate-400 font-bold uppercase tracking-widest text-xs">No requests found in this category</p>
            </div>
          )}
        </div>
      )}

      {hasOpenRequestModal && (
        <div className="fixed inset-0 z-[1200] bg-slate-900/70 backdrop-blur-sm p-2 md:p-4">
          <div className="relative mx-auto h-[94vh] md:h-[94vh] w-full max-w-6xl rounded-[2rem] bg-white shadow-2xl overflow-hidden">
            <button
              type="button"
              onClick={() => setRequestModal(null)}
              className="absolute top-4 right-4 z-20 p-2 rounded-xl bg-slate-100 text-slate-600 hover:bg-slate-900 hover:text-white transition-colors"
              aria-label="Close request details"
            >
              <X size={18} />
            </button>
            <div className="h-full overflow-y-auto p-4 md:p-6 pt-16">
              <RequestDetailPage id={String(selectedRequestId)} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
