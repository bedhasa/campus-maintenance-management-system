"use client";

import { useEffect, useMemo, useState } from "react";
import { BellRing, CheckCheck, Clock3, ShieldAlert } from "lucide-react";
import { apiRequest } from "@/lib/api";
import { ListSkeleton } from "@/components/PageSkeleton";

type NotificationItem = {
  id: number;
  message: string;
  type: string;
  is_read: boolean;
  created_at: string;
};

const formatUtcDateTime = (value: string) =>
  new Date(value).toLocaleString("en-GB", {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
  });

export default function TechnicianNotificationsPage() {
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiRequest<{ success: boolean; notifications: { data: NotificationItem[] } }>(
        "/api/me/notifications",
        { method: "GET" },
        true
      );
      setItems(data.notifications?.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load notifications.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
  }, []);

  const unreadCount = useMemo(() => items.filter((item) => !item.is_read).length, [items]);

  const markRead = async (id: number) => {
    await apiRequest(`/api/me/notifications/${id}/read`, { method: "PATCH" }, true);
    setItems((prev) => prev.map((item) => (item.id === id ? { ...item, is_read: true } : item)));
  };

  const markAllRead = async () => {
    await apiRequest("/api/me/notifications/read-all", { method: "POST" }, true);
    setItems((prev) => prev.map((item) => ({ ...item, is_read: true })));
  };

  return (
    <div className="space-y-6 pb-16">
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-black text-slate-900 leading-none">Notifications</h1>
          <p className="mt-2 text-sm font-medium italic text-slate-500">Stay on top of new assignments, supervisor messages, and system updates.</p>
        </div>
        <button
          type="button"
          onClick={() => void markAllRead()}
          disabled={unreadCount === 0}
          className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-xs font-black uppercase tracking-widest text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-40"
        >
          <CheckCheck size={16} />
          Mark All Read
        </button>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-50 text-blue-700">
            <BellRing size={22} />
          </div>
          <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Total Notifications</p>
          <p className="mt-1 text-3xl font-black text-slate-900">{items.length}</p>
        </div>
        <div className="rounded-[2rem] border border-slate-100 bg-white p-5 shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-700">
            <Clock3 size={22} />
          </div>
          <p className="mt-4 text-[10px] font-black uppercase tracking-widest text-slate-400">Unread</p>
          <p className="mt-1 text-3xl font-black text-slate-900">{unreadCount}</p>
        </div>
      </div>

      {error && (
        <div className="rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm font-bold text-rose-700">
          {error}
        </div>
      )}

      {loading ? (
        <ListSkeleton rows={5} />
      ) : items.length === 0 ? (
        <div className="rounded-[2rem] border-2 border-dashed border-slate-200 bg-white px-6 py-20 text-center">
          <p className="text-sm font-black uppercase tracking-widest text-slate-700">No notifications yet</p>
          <p className="mt-2 text-sm font-medium text-slate-500">Assignments and supervisor updates will appear here.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <article
              key={item.id}
              className={`rounded-[2rem] border p-5 shadow-sm ${item.is_read ? "border-slate-100 bg-white" : "border-blue-100 bg-blue-50/60"}`}
            >
              <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={`inline-flex items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-widest ${item.is_read ? "bg-slate-100 text-slate-600" : "bg-blue-100 text-blue-700"}`}>
                      {item.is_read ? "Read" : "Unread"}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] font-black uppercase tracking-widest text-slate-400">
                      <ShieldAlert size={12} />
                      {item.type.replace(/_/g, " ")}
                    </span>
                  </div>
                  <p className="mt-3 text-sm font-bold leading-relaxed text-slate-900">{item.message}</p>
                  <p className="mt-2 text-xs font-medium text-slate-500">{formatUtcDateTime(item.created_at)}</p>
                </div>
                {!item.is_read && (
                  <button
                    type="button"
                    onClick={() => void markRead(item.id)}
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-3 text-xs font-black uppercase tracking-widest text-blue-700 transition-colors hover:bg-blue-100"
                  >
                    <CheckCheck size={14} />
                    Mark Read
                  </button>
                )}
              </div>
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
