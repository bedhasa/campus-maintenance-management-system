
import React, { useEffect, useMemo, useState } from 'react';
import { useApp } from '../../App';
import { useNavigate } from '../../lib/router-dom-shim';
import { TicketStatus } from '../../types';
import { 
  PlusCircle, ClipboardList, Clock, 
  CheckCircle2, FileText,
  AlertCircle, ChevronRight
} from 'lucide-react';
import { apiRequest } from '../../lib/api';
import RequestDetailModal from '../../components/RequestDetailModal';

type ApiRequestItem = {
  id: number;
  title: string;
  status: 'submitted' | 'approved' | 'assigned' | 'in_progress' | 'completed' | 'rejected' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  created_at: string;
};

type DashboardResponse = {
  success: boolean;
  summary: {
    total: number;
    submitted: number;
    in_progress: number;
    completed: number;
    rejected: number;
    closed: number;
  };
  recent_requests: ApiRequestItem[];
};

const normalizeStatus = (status: ApiRequestItem['status']): TicketStatus => {
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
    case 'rejected':
      return TicketStatus.REJECTED;
    case 'closed':
      return TicketStatus.COMPLETED;
    default:
      return TicketStatus.PENDING;
  }
};

const TrackingPage: React.FC = () => {
  const { currentUser, t } = useApp();
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
        const message = err instanceof Error ? err.message : 'Failed to load dashboard.';
        setError(message);
      } finally {
        setIsLoading(false);
      }
    };

    loadDashboard();
  }, []);

  const stats = useMemo(() => ([
    { label: 'Submitted', value: summary?.submitted ?? 0, icon: <FileText size={20} />, bg: 'bg-amber-50', text: 'text-amber-600' },
    { label: 'In Progress', value: summary?.in_progress ?? 0, icon: <Clock size={20} />, bg: 'bg-blue-50', text: 'text-blue-600' },
    { label: 'Completed', value: summary?.completed ?? 0, icon: <CheckCircle2 size={20} />, bg: 'bg-emerald-50', text: 'text-emerald-600' },
    { label: 'Total', value: summary?.total ?? 0, icon: <ClipboardList size={20} />, bg: 'bg-gray-50', text: 'text-gray-600' },
  ]), [summary]);

  const handleOpen = (requestId: number) => {
    setActiveRequestId(requestId);
  };

  const firstName = currentUser?.firstName || currentUser?.name || 'Requester';

  return (
    <div className="space-y-8 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h1 className="text-3xl font-black text-gray-900 leading-none">
            {t('welcome')}, {firstName}!
          </h1>
          <p className="text-sm text-gray-500 mt-2 font-medium italic">Campus Maintenance Dashboard</p>
        </div>
        <button 
          onClick={() => navigate('/requester/submit')}
          className="flex items-center space-x-3 px-8 py-4 bg-[#003366] text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-900 transition-all shadow-xl active:scale-95 group"
        >
          <PlusCircle size={18} />
          <span>Report New Issue</span>
        </button>
      </div>

      {/* Summary Cards Grid */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
        {stats.map((stat, idx) => (
          <div key={idx} className="bg-white p-6 rounded-2xl border border-gray-100 shadow-soft">
            <div className={`w-10 h-10 rounded-xl ${stat.bg} ${stat.text} flex items-center justify-center mb-4`}>
              {stat.icon}
            </div>
            <p className="text-[10px] font-black text-gray-400 uppercase tracking-widest">{stat.label}</p>
            <h3 className="text-2xl md:text-3xl font-black text-gray-900 mt-1">{stat.value}</h3>
          </div>
        ))}
      </div>

      <div className="grid md:grid-cols-3 gap-8">
        <div className="md:col-span-3">
          <div className="bg-white rounded-4xl p-6 md:p-8 border border-gray-100 shadow-soft flex flex-col">
            <div className="flex items-center justify-between mb-8 border-b border-gray-50 pb-4">
              <h2 className="text-sm font-black text-gray-900 uppercase tracking-widest">Recent Requests</h2>
              <button onClick={() => navigate('/requester/history')} className="text-[10px] font-black text-blue-600 uppercase tracking-widest hover:underline">Full Archive</button>
            </div>
            
            <div className="space-y-4">
              {isLoading && (
                <div className="p-8 text-center text-sm font-medium text-gray-500">Loading dashboard...</div>
              )}
              {error && (
                <div className="p-4 rounded-xl bg-red-50 border border-red-100 text-red-600 text-sm font-bold">
                  {error}
                </div>
              )}
              {!isLoading && !error && recentRequests.length > 0 ? recentRequests.map(req => (
                <div 
                  key={req.id} 
                  onClick={() => handleOpen(req.id)}
                  className="flex items-center justify-between p-4 bg-gray-50/50 rounded-2xl hover:bg-white hover:shadow-soft border border-transparent hover:border-gray-100 transition-all cursor-pointer group"
                >
                  <div className="flex items-center space-x-4">
                    <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-blue-600 border border-gray-100 shadow-sm">
                      <AlertCircle size={20} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-black text-gray-900 truncate">{req.title}</p>
                      <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest mt-0.5">MR-{req.id}</p>
                    </div>
                  </div>
                  <div className="flex items-center space-x-4">
                    <div className={`hidden sm:flex px-3 py-1 rounded-xl text-[9px] font-black uppercase tracking-widest items-center space-x-2 border ${
                      normalizeStatus(req.status) === TicketStatus.PENDING ? 'bg-amber-50 text-amber-600 border-amber-100' :
                      normalizeStatus(req.status) === TicketStatus.COMPLETED ? 'bg-emerald-50 text-emerald-600 border-emerald-100' :
                      'bg-blue-50 text-blue-600 border-blue-100'
                    }`}>
                      <span>{normalizeStatus(req.status).replace('_', ' ')}</span>
                    </div>
                    <ChevronRight size={18} className="text-gray-300 group-hover:text-blue-600 transition-colors" />
                  </div>
                </div>
              )) : (
                !isLoading && !error && (
                  <div className="h-64 flex flex-col items-center justify-center text-center opacity-30">
                    <ClipboardList size={48} className="mb-4" />
                    <p className="text-xs font-black uppercase tracking-widest">Everything is up to date</p>
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      </div>

      {activeRequestId && (
        <RequestDetailModal
          request={{ id: String(activeRequestId) } as any}
          onClose={() => setActiveRequestId(null)}
        />
      )}
    </div>
  );
};

export default TrackingPage;
