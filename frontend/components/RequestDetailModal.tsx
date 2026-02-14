'use client';

import React, { useState, useRef, useEffect, useMemo } from 'react';
import { 
  X, MapPin, Wrench, FileText, MessageSquare, Send, 
  Clock, Phone, User, CheckCircle2, 
  UserCheck, ShieldCheck, PlayCircle, ClipboardCheck,
  Edit2, Trash2, Check
} from 'lucide-react';

import { MaintenanceRequest, Priority, RequestMessage, TicketStatus } from '@/types';
import StatusBadge from './StatusBadge';
import { useApp } from '@/context/AppContext'; 
import { apiRequest } from '@/lib/api';
import { useNavigate } from '@/lib/router-dom-shim';

interface RequestDetailModalProps {
  request: MaintenanceRequest;
  onClose: () => void;
  initialView?: 'info' | 'chat';
}

type ApiUser = {
  id: number;
  fname: string;
  lname: string;
  phone?: string | null;
};

type ApiStatusLog = {
  id: number;
  new_status: string;
  comment?: string | null;
  created_at: string;
  changedBy?: ApiUser | null;
  changed_by?: ApiUser | number | null;
};

type ApiMessage = {
  id: number;
  sender_id: number;
  message: string;
  created_at: string;
  edited_at?: string | null;
  sender?: ApiUser | null;
};

type ApiRequestDetail = {
  id: number;
  title: string;
  description: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'submitted' | 'approved' | 'assigned' | 'in_progress' | 'completed' | 'rejected' | 'closed';
  created_at: string;
  updated_at?: string;
  category_id?: number | null;
  building_id?: number | null;
  room_id?: number | null;
  custom_location?: string | null;
  category?: { id?: number; name: string } | null;
  building?: { id?: number; name: string } | null;
  room?: { id?: number; name: string } | null;
  requester?: ApiUser | null;
  statusLogs?: ApiStatusLog[];
  status_logs?: ApiStatusLog[];
  messages?: ApiMessage[];
};

type EditRequestState = {
  id: number;
  title: string;
  description: string;
  category_id: number | null;
  category_name?: string | null;
  building_id: number | null;
  building_name?: string | null;
  room_id: number | null;
  room_name?: string | null;
  custom_location: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
};

type RequestDetailResponse = {
  success: boolean;
  request: ApiRequestDetail;
};

const apiStatusToTicketStatus = (status: ApiRequestDetail['status']): TicketStatus => {
  switch (status) {
    case 'submitted':
      return TicketStatus.PENDING;
    case 'approved':
      return TicketStatus.APPROVED;
    case 'assigned':
      return TicketStatus.ASSIGNED;
    case 'in_progress':
      return TicketStatus.IN_PROGRESS;
    case 'completed':
    case 'closed':
      return TicketStatus.COMPLETED;
    case 'rejected':
      return TicketStatus.REJECTED;
    default:
      return TicketStatus.PENDING;
  }
};

const apiPriorityToUrgency = (priority: ApiRequestDetail['priority']): Priority => {
  switch (priority) {
    case 'low':
      return Priority.LOW;
    case 'medium':
      return Priority.MEDIUM;
    case 'high':
      return Priority.HIGH;
    case 'urgent':
      return Priority.CRITICAL;
    default:
      return Priority.MEDIUM;
  }
};

const fullName = (user?: ApiUser | null) => {
  if (!user) return '';
  return `${user.fname ?? ''} ${user.lname ?? ''}`.trim();
};

const actorFromLog = (log?: ApiStatusLog | null): ApiUser | null => {
  if (!log) return null;
  if (log.changedBy && typeof log.changedBy === 'object') return log.changedBy;
  if (log.changed_by && typeof log.changed_by === 'object') return log.changed_by;
  return null;
};

