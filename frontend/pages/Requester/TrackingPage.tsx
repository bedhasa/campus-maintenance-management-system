import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../App';
import { useNavigate } from '../../lib/router-dom-shim';
import { MaintenanceRequest, Priority, TicketStatus } from '../../types';
import { 
  Plus, ClipboardList, Clock, 
  CheckCircle2, FileText,
  AlertCircle, ChevronRight,
  LayoutDashboard
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import RequestDetailModal from '../../components/RequestDetailModal';
import { ListSkeleton } from '../../components/PageSkeleton';

// Types and Enums
type ApiRequestItem = {
  id: number;
  title: string;
  priority?: 'low' | 'medium' | 'high' | 'urgent';
  status: 'submitted' | 'approved' | 'assigned' | 'in_progress' | 'completed' | 'rejected' | 'closed';
  created_at: string;
  updated_at?: string;
};

type DashboardResponse = {
  success: boolean;
  summary: {
    submitted: number;
    in_progress: number;
    completed: number;
    total: number;
  };
  recent_requests?: ApiRequestItem[];
};

// Logic: Status and Priority Mapping (Preserved)
const normalizeStatus = (status: ApiRequestItem['status']): TicketStatus => {
  switch (status) {
    case 'submitted': return TicketStatus.PENDING;
    case 'approved': return TicketStatus.APPROVED;
    case 'assigned': return TicketStatus.ASSIGNED;
    case 'in_progress': return TicketStatus.IN_PROGRESS;
    case 'completed': return TicketStatus.COMPLETED;
    case 'closed': return TicketStatus.CLOSED;
    case 'rejected': return TicketStatus.REJECTED;
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

  const stats = useMemo(() => ([
    { label: 'Pending', value: summary?.submitted ?? 0, icon: <FileText size={18} />, color: 'text-amber-600', bg: 'bg-amber-50' },
    { label: 'Active', value: summary?.in_progress ?? 0, icon: <Clock size={18} />, color: 'text-blue-600', bg: 'bg-blue-50' },
    { label: 'Done', value: summary?.completed ?? 0, icon: <CheckCircle2 size={18} />, color: 'text-emerald-600', bg: 'bg-emerald-50' },
    { label: 'All', value: summary?.total ?? 0, icon: <LayoutDashboard size={18} />, color: 'text-slate-600', bg: 'bg-slate-50' },
  ]), [summary]);

  const firstName = currentUser?.firstName || currentUser?.name || 'User';

  // Map the selected API item to the formal MaintenanceRequest type for the Modal
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
    };
  }, [activeRequestId, recentRequests, currentUser, firstName]);

  return (
    <div className="max-w-md mx-auto px-4 pb-24 pt-4 space-y-6 animate-in fade-in duration-500">
      
      {/* 1. Dynamic Greeting Header */}
      <header className="flex justify-between items-end pt-2">
        <div>
          <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em] mb-1">Requester Portal</p>
          <h1 className="text-2xl font-black text-slate-900 leading-none">
            Welcome, {firstName}
          </h1>
        </div>
        <button 
          onClick={() => navigate('/requester/submit')}
          className="h-12 w-12 bg-slate-900 text-white rounded-2xl flex items-center justify-center shadow-lg active:scale-90 transition-all"
        >
          <Plus size={24} />
        </button>
      </header>

      {/* 2. Visual Summary Grid */}
      <section className="grid grid-cols-2 gap-3">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-4 rounded-[1.5rem] border border-slate-100 flex items-center gap-3">
            <div className={`shrink-0 w-9 h-9 rounded-xl ${stat.bg} ${stat.color} flex items-center justify-center`}>
              {stat.icon}
            </div>
            <div className="min-w-0">
              <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">{stat.label}</p>
              <p className="text-xl font-black text-slate-900 leading-none">{stat.value}</p>
            </div>
          </div>
        ))}
      </section>

      {/* 3. Recent Requests List */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-xs font-black text-slate-900 uppercase tracking-widest">Recent Activity</h2>
          <button 
            onClick={() => navigate('/requester/history')} 
            className="text-[10px] font-black text-blue-600 uppercase tracking-widest"
          >
            Archive
          </button>
        </div>

        <div className="bg-white rounded-[2rem] border border-slate-100 shadow-sm overflow-hidden">
          {isLoading ? (
            <ListSkeleton rows={4} className="p-4 space-y-4" />
          ) : error ? (
            <div className="p-8 text-center">
              <p className="text-xs font-bold text-red-500">{error}</p>
            </div>
          ) : recentRequests.length > 0 ? (
            <div className="divide-y divide-slate-50">
              {recentRequests.map(req => (
                <button 
                  key={req.id} 
                  onClick={() => setActiveRequestId(req.id)}
                  className="w-full flex items-center justify-between p-4 hover:bg-slate-50 active:bg-slate-100 transition-colors text-left group"
                >
                  <div className="flex items-center gap-4 min-w-0">
                    <div className="shrink-0 w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-300 group-hover:text-blue-500 transition-colors">
                      <AlertCircle size={20} />
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-bold text-slate-900 truncate pr-2">{req.title}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">ID-{req.id}</span>
                        <StatusBadge status={normalizeStatus(req.status)} />
                      </div>
                    </div>
                  </div>
                  <ChevronRight size={16} className="text-slate-300" />
                </button>
              ))}
            </div>
          ) : (
            <div className="py-16 flex flex-col items-center justify-center text-slate-300">
              <ClipboardList size={40} strokeWidth={1.5} />
              <p className="text-[10px] font-black uppercase tracking-widest mt-4">All caught up</p>
            </div>
          )}
        </div>
      </section>

      {/* Modal Integration */}
      {selectedRequest && (
        <RequestDetailModal
          request={selectedRequest}
          onClose={() => setActiveRequestId(null)}
        />
      )}
    </div>
  );
};

// Internal Sub-component for clean status rendering
const StatusBadge = ({ status }: { status: TicketStatus }) => {
  const styles = {
    [TicketStatus.PENDING]: 'bg-amber-50 text-amber-600 border-amber-100',
    [TicketStatus.COMPLETED]: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    [TicketStatus.REJECTED]: 'bg-red-50 text-red-600 border-red-100',
  };
  
  const currentStyle = styles[status as keyof typeof styles] || 'bg-blue-50 text-blue-600 border-blue-100';

  return (
    <span className={`text-[8px] font-black uppercase px-1.5 py-0.5 rounded-md border ${currentStyle}`}>
      {status.replace('_', ' ')}
    </span>
  );
};

export default TrackingPage;