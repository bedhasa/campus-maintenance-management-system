"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";

interface Props {
  id: string;
}

type WorkOrderDetail = {
  id: number;
  priority: string;
  work_status: string;
  completion_note?: string | null;
  delay_reason?: string | null;
  assignee?: { fname?: string; lname?: string; phone?: string; email?: string };
  request?: { title?: string; description?: string; status?: string; due_date?: string | null; category?: { name?: string }; building?: { name?: string }; room?: { name?: string } };
};

export default function WorkOrderDetailPage({ id }: Props) {
  const params = useSearchParams();
  const delayRef = useRef<HTMLDivElement | null>(null);
  const [data, setData] = useState<WorkOrderDetail | null>(null);

  useEffect(() => {
    const run = async () => {
      const res = await apiRequest<{ success: boolean; work_order: WorkOrderDetail }>(`/api/supervisor/work-orders/${id}`, { method: "GET" }, true);
      setData(res.work_order);
    };
    void run();
  }, [id]);

  useEffect(() => {
    if (params.get("scroll") === "delay" && delayRef.current) {
      delayRef.current.scrollIntoView({ behavior: "smooth", block: "center" });
    }
  }, [params, data]);

  if (!data) return <PageSkeleton cards={2} rows={3} />;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-900">Work Order #{data.id}</h1>
      <div className="grid md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 p-4 bg-white">
          <p className="text-sm font-black">{data.request?.title ?? "Manual Work Order"}</p>
          <p className="text-xs text-slate-600 mt-2">{data.request?.description ?? "-"}</p>
        </div>
        <div className="rounded-xl border border-slate-200 p-4 bg-white text-sm">
          <p><span className="font-black">Technician:</span> {data.assignee ? `${data.assignee.fname} ${data.assignee.lname}` : "-"}</p>
          <p><span className="font-black">Status:</span> {data.work_status}</p>
          <p><span className="font-black">Priority:</span> {data.priority}</p>
        </div>
      </div>
      <div ref={delayRef} className="rounded-xl border border-red-200 p-4 bg-red-50 text-sm">
        <p className="font-black text-red-800">Delay Reason</p>
        <p className="text-red-700 mt-1">{data.delay_reason ?? "No delay reason submitted."}</p>
      </div>
    </div>
  );
}
