"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { apiRequest } from "@/lib/api";
import { 
  X, ChevronLeft, ChevronRight, MapPin, Tag, Box, 
  Calendar, Clock, User, MessageSquare, Send, 
  Trash2, Edit3, ShieldCheck, CheckCircle2, AlertCircle,
  HardHat, Phone, Mail, Hash, Layers, Building2, DoorOpen
} from "lucide-react";

interface Props { id: string; }

// Types (Restricted to your provided structure)
type RequestDetail = {
  id: number; title: string; description: string; status: string; priority: string; created_at: string;
  category_id?: number | null; custom_location?: string | null;
  requester?: { id?: number; fname?: string; lname?: string; phone?: string; email?: string; profile_picture_url?: string | null };
  category?: { id?: number; name?: string }; building?: { name?: string }; room?: { name?: string }; asset?: { name?: string };
  status_logs?: Array<{
    id: number;
    old_status?: string | null;
    new_status: string;
    comment?: string | null;
    created_at: string;
    changedBy?: { fname?: string; lname?: string } | null;
    changed_by?: { fname?: string; lname?: string } | number | null;
  }>;
  messages?: Array<{ id: number; message: string; created_at: string; edited_at?: string | null; sender?: { id?: number; fname?: string; lname?: string }; }>;
  images?: Array<{ id: number; image_path: string }>;
  work_orders?: Array<{
    id: number;
    work_status: string;
    assignee?: { fname?: string; lname?: string; phone?: string; email?: string; profile_picture_url?: string | null } | null;
  }>;
};

type TechnicianOption = {
  id: number;
  fname?: string;
  lname?: string;
  phone?: string;
  email?: string;
  profile_picture_url?: string | null;
  open_workload?: number;
  availability?: boolean;
  specialties?: Array<{ id: number; name?: string; category_id?: number }>;
};

const statusColors: Record<string, string> = {
  submitted: "bg-amber-500", approved: "bg-cyan-600", assigned: "bg-blue-600",
  completed: "bg-emerald-600", closed: "bg-slate-900", rejected: "bg-rose-600",
};

