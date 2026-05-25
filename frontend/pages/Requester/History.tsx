import React, { useCallback, useEffect, useState } from 'react';
import { Search, Filter, ChevronRight, FilterX, History, Calendar, Hash } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import { MaintenanceRequest, TicketStatus, Priority } from '../../types';
import { apiRequest } from '../../lib/api';
import RequestDetailModal from '../../components/RequestDetailModal';
import { ListSkeleton, TableRowsSkeleton } from '../../components/PageSkeleton';
import { useLiveRefresh } from '../../lib/use-live-refresh';

// ... (Types and Mappers stay the same as your logic)
type ApiRequestItem = {
  id: number;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'submitted' | 'approved' | 'assigned' | 'in_progress' | 'completed' | 'rejected' | 'closed' | 'cancelled';
  created_at: string;
};

type PaginatedResponse = {
  success: boolean;
  requests: { data: ApiRequestItem[] };
};

const statusFromApi = (status: ApiRequestItem['status']): TicketStatus => {
  const map: Record<string, TicketStatus> = {
    submitted: TicketStatus.PENDING,
    approved: TicketStatus.APPROVED,
    assigned: TicketStatus.ASSIGNED,
    in_progress: TicketStatus.IN_PROGRESS,
    completed: TicketStatus.COMPLETED,
    closed: TicketStatus.CLOSED,
    rejected: TicketStatus.REJECTED,
    cancelled: TicketStatus.CANCELLED,
  };
  return map[status] || TicketStatus.PENDING;
};

const priorityFromApi = (priority: ApiRequestItem['priority']): Priority => {
  const map: Record<string, Priority> = {
    low: Priority.LOW,
    medium: Priority.MEDIUM,
    high: Priority.HIGH,
    urgent: Priority.CRITICAL,
  };
  return map[priority] || Priority.MEDIUM;
};

const mapApiRequestItemToMaintenanceRequest = (item: ApiRequestItem): MaintenanceRequest => ({
  id: String(item.id),
  title: item.title,
  requesterId: '',
  requesterName: 'Requester',
  department: '',
  location: '',
  problemType: '',
  urgency: priorityFromApi(item.priority),
  description: '',
  status: statusFromApi(item.status),
  createdAt: item.created_at,
  updatedAt: item.created_at,
});