const mapApiDetailToMaintenanceRequest = (
  detail: ApiRequestDetail,
  fallback: MaintenanceRequest
): MaintenanceRequest => {
  const logs = detail.statusLogs ?? detail.status_logs ?? [];
  const approvedLog = logs.find((log) => log.new_status === 'approved');
  const assignedLog = logs.find((log) => log.new_status === 'assigned');
  const completedLog = logs.find((log) => log.new_status === 'completed' || log.new_status === 'closed');
  const requesterName = fullName(detail.requester) || fallback.requesterName || 'Requester';
  const location = detail.custom_location || [detail.building?.name, detail.room?.name].filter(Boolean).join(' / ') || fallback.location || '-';

  return {
    ...fallback,
    id: String(detail.id),
    title: detail.title ?? fallback.title,
    description: detail.description ?? fallback.description,
    requesterName,
    location,
    building: detail.building?.name ?? fallback.building,
    room: detail.room?.name ?? fallback.room,
    problemType: detail.category?.name ?? fallback.problemType,
    urgency: apiPriorityToUrgency(detail.priority),
    status: apiStatusToTicketStatus(detail.status),
    createdAt: detail.created_at ?? fallback.createdAt,
    updatedAt: detail.updated_at ?? fallback.updatedAt ?? detail.created_at,
    approvedAt: approvedLog?.created_at ?? fallback.approvedAt,
    approvedBy: fullName(actorFromLog(approvedLog)) || fallback.approvedBy,
    technicianName: fullName(actorFromLog(assignedLog)) || fallback.technicianName,
    technicianPhone: actorFromLog(assignedLog)?.phone ?? fallback.technicianPhone,
    assignedAt: assignedLog?.created_at ?? fallback.assignedAt,
    completedAt: completedLog?.created_at ?? fallback.completedAt,
    completionNotes: completedLog?.comment ?? fallback.completionNotes,
    messages: (detail.messages ?? []).map((msg): RequestMessage => ({
      id: String(msg.id),
      senderId: String(msg.sender_id),
      senderName: fullName(msg.sender) || 'User',
      senderRole: 'requester',
      text: msg.message,
      createdAt: msg.created_at,
      updatedAt: msg.edited_at ?? undefined,
    })),
  };
};

