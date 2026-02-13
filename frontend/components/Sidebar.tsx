
import React from 'react';
import { NavLink } from '../lib/router-dom-shim';
import { 
  LayoutDashboard, 
  FilePlus, 
  ListTodo, 
  ClipboardList, 
  Package, 
  Calendar,
  LogOut,
  Settings,
  History,
  Activity,
  Bell,
  HelpCircle,
  X,
  Users
} from 'lucide-react';
import { UserRole } from '../types';
import { useApp } from '../App';
import { roleToBasePath } from '../lib/role-routes';

interface SidebarProps {
  role: UserRole;
  onLogout: () => void;
  isOpen?: boolean;
  onClose?: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({ role, onLogout, isOpen, onClose }) => {
  const { notifications, currentUser, t } = useApp();
  
  // Apply the same strict filtering logic for the sidebar badge
  const relevantNotifications = notifications.filter(n => {
    if (n.recipientId) {
      return n.recipientId === currentUser?.id;
    }
    if (n.recipientRole) {
      return n.recipientRole === role;
    }
    return true;
  });
  
  const unreadCount = relevantNotifications.filter(n => !n.read).length;
  const basePath = roleToBasePath(role);

  const getNavItems = () => {
    const base: Array<{
      name: string;
      path: string;
      icon: React.ReactNode;
      badge?: number | null;
      tooltip: string;
    }> = [];
    switch (role) {
      case 'requester':
        base.push(
          { name: t('dashboard'), path: '/requester/dashboard', icon: <Activity size={18} />, tooltip: "View your status" },
          { name: t('reportIssue'), path: '/requester/submit', icon: <FilePlus size={18} />, tooltip: "Submit new request" },
          { name: t('myHistory'), path: '/requester/history', icon: <History size={18} />, tooltip: "View past reports" },
        );
        break;
      case 'supervisor':
        base.push(
          { name: t('analytics'), path: '/supervisor/dashboard', icon: <LayoutDashboard size={18} />, tooltip: "Operational data" },
          { name: t('workOrders'), path: '/supervisor/requests', icon: <ClipboardList size={18} />, tooltip: "Review & assign" },
          { name: 'Technicians', path: '/supervisor/technicians', icon: <Users size={18} />, tooltip: "Manage maintenance staff" },
          { name: t('allHistory'), path: '/supervisor/history', icon: <History size={18} />, tooltip: "Full campus log" },
          { name: t('maintenance'), path: '/supervisor/preventive-maintenance', icon: <Calendar size={18} />, tooltip: "Scheduled checks" },
        );
        break;
      case 'technician':
        base.push(
          { name: t('tasks'), path: '/technician/dashboard', icon: <ListTodo size={18} />, tooltip: "Active jobs" },
          { name: t('completedTasks'), path: '/technician/history', icon: <History size={18} />, tooltip: "Resolution archive" },
        );
        break;
      case 'inventory_officer':
        base.push(
          { name: t('dashboard'), path: '/inventory/dashboard', icon: <LayoutDashboard size={18} />, tooltip: "Stock summary" },
          { name: t('stockList'), path: '/inventory/list', icon: <Package size={18} />, tooltip: "Manage parts" },
        );
        break;
    }
    
    base.push({ 
      name: t('notifications'), 
      path: `${basePath}/notifications`, 
      icon: <Bell size={18} />,
      badge: unreadCount > 0 ? unreadCount : null,
      tooltip: "Alerts & updates"
    });

    base.push({
      name: t('help'),
      path: `${basePath}/help`,
      icon: <HelpCircle size={18} />,
      tooltip: "System guide"
    });
    
    return base;
  };

  const navItems = getNavItems();

  const handleNavClick = () => {
    if (onClose) onClose();
  };

  return (
    <div className={`
      fixed inset-y-0 left-0 z-50 w-60 bg-[#003366] text-white flex flex-col overflow-x-hidden
      transform ${isOpen ? 'translate-x-0' : '-translate-x-full'} 
      lg:relative lg:translate-x-0 transition-transform duration-300 ease-in-out shrink-0
    `}>
      <div className="p-5 border-b border-blue-800 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold tracking-tight">HU CMMS</h1>
          <p className="text-[10px] text-blue-100 mt-0.5 uppercase tracking-wider">Campus Maintenance</p>
        </div>
        <button 
          onClick={onClose}
          className="lg:hidden p-2 text-blue-100 hover:text-white hover:bg-blue-800 rounded-lg group relative"
        >
          <X size={18} />
          <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 hidden group-hover:block bg-gray-900 text-white text-[10px] py-1 px-2 rounded font-bold whitespace-nowrap z-50">Close Menu</span>
        </button>
      </div>

      <nav className="flex-1 mt-4 px-3 space-y-0.5 overflow-y-auto overflow-x-hidden scrollbar-hide">
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            onClick={handleNavClick}
            className={({ isActive }) => `
              group relative flex items-center justify-between px-3 py-2.5 rounded-lg transition-all
              ${isActive ? 'bg-blue-700 text-white shadow-md' : 'text-blue-100 hover:bg-blue-800'}
            `}
          >
            <div className="flex items-center space-x-3 min-w-0">
              {item.icon}
              <span className="text-sm font-medium">{item.name}</span>
            </div>
            {item.badge && (
              <span className="bg-red-500 text-white text-[9px] font-black px-1.5 py-0.5 rounded-full ring-2 ring-blue-900">
                {item.badge}
              </span>
            )}
            <div className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-1 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[1000] pointer-events-none whitespace-nowrap hidden lg:block">
              {item.tooltip}
              <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-gray-900"></div>
            </div>
          </NavLink>
        ))}
      </nav>

      <div className="p-3 border-t border-blue-800 space-y-0.5">
        <NavLink 
          to={`${basePath}/settings`}
          onClick={handleNavClick}
          className={({ isActive }) => `group relative flex items-center space-x-3 w-full px-3 py-2.5 rounded-lg transition-colors ${isActive ? 'bg-blue-700 text-white' : 'text-blue-100 hover:bg-blue-800'}`}
        >
          <Settings size={18} />
          <span className="text-sm font-medium">{t('settings')}</span>
          <div className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-1 bg-gray-900 text-white text-[10px] font-black uppercase tracking-widest rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[1000] pointer-events-none whitespace-nowrap hidden lg:block">
            Configuration
            <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-gray-900"></div>
          </div>
        </NavLink>
        <button 
          onClick={() => { handleNavClick(); onLogout(); }}
          className="group relative flex items-center space-x-3 w-full px-3 py-2.5 text-red-300 hover:bg-red-900/30 rounded-lg transition-colors"
        >
          <LogOut size={18} />
          <span className="text-sm font-medium">{t('logout')}</span>
          <div className="absolute left-1/2 -translate-x-1/2 -top-8 px-2 py-1 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all duration-200 z-[1000] pointer-events-none whitespace-nowrap hidden lg:block">
            Exit Portal
            <div className="absolute left-1/2 -translate-x-1/2 top-full border-4 border-transparent border-t-red-600"></div>
          </div>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
