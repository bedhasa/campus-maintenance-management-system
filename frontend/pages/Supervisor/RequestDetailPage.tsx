"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { apiRequest } from "@/lib/api";

interface Props {
  id: string;
}

type RequestDetail = {
  id: number;
  title: string;
  description: string;
  status: string;
  priority: string;
  created_at: string;
  requester?: { fname?: string; lname?: string; phone?: string; email?: string };
  category?: { name?: string };
  building?: { name?: string };
  room?: { name?: string };
  asset?: { name?: string };
  status_logs?: Array<{ id: number; old_status?: string | null; new_status: string; comment?: string | null; created_at: string }>;
  messages?: Array<{ id: number; message: string; created_at: string; edited_at?: string | null; sender?: { fname?: string; lname?: string } }>;
  images?: Array<{ id: number; image_path: string }>;
};

export default function RequestDetailPage({ id }: Props) {
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [newMessage, setNewMessage] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const chatRef = useRef<HTMLDivElement | null>(null);

  const load = async () => {
    const res = await apiRequest<{ success: boolean; request: RequestDetail }>(`/api/supervisor/requests/${id}`, { method: "GET" }, true);
    setDetail(res.request);
  };

  useEffect(() => {
    let ignore = false;
    (async () => {
      const res = await apiRequest<{ success: boolean; request: RequestDetail }>(`/api/supervisor/requests/${id}`, { method: "GET" }, true);
      if (!ignore) {
        setDetail(res.request);
      }
    })();
    return () => {
      ignore = true;
    };
  }, [id]);

  useEffect(() => {
    if (chatRef.current) {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [detail?.messages]);

  const chatLocked = useMemo(() => detail?.status === "closed", [detail?.status]);

  const sendMessage = async () => {
    if (!newMessage.trim() || chatLocked) return;
    await apiRequest(`/api/supervisor/requests/${id}/messages`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: newMessage }),
    }, true);
    setNewMessage("");
    await load();
  };

  const review = async (action: "approve" | "reject") => {
    await apiRequest(`/api/supervisor/requests/${id}/review`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }, true);
    await load();
  };

  const closeRequest = async () => {
    await apiRequest(`/api/supervisor/requests/${id}/close`, { method: "PATCH" }, true);
    await load();
  };

  const reopenRequest = async () => {
    await apiRequest(`/api/supervisor/requests/${id}/reopen`, { method: "PATCH" }, true);
    await load();
  };

  const saveEdit = async (messageId: number) => {
    await apiRequest(`/api/supervisor/requests/${id}/messages/${messageId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: editingText }),
    }, true);
    setEditingId(null);
    setEditingText("");
    await load();
  };

  const removeMessage = async (messageId: number) => {
    await apiRequest(`/api/supervisor/requests/${id}/messages/${messageId}`, { method: "DELETE" }, true);
    await load();
  };

  if (!detail) return <p className="text-sm text-slate-500">Loading request...</p>;

  return (
    <div className="grid lg:grid-cols-3 gap-6">
      <div className="lg:col-span-2 space-y-4">
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h1 className="text-2xl font-black text-slate-900">{detail.title}</h1>
          <p className="text-xs font-bold text-slate-500 uppercase mt-1">#{detail.id} • {detail.status} • {detail.priority}</p>
          <p className="text-sm text-slate-700 mt-4 whitespace-pre-wrap">{detail.description}</p>
        </div>

        <div className="grid sm:grid-cols-2 gap-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <p className="font-black mb-2">Location</p>
            <p>{detail.building?.name ?? "-"}</p>
            <p>{detail.room?.name ?? "-"}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm">
            <p className="font-black mb-2">Asset / Category</p>
            <p>{detail.asset?.name ?? "-"}</p>
            <p>{detail.category?.name ?? "-"}</p>
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-black mb-2">Timeline</p>
          <div className="space-y-2">
            {(detail.status_logs ?? []).map((log) => (
              <div key={log.id} className="text-xs">
                <p className="font-bold">{log.old_status ?? "new"} → {log.new_status}</p>
                <p className="text-slate-500">{log.comment ?? "-"}</p>
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-black mb-2">Images</p>
          {(detail.images ?? []).length > 0 ? (
            <div className="grid grid-cols-3 md:grid-cols-4 gap-2">
              {(detail.images ?? []).map((img) => (
                // eslint-disable-next-line @next/next/no-img-element
                <img key={img.id} src={`${process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000"}/storage/${img.image_path}`} alt="request" className="w-full h-20 object-cover rounded-lg border border-slate-200" />
              ))}
            </div>
          ) : (
            <p className="text-xs text-slate-500">No images.</p>
          )}
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-sm font-black mb-3">Actions</p>
          <div className="flex flex-wrap gap-2">
            {detail.status === "submitted" && (
              <>
                <button onClick={() => review("approve")} className="px-3 py-2 rounded-lg bg-emerald-600 text-white text-xs font-bold">Approve</button>
                <button onClick={() => review("reject")} className="px-3 py-2 rounded-lg bg-rose-600 text-white text-xs font-bold">Reject</button>
              </>
            )}
            {detail.status === "completed" && (
              <button onClick={closeRequest} className="px-3 py-2 rounded-lg bg-[#003366] text-white text-xs font-bold">Close Request</button>
            )}
            {detail.status === "closed" && (
              <button onClick={reopenRequest} className="px-3 py-2 rounded-lg bg-amber-600 text-white text-xs font-bold">Reopen Request</button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-4 flex flex-col">
        <p className="text-sm font-black mb-2">Chat</p>
        <div ref={chatRef} className="space-y-2 flex-1 overflow-y-auto max-h-[60vh] pr-1">
          {(detail.messages ?? []).map((m) => (
            <div key={m.id} className="rounded-lg border border-slate-100 p-2 text-xs">
              <p className="font-bold">{m.sender?.fname} {m.sender?.lname}</p>
              {editingId === m.id ? (
                <div className="mt-1 space-y-1">
                  <textarea value={editingText} onChange={(e) => setEditingText(e.target.value)} className="w-full border rounded p-1 text-xs min-h-16" />
                  <div className="flex gap-1">
                    <button onClick={() => saveEdit(m.id)} className="px-2 py-1 rounded bg-blue-700 text-white">Save</button>
                    <button onClick={() => { setEditingId(null); setEditingText(""); }} className="px-2 py-1 rounded bg-slate-200">Cancel</button>
                  </div>
                </div>
              ) : (
                <>
                  <p className="text-slate-700 mt-1">{m.message}</p>
                  <p className="text-slate-400 mt-1">
                    {new Date(m.created_at).toLocaleString()}
                    {m.edited_at ? " • edited" : ""}
                  </p>
                  {!chatLocked && (
                    <div className="flex gap-2 mt-1">
                      <button onClick={() => { setEditingId(m.id); setEditingText(m.message); }} className="text-blue-700 font-bold">Edit</button>
                      <button onClick={() => removeMessage(m.id)} className="text-red-700 font-bold">Delete</button>
                    </div>
                  )}
                </>
              )}
            </div>
          ))}
        </div>
        <div className="mt-3 space-y-2">
          <textarea
            value={newMessage}
            onChange={(e) => setNewMessage(e.target.value)}
            disabled={chatLocked}
            placeholder={chatLocked ? "Chat locked (request closed)" : "Type message..."}
            className="w-full border border-slate-200 rounded-lg p-2 text-sm min-h-20"
          />
          <button onClick={sendMessage} disabled={chatLocked} className="w-full py-2 rounded-lg bg-[#003366] text-white font-bold text-sm disabled:opacity-50">
            Send
          </button>
        </div>
      </div>
    </div>
  );
}
