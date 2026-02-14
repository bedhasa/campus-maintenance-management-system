"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

type Log = { id: number; module: string; action: string; description: string; created_at: string; user?: { fname: string; lname: string } };

export default function SystemLogsPage() {
  const [logs, setLogs] = useState<Log[]>([]);

  useEffect(() => {
    const run = async () => {
      const data = await apiRequest<{ success: boolean; logs: { data: Log[] } }>("/api/admin/system-logs", { method: "GET" }, true);
      setLogs(data.logs.data ?? []);
    };
    void run();
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-900">System Activity Logs</h1>
      <div className="space-y-3">
        {logs.map((l) => (
          <div key={l.id} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="text-sm font-bold">{l.module} - {l.action}</p>
            <p className="text-xs text-slate-500">{l.description}</p>
            <p className="text-xs text-slate-400 mt-1">{new Date(l.created_at).toLocaleString()}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

