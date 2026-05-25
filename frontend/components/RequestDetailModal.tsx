'use client';

import React, { useState, useRef, useEffect, useMemo, useCallback } from 'react';
import { 
  X, MapPin, Wrench, FileText, MessageSquare, Send, 
  Clock, Phone, User, CheckCircle2, 
  UserCheck, ShieldCheck, PlayCircle, ClipboardCheck,
  Edit2, Trash2, Check, Star, CheckCheck
} from 'lucide-react';

import { MaintenanceRequest, Priority, RequestMessage, TicketStatus } from '@/types';
import StatusBadge from './StatusBadge';
import OverlayMessage from './OverlayMessage';
import { useApp } from '@/context/AppContext'; 
import { apiRequest } from '@/lib/api';
import { useLiveRefresh } from '@/lib/use-live-refresh';
import { useNavigate } from '@/lib/router-dom-shim';
import { buildRequestRealtimeTopics, emitRealtimeTopics } from '@/lib/realtime';

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
  email?: string | null;
  profile_picture_url?: string | null;
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
  status: 'submitted' | 'approved' | 'assigned' | 'in_progress' | 'completed' | 'rejected' | 'closed' | 'cancelled';
  created_at: string;
  updated_at?: string;
  due_date?: string | null;
  category_id?: number | null;
  building_id?: number | null;
  room_id?: number | null;
  asset_id?: number | null;
  custom_location?: string | null;
  category?: { id?: number; name: string } | null;
  building?: { id?: number; name: string } | null;
  room?: { id?: number; name: string } | null;
  asset?: { id?: number; name: string } | null;
  requester?: ApiUser | null;
  statusLogs?: ApiStatusLog[];
  status_logs?: ApiStatusLog[];
  messages?: ApiMessage[];
  work_orders?: Array<{
    id: number;
    work_status: string;
    scheduled_date?: string | null;
    scheduled_time?: string | null;
    started_at?: string | null;
    paused_at?: string | null;
    assignee?: ApiUser | null;
  }>;
  rating?: {
    rating: number;
    comment?: string | null;
    created_at: string;
  } | null;
};

type ParticipantState = {
  requester?: ApiUser | null;
  technician?: ApiUser | null;
};

type WorkOrderState = {
  workStatus?: string | null;
  scheduledTime?: string | null;
  startedAt?: string | null;
  pausedAt?: string | null;
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
  asset_id: number | null;
  asset_name?: string | null;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status?: 'submitted' | 'approved' | 'assigned' | 'in_progress' | 'completed' | 'rejected' | 'closed' | 'cancelled';
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
      return TicketStatus.COMPLETED;
    case 'closed':
      return TicketStatus.CLOSED;
    case 'rejected':
      return TicketStatus.REJECTED;
    case 'cancelled':
      return TicketStatus.CANCELLED;
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

const formatTimeValue = (value?: string | null): string | null => {
  if (!value) return null;

  const directTimeMatch = value.match(/^(\d{1,2}):(\d{2})/);
  if (directTimeMatch) {
    return `${directTimeMatch[1].padStart(2, '0')}:${directTimeMatch[2]}`;
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;

  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  }).format(parsed);
};

const hasRequesterApprovalPendingClosure = (detail: ApiRequestDetail): boolean => {
  const logs = detail.statusLogs ?? detail.status_logs ?? [];
  return (
    detail.status === 'completed' &&
    logs.some(
      (log) =>
        log.new_status === 'completed' &&
        (log.comment ?? '').toLowerCase().includes('requester approved the completed work'),
    )
  );
};

