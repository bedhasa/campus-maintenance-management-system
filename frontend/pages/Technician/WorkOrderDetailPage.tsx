"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api";

interface Props {
  id: string;
}

export default function WorkOrderDetailPage({ id }: Props) {
  const [note, setNote] = useState("");
  const [delayReason, setDelayReason] = useState("");
  const [msg, setMsg] = useState<string | null>(null);

  const start = async () => {
    await apiRequest(`/api/technician/work-orders/${id}/start`, { method: "PATCH" }, true);
    setMsg("Work started.");
  };

  const complete = async () => {
    await apiRequest(`/api/technician/work-orders/${id}/complete`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ completion_note: note, delay_reason: delayReason || null }),
    }, true);
    setMsg("Work completed.");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-900">Work Order #{id}</h1>
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-3 max-w-xl">
        <button onClick={start} className="px-3 py-2 bg-blue-700 text-white rounded-lg text-xs font-bold">Start Work</button>
        <textarea value={note} onChange={(e) => setNote(e.target.value)} className="w-full border rounded-lg p-2 min-h-24" placeholder="Completion note" />
        <textarea value={delayReason} onChange={(e) => setDelayReason(e.target.value)} className="w-full border rounded-lg p-2 min-h-20" placeholder="Delay reason (required if overdue)" />
        <button onClick={complete} className="px-3 py-2 bg-emerald-700 text-white rounded-lg text-xs font-bold">Mark Completed</button>
        {msg && <p className="text-sm text-emerald-700 font-semibold">{msg}</p>}
      </div>
    </div>
  );
}

