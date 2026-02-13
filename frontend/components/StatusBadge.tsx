
import React from 'react';
import { TicketStatus, Priority } from '../types';

interface StatusBadgeProps {
  status?: TicketStatus;
  priority?: Priority;
}

const StatusBadge: React.FC<StatusBadgeProps> = ({ status, priority }) => {
  if (status) {
    const statusConfig: Record<TicketStatus, { bg: string; text: string; dot: string }> = {
      [TicketStatus.DRAFT]: { bg: 'bg-gray-100', text: 'text-gray-600', dot: 'bg-gray-400' },
      [TicketStatus.PENDING]: { bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
      [TicketStatus.APPROVED]: { bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
      [TicketStatus.ASSIGNED]: { bg: 'bg-indigo-50', text: 'text-indigo-700', dot: 'bg-indigo-500' },
      [TicketStatus.IN_PROGRESS]: { bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
      [TicketStatus.COMPLETED]: { bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
      [TicketStatus.REJECTED]: { bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
      [TicketStatus.ON_HOLD]: { bg: 'bg-slate-50', text: 'text-slate-700', dot: 'bg-slate-400' },
    };

    const config = statusConfig[status];
    const label = status === TicketStatus.PENDING ? 'Submitted' : status.replace('_', ' ');
    
    return (
      <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold tracking-tight ${config.bg} ${config.text} border border-current border-opacity-10`}>
        <span className={`w-1.5 h-1.5 rounded-full mr-1.5 ${config.dot}`}></span>
        {label}
      </span>
    );
  }

  if (priority) {
    const priorityConfig: Record<Priority, { bg: string; text: string }> = {
      [Priority.LOW]: { bg: 'bg-slate-50', text: 'text-slate-500' },
      [Priority.MEDIUM]: { bg: 'bg-blue-50', text: 'text-blue-600' },
      [Priority.HIGH]: { bg: 'bg-orange-50', text: 'text-orange-600' },
      [Priority.CRITICAL]: { bg: 'bg-rose-50', text: 'text-rose-600' },
    };

    const config = priorityConfig[priority];
    
    return (
      <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${config.bg} ${config.text}`}>
        {priority}
      </span>
    );
  }

  return null;
};

export default StatusBadge;