export default function RequestDetailModal({ request: initialRequest, onClose, initialView = 'info' }: RequestDetailModalProps) {
  const navigate = useNavigate();
  const { editRequestMessage, currentUser, requests } = useApp();
  const [messageText, setMessageText] = useState('');
  const [view, setView] = useState<'info' | 'chat'>(initialView);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [editRequestState, setEditRequestState] = useState<EditRequestState | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const baseRequest = useMemo(
    () => requests.find((r: MaintenanceRequest) => String(r.id) === String(initialRequest.id)) || initialRequest,
    [requests, initialRequest]
  );
  const [request, setRequest] = useState<MaintenanceRequest>(baseRequest);
  const endpointRequestId = useMemo(() => {
    const raw = String(initialRequest.id ?? '').trim();
    const parsed = Number(raw);
    if (Number.isFinite(parsed)) return String(parsed);
    const match = raw.match(/\d+/);
    return match ? match[0] : raw;
  }, [initialRequest.id]);
  const canEditRequest = request.status === TicketStatus.PENDING;

  const mapToEditState = (detail: ApiRequestDetail): EditRequestState => {
    const categoryId = detail.category_id ?? detail.category?.id ?? null;
    return {
      id: detail.id,
      title: detail.title,
      description: detail.description,
      category_id: categoryId ? Number(categoryId) : null,
      category_name: detail.category?.name ?? null,
      building_id: detail.building_id ?? detail.building?.id ?? null,
      building_name: detail.building?.name ?? null,
      room_id: detail.room_id ?? detail.room?.id ?? null,
      room_name: detail.room?.name ?? null,
      custom_location: detail.custom_location ?? null,
      priority: detail.priority,
    };
  };

  useEffect(() => {
    setRequest(baseRequest);
  }, [baseRequest]);

  useEffect(() => {
    setView(initialView);
  }, [initialView, initialRequest.id]);

  useEffect(() => {
    let cancelled = false;

    const loadRequestDetail = async () => {
      try {
        setLoadError(null);
        const data = await apiRequest<RequestDetailResponse>(
          `/api/requester/requests/${endpointRequestId}`,
          { method: 'GET' },
          true
        );
        if (cancelled) return;
        setEditRequestState(mapToEditState(data.request));
        setRequest((prev) => mapApiDetailToMaintenanceRequest(data.request, prev));
      } catch (error) {
        if (cancelled) return;
        setLoadError(error instanceof Error ? error.message : 'Failed to load request details.');
      }
    };

    if (endpointRequestId) {
      loadRequestDetail();
    }

    return () => {
      cancelled = true;
    };
  }, [endpointRequestId]);

  useEffect(() => {
    if (view === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [request.messages, view]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = messageText.trim();
    if (!message || !endpointRequestId) return;

    try {
      setSending(true);
      setLoadError(null);
      await apiRequest(
        `/api/requester/requests/${endpointRequestId}/messages`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message }),
        },
        true
      );

      const data = await apiRequest<RequestDetailResponse>(
        `/api/requester/requests/${endpointRequestId}`,
        { method: 'GET' },
        true
      );
      setRequest((prev) => mapApiDetailToMaintenanceRequest(data.request, prev));
      setMessageText('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to send message.');
    } finally {
      setSending(false);
    }
  };

  const startEditing = (msg: RequestMessage) => {
    setEditingMessageId(msg.id);
    setEditValue(msg.text);
  };

  const handleSaveEdit = (msgId: string) => {
    if (editValue.trim()) {
      editRequestMessage(request.id, msgId, editValue.trim());
      setEditingMessageId(null);
    }
  };

  const handleDelete = (msgId: string) => {
    const run = async () => {
      if (!window.confirm('Delete this message?')) return;
      if (!endpointRequestId) return;

      const parsed = Number(msgId);
      const endpointMessageId = Number.isFinite(parsed) ? String(parsed) : msgId.match(/\d+/)?.[0];
      if (!endpointMessageId) {
        setLoadError('Failed to resolve message id for delete.');
        return;
      }

      try {
        setLoadError(null);
        await apiRequest(
          `/api/requester/requests/${endpointRequestId}/messages/${endpointMessageId}`,
          { method: 'DELETE' },
          true
        );
        const data = await apiRequest<RequestDetailResponse>(
          `/api/requester/requests/${endpointRequestId}`,
          { method: 'GET' },
          true
        );
        setRequest((prev) => mapApiDetailToMaintenanceRequest(data.request, prev));
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Failed to delete message.');
      }
    };

    void run();
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) return dateStr;
    return new Intl.DateTimeFormat(undefined, {
      year: 'numeric',
      month: 'short',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: true,
      timeZoneName: 'short',
    }).format(parsed);
  };

  const isEditable = (createdAt: string) => {
    const sentTime = new Date(createdAt).getTime();
    const now = Date.now();
    return (now - sentTime) < 3 * 60 * 1000; 
  };

  const getStepStatus = (step: 'pending' | 'approved' | 'assigned' | 'progress' | 'completed') => {
    const status = request.status;
    const order: Record<string, number> = { 'DRAFT': 0, 'PENDING': 1, 'APPROVED': 2, 'ASSIGNED': 3, 'IN_PROGRESS': 4, 'COMPLETED': 5, 'REJECTED': -1 };
    const currentWeight = order[status] || 0;
    const stepWeights = { 'pending': 1, 'approved': 2, 'assigned': 3, 'progress': 4, 'completed': 5 };
    
    if (currentWeight === -1 && step === 'approved') return 'rejected';
    if (currentWeight >= stepWeights[step]) return 'done';
    return 'upcoming';
  };

  const handleEditRequest = () => {
    if (!canEditRequest) {
      setLoadError('This request is under review and can no longer be modified.');
      return;
    }
    if (!editRequestState) {
      setLoadError('Unable to load request data for editing. Please reopen this request and try again.');
      return;
    }

    navigate(`/requester/submit?edit=${editRequestState.id}`, { state: { editRequest: editRequestState } });
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-100 flex items-end md:items-center justify-center p-0 md:p-6 animate-in fade-in duration-300">
      <div className="bg-white w-full max-w-2xl h-[92vh] md:h-auto md:max-h-[90vh] rounded-t-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in slide-in-from-bottom duration-500 md:zoom-in-95">
        
        {/* Header */}
        <div className="p-6 border-b border-slate-100 flex items-center justify-between shrink-0 bg-white sticky top-0 z-20">
          <div className="flex items-center space-x-3">
             <div className="w-10 h-10 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center font-black text-xs italic border border-blue-100 shadow-sm">HU</div>
             <div className="min-w-0">
                {/* Fixed: max-w-[180px] requires brackets */}
                <h2 className="text-sm font-black text-slate-900 leading-tight truncate max-w-180px">{request.title || `MR-${request.id}`}</h2>
                <div className="flex items-center space-x-2 mt-0.5">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{request.id}</span>
                  <StatusBadge status={request.status} />
                </div>
             </div>
          </div>
          <div className="flex items-center space-x-2">
            {canEditRequest && (
              <button
                type="button"
                onClick={handleEditRequest}
                className="px-3 py-2 bg-blue-50 text-blue-700 hover:bg-blue-100 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest flex items-center space-x-1.5"
              >
                <Edit2 size={12} />
                <span>Edit Request</span>
              </button>
            )}
            <button onClick={onClose} className="p-2.5 bg-slate-50 text-slate-400 hover:text-slate-900 rounded-2xl transition-all">
              <X size={20} />
            </button>
          </div>
        </div>

        {/* View Toggle */}
        <div className="flex p-1.5 bg-slate-50 mx-6 mt-4 rounded-2xl border border-slate-100 shrink-0">
          <button 
            onClick={() => setView('info')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-2 transition-all ${view === 'info' ? 'bg-white text-[#003366] shadow-md' : 'text-slate-400'}`}
          >
            <FileText size={14} />
            <span>Details</span>
          </button>
          <button 
            onClick={() => setView('chat')}
            className={`flex-1 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center space-x-2 transition-all ${view === 'chat' ? 'bg-white text-[#003366] shadow-md' : 'text-slate-400'}`}
          >
            <MessageSquare size={14} />
            <span>Activity</span>
            {(request.messages?.length || 0) > 0 && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {loadError && (
            <p className="text-xs text-rose-600 font-bold mb-3">{loadError}</p>
          )}
          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mb-3">
            Times shown in your device&apos;s local timezone
          </p>
          {!canEditRequest && view === 'info' && (
            <p className="text-xs text-amber-700 font-bold mb-3">
              This request is under review and can no longer be modified.
            </p>
          )}
          {view === 'info' ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-left-2 duration-300">
              
              {request.technicianName && (
                <section className="bg-[#003366] p-6 rounded-[2.5rem] text-white shadow-xl shadow-blue-900/10 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:scale-110 transition-transform">
                    <User size={80} />
                  </div>
                  <div className="flex items-center space-x-4 mb-4 relative z-10">
                    <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center text-white border border-white/20 shadow-inner">
                      <User size={28} />
                    </div>
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-200">Active Technician</p>
                      <h3 className="text-xl font-black">{request.technicianName}</h3>
                      <p className="text-[10px] font-bold text-blue-300 mt-0.5 uppercase tracking-widest">Maintenance Team • HU</p>
                    </div>
                  </div>
                  <a 
                    href={`tel:${request.technicianPhone || '+251911223344'}`}
                    className="relative z-10 w-full py-4 bg-white text-[#003366] rounded-2xl font-black uppercase tracking-widest text-[11px] flex items-center justify-center space-x-2 hover:bg-blue-50 transition-all active:scale-[0.98] shadow-lg"
                  >
                    <Phone size={16} />
                    <span>Call Technician Now</span>
                  </a>
                </section>
              )}

              <div className="bg-slate-50/50 border border-slate-100 p-6 rounded-[2.5rem] space-y-6">
                <div className="flex items-start space-x-4">
                  <div className="p-2.5 bg-white rounded-xl text-blue-500 shadow-sm border border-slate-50"><MapPin size={18} /></div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Site Location</p>
                    {(request.building || request.room) ? (
                      <p className="text-sm font-bold text-slate-800">
                        Building: {request.building || '-'} | Room: {request.room || '-'}
                      </p>
                    ) : (
                      <p className="text-sm font-bold text-slate-800">
                        Custom Location: {request.location || '-'}
                      </p>
                    )}
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="p-2.5 bg-white rounded-xl text-blue-500 shadow-sm border border-slate-50"><Wrench size={18} /></div>
                  <div>
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Job Category</p>
                    <p className="text-sm font-bold text-slate-800">{request.problemType}</p>
                  </div>
                </div>
                <div className="flex items-start space-x-4">
                  <div className="p-2.5 bg-white rounded-xl text-blue-500 shadow-sm border border-slate-50"><FileText size={18} /></div>
                  <div className="flex-1">
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Description</p>
                    <p className="text-sm font-medium text-slate-600 leading-relaxed italic mt-1 bg-white/50 p-3 rounded-xl border border-slate-50 shadow-sm">
                      &quot;{request.description}&quot;
                    </p>
                  </div>
                </div>
              </div>

              {/* Lifecycle Activity */}
              <section className="space-y-6">
                 <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] px-2 flex items-center">
                    <Clock size={14} className="mr-2 text-blue-600" /> Lifecycle Activity
                 </h3>
                 
                 <div className="relative pl-8 space-y-8 before:content-[''] before:absolute before:left-15px before:top-2 before:bottom-2 before:w-2px before:bg-slate-100">
                    <TimelineStep 
                      title="Request Lodged"
                      person={request.requesterName}
                      role="Requester"
                      date={formatDate(request.createdAt)}
                      status={getStepStatus('pending')}
                      icon={<FileText size={14} />}
                    />
                    {/* Repeat steps similarly... */}
                    <TimelineStep 
                      title={request.status === 'REJECTED' ? "Request Rejected" : "Supervisor Approval"}
                      person={request.approvedBy || "Department Head"}
                      role="Supervisor"
                      date={formatDate(request.approvedAt)}
                      status={getStepStatus('approved')}
                      icon={<ShieldCheck size={14} />}
                      note={request.rejectionReason}
                    />
                    <TimelineStep 
                      title="Task Assigned"
                      person={request.technicianName || "Pending Team"}
                      role="Execution Unit"
                      date={formatDate(request.assignedAt)}
                      status={getStepStatus('assigned')}
                      icon={<UserCheck size={14} />}
                    />
                    <TimelineStep 
                      title="Maintenance In-Progress"
                      person={request.technicianName || "Assigned Tech"}
                      role="Field Work"
                      date={formatDate(request.updatedAt)} 
                      status={getStepStatus('progress')}
                      icon={<PlayCircle size={14} />}
                    />
                    <TimelineStep 
                      title="Resolution Verified"
                      person={request.technicianName || "Assigned Tech"}
                      role="Final Completion"
                      date={formatDate(request.completedAt)}
                      status={getStepStatus('completed')}
                      icon={<ClipboardCheck size={14} />}
                      note={request.completionNotes}
                    />
                 </div>
              </section>
            </div>
          ) : (
            <div className="h-full flex flex-col animate-in fade-in slide-in-from-right-2 duration-300">
               {(!request.messages || request.messages.length === 0) ? (
                <div className="flex-1 flex flex-col items-center justify-center text-center opacity-30 py-20">
                  <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center mb-4">
                    <MessageSquare size={32} />
                  </div>
                  <p className="text-[10px] font-black uppercase tracking-widest">No communication log</p>
                </div>
              ) : (
                <div className="flex-1 space-y-6 pb-20">
                  {request.messages.map((msg) => {
                    const isMe = msg.senderId === currentUser?.id;
                    const canAct = isMe && isEditable(msg.createdAt);
                    const isEditing = editingMessageId === msg.id;

                    return (
                      <div key={msg.id} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} group`}>
                        <div className="flex items-center space-x-2 max-w-[90%]">
                          {isEditing ? (
                            <div className="flex flex-col space-y-2 bg-slate-50 p-3 rounded-2xl border border-slate-200 shadow-inner w-full">
                                 <textarea 
                                 autoFocus
                                 value={editValue}
                                 onChange={(e) => setEditValue(e.target.value)}
                                 className="w-full bg-transparent text-slate-900 text-xs font-medium outline-none resize-none min-h-60px"
                               />
                               <div className="flex justify-end space-x-2">
                                  <button onClick={() => setEditingMessageId(null)} className="p-1.5 text-slate-400 hover:text-red-500 transition-colors">
                                     <X size={14} />
                                  </button>
                                  <button onClick={() => handleSaveEdit(msg.id)} className="p-1.5 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors">
                                     <Check size={14} />
                                  </button>
                               </div>
                            </div>
                          ) : (
                            <>
                              {canAct && (
                                <div className="flex flex-col space-y-1 opacity-0 group-hover:opacity-100 transition-opacity">
                                   <button onClick={() => startEditing(msg)} className="p-1.5 text-slate-400 hover:text-blue-600 transition-colors bg-white rounded-lg border border-slate-100 shadow-sm">
                                      <Edit2 size={12} />
                                   </button>
                                   <button onClick={() => handleDelete(msg.id)} className="p-1.5 text-slate-400 hover:text-red-600 transition-colors bg-white rounded-lg border border-slate-100 shadow-sm">
                                      <Trash2 size={12} />
                                   </button>
                                </div>
                              )}
                              <div className={`px-4 py-3 rounded-2xl text-[13px] shadow-sm ${
                                isMe ? 'bg-[#003366] text-white rounded-tr-none shadow-blue-900/10' : 'bg-slate-100 text-slate-800 rounded-tl-none border border-slate-200'
                              }`}>
                                <p className="font-medium leading-relaxed whitespace-pre-wrap">{msg.text}</p>
                              </div>
                            </>
                          )}
                        </div>
                        <div className="flex items-center space-x-2 mt-1.5 px-1">
                          <span className="text-[9px] text-slate-400 font-bold uppercase tracking-tighter">
                            {msg.senderName} • {formatDate(msg.createdAt)}
                            {msg.updatedAt && <span className="ml-1 normal-case text-blue-400 font-medium italic">(edited)</span>}
                          </span>
                        </div>
                      </div>
                    );
                  })}
                  <div ref={chatEndRef} />
                </div>
              )}
            </div>
          )}
        </div>

        {/* Chat Input */}
        {view === 'chat' && (
          <div className="p-4 bg-white border-t border-slate-100 sticky bottom-0 z-30 shadow-[0_-10px_20px_rgba(0,0,0,0.02)]">
            <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
              <input 
                type="text" 
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                placeholder="Message maintenance staff..."
                className="flex-1 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-1.5rem text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
              />
              <button 
                type="submit"
                disabled={sending || !messageText.trim()}
                className="p-4 bg-[#003366] text-white rounded-1.5rem hover:bg-blue-900 transition-all active:scale-90 disabled:opacity-30 shadow-xl shadow-blue-900/20"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
  );
}

