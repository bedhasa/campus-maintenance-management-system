
import React, { useEffect, useMemo, useState } from 'react';
import { Search, Filter, ChevronRight, FilterX } from 'lucide-react';
import StatusBadge from '../../components/StatusBadge';
import { TicketStatus, Priority } from '../../types';
import { apiRequest } from '../../lib/api';
import RequestDetailModal from '../../components/RequestDetailModal';

type ApiRequestItem = {
  id: number;
  title: string;
  priority: 'low' | 'medium' | 'high' | 'urgent';
  status: 'submitted' | 'approved' | 'assigned' | 'in_progress' | 'completed' | 'rejected' | 'closed';
  created_at: string;
};

type PaginatedResponse = {
  success: boolean;
  requests: {
    data: ApiRequestItem[];
  };
};

const statusFromApi = (status: ApiRequestItem['status']): TicketStatus => {
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

const priorityFromApi = (priority: ApiRequestItem['priority']): Priority => {
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

const RequesterHistory: React.FC = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [items, setItems] = useState<ApiRequestItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeRequestId, setActiveRequestId] = useState<number | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams();
        if (searchTerm.trim()) params.set('search', searchTerm.trim());
        if (statusFilter !== 'all') params.set('status', statusFilter);

        const query = params.toString();
        const data = await apiRequest<PaginatedResponse>(
          `/api/requester/requests${query ? `?${query}` : ''}`,
          { method: 'GET' },
          true
        );
        setItems(data.requests?.data ?? []);
      } catch (err) {
        const message = err instanceof Error ? err.message : 'Failed to load request history.';
        setError(message);
      } finally {
        setLoading(false);
      }
    };

    const handle = setTimeout(load, 250);
    return () => clearTimeout(handle);
  }, [searchTerm, statusFilter]);

  const history = useMemo(() => items, [items]);

  return (
    <div className="space-y-6 pb-20">
      <div>
        <h1 className="text-3xl font-black text-gray-900 leading-none">My Requests</h1>
        <p className="text-sm text-gray-500 mt-2 font-medium italic">History and real-time status archive</p>
      </div>

      <div className="bg-white rounded-4xl shadow-soft border border-gray-100 overflow-hidden">
        {/* Search & Filter Bar */}
        <div className="p-6 border-b flex flex-col md:flex-row gap-4 items-center">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-400" size={18} />
            <input 
              type="text"
              className="w-full pl-12 pr-4 py-3 bg-gray-50/50 rounded-xl border border-gray-100 outline-none focus:ring-4 focus:ring-blue-500/5 transition-all font-medium text-sm"
              value={searchTerm} onChange={e => setSearchTerm(e.target.value)}
            />
          </div>
          <div className="flex items-center space-x-2 w-full md:w-auto">
            <div className="flex items-center bg-gray-50/50 px-4 rounded-xl border border-gray-100 flex-1 md:flex-none">
              <Filter size={16} className="text-gray-400 mr-2" />
              <select 
                value={statusFilter}
                onChange={e => setStatusFilter(e.target.value)}
                className="bg-transparent border-none text-[10px] font-black uppercase tracking-widest text-gray-600 outline-none cursor-pointer py-3"
              >
                <option value="all">Status: All</option>
                <option value="submitted">Submitted</option>
                <option value="approved">Approved</option>
                <option value="assigned">Assigned</option>
                <option value="in_progress">In Progress</option>
                <option value="completed">Completed</option>
                <option value="rejected">Rejected</option>
                <option value="closed">Closed</option>
              </select>
            </div>
            {(searchTerm || statusFilter !== 'all') && (
              <button 
                onClick={() => { setSearchTerm(''); setStatusFilter('all'); }}
                className="p-3 text-red-500 bg-red-50 rounded-xl hover:bg-red-100 transition-colors"
              >
                <FilterX size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Requests Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-gray-50/30 text-[10px] font-black text-gray-500 uppercase tracking-widest border-b border-gray-100">
              <tr>
                <th className="px-8 py-5">Title</th>
                <th className="px-8 py-5">Priority</th>
                <th className="px-8 py-5">Status</th>
                <th className="px-8 py-5">Date</th>
                <th className="px-8 py-5 text-right">View</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {loading && (
                <tr>
                  <td className="px-8 py-8 text-sm font-medium text-gray-500" colSpan={5}>Loading requests...</td>
                </tr>
              )}
              {error && (
                <tr>
                  <td className="px-8 py-8 text-sm font-bold text-red-600" colSpan={5}>{error}</td>
                </tr>
              )}
              {history.map((req) => (
                <tr 
                  key={req.id} 
                  onClick={() => setActiveRequestId(req.id)}
                  className="hover:bg-blue-50/20 transition-all group"
                >
                  <td className="px-8 py-6">
                    <div>
                      <p className="text-sm font-black text-gray-900 group-hover:text-blue-600 transition-colors">{req.title}</p>
                      <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest mt-0.5">ID: MR-{req.id}</p>
                    </div>
                  </td>
                  <td className="px-8 py-6">
                    <StatusBadge priority={priorityFromApi(req.priority)} />
                  </td>
                  <td className="px-8 py-6">
                    <StatusBadge status={statusFromApi(req.status)} />
                  </td>
                  <td className="px-8 py-6">
                    <p className="text-xs font-bold text-gray-600">{new Date(req.created_at).toLocaleDateString()}</p>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end space-x-3">
                      <div className="p-2 bg-white rounded-lg shadow-sm border border-gray-100 group-hover:border-blue-200 transition-all">
                        <ChevronRight size={16} className="text-gray-400 group-hover:text-blue-600" />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!loading && !error && history.length === 0 && (
          <div className="p-24 text-center">
            <div className="w-20 h-20 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-6 text-gray-200">
              <Search size={40} />
            </div>
            <h3 className="text-xl font-black text-gray-900 uppercase tracking-widest">No Requests Found</h3>
            <p className="text-sm text-gray-500 mt-2 font-medium">Try adjusting your filters or report a new issue.</p>
          </div>
        )}
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

export default RequesterHistory;
