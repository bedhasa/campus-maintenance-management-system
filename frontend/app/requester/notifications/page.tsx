"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

type NotificationItem = {
  id: number;
  type: string;
  message: string;
  is_read: boolean;
  created_at: string;
};

type NotificationResponse = {
  success: boolean;
  notifications: {
    data: NotificationItem[];
  };
};

export default function RoutePage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<NotificationResponse>("/api/requester/notifications", { method: "GET" }, true);
      setItems(data.notifications?.data ?? []);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Failed to load notifications.";
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const markRead = async (id: number) => {
    try {
      await apiRequest(`/api/requester/notifications/${id}/read`, { method: "PATCH" }, true);
      setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
    } catch {
      // ignore
    }
  };

  const markAllRead = async () => {
    try {
      await apiRequest("/api/requester/notifications/read-all", { method: "POST" }, true);
      setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6 pb-20">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-gray-900 leading-none">Notifications</h1>
        <button
          onClick={markAllRead}
          className="px-4 py-2 rounded-xl bg-blue-50 text-blue-700 text-xs font-black uppercase tracking-widest"
        >
          Mark All Read
        </button>
      </div>

      {loading && <p className="text-sm font-medium text-gray-500">Loading notifications...</p>}
      {error && <p className="text-sm font-bold text-red-600">{error}</p>}

      {!loading && !error && (
        <div className="space-y-3">
          {items.map((item) => (
            <button
              key={item.id}
              onClick={() => markRead(item.id)}
              className={`w-full text-left p-4 rounded-2xl border transition-all ${
                item.is_read ? "bg-white border-gray-100 text-gray-600" : "bg-blue-50 border-blue-100 text-blue-900"
              }`}
            >
              <p className="text-[10px] font-black uppercase tracking-widest opacity-70">{item.type}</p>
              <p className="text-sm font-bold mt-1">{item.message}</p>
              <p className="text-xs mt-1 opacity-70">{new Date(item.created_at).toLocaleString()}</p>
            </button>
          ))}
          {items.length === 0 && <p className="text-sm font-medium text-gray-500">No notifications yet.</p>}
        </div>
      )}
    </div>
  );
}
