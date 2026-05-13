import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../App';
import { useNavigate } from '../../lib/router-dom-shim';
import { MaintenanceRequest, Priority, TicketStatus } from '../../types';
import { 
  ClipboardList, Clock, 
  CheckCircle2, FileText,
  AlertCircle, ChevronRight,
  LayoutDashboard, ThumbsUp, XCircle,
  ArrowRightCircle
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import RequestDetailModal from '../../components/RequestDetailModal';
import { ListSkeleton } from '../../components/PageSkeleton';

// ... (Types and Helper functions stay exactly as you had them)
type ApiRequestItem = {
  id: number;
  title: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status: 'submitted' | 'approved' | 'assigned' | 'in_progress' | 'completed' | 'rejected' | 'closed' | 'cancelled';
  created_at: string;
  updated_at?: string;
};

type DashboardResponse = {
  success: boolean;
  summary: {
    submitted: number;
    approved?: number; // Added if available from backend
    assigned?: number;
    in_progress: number;
    completed: number;
    closed?: number;
    rejected?: number; // Added if available from backend
    cancelled?: number;
    total: number;
  };
  recent_requests?: ApiRequestItem[];
};

const normalizeStatus = (status: ApiRequestItem['status']): TicketStatus => {
  switch (status) {
    case 'submitted': return TicketStatus.PENDING;
    case 'approved': return TicketStatus.APPROVED;
    case 'assigned': return TicketStatus.ASSIGNED;
    case 'in_progress': return TicketStatus.IN_PROGRESS;
    case 'completed': return TicketStatus.COMPLETED;
    case 'closed': return TicketStatus.CLOSED;
    case 'rejected': return TicketStatus.REJECTED;
    case 'cancelled': return TicketStatus.CANCELLED;
    default: return TicketStatus.PENDING;
  }
};

const priorityFromApi = (priority?: ApiRequestItem['priority']): Priority => {
  switch (priority) {
    case 'low': return Priority.LOW;
    case 'high': return Priority.HIGH;
    case 'urgent': return Priority.CRITICAL;
    default: return Priority.MEDIUM;
  }
};

const TrackingPage: React.FC = () => {
  const { currentUser } = useApp();
  const navigate = useNavigate();
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<DashboardResponse['summary'] | null>(null);
  const [recentRequests, setRecentRequests] = useState<ApiRequestItem[]>([]);
  const [activeRequestId, setActiveRequestId] = useState<number | null>(null);

  useEffect(() => {
    const loadDashboard = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const data = await apiRequest<DashboardResponse>('/api/requester/dashboard', { method: 'GET' }, true);
        setSummary(data.summary);
        setRecentRequests(data.recent_requests ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Connection failed');
      } finally {
        setIsLoading(false);
      }
    };
    loadDashboard();
  }, []);

  // NEW KPI CARD LOGIC
  const stats = useMemo(() => ([
    { label: 'Total', value: summary?.total ?? 0, icon: <LayoutDashboard size={20} />, color: 'text-slate-600', bg: 'bg-slate-100', border: 'border-slate-200' },
    { label: 'Pending', value: summary?.submitted ?? 0, icon: <FileText size={20} />, color: 'text-amber-600', bg: 'bg-amber-50', border: 'border-amber-100' },
    { label: 'Approved', value: summary?.approved ?? 0, icon: <ThumbsUp size={20} />, color: 'text-indigo-600', bg: 'bg-indigo-50', border: 'border-indigo-100' },
    { label: 'In Progress', value: (summary?.in_progress ?? 0) + (summary?.assigned ?? 0), icon: <Clock size={20} />, color: 'text-blue-600', bg: 'bg-blue-50', border: 'border-blue-100' },
    { label: 'Rejected', value: summary?.rejected ?? 0, icon: <XCircle size={20} />, color: 'text-rose-600', bg: 'bg-rose-50', border: 'border-rose-100' },
    { label: 'Completed', value: (summary?.completed ?? 0) + (summary?.closed ?? 0), icon: <CheckCircle2 size={20} />, color: 'text-emerald-600', bg: 'bg-emerald-50', border: 'border-emerald-100' },
  ]), [summary]);

  const firstName = currentUser?.firstName || currentUser?.name || 'User';

  const selectedRequest = useMemo<MaintenanceRequest | null>(() => {
    if (activeRequestId == null) return null;
    const request = recentRequests.find((item) => item.id === activeRequestId);
    if (!request) return null;

    return {
  id: String(request.id),
  title: request.title,
  requesterId: String((currentUser as any)?.id ?? ''),
  requesterName: firstName,
  department: currentUser?.department || 'Department',
  location: 'Campus Site',
  problemType: 'Maintenance',
  urgency: priorityFromApi(request.priority),
  description: request.title,
  status: normalizeStatus(request.status),
  createdAt: request.created_at,
  updatedAt: request.updated_at ?? request.created_at,
} as MaintenanceRequest
  }, [activeRequestId, recentRequests, currentUser, firstName]);

  return (
    <div className="max-w-7xl mx-auto px-4 pb-32 pt-6 space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-700">
      
      {/* 1. Enhanced Header */}
      <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-100 pb-6">
        <div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">
            Hi, {firstName} 👋
          </h1>
          <p className="text-sm font-bold text-slate-400 uppercase tracking-widest mt-1">
            Track and manage your maintenance requests
          </p>
        </div>
        <button 
          onClick={() => navigate('/requester/new')}
          className="flex items-center justify-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg shadow-blue-200 active:scale-95"
        >
          <ArrowRightCircle size={18} />
          New Request
        </button>
      </header>

      {/* 2. New KPI Grid (6 Cards) */}
      <section className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
        {stats.map((stat, idx) => (
          <div key={idx} className={`bg-white p-5 rounded-[2rem] border ${stat.border} shadow-sm transition-transform hover:-translate-y-1`}>
            <div className={`w-10 h-10 rounded-2xl ${stat.bg} ${stat.color} flex items-center justify-center mb-3`}>
              {stat.icon}
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">{stat.label}</p>
            <p className="text-2xl font-black text-slate-900">{stat.value}</p>
          </div>
        ))}
      </section>

      {/* 3. Recent Activity Section */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-sm font-black text-slate-900 uppercase tracking-[0.2em]">Live Activity</h2>
          <span className="h-px flex-1 bg-slate-100 mx-4 hidden md:block" />
          <button 
            onClick={() => navigate('/requester/history')} 
            className="group flex items-center gap-1 text-[10px] font-black text-blue-600 uppercase tracking-widest"
          >
            Full History
            <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
          </button>
        </div>

        <div className="grid gap-3">
          {isLoading ? (
            <ListSkeleton rows={4} className="rounded-[2rem]" />
          ) : error ? (
            <div className="bg-rose-50 border border-rose-100 rounded-[2rem] p-10 text-center text-rose-600 font-bold">
              {error}
            </div>
          ) : recentRequests.length > 0 ? (
            recentRequests.map(req => (
              <button 
                key={req.id} 
                onClick={() => setActiveRequestId(req.id)}
                className="w-full flex items-center justify-between p-5 bg-white rounded-[2rem] border border-slate-100 hover:border-blue-200 hover:shadow-md transition-all text-left group"
              >
                <div className="flex items-center gap-5 min-w-0">
                  <div className="shrink-0 w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 group-hover:bg-blue-50 group-hover:text-blue-600 transition-colors">
                    <ClipboardList size={22} />
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-3 mb-1">
                      <span className="text-[10px] font-black text-blue-600 bg-blue-50 px-2 py-0.5 rounded-lg">#{req.id}</span>
                      <StatusBadge status={normalizeStatus(req.status)} />
                    </div>
                    <p className="text-base font-black text-slate-900 truncate">{req.title}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 text-slate-300">
                   <div className="hidden sm:block text-right pr-4 border-r border-slate-100">
                      <p className="text-[9px] font-black uppercase text-slate-400 tracking-tighter">Updated</p>
                      <p className="text-[10px] font-bold text-slate-600">{new Date(req.created_at).toLocaleDateString()}</p>
                   </div>
                   <ChevronRight size={20} className="group-hover:translate-x-1 transition-transform text-slate-300 group-hover:text-blue-600" />
                </div>
              </button>
            ))
          ) : (
            <div className="bg-slate-50/50 rounded-[3rem] border-2 border-dashed border-slate-200 py-20 flex flex-col items-center justify-center text-slate-400">
              <ClipboardList size={48} strokeWidth={1} className="mb-4 opacity-20" />
              <p className="text-xs font-black uppercase tracking-[0.2em]">No requests found yet</p>
            </div>
          )}
        </div>
      </section>

      {/* 4. MODAL INTEGRATION */}
      {selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          onClose={() => setActiveRequestId(null)}
        />
      )}

    </div>
  );
};

const StatusBadge = ({ status }: { status: TicketStatus }) => {
  const styles = {
    [TicketStatus.PENDING]: 'bg-amber-50 text-amber-600 border-amber-100',
    [TicketStatus.APPROVED]: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    [TicketStatus.IN_PROGRESS]: 'bg-blue-50 text-blue-600 border-blue-100',
    [TicketStatus.COMPLETED]: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    [TicketStatus.REJECTED]: 'bg-rose-50 text-rose-600 border-rose-100',
    [TicketStatus.CANCELLED]: 'bg-slate-50 text-slate-600 border-slate-100',
    [TicketStatus.ASSIGNED]: 'bg-cyan-50 text-cyan-600 border-cyan-100',
    [TicketStatus.CLOSED]: 'bg-slate-50 text-slate-600 border-slate-100',
  };
  const currentStyle = styles[status as keyof typeof styles] || 'bg-slate-50 text-slate-400 border-slate-100';
  return (
    <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-lg border ${currentStyle}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

export default TrackingPage;