export default function RequestDetailPage({ id }: Props) {
  const [detail, setDetail] = useState<RequestDetail | null>(null);
  const [activeTab, setActiveTab] = useState<"details" | "chat">("details");
  const [newMessage, setNewMessage] = useState("");
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingText, setEditingText] = useState("");
  const [currentUserId, setCurrentUserId] = useState<number | null>(null);
  const [assignOpen, setAssignOpen] = useState(false);
  const [assignError, setAssignError] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);
  const [assignLoading, setAssignLoading] = useState(false);
  const [technicians, setTechnicians] = useState<TechnicianOption[]>([]);
  const [selectedTechId, setSelectedTechId] = useState("");
  const [scheduledDate, setScheduledDate] = useState("");
  const [scheduledTime, setScheduledTime] = useState("");
  const [previewIndex, setPreviewIndex] = useState<number | null>(null);
  const chatRef = useRef<HTMLDivElement | null>(null);
  const baseUrl = process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

  // Logic Endpoints (Untouched as per instructions)
  const load = useCallback(async () => {
    const res = await apiRequest<{ success: boolean; request: RequestDetail }>(`/api/supervisor/requests/${id}`, { method: "GET" }, true);
    setDetail(res.request);
  }, [id]);

  useEffect(() => {
    load();
    const loadUser = async () => {
      try {
        const data = await apiRequest<{ success: boolean; user: { id: number } }>("/api/user", { method: "GET" }, true);
        setCurrentUserId(data.user?.id ?? null);
      } catch { setCurrentUserId(null); }
    };
    void loadUser();
  }, [id, load]);

  useEffect(() => {
    if (chatRef.current && activeTab === "chat") {
      chatRef.current.scrollTop = chatRef.current.scrollHeight;
    }
  }, [detail?.messages, activeTab]);

  const chatLocked = useMemo(() => detail?.status === "closed", [detail?.status]);
  const latestWorkOrder = useMemo(() => (detail?.work_orders ?? [])[0], [detail?.work_orders]);
  const assignee = latestWorkOrder?.assignee ?? null;
  const isAssigned = Boolean(assignee);

  const timelineEvents = useMemo(() => {
    if (!detail) return [];
    const logs = [...(detail.status_logs ?? [])].sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());
    const submittedBy = `${detail.requester?.fname ?? ""} ${detail.requester?.lname ?? ""}`.trim() || "Requester";
    const hasSubmittedLog = logs.some((l) => l.new_status === "submitted");
    const submittedEvent = hasSubmittedLog ? [] : [{
      id: -1,
      new_status: "submitted",
      created_at: detail.created_at,
      actor: submittedBy,
      comment: "Request submitted.",
    }];
    const mapped = logs.map((log) => {
      const fallbackActorObj = typeof log.changed_by === "object" ? log.changed_by : null;
      const actor = `${log.changedBy?.fname ?? fallbackActorObj?.fname ?? ""} ${log.changedBy?.lname ?? fallbackActorObj?.lname ?? ""}`.trim() || "System";
      return {
        id: log.id,
        new_status: log.new_status,
        created_at: log.created_at,
        actor,
        comment: log.comment ?? "",
      };
    });
    return [...submittedEvent, ...mapped];
  }, [detail]);

  const formatLocalDateTime = (value?: string | null) => {
    if (!value) return "-";
    return new Date(value).toLocaleString([], { dateStyle: 'medium', timeStyle: 'short' });
  };

  const resolveImage = (path?: string | null) => {
    if (!path) return "";
    return path.startsWith("http") ? path : `${baseUrl}/storage/${path.replace(/^\/+/, "")}`;
  };

  // Logic Actions
  const sendMessage = async () => {
    if (!newMessage.trim() || chatLocked) return;
    await apiRequest(`/api/supervisor/requests/${id}/messages`, {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: newMessage }),
    }, true);
    setNewMessage("");
    await load();
  };

  const review = async (action: "approve" | "reject") => {
    await apiRequest(`/api/supervisor/requests/${id}/review`, {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action }),
    }, true);
    await load();
  };

  const openAssign = async () => {
    const resolvedCategoryId = detail?.category_id ?? detail?.category?.id ?? null;
    if (!resolvedCategoryId) {
      setAssignError("This request has no category. Set category first.");
      setAssignOpen(true);
      return;
    }
    try {
      setAssignLoading(true);
      setAssignError(null);
      // Use stable PM technician list and filter by specialty category locally.
      const all = await apiRequest<{ success: boolean; technicians: TechnicianOption[] }>(
        "/api/pm/technicians",
        { method: "GET" },
        true
      );
      const techs = (all.technicians ?? []).filter((t) =>
        (t.specialties ?? []).some((s) => Number(s.category_id) === Number(resolvedCategoryId))
      );

      setTechnicians(techs);
      setSelectedTechId(techs[0]?.id ? String(techs[0].id) : "");
      if (techs.length === 0) setAssignError("No technicians found for this category.");
      setAssignOpen(true);
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : "Failed to load technicians.");
      setAssignOpen(true);
    } finally {
      setAssignLoading(false);
    }
  };

  const assignTechnician = async () => {
    if (!selectedTechId) {
      setAssignError("Select technician.");
      return;
    }
    try {
      setAssigning(true);
      setAssignError(null);
      await apiRequest(`/api/supervisor/requests/${id}/assign`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          assigned_to: Number(selectedTechId),
          scheduled_date: scheduledDate || null,
          scheduled_time: scheduledTime || null,
        }),
      }, true);
      setAssignOpen(false);
      await load();
    } catch (error) {
      setAssignError(error instanceof Error ? error.message : "Failed to assign technician.");
    } finally {
      setAssigning(false);
    }
  };

  if (!detail) return <div className="h-screen flex items-center justify-center font-black text-slate-400 animate-pulse">LOADING...</div>;

  return (
    <div className="max-w-7xl mx-auto space-y-6 animate-in fade-in duration-500">
      
      {/* SECTION 1: TOP HEADER & CONTROLS */}
      <div className="bg-white rounded-[2rem] border border-slate-100 p-8 shadow-sm">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className={`px-4 py-1 rounded-full text-[9px] font-black text-white uppercase tracking-[0.2em] ${statusColors[detail.status]}`}>
                {detail.status}
              </span>
              <span className="text-[10px] font-black text-slate-300 uppercase tracking-widest flex items-center gap-1">
                <Hash size={12}/> {detail.id}
              </span>
            </div>
            <h1 className="text-3xl font-black text-slate-900 leading-tight">{detail.title}</h1>
          </div>

          {/* Navigation & Action Mix */}
          <div className="flex bg-slate-100 p-1.5 rounded-2xl">
            <button 
              onClick={() => setActiveTab("details")}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "details" ? "bg-white text-[#003366] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Details
            </button>
            <button 
              onClick={() => setActiveTab("chat")}
              className={`px-6 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all ${activeTab === "chat" ? "bg-white text-[#003366] shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
            >
              Chat Loop
            </button>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-12 gap-6">
        
        {/* SECTION 2: CONTENT AREA (Dynamic based on Tab) */}
        <div className="lg:col-span-8">
          {activeTab === "details" ? (
            <div className="space-y-6 animate-in slide-in-from-left-4 duration-300">
              
              {/* PRIMARY DETAILS */}
              <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2">
                  <Layers size={16} /> Technical Specs
                </h3>
                <div className="grid sm:grid-cols-2 gap-4">
                  <div className="p-5 rounded-3xl bg-slate-50/50 border border-slate-100 sm:col-span-2">
                    <p className="text-[9px] font-black text-blue-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <MapPin size={12}/> Location
                    </p>
                    {detail.building?.name || detail.room?.name ? (
                      <p className="text-sm font-black text-slate-800">
                        Building: {detail.building?.name || "-"} | Room: {detail.room?.name || "-"}
                      </p>
                    ) : (
                      <p className="text-sm font-black text-slate-800">
                        Custom Location: {detail.custom_location || "-"}
                      </p>
                    )}
                  </div>
                  <div className="p-5 rounded-3xl bg-slate-50/50 border border-slate-100">
                    <p className="text-[9px] font-black text-purple-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Tag size={12}/> Category
                    </p>
                    <p className="text-sm font-black text-slate-800">{detail.category?.name || "General"}</p>
                  </div>
                  <div className="p-5 rounded-3xl bg-slate-50/50 border border-slate-100">
                    <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Box size={12}/> Linked Asset
                    </p>
                    <p className="text-sm font-black text-slate-800">{detail.asset?.name || "No Asset"}</p>
                  </div>
                </div>

                <div className="mt-8 space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Problem Description</p>
                  <p className="text-sm text-slate-700 leading-relaxed bg-white border border-slate-100 p-6 rounded-3xl whitespace-pre-wrap">{detail.description}</p>
                </div>
              </div>

              {/* IMAGES */}
              <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
                <h3 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6 flex items-center gap-2">
                  <MessageSquare size={16} /> Visual Attachments
                </h3>
                <div className="flex gap-4 overflow-x-auto pb-2 scrollbar-hide">
                  {detail.images?.map((img, idx) => (
                    <button key={img.id} onClick={() => setPreviewIndex(idx)} className="relative group shrink-0">
                      <img src={resolveImage(img.image_path)} className="w-32 h-32 object-cover rounded-[1.5rem] border border-slate-100 group-hover:scale-105 transition-transform" alt="request evidence" />
                    </button>
                  ))}
                  {(!detail.images || detail.images.length === 0) && <p className="text-xs text-slate-400 italic py-8">No images provided for this request.</p>}
                </div>
              </div>
            </div>
          ) : (
            /* CHAT SECTION */
            <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm flex flex-col h-[700px] overflow-hidden animate-in slide-in-from-right-4 duration-300">
              <div ref={chatRef} className="flex-1 overflow-y-auto p-8 space-y-6 bg-slate-50/20">
                {detail.messages?.map((m) => {
                  const isMe = m.sender?.id === currentUserId;
                  return (
                    <div key={m.id} className={`flex ${isMe ? "justify-end" : "justify-start"}`}>
                      <div className={`max-w-[80%] ${isMe ? "items-end text-right" : "items-start text-left"}`}>
                        <div className="flex items-center gap-2 mb-1 px-2">
                          <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">{m.sender?.fname}</span>
                          <span className="text-[8px] font-bold text-slate-300">{new Date(m.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                        </div>
                        <div className={`px-5 py-3 rounded-2xl text-sm shadow-sm ${isMe ? "bg-[#003366] text-white rounded-tr-none" : "bg-white text-slate-700 border border-slate-100 rounded-tl-none"}`}>
                          {m.message}
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="p-6 bg-white border-t border-slate-50">
                <div className="relative group">
                  <textarea 
                    value={newMessage} 
                    onChange={(e) => setNewMessage(e.target.value)}
                    disabled={chatLocked}
                    placeholder={chatLocked ? "Thread Locked" : "Type your message..."} 
                    className="w-full bg-slate-50 border-none rounded-[1.5rem] p-4 pr-14 text-sm min-h-[80px] focus:ring-2 focus:ring-[#003366]/5 outline-none resize-none"
                  />
                  <button onClick={sendMessage} disabled={chatLocked} className="absolute bottom-4 right-4 p-3 bg-[#003366] text-white rounded-xl shadow-lg hover:scale-110 active:scale-95 transition-transform disabled:opacity-20">
                    <Send size={18} />
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* SECTION 3: SIDEBAR (Persistent Info) */}
        <div className="lg:col-span-4 space-y-6">
          
          {/* Action Hub */}
          <div className="bg-[#003366] rounded-[2.5rem] p-8 text-white shadow-xl shadow-blue-900/20">
            <h3 className="text-[10px] font-black uppercase tracking-widest mb-6 opacity-60 flex items-center gap-2">
              <ShieldCheck size={16}/> Management Hub
            </h3>
            <div className="space-y-3">
              {detail.status === "submitted" && (
                <div className="grid grid-cols-2 gap-3">
                  <button onClick={() => review("approve")} className="bg-emerald-500 hover:bg-emerald-600 py-3 rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg shadow-emerald-900/40">Approve</button>
                  <button onClick={() => review("reject")} className="bg-rose-500 hover:bg-rose-600 py-3 rounded-2xl text-[10px] font-black uppercase transition-all shadow-lg shadow-rose-900/40">Reject</button>
                </div>
              )}
              {!isAssigned && detail.status === "approved" && (
                <button onClick={openAssign} className="w-full bg-white text-[#003366] py-3 rounded-2xl text-[10px] font-black uppercase transition-all flex items-center justify-center gap-2">
                  <HardHat size={14}/> Assign Technician
                </button>
              )}
              {isAssigned && (
                <div className="rounded-2xl bg-white/10 p-4 border border-white/10">
                  <p className="text-[9px] font-black uppercase tracking-widest text-blue-200 mb-1">Assigned To</p>
                  <p className="text-xs font-black text-white">{assignee?.fname} {assignee?.lname}</p>
                  <p className="text-[11px] text-blue-100">{assignee?.phone || "-"}</p>
                  <p className="text-[11px] text-blue-100 break-all">{assignee?.email || "-"}</p>
                </div>
              )}
              <div className="pt-4 border-t border-white/10 mt-4">
                <div className="flex justify-between items-center text-[10px] font-black uppercase opacity-60">
                  <span>Priority Level</span>
                  <span className={detail.priority === "urgent" ? "text-rose-400" : "text-blue-300"}>{detail.priority}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Requester Contact */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <User size={16}/> Requester
            </h3>
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-lg font-black text-[#003366]">
                {detail.requester?.profile_picture_url ? (
                  <img src={detail.requester.profile_picture_url} alt="Requester" className="w-full h-full object-cover rounded-2xl" />
                ) : detail.requester?.fname?.[0] || "?"}
              </div>
              <div className="min-w-0">
                <p className="text-sm font-black text-slate-900 truncate">{detail.requester?.fname} {detail.requester?.lname}</p>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Employee</p>
              </div>
            </div>
            <div className="space-y-2">
              <a href={`tel:${detail.requester?.phone}`} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 text-slate-600 text-xs font-bold hover:bg-blue-50 transition-all">
                <Phone size={14} className="text-blue-500" /> {detail.requester?.phone || "-"}
              </a>
              <a href={`mailto:${detail.requester?.email}`} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 text-slate-600 text-xs font-bold hover:bg-blue-50 transition-all truncate">
                <Mail size={14} className="text-blue-500" /> {detail.requester?.email || "-"}
              </a>
            </div>
          </div>

          {isAssigned && (
            <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
              <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
                <HardHat size={16}/> Assigned Technician
              </h3>
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-slate-50 border border-slate-100 flex items-center justify-center text-lg font-black text-[#003366] overflow-hidden">
                  {assignee?.profile_picture_url ? (
                    <img src={assignee.profile_picture_url} alt="Technician" className="w-full h-full object-cover rounded-2xl" />
                  ) : assignee?.fname?.[0] || "T"}
                </div>
                <div className="min-w-0">
                  <p className="text-sm font-black text-slate-900 truncate">{assignee?.fname} {assignee?.lname}</p>
                  <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Technician</p>
                </div>
              </div>
              <div className="space-y-2">
                <a href={`tel:${assignee?.phone ?? ""}`} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 text-slate-600 text-xs font-bold hover:bg-blue-50 transition-all">
                  <Phone size={14} className="text-blue-500" /> {assignee?.phone || "-"}
                </a>
                <a href={`mailto:${assignee?.email ?? ""}`} className="flex items-center gap-3 p-3 rounded-2xl bg-slate-50 text-slate-600 text-xs font-bold hover:bg-blue-50 transition-all truncate">
                  <Mail size={14} className="text-blue-500" /> {assignee?.email || "-"}
                </a>
              </div>
            </div>
          )}

          {/* Mini Logs */}
          <div className="bg-white rounded-[2.5rem] border border-slate-100 p-8 shadow-sm">
            <h3 className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-6 flex items-center gap-2">
              <Clock size={16}/> Timeline
            </h3>
            <div className="space-y-6 relative before:absolute before:left-2.5 before:top-2 before:bottom-2 before:w-[1px] before:bg-slate-100">
              {timelineEvents.map((log) => (
                <div key={log.id} className="relative pl-8">
                  <div className={`absolute left-0 top-1.5 w-5 h-5 rounded-full border-4 border-white shadow-sm ring-1 ring-slate-100 ${statusColors[log.new_status] || 'bg-slate-300'}`} />
                  <p className="text-[10px] font-black text-slate-900 uppercase">{log.new_status}</p>
                  <p className="text-[9px] font-bold text-slate-400">{formatLocalDateTime(log.created_at)}</p>
                  <p className="text-[9px] font-bold text-slate-500">By: {log.actor}</p>
                </div>
              ))}
            </div>
          </div>

        </div>
      </div>

      {/* LIGHTBOX (Untouched logic) */}
      {previewIndex !== null && (
        <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-md flex items-center justify-center p-8">
          <button onClick={() => setPreviewIndex(null)} className="absolute top-8 right-8 text-white hover:scale-110 transition-transform"><X size={32} /></button>
          <img src={resolveImage(detail.images?.[previewIndex]?.image_path)} className="max-w-full max-h-[85vh] rounded-3xl animate-in zoom-in-95 duration-300" alt="Preview" />
        </div>
      )}

      {assignOpen && (
        <div className="fixed inset-0 z-[1300] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="w-full max-w-xl rounded-[2rem] bg-white border border-slate-100 p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between">
              <h3 className="text-lg font-black text-slate-900">Assign Technician</h3>
              <button onClick={() => setAssignOpen(false)} className="p-2 rounded-xl bg-slate-100 text-slate-500 hover:bg-slate-200">
                <X size={16} />
              </button>
            </div>

            <p className="text-xs font-bold text-slate-500">Category: {detail.category?.name ?? "General"}</p>

            {assignLoading ? (
              <p className="text-sm text-slate-500">Loading technicians...</p>
            ) : (
              <>
                <select
                  value={selectedTechId}
                  onChange={(e) => setSelectedTechId(e.target.value)}
                  className="w-full border border-slate-200 rounded-xl p-3 text-sm"
                >
                  <option value="">Choose technician...</option>
                  {technicians.map((t) => (
                    <option key={t.id} value={String(t.id)}>
                      {`${t.fname ?? ""} ${t.lname ?? ""}`.trim()} | load: {t.open_workload ?? 0} | {t.availability ? "available" : "busy"}
                    </option>
                  ))}
                </select>

                <div className="grid grid-cols-2 gap-3">
                  <input type="date" value={scheduledDate} onChange={(e) => setScheduledDate(e.target.value)} className="border border-slate-200 rounded-xl p-3 text-sm" />
                  <input type="time" value={scheduledTime} onChange={(e) => setScheduledTime(e.target.value)} className="border border-slate-200 rounded-xl p-3 text-sm" />
                </div>
              </>
            )}

            {assignError && <p className="text-xs font-bold text-rose-600">{assignError}</p>}

            <div className="flex justify-end gap-2">
              <button onClick={() => setAssignOpen(false)} className="px-4 py-2 rounded-xl bg-slate-100 text-slate-600 text-xs font-black uppercase">Cancel</button>
              <button onClick={assignTechnician} disabled={assignLoading || assigning || !selectedTechId} className="px-4 py-2 rounded-xl bg-[#003366] text-white text-xs font-black uppercase disabled:opacity-40">
                {assigning ? "Assigning..." : "Assign"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
