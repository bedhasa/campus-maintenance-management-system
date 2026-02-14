"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

type Notification = {
  id: number;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
};

export default function NotificationsPage() {
  const [items, setItems] = useState<Notification[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let ignore = false;
    (async () => {
      try {
        const data = await apiRequest<{ success: boolean; notifications: { data: Notification[] } }>("/api/me/notifications", { method: "GET" }, true);
        if (!ignore) {
          setItems(data.notifications.data ?? []);
        }
      } catch (err) {
        if (!ignore) {
          setError(err instanceof Error ? err.message : "Failed to load notifications.");
        }
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  const markRead = async (id: number) => {
    await apiRequest(`/api/me/notifications/${id}/read`, { method: "PATCH" }, true);
    setItems((prev) => prev.map((n) => (n.id === id ? { ...n, is_read: true } : n)));
  };

  if (error) return <p className="text-sm text-red-600 font-semibold">{error}</p>;

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-900">Notifications</h1>
      <div className="space-y-3">
        {items.map((n) => (
          <div key={n.id} className={`rounded-xl border p-4 ${n.is_read ? "bg-white border-slate-200" : "bg-blue-50 border-blue-200"}`}>
            <p className="text-sm font-bold text-slate-900">{n.message}</p>
            <p className="text-xs text-slate-500 mt-1">{new Date(n.created_at).toLocaleString()}</p>
            {!n.is_read && <button onClick={() => markRead(n.id)} className="mt-2 text-xs font-bold text-blue-700">Mark read</button>}
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-slate-500">No notifications.</p>}
      </div>
    </div>
  );
}