// Timeline Sub-component (Fixed classes)
function TimelineStep({ title, person, role, date, status, icon, note }: {
  title: string; person: string; role: string; date: string | null;
  status: 'done' | 'upcoming' | 'rejected'; icon: React.ReactNode; note?: string;
}) {
  return (
    <div className="relative group">
      <div className={`absolute -left-[24.5px] top-1.5 w-4 h-4 rounded-full border-2 z-10 transition-all duration-500 ${
        status === 'done' ? 'bg-blue-600 border-blue-600' : 
        status === 'rejected' ? 'bg-red-600 border-red-600' : 'bg-white border-slate-200'
      }`}>
        <div className={`absolute inset-0 flex items-center justify-center text-[8px] text-white transition-opacity ${status !== 'upcoming' ? 'opacity-100' : 'opacity-0'}`}>
          {status === 'rejected' ? <X size={8} /> : <CheckCircle2 size={8} />}
        </div>
      </div>

      <div className={`transition-all duration-300 ${status === 'upcoming' ? 'opacity-40 grayscale' : 'opacity-100'}`}>
        <div className="flex justify-between items-start">
           <div>
              <h4 className={`text-[11px] font-black uppercase tracking-wider mb-0.5 ${status === 'rejected' ? 'text-red-600' : 'text-slate-900'}`}>{title}</h4>
              <div className="flex items-center space-x-2 text-xs">
                <span className="font-bold text-slate-700">{person}</span>
                <span className="text-[10px] text-slate-400 font-medium px-1.5 py-0.5 bg-slate-50 rounded-md border border-slate-100">{role}</span>
              </div>
              {note && (
                <p className={`mt-2 p-2 rounded-xl text-[11px] font-medium leading-relaxed border ${status === 'rejected' ? 'bg-red-50 text-red-700 border-red-100' : 'bg-blue-50 text-blue-700 border-blue-100'}`}>
                  {note}
                </p>
              )}
           </div>
           <div className="text-right">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-tighter tabular-nums">{date || 'Awaiting'}</p>
              <div className={`mt-1 flex justify-end transition-colors ${status === 'done' ? 'text-blue-500' : status === 'rejected' ? 'text-red-500' : 'text-slate-300'}`}>
                {icon}
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