const RequesterHistory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [items, setItems] = useState<ApiRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<number | null>(null);
  const selectedRequest = activeRequestId !== null ? items.find((req) => req.id === activeRequestId) : undefined;

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (searchTerm.trim()) params.set('search', searchTerm.trim());
      if (statusFilter !== 'all') params.set('status', statusFilter);
      const data = await apiRequest<PaginatedResponse>(`/api/requester/requests?${params.toString()}`, { method: 'GET' }, true);
      setItems(data.requests?.data ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load history.');
    } finally {
      setLoading(false);
    }
  }, [searchTerm, statusFilter]);

  useEffect(() => {
    const handle = setTimeout(() => {
      void load();
    }, 300);
    return () => clearTimeout(handle);
  }, [load]);

  useLiveRefresh(load, {
    enabled: true,
    topics: ['requester.requests', 'requests'],
    refreshOnFocus: false,
  });

  return (
    <div className="max-w-7xl mx-auto px-4 pb-32 pt-6 space-y-8 animate-in fade-in duration-700">
      
      {/* 1. Page Header */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
             <History size={16} className="text-blue-600" />
             <p className="text-[10px] font-black text-blue-600 uppercase tracking-[0.2em]">System Logs</p>
          </div>
          <h1 className="text-3xl font-black text-slate-900 tracking-tight">Request History</h1>
        </div>
        
        {/* Search & Filter Compact Box */}
        <div className="flex flex-col sm:flex-row gap-3 w-full md:w-auto">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Search by title..."
              className="w-full sm:w-64 pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:ring-4 focus:ring-blue-500/5 focus:border-blue-500 transition-all"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          
          <div className="flex items-center bg-white border border-slate-200 rounded-2xl px-4">
            <Filter size={14} className="text-slate-400 mr-2" />
            <select 
              value={statusFilter}
              onChange={e => setStatusFilter(e.target.value)}
              className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-slate-600 outline-none py-3 cursor-pointer"
            >
              <option value="all">All Status</option>
              <option value="submitted">Pending</option>
              <option value="approved">Approved</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
              <option value="rejected">Rejected</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>

          {(searchTerm || statusFilter !== 'all') && (
            <button 
              onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
              className="p-3 bg-rose-50 text-rose-600 rounded-2xl hover:bg-rose-100 transition-colors"
            >
              <FilterX size={20} />
            </button>
          )}
        </div>
      </div>

      {/* 2. Content Area */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full text-left hidden md:table">
              <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                <tr>
                  <th className="px-8 py-5">Request Info</th>
                  <th className="px-8 py-5">Priority</th>
                  <th className="px-8 py-5">Status</th>
                  <th className="px-8 py-5">Submitted Date</th>
                  <th className="px-8 py-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                <TableRowsSkeleton rows={5} />
              </tbody>
            </table>

            <div className="p-6 md:hidden">
              <ListSkeleton
                rows={4}
                className="space-y-4"
              />
            </div>
          </div>
        ) : error ? (
          <div className="p-20 text-center text-rose-500 font-bold">{error}</div>
        ) : items.length > 0 ? (
          <div className="overflow-x-auto">
            {/* Desktop Table View */}
            <table className="w-full text-left hidden md:table">
              <thead className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                <tr>
                  <th className="px-8 py-5">Request Info</th>
                  <th className="px-8 py-5">Priority</th>
                  <th className="px-8 py-5">Status</th>
                  <th className="px-8 py-5">Submitted Date</th>
                  <th className="px-8 py-5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {items.map((req) => (
                  <tr 
                    key={req.id} 
                    onClick={() => setActiveRequestId(req.id)}
                    className="hover:bg-blue-50/30 transition-all cursor-pointer group"
                  >
                    <td className="px-8 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-50 flex items-center justify-center text-slate-400 group-hover:bg-white group-hover:text-blue-600 transition-all">
                          <Hash size={18} />
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 group-hover:text-blue-600 transition-colors">{req.title}</p>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Ticket #MR-{req.id}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-6">
                      <StatusBadge priority={priorityFromApi(req.priority)} />
                    </td>
                    <td className="px-8 py-6">
                      <StatusBadge status={statusFromApi(req.status)} />
                    </td>
                    <td className="px-8 py-6 text-xs font-bold text-slate-500">
                      {new Date(req.created_at).toLocaleDateString(undefined, { dateStyle: 'medium' })}
                    </td>
                    <td className="px-8 py-6 text-right">
                       <div className="inline-flex p-2 rounded-xl border border-slate-100 bg-white group-hover:border-blue-200 group-hover:shadow-sm transition-all">
                         <ChevronRight size={18} className="text-slate-300 group-hover:text-blue-600" />
                       </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Mobile Card View */}
            <div className="md:hidden divide-y divide-slate-50">
              {items.map((req) => (
                <button 
                  key={req.id} 
                  onClick={() => setActiveRequestId(req.id)}
                  className="w-full p-6 flex flex-col gap-4 text-left active:bg-slate-50"
                >
                  <div className="flex justify-between items-start">
                    <div>
                      <p className="text-sm font-black text-slate-900 line-clamp-1">{req.title}</p>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">#MR-{req.id}</p>
                    </div>
                    <StatusBadge status={statusFromApi(req.status)} />
                  </div>
                  <div className="flex items-center justify-between mt-2">
                    <div className="flex items-center gap-4">
                      <StatusBadge priority={priorityFromApi(req.priority)} />
                      <div className="flex items-center gap-1.5 text-slate-400">
                        <Calendar size={12} />
                        <span className="text-[10px] font-bold">{new Date(req.created_at).toLocaleDateString()}</span>
                      </div>
                    </div>
                    <ChevronRight size={18} className="text-blue-600" />
                  </div>
                </button>
              ))}
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="py-32 text-center flex flex-col items-center">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center mb-6 text-slate-200">
              <History size={48} strokeWidth={1} />
            </div>
            <h3 className="text-lg font-black text-slate-900 uppercase tracking-widest">No Records Found</h3>
            <p className="text-sm text-slate-500 mt-2 font-medium">We couldn&apos;t find any requests matching your criteria.</p>
          </div>
        )}
      </div>

      {/* Modal Detail View */}
      {selectedRequest && (
        <RequestDetailModal
          request={mapApiRequestItemToMaintenanceRequest(selectedRequest)}
          onClose={() => setActiveRequestId(null)}
        />
      )}
    </div>
  );
};

export default RequesterHistory;