const mapApiDetailToMaintenanceRequest = (
  detail: ApiRequestDetail,
  fallback: MaintenanceRequest
): MaintenanceRequest => {
  const logs = detail.statusLogs ?? detail.status_logs ?? [];
  const latestWorkOrder = (detail.work_orders ?? [])[0];
  const approvedLog = logs.find((log) => log.new_status === 'approved');
  const assignedLog = logs.find((log) => log.new_status === 'assigned');
  const rejectedLog = logs.find((log) => log.new_status === 'rejected');
  const completedLog = logs.find((log) => log.new_status === 'completed' || log.new_status === 'closed');
  const requesterName = fullName(detail.requester) || fallback.requesterName || 'Requester';
  const location = detail.custom_location || [detail.building?.name, detail.room?.name].filter(Boolean).join(' / ') || fallback.location || '-';
  const scheduledAt = latestWorkOrder?.scheduled_date
    ? formatTimeValue(`${latestWorkOrder.scheduled_date}${latestWorkOrder.scheduled_time ? ` ${latestWorkOrder.scheduled_time}` : ''}`)
    : fallback.scheduledAt;

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
    technicianName: fullName(latestWorkOrder?.assignee) || fullName(actorFromLog(assignedLog)) || fallback.technicianName,
    technicianPhone: latestWorkOrder?.assignee?.phone ?? actorFromLog(assignedLog)?.phone ?? fallback.technicianPhone,
    assignedAt: assignedLog?.created_at ?? fallback.assignedAt,
    scheduledAt: scheduledAt ?? undefined,
    completedAt: completedLog?.created_at ?? fallback.completedAt,
    completionNotes: completedLog?.comment ?? fallback.completionNotes,
    rejectionReason: rejectedLog?.comment ?? fallback.rejectionReason,
    rating: detail.rating?.rating ?? fallback.rating,
    requesterComment: detail.rating?.comment ?? fallback.requesterComment,
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
  const { currentUser, requests } = useApp();
  const [messageText, setMessageText] = useState('');
  const [view, setView] = useState<'info' | 'chat'>(initialView);
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [rawStatus, setRawStatus] = useState<ApiRequestDetail['status'] | null>(null);
  const [participants, setParticipants] = useState<ParticipantState>({});
  const [ratingForm, setRatingForm] = useState({ rating: 5, comment: '' });
  const [ratingSaving, setRatingSaving] = useState(false);
  const [verifyBusy, setVerifyBusy] = useState(false);
  const [reopenReason, setReopenReason] = useState('');
  const [editRequestState, setEditRequestState] = useState<EditRequestState | null>(null);
  const [workOrderState, setWorkOrderState] = useState<WorkOrderState>({});
  const [requesterApprovalPendingClosure, setRequesterApprovalPendingClosure] = useState(false);
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
  const canEditRequest =
    rawStatus === 'submitted' ||
    rawStatus === 'rejected' ||
    rawStatus === 'cancelled' ||
    (!rawStatus && (request.status === TicketStatus.PENDING || request.status === TicketStatus.REJECTED || request.status === TicketStatus.CANCELLED));
  const canCancelRequest = rawStatus === 'submitted' || (!rawStatus && request.status === TicketStatus.PENDING);
  const chatLocked = rawStatus === 'closed';
  const canSubmitFeedback = (rawStatus === 'closed' || requesterApprovalPendingClosure) && !request.rating;
  const canRequesterReopenResolvedRequest =
    rawStatus === 'closed' || (rawStatus === 'completed' && requesterApprovalPendingClosure);

  const mapToEditState = useCallback((detail: ApiRequestDetail): EditRequestState => {
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
      asset_id: detail.asset_id ?? detail.asset?.id ?? null,
      asset_name: detail.asset?.name ?? null,
      priority: detail.priority,
      status: detail.status,
    };
  }, []);

  useEffect(() => {
    setRequest(baseRequest);
  }, [baseRequest]);

  useEffect(() => {
    setView(initialView);
  }, [initialView, initialRequest.id]);

  const loadRequestDetail = useCallback(async (silent = false) => {
    if (!endpointRequestId) return;

    try {
      if (!silent) {
        setIsLoading(true);
        setSuccessMessage(null);
      }
      setLoadError(null);
      const data = await apiRequest<RequestDetailResponse>(
        `/api/requester/requests/${endpointRequestId}`,
        { method: 'GET' },
        true
      );
      setEditRequestState(mapToEditState(data.request));
      setRawStatus(data.request.status);
      setRequesterApprovalPendingClosure(hasRequesterApprovalPendingClosure(data.request));
      setParticipants({
        requester: data.request.requester ?? null,
        technician: (data.request.work_orders ?? [])[0]?.assignee ?? null,
      });
      const activeWorkOrder = (data.request.work_orders ?? [])[0];
      setWorkOrderState({
        workStatus: activeWorkOrder?.work_status ?? null,
        scheduledTime: formatTimeValue(
          activeWorkOrder?.scheduled_date
            ? `${activeWorkOrder.scheduled_date}${activeWorkOrder.scheduled_time ? ` ${activeWorkOrder.scheduled_time}` : ''}`
            : activeWorkOrder?.scheduled_time ?? null
        ),
        startedAt: activeWorkOrder?.started_at ?? null,
        pausedAt: activeWorkOrder?.paused_at ?? null,
      });
      setRequest((prev) => mapApiDetailToMaintenanceRequest(data.request, prev));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to load request details.');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [endpointRequestId, mapToEditState]);

  useEffect(() => {
    void loadRequestDetail();
  }, [loadRequestDetail]);

  const realtimeTopics = useMemo(() => {
    return buildRequestRealtimeTopics(endpointRequestId);
  }, [endpointRequestId]);

  useLiveRefresh(() => loadRequestDetail(true), {
    enabled: Boolean(endpointRequestId),
    topics: realtimeTopics,
    refreshOnFocus: false,
  });

  useEffect(() => {
    if (view === 'chat') {
      chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [request.messages, view]);

  useEffect(() => {
    if (!loadError) return;
    const timer = window.setTimeout(() => setLoadError(null), 6000);
    return () => window.clearTimeout(timer);
  }, [loadError]);

  useEffect(() => {
    if (!successMessage) return;
    const timer = window.setTimeout(() => setSuccessMessage(null), 6000);
    return () => window.clearTimeout(timer);
  }, [successMessage]);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    const message = messageText.trim();
    if (!message || !endpointRequestId || chatLocked) return;

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
      emitRealtimeTopics(buildRequestRealtimeTopics(endpointRequestId), {
        requestId: endpointRequestId,
        action: 'message.created',
      });

      const data = await apiRequest<RequestDetailResponse>(
        `/api/requester/requests/${endpointRequestId}`,
        { method: 'GET' },
        true
      );
      setRawStatus(data.request.status);
      setRequesterApprovalPendingClosure(hasRequesterApprovalPendingClosure(data.request));
      setParticipants({
        requester: data.request.requester ?? null,
        technician: (data.request.work_orders ?? [])[0]?.assignee ?? null,
      });
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
    const run = async () => {
      if (!editValue.trim() || !endpointRequestId) return;

      const parsed = Number(msgId);
      const endpointMessageId = Number.isFinite(parsed) ? String(parsed) : msgId.match(/\d+/)?.[0];
      if (!endpointMessageId) {
        setLoadError('Failed to resolve message id for edit.');
        return;
      }

      try {
        setLoadError(null);
        await apiRequest(
          `/api/requester/requests/${endpointRequestId}/messages/${endpointMessageId}`,
          {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ message: editValue.trim() }),
          },
          true
        );
        emitRealtimeTopics(buildRequestRealtimeTopics(endpointRequestId), {
          requestId: endpointRequestId,
          action: 'message.updated',
        });
        const data = await apiRequest<RequestDetailResponse>(
          `/api/requester/requests/${endpointRequestId}`,
          { method: 'GET' },
          true
        );
        setRawStatus(data.request.status);
        setRequesterApprovalPendingClosure(hasRequesterApprovalPendingClosure(data.request));
        setParticipants({
          requester: data.request.requester ?? null,
          technician: (data.request.work_orders ?? [])[0]?.assignee ?? null,
        });
        setRequest((prev) => mapApiDetailToMaintenanceRequest(data.request, prev));
        setEditingMessageId(null);
        setEditValue('');
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Failed to edit message.');
      }
    };

    void run();
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
        emitRealtimeTopics(buildRequestRealtimeTopics(endpointRequestId), {
          requestId: endpointRequestId,
          action: 'message.deleted',
        });
        const data = await apiRequest<RequestDetailResponse>(
          `/api/requester/requests/${endpointRequestId}`,
          { method: 'GET' },
          true
        );
        setRawStatus(data.request.status);
        setRequesterApprovalPendingClosure(hasRequesterApprovalPendingClosure(data.request));
        setParticipants({
          requester: data.request.requester ?? null,
          technician: (data.request.work_orders ?? [])[0]?.assignee ?? null,
        });
        setRequest((prev) => mapApiDetailToMaintenanceRequest(data.request, prev));
      } catch (error) {
        setLoadError(error instanceof Error ? error.message : 'Failed to delete message.');
      }
    };

    void run();
  };

  const handleSubmitFeedback = async () => {
    if (!endpointRequestId || !canSubmitFeedback) return;
    try {
      setRatingSaving(true);
      setLoadError(null);
      setSuccessMessage(null);
      const response = await apiRequest<{ success: boolean; message?: string }>(
        `/api/requester/requests/${endpointRequestId}/rating`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rating: ratingForm.rating,
            comment: ratingForm.comment.trim() || undefined,
          }),
        },
        true
      );
      setSuccessMessage(response.message || 'Feedback submitted.');
      emitRealtimeTopics(buildRequestRealtimeTopics(endpointRequestId), {
        requestId: endpointRequestId,
        action: 'feedback.submitted',
      });

      const data = await apiRequest<RequestDetailResponse>(
        `/api/requester/requests/${endpointRequestId}`,
        { method: 'GET' },
        true
      );
      setRawStatus(data.request.status);
      setRequesterApprovalPendingClosure(hasRequesterApprovalPendingClosure(data.request));
      setParticipants({
        requester: data.request.requester ?? null,
        technician: (data.request.work_orders ?? [])[0]?.assignee ?? null,
      });
      setRequest((prev) => mapApiDetailToMaintenanceRequest(data.request, prev));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to submit feedback.');
    } finally {
      setRatingSaving(false);
    }
  };

  const handleVerifyCompletion = async (action: 'accept' | 'reopen') => {
    if (!endpointRequestId) return;
    if (action === 'reopen' && !reopenReason.trim()) {
      setLoadError('Please provide a reason before reopening.');
      return;
    }

    try {
      setVerifyBusy(true);
      setLoadError(null);
      setSuccessMessage(null);
      const response = await apiRequest<{ success: boolean; message?: string }>(
        `/api/requester/requests/${endpointRequestId}/verify-completion`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action,
            comment: action === 'reopen' ? reopenReason.trim() : undefined,
          }),
        },
        true
      );
      setSuccessMessage(
        response.message ||
          (action === 'accept'
            ? 'Request approved and closed. You can now provide feedback.'
            : 'Request reopened for additional work.'),
      );
      emitRealtimeTopics(buildRequestRealtimeTopics(endpointRequestId), {
        requestId: endpointRequestId,
        action: `verify.${action}`,
      });

      const data = await apiRequest<RequestDetailResponse>(
        `/api/requester/requests/${endpointRequestId}`,
        { method: 'GET' },
        true
      );
      setEditRequestState(mapToEditState(data.request));
      setRawStatus(data.request.status);
      setRequesterApprovalPendingClosure(hasRequesterApprovalPendingClosure(data.request));
      setParticipants({
        requester: data.request.requester ?? null,
        technician: (data.request.work_orders ?? [])[0]?.assignee ?? null,
      });
      const activeWorkOrder = (data.request.work_orders ?? [])[0];
      setWorkOrderState({
        workStatus: activeWorkOrder?.work_status ?? null,
        scheduledTime: formatTimeValue(
          activeWorkOrder?.scheduled_date
            ? `${activeWorkOrder.scheduled_date}${activeWorkOrder.scheduled_time ? ` ${activeWorkOrder.scheduled_time}` : ''}`
            : activeWorkOrder?.scheduled_time ?? null
        ),
        startedAt: activeWorkOrder?.started_at ?? null,
        pausedAt: activeWorkOrder?.paused_at ?? null,
      });
      setRequest((prev) => mapApiDetailToMaintenanceRequest(data.request, prev));
      setReopenReason('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to verify completion.');
    } finally {
      setVerifyBusy(false);
    }
  };

  const handleReopenResolvedRequest = async () => {
    if (!endpointRequestId || !canRequesterReopenResolvedRequest) return;
    if (!reopenReason.trim()) {
      setLoadError('Please explain why this completed request should be reopened.');
      return;
    }

    try {
      setVerifyBusy(true);
      setLoadError(null);
      setSuccessMessage(null);
      const response = await apiRequest<{ success: boolean; message?: string }>(
        `/api/requester/requests/${endpointRequestId}/reopen`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ comment: reopenReason.trim() }),
        },
        true
      );
      setSuccessMessage(response.message || 'Request reopened for additional work.');
      emitRealtimeTopics(buildRequestRealtimeTopics(endpointRequestId), {
        requestId: endpointRequestId,
        action: 'request.reopened',
      });

      const data = await apiRequest<RequestDetailResponse>(
        `/api/requester/requests/${endpointRequestId}`,
        { method: 'GET' },
        true
      );
      setEditRequestState(mapToEditState(data.request));
      setRawStatus(data.request.status);
      setRequesterApprovalPendingClosure(hasRequesterApprovalPendingClosure(data.request));
      setParticipants({
        requester: data.request.requester ?? null,
        technician: (data.request.work_orders ?? [])[0]?.assignee ?? null,
      });
      const activeWorkOrder = (data.request.work_orders ?? [])[0];
      setWorkOrderState({
        workStatus: activeWorkOrder?.work_status ?? null,
        scheduledTime: formatTimeValue(
          activeWorkOrder?.scheduled_date
            ? `${activeWorkOrder.scheduled_date}${activeWorkOrder.scheduled_time ? ` ${activeWorkOrder.scheduled_time}` : ''}`
            : activeWorkOrder?.scheduled_time ?? null
        ),
        startedAt: activeWorkOrder?.started_at ?? null,
        pausedAt: activeWorkOrder?.paused_at ?? null,
      });
      setRequest((prev) => mapApiDetailToMaintenanceRequest(data.request, prev));
      setReopenReason('');
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to reopen request.');
    } finally {
      setVerifyBusy(false);
    }
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return null;
    const parsed = new Date(dateStr);
    if (Number.isNaN(parsed.getTime())) return dateStr;
    return new Intl.DateTimeFormat(undefined, {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(parsed);
  };

  const formatLifecycleTime = (dateStr?: string) => {
    return formatTimeValue(dateStr);
  };

  const formatChatTime = (dateStr?: string) => {
    return formatTimeValue(dateStr) ?? '';
  };

  const getStepStatus = (step: 'pending' | 'approved' | 'assigned' | 'progress' | 'completed') => {
    const status = request.status;
    const order: Record<string, number> = { 'DRAFT': 0, 'PENDING': 1, 'APPROVED': 2, 'ASSIGNED': 3, 'IN_PROGRESS': 4, 'COMPLETED': 5, 'CLOSED': 6, 'REJECTED': -1 };
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

    const isResubmit = editRequestState.status === 'rejected' || editRequestState.status === 'cancelled';
    navigate(`/requester/submit?edit=${editRequestState.id}`, {
      state: {
        editRequest: editRequestState,
        requestIdToResubmit: isResubmit ? editRequestState.id : undefined,
      },
    });
    onClose();
  };

  const handleCancelRequest = async () => {
    if (!endpointRequestId || !canCancelRequest) return;
    const confirmed = window.confirm('Cancel this pending request?');
    if (!confirmed) return;

    try {
      setVerifyBusy(true);
      setLoadError(null);
      setSuccessMessage(null);
      const response = await apiRequest<{ success: boolean; message?: string }>(
        `/api/requester/requests/${endpointRequestId}/cancel`,
        {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({}),
        },
        true
      );
      setSuccessMessage(response.message || 'Request cancelled.');
      emitRealtimeTopics(buildRequestRealtimeTopics(endpointRequestId), {
        requestId: endpointRequestId,
        action: 'request.cancelled',
      });

      const data = await apiRequest<RequestDetailResponse>(
        `/api/requester/requests/${endpointRequestId}`,
        { method: 'GET' },
        true
      );
      setEditRequestState(mapToEditState(data.request));
      setRawStatus(data.request.status);
      setRequesterApprovalPendingClosure(hasRequesterApprovalPendingClosure(data.request));
      setParticipants({
        requester: data.request.requester ?? null,
        technician: (data.request.work_orders ?? [])[0]?.assignee ?? null,
      });
      setRequest((prev) => mapApiDetailToMaintenanceRequest(data.request, prev));
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'Failed to cancel request.');
    } finally {
      setVerifyBusy(false);
    }
  };

  const workProgressTitle =
    workOrderState.workStatus === 'paused'
      ? 'Maintenance Paused'
      : workOrderState.workStatus === 'in_progress'
        ? 'Maintenance Started'
        : 'Maintenance In-Progress';

  const workProgressTime =
    workOrderState.workStatus === 'paused'
      ? formatLifecycleTime(workOrderState.pausedAt ?? request.updatedAt)
      : formatLifecycleTime(workOrderState.startedAt ?? request.updatedAt);

  const workProgressNote =
    workOrderState.workStatus === 'paused'
      ? 'Work is temporarily paused.'
      : workOrderState.workStatus === 'in_progress'
        ? 'Work has started.'
        : undefined;

  return (
    <>
    <OverlayMessage message={loadError} tone="error" />
    <OverlayMessage message={successMessage} tone="success" />
    <div
      className="fixed inset-0 bg-slate-900/80 backdrop-blur-sm z-100 flex items-end md:items-center justify-center p-0 md:p-6 animate-in fade-in duration-300"
      onClick={onClose}
    >
      <div
        className="bg-white w-full max-w-2xl h-[92vh] md:h-auto md:max-h-[90vh] rounded-t-[2.5rem] md:rounded-[3rem] shadow-2xl overflow-hidden flex flex-col border border-slate-200 animate-in slide-in-from-bottom duration-500 md:zoom-in-95"
        onClick={(e) => e.stopPropagation()}
      >
        
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
                <span>
                  {rawStatus === 'rejected' || rawStatus === 'cancelled' || request.status === TicketStatus.REJECTED || request.status === TicketStatus.CANCELLED
                    ? 'Edit & Resubmit'
                    : 'Edit Request'}
                </span>
              </button>
            )}
            {canCancelRequest && (
              <button
                type="button"
                onClick={() => void handleCancelRequest()}
                className="px-3 py-2 bg-rose-50 text-rose-700 hover:bg-rose-100 rounded-xl transition-all text-[10px] font-black uppercase tracking-widest"
              >
                Cancel Request
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
            <span>Chat</span>
            {(request.messages?.length || 0) > 0 && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full animate-pulse"></span>}
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 scrollbar-hide">
          {!isLoading && view === 'info' && rawStatus === 'cancelled' && (
            <p className="text-xs text-rose-700 font-bold mb-3">
              This request was cancelled before supervisor review.
            </p>
          )}
          {!isLoading && view === 'info' && !canEditRequest && (
            <p className="text-xs text-amber-700 font-bold mb-3">
              This request is under review and can no longer be modified.
            </p>
          )}
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-32 space-y-4">
              <div className="w-10 h-10 border-4 border-slate-100 border-t-[#003366] rounded-full animate-spin"></div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest animate-pulse">
                {view === 'info' ? 'Loading Details...' : 'Loading Chat...'}
              </p>
            </div>
          ) : view === 'info' ? (
            <div className="space-y-8 animate-in fade-in slide-in-from-left-2 duration-300">
              {rawStatus === 'submitted' && (
                <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4 text-xs font-bold text-emerald-700">
                  Expected response within 24 hours.
                </div>
              )}

              <div className="grid sm:grid-cols-2 gap-4">
                <div className="bg-white rounded-[1.8rem] border border-slate-100 p-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Requester Contact</p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-slate-100 overflow-hidden flex items-center justify-center text-slate-700 font-black">
                      {participants.requester?.profile_picture_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={participants.requester.profile_picture_url} alt={request.requesterName} className="w-full h-full object-cover" />
                      ) : (
                        (request.requesterName || "R").charAt(0)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">{request.requesterName}</p>
                      <p className="text-[11px] font-bold text-slate-500">{participants.requester?.phone || "-"}</p>
                      <p className="text-[11px] font-bold text-slate-500 truncate">{participants.requester?.email || "-"}</p>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-[1.8rem] border border-slate-100 p-4">
                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-3">Technician Contact</p>
                  <div className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-xl bg-blue-50 overflow-hidden flex items-center justify-center text-blue-700 font-black">
                      {participants.technician?.profile_picture_url ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={participants.technician.profile_picture_url} alt={request.technicianName || "Technician"} className="w-full h-full object-cover" />
                      ) : (
                        (request.technicianName || "T").charAt(0)
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-black text-slate-900 truncate">{request.technicianName || "Pending Assignment"}</p>
                      <p className="text-[11px] font-bold text-slate-500">{participants.technician?.phone || "-"}</p>
                      <p className="text-[11px] font-bold text-slate-500 truncate">{participants.technician?.email || "-"}</p>
                    </div>
                  </div>
                </div>
              </div>
              
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
                      {(workOrderState.scheduledTime || request.scheduledAt) && (
                        <p className="text-[11px] font-bold text-emerald-200 mt-2">Scheduled: {workOrderState.scheduledTime || request.scheduledAt}</p>
                      )}
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
                    <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Location - Building, Room</p>
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
                {editRequestState?.asset_name && (
                  <div className="flex items-start space-x-4">
                    <div className="p-2.5 bg-white rounded-xl text-blue-500 shadow-sm border border-slate-50"><Wrench size={18} /></div>
                    <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Linked Asset</p>
                      <p className="text-sm font-bold text-slate-800">{editRequestState.asset_name}</p>
                    </div>
                  </div>
                )}
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
                      date={formatLifecycleTime(request.createdAt)}
                      status={getStepStatus('pending')}
                      icon={<FileText size={14} />}
                    />
                    {/* Repeat steps similarly... */}
                    <TimelineStep 
                      title={request.status === 'REJECTED' ? "Request Rejected" : "Supervisor Approval"}
                      person={request.approvedBy || "Department Head"}
                      role="Supervisor"
                      date={formatLifecycleTime(request.approvedAt)}
                      status={getStepStatus('approved')}
                      icon={<ShieldCheck size={14} />}
                      note={request.rejectionReason}
                    />
                    <TimelineStep 
                      title="Task Assigned"
                      person={request.technicianName || "Pending Team"}
                      role="Execution Unit"
                      date={formatLifecycleTime(request.assignedAt)}
                      status={getStepStatus('assigned')}
                      icon={<UserCheck size={14} />}
                    />
                    <TimelineStep 
                      title={workProgressTitle}
                      person={request.technicianName || "Assigned Tech"}
                      role="Field Work"
                      date={workProgressTime}
                      status={getStepStatus('progress')}
                      icon={<PlayCircle size={14} />}
                      note={workProgressNote}
                    />
                    <TimelineStep 
                      title="Resolution Verified"
                      person={request.technicianName || "Assigned Tech"}
                      role="Final Completion"
                      date={formatLifecycleTime(request.completedAt)}
                      status={getStepStatus('completed')}
                      icon={<ClipboardCheck size={14} />}
                      note={request.completionNotes}
                    />
                 </div>
              </section>

              {canSubmitFeedback && (
                <section className="rounded-[2.5rem] border border-amber-100 bg-amber-50/60 p-6 space-y-4">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-700 flex items-center gap-2">
                    <Star size={14} /> Rate Completed Work
                  </h3>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Rating</label>
                    <select
                      value={ratingForm.rating}
                      onChange={(e) => setRatingForm((p) => ({ ...p, rating: Number(e.target.value) }))}
                      className="w-full p-3 rounded-xl border border-amber-100 bg-white text-sm font-bold text-slate-800"
                    >
                      <option value={5}>5 - Excellent</option>
                      <option value={4}>4 - Good</option>
                      <option value={3}>3 - Fair</option>
                      <option value={2}>2 - Poor</option>
                      <option value={1}>1 - Very Poor</option>
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black uppercase tracking-widest text-slate-500">Comment</label>
                    <textarea
                      value={ratingForm.comment}
                      onChange={(e) => setRatingForm((p) => ({ ...p, comment: e.target.value }))}
                      placeholder="Share your experience with the completed work..."
                      className="w-full p-3 rounded-xl border border-amber-100 bg-white text-sm min-h-[90px]"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleSubmitFeedback}
                    disabled={ratingSaving}
                    className="w-full py-3 bg-amber-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-amber-600 disabled:opacity-50"
                  >
                    {ratingSaving ? 'Submitting...' : 'Submit Feedback'}
                  </button>
                </section>
              )}

              {rawStatus === 'completed' && !requesterApprovalPendingClosure && (
                <section className="rounded-[2.5rem] border border-blue-100 bg-blue-50/60 p-6 space-y-4">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-blue-700">
                    Approve Completed Work
                  </h3>
                  <p className="text-sm font-medium text-slate-700">
                    Confirm whether the maintenance work is acceptable. After your approval, the supervisor will do the final closure.
                  </p>
                  <textarea
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    placeholder="If reopening, explain what still needs to be fixed."
                    className="w-full p-3 rounded-xl border border-blue-100 bg-white text-sm min-h-[90px]"
                  />
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      disabled={verifyBusy}
                      onClick={() => void handleVerifyCompletion('accept')}
                      className="w-full py-3 bg-emerald-600 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-emerald-700 disabled:opacity-50"
                    >
                      {verifyBusy ? 'Processing...' : 'Approve Completion'}
                    </button>
                    <button
                      type="button"
                      disabled={verifyBusy}
                      onClick={() => void handleVerifyCompletion('reopen')}
                      className="w-full py-3 bg-amber-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-amber-600 disabled:opacity-50"
                    >
                      {verifyBusy ? 'Processing...' : 'Reject and Reopen'}
                    </button>
                  </div>
                </section>
              )}

              {rawStatus === 'completed' && requesterApprovalPendingClosure && (
                <section className="rounded-[2.5rem] border border-emerald-100 bg-emerald-50/60 p-6 space-y-3">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700">
                    Requester Approval Sent
                  </h3>
                  <p className="text-sm font-medium text-slate-700">
                    You already approved this completed work. The supervisor will still see it for final closure, and you can submit rating and feedback now.
                  </p>
                </section>
              )}

              {canRequesterReopenResolvedRequest && (
                <section className="rounded-[2.5rem] border border-amber-100 bg-amber-50/60 p-6 space-y-4">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-amber-700">
                    Reopen If Problem Persists
                  </h3>
                  <p className="text-sm font-medium text-slate-700">
                    If the same issue happened again or was not fully fixed, you can reopen this maintenance request and send it back for additional work.
                  </p>
                  <textarea
                    value={reopenReason}
                    onChange={(e) => setReopenReason(e.target.value)}
                    placeholder="Explain what is still failing or what happened again."
                    className="w-full p-3 rounded-xl border border-amber-100 bg-white text-sm min-h-[90px]"
                  />
                  <button
                    type="button"
                    disabled={verifyBusy}
                    onClick={() => void handleReopenResolvedRequest()}
                    className="w-full py-3 bg-amber-500 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-amber-600 disabled:opacity-50"
                  >
                    {verifyBusy ? 'Processing...' : 'Reopen Request'}
                  </button>
                </section>
              )}

              {request.rating && (
                <section className="rounded-[2.5rem] border border-emerald-100 bg-emerald-50/60 p-6">
                  <h3 className="text-[11px] font-black uppercase tracking-[0.2em] text-emerald-700 mb-3 flex items-center gap-2">
                    <Star size={14} /> Submitted Feedback
                  </h3>
                  <p className="text-sm font-bold text-slate-800">Rating: {request.rating}/5</p>
                  {request.requesterComment && <p className="text-sm text-slate-700 italic mt-2">&quot;{request.requesterComment}&quot;</p>}
                </section>
              )}
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
                  {request.messages.map((msg, index) => {
                    const isMe = msg.senderId === currentUser?.id;
                    const canAct = !chatLocked && isMe;
                    const isEditing = editingMessageId === msg.id;
                    const seenByOtherUser = isMe && request.messages!.slice(index + 1).some((m) => m.senderId !== currentUser?.id);

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
                            {msg.senderName} • {formatChatTime(msg.createdAt)}
                            {msg.updatedAt && <span className="ml-1 normal-case text-blue-400 font-medium italic">(edited)</span>}
                          </span>
                          {isMe && (
                            <span className={`text-[10px] ${seenByOtherUser ? 'text-blue-500' : 'text-slate-400'}`}>
                              {seenByOtherUser ? <CheckCheck size={12} /> : <Check size={12} />}
                            </span>
                          )}
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
            <p className="text-[9px] font-bold text-slate-400 mb-2 uppercase tracking-widest">
              Chat for this request only. You can edit or delete your messages.
            </p>
            <form onSubmit={handleSendMessage} className="flex items-center space-x-2">
              <input 
                type="text" 
                value={messageText}
                onChange={(e) => setMessageText(e.target.value)}
                disabled={chatLocked}
                placeholder={chatLocked ? "Chat is closed after request closure." : "Message maintenance staff..."}
                className="flex-1 px-5 py-3.5 bg-slate-50 border border-slate-100 rounded-1.5rem text-slate-900 placeholder:text-slate-400 text-sm font-medium focus:ring-4 focus:ring-blue-500/10 transition-all outline-none"
              />
              <button 
                type="submit"
                disabled={chatLocked || sending || !messageText.trim()}
                className="p-4 bg-[#003366] text-white rounded-1.5rem hover:bg-blue-900 transition-all active:scale-90 disabled:opacity-30 shadow-xl shadow-blue-900/20"
              >
                <Send size={18} />
              </button>
            </form>
          </div>
        )}
      </div>
    </div>
    </>
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
              <div className="flex items-center text-xs">
                <span className="font-bold text-slate-700">{`${role}: ${person}`}</span>
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
