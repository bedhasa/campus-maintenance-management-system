"use client";

import { useState } from "react";
import { apiRequest } from "@/lib/api";

export default function ManualWorkOrderPage() {
  const [priority, setPriority] = useState("medium");
  const [assignedTo, setAssignedTo] = useState("");
  const [estimatedHours, setEstimatedHours] = useState("2");
  const [message, setMessage] = useState<string | null>(null);

  const submit = async (release: boolean) => {
    await apiRequest("/api/supervisor/work-orders/manual", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        priority,
        assigned_to: assignedTo ? Number(assignedTo) : null,
        estimated_hours: Number(estimatedHours),
        release,
      }),
    }, true);
    setMessage(release ? "Manual work order released." : "Manual work order saved as draft.");
  };

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-900">Manual Work Order</h1>
      <div className="bg-white border border-slate-200 rounded-xl p-6 space-y-4 max-w-xl">
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-bold">Priority</span>
          <select value={priority} onChange={(e) => setPriority(e.target.value)} className="border rounded-lg p-2">
            <option value="low">Low</option>
            <option value="medium">Medium</option>
            <option value="high">High</option>
            <option value="urgent">Urgent</option>
          </select>
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-bold">Assigned Technician ID</span>
          <input value={assignedTo} onChange={(e) => setAssignedTo(e.target.value)} className="border rounded-lg p-2" />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          <span className="font-bold">Estimated Hours</span>
          <input value={estimatedHours} onChange={(e) => setEstimatedHours(e.target.value)} className="border rounded-lg p-2" />
        </label>
        <div className="flex gap-2">
          <button onClick={() => submit(false)} className="px-4 py-2 bg-slate-200 text-slate-900 rounded-lg text-xs font-bold">Save Draft</button>
          <button onClick={() => submit(true)} className="px-4 py-2 bg-[#003366] text-white rounded-lg text-xs font-bold">Release</button>
        </div>
        {message && <p className="text-sm text-emerald-700 font-semibold">{message}</p>}
      </div>
    </div>
  );
}

