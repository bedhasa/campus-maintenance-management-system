
import React, { useState, useEffect } from 'react';
import { Bell, User as UserIcon, Menu, CirclePlus, Settings, LogOut, Search, Globe, FilePlus, LayoutDashboard, Wrench } from 'lucide-react';
import { Link, useLocation, useNavigate } from '../lib/router-dom-shim';
import Sidebar from './Sidebar';
import { User } from '../types';
import { useApp } from '../App';
import RequestDetailModal from './RequestDetailModal';
import { roleToBasePath } from '../lib/role-routes';

interface LayoutProps {
  user: User;
  onLogout: () => void;
  children: React.ReactNode;
}

const Layout: React.FC<LayoutProps> = ({ user, onLogout, children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { notifications, language, setLanguage, t, viewedRequestId, setViewedRequestId, requests } = useApp();
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  const basePath = roleToBasePath(user.role);
  
  const isRequester = user.role === 'requester';

  // Filter notifications for this specific user
  const relevantNotifications = notifications.filter(n => {
    const forMe = !n.recipientId || n.recipientId === user.id;
    const forMyRole = !n.recipientRole || n.recipientRole === user.role;
    return forMe && forMyRole;
  });

  const unreadCount = relevantNotifications.filter(n => !n.read).length;

  // Find the request to view globally if ID is present
  const globalViewRequest = viewedRequestId ? requests.find(r => r.id === viewedRequestId) : null;

  return (
    <div className="flex h-screen overflow-hidden relative">
      {/* Global Request Detail Modal */}
      {globalViewRequest && (
        <RequestDetailModal 
          request={globalViewRequest} 
          onClose={() => setViewedRequestId(null)} 
        />
      )}

      {/* Mobile Backdrop */}
      {isSidebarOpen && (
        <div 
          className="fixed inset-0 bg-black/50 z-40 lg:hidden transition-opacity duration-300 animate-in fade-in"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <Sidebar 
        role={user.role} 
        onLogout={onLogout} 
        isOpen={isSidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      
      <div className="flex-1 flex flex-col min-w-0 bg-[#F9FAFB] overflow-hidden relative">
        {/* Top Navbar */}
        <header className="h-16 bg-white border-b border-gray-100 flex items-center justify-between px-6 shrink-0 z-30 shadow-sm">
          <div className="flex items-center space-x-4">
            <button 
              onClick={() => setSidebarOpen(true)}
              className="group relative lg:hidden text-gray-500 p-2 hover:bg-gray-100 rounded-xl transition-all"
            >
              <Menu size={20} />
              <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 rounded bg-gray-900 text-white text-[10px] font-bold opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none whitespace-nowrap z-1000">
                Open menu
              </span>
            </button>
            <div className="hidden md:block">
              <h2 className="text-sm font-black text-gray-900 leading-none mb-0.5">
                {user.name}
              </h2>
              <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest">{user.role.replace('_', ' ')}</p>
            </div>
          </div>

          <div className="flex items-center space-x-2 sm:space-x-4">
            <button 
              onClick={() => navigate(`${basePath}/notifications`)}
              className={`group relative p-2.5 text-gray-400 hover:text-blue-600 bg-gray-50/50 border border-gray-100 rounded-xl transition-all ${unreadCount > 0 ? 'ring-2 ring-blue-50 text-blue-500' : ''}`}
            >
              <Bell size={18} className={unreadCount > 0 ? 'animate-ring' : ''} />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white"></span>
              )}
              <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 rounded bg-gray-900 text-white text-[10px] font-bold opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none whitespace-nowrap z-1000">
                Notifications
              </span>
            </button>
            
            <div className="relative group">
              <button 
                onClick={() => setShowProfileMenu(!showProfileMenu)}
                className="group relative flex items-center space-x-2 active:scale-95 transition-all"
              >
                <div className="h-9 w-9 rounded-xl bg-blue-50 flex items-center justify-center text-blue-600 border border-blue-100 text-xs font-black shadow-sm group-hover:bg-blue-100">
                  {user.name.charAt(0)}
                </div>
                <span className="absolute left-1/2 -translate-x-1/2 top-full mt-2 px-2 py-1 rounded bg-gray-900 text-white text-[10px] font-bold opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all pointer-events-none whitespace-nowrap z-1000">
                  Profile menu
                </span>
              </button>

              {showProfileMenu && (
                <>
                  <div className="fixed inset-0 z-40" onClick={() => setShowProfileMenu(false)}></div>
                  <div className="absolute right-0 mt-3 w-52 bg-white rounded-2xl shadow-2xl border border-gray-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-200">
                    <div className="p-4 border-b bg-gray-50/50 text-xs">
                      <p className="font-black text-gray-900">{user.name}</p>
                      <p className="text-[10px] text-gray-400 truncate mt-0.5">{user.email}</p>
                    </div>
                    <div className="p-2 space-y-0.5">
                      <Link 
                        to={`${basePath}/profile`} 
                        onClick={() => setShowProfileMenu(false)}
                        className="flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 text-gray-600 text-xs font-bold transition-colors"
                      >
                        <UserIcon size={16} />
                        <span>{t('viewProfile')}</span>
                      </Link>
                      <button 
                        onClick={() => { setShowProfileMenu(false); onLogout(); }}
                        className="flex items-center space-x-3 px-3 py-2.5 rounded-xl hover:bg-red-50 text-red-600 text-xs font-black w-full text-left transition-colors"
                      >
                        <LogOut size={16} />
                        <span>{t('logout')}</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6 md:p-8">
          <div className="max-w-7xl mx-auto">
            {children}
          </div>
        </main>

        {/* STICKY FAB for Requesters */}
        {isRequester && location.pathname !== '/requester/submit' && (
          <div className="fixed bottom-8 right-8 z-40">
            <Link 
              to="/requester/submit"
              className="group flex items-center space-x-3 bg-[#003366] text-white px-6 py-4 rounded-4xl shadow-2xl hover:bg-blue-900 hover:scale-105 active:scale-95 transition-all"
            >
              <FilePlus size={24} />
              <span className="text-xs font-black uppercase tracking-widest max-w-0 overflow-hidden group-hover:max-w-30 transition-all duration-500 whitespace-nowrap">Report Issue</span>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
};

export default Layout;
