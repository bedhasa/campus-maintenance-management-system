
import React from 'react';
import { useNavigate } from '../../lib/router-dom-shim';
import { useApp } from '../../App';
import { 
  HelpCircle, Info, Clock, ShieldCheck, Mail, Phone, 
  ChevronRight, CircleAlert, ClipboardList, UserCheck, 
  CalendarClock, Activity, XCircle, Target, BookOpen,
  ArrowRight, Wrench, Package, MessageSquare, CheckCircle, 
  AlertTriangle, Play, CheckCircle2, History
} from 'lucide-react';
import { TicketStatus, Priority } from '../../types';
import StatusBadge from '../../components/StatusBadge';

const HelpPage: React.FC = () => {
  const { currentUser, t } = useApp();
  const navigate = useNavigate();
  
  const isSupervisor = currentUser?.role === 'supervisor';
  const isTechnician = currentUser?.role === 'technician';

  // --- SUPERVISOR VIEW ---
  if (isSupervisor) {
    return (
      <div className="max-w-5xl mx-auto space-y-10 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            <div className="p-4 bg-hawassa-blue text-white rounded-[2rem] shadow-xl shadow-blue-900/20">
              <HelpCircle size={40} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-gray-900 leading-none">Supervisor Protocol</h1>
              <p className="text-sm text-gray-500 mt-2 font-medium italic">Operational Guidelines for Campus Facility Management</p>
            </div>
          </div>
          <div className="px-6 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm flex items-center space-x-3">
             <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></div>
             <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">System Version 3.1.0</span>
          </div>
        </div>

        <section className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-xl shadow-gray-100/50">
            <h2 className="text-lg font-black text-gray-900 uppercase tracking-widest flex items-center mb-6">
              <Target size={22} className="mr-3 text-blue-600" /> My Responsibilities
            </h2>
            <ul className="space-y-4">
              {[
                "Review and validate all incoming maintenance requests",
                "Assign staff based on expertise (IT, Electrical, etc.)",
                "Set precise maintenance windows and schedules",
                "Audit work quality and monitor resolution velocity",
                "Oversee preventive maintenance compliance"
              ].map((item, i) => (
                <li key={i} className="flex items-start space-x-3 text-sm font-medium text-gray-600">
                  <div className="mt-1 w-4 h-4 rounded-full bg-blue-50 flex items-center justify-center shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-blue-600"></div>
                  </div>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-red-50/50 rounded-[2.5rem] p-8 border border-red-100">
            <h2 className="text-lg font-black text-red-900 uppercase tracking-widest flex items-center mb-6">
              <XCircle size={22} className="mr-3 text-red-600" /> System Restrictions
            </h2>
            <p className="text-xs text-red-700/70 mb-6 font-medium">The following actions require <span className="font-black">System Administrator</span> privileges:</p>
            <div className="space-y-3">
              <div className="flex items-center space-x-3 p-3 bg-white/60 rounded-xl text-xs font-bold text-red-600 border border-red-100">
                <ShieldCheck size={14} /> <span>Creating User Accounts</span>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-white/60 rounded-xl text-xs font-bold text-red-600 border border-red-100">
                <ShieldCheck size={14} /> <span>Changing User Roles or Depts</span>
              </div>
              <div className="flex items-center space-x-3 p-3 bg-white/60 rounded-xl text-xs font-bold text-red-600 border border-red-100">
                <ShieldCheck size={14} /> <span>Global System Configuration</span>
              </div>
            </div>
          </div>
        </section>

        <section className="bg-white rounded-[3rem] p-10 shadow-2xl shadow-gray-200/50 border border-gray-100">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-xl font-black text-gray-900 uppercase tracking-widest">Work Order Lifecycle Management</h2>
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl"><BookOpen size={20} /></div>
          </div>
          <div className="grid md:grid-cols-3 gap-10 relative">
            <div className="space-y-4">
              <div className="text-5xl font-black text-blue-50/50 italic select-none">01</div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center">
                <ClipboardList size={16} className="mr-2 text-blue-600" /> Review & Approve
              </h3>
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                Open <span className="text-blue-600 font-bold">Pending Requests</span>. Validate location accuracy and urgency. Approve if legitimate, or reject with a clear reason for the requester.
              </p>
            </div>
            <div className="space-y-4">
              <div className="text-5xl font-black text-blue-50/50 italic select-none">02</div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center">
                <UserCheck size={16} className="mr-2 text-blue-600" /> Assign Staff
              </h3>
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                Match the <span className="text-blue-600 font-bold">Problem Category</span> to the technician's specialty. Monitor current workloads to ensure no single staff member is overwhelmed.
              </p>
            </div>
            <div className="space-y-4">
              <div className="text-5xl font-black text-blue-50/50 italic select-none">03</div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest flex items-center">
                <CalendarClock size={16} className="mr-2 text-blue-600" /> Set Schedule
              </h3>
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                Specify exactly <span className="text-blue-600 font-bold">when</span> the maintenance occurs. The requester is notified and can optionally confirm availability via the system.
              </p>
            </div>
          </div>
        </section>

        <section className="bg-hawassa-blue rounded-[3rem] p-10 shadow-2xl shadow-blue-900/40 border border-blue-800 text-white">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left">
              <h2 className="text-3xl font-black uppercase tracking-widest mb-2">Technical Escalation</h2>
              <p className="text-blue-200 font-medium max-w-lg">
                For database resets, user credential issues, or critical system failures, contact the Enterprise IT Support Desk.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <a href="mailto:sysadmin@hu.edu.et" className="flex items-center justify-center space-x-3 px-8 py-5 bg-white/10 hover:bg-white/20 rounded-2xl transition-all border border-white/10 text-xs font-bold">
                <Mail size={20} />
                <span>sysadmin@hu.edu.et</span>
              </a>
              <a href="tel:+2511122334455" className="flex items-center justify-center space-x-3 px-8 py-5 bg-white/10 hover:bg-white/20 rounded-2xl transition-all border border-white/10 text-xs font-bold">
                <Phone size={20} />
                <span>Ext. 9911</span>
              </a>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // --- TECHNICIAN VIEW ---
  if (isTechnician) {
    return (
      <div className="max-w-5xl mx-auto space-y-10 pb-20">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center space-x-5">
            <div className="p-4 bg-emerald-600 text-white rounded-[2rem] shadow-xl shadow-emerald-900/20">
              <Wrench size={40} />
            </div>
            <div>
              <h1 className="text-4xl font-black text-gray-900 leading-none">Technician Operations Protocol</h1>
              <p className="text-sm text-gray-500 mt-2 font-medium italic">Standard Operating Procedures for Maintenance Resolution</p>
            </div>
          </div>
          <div className="px-6 py-3 bg-white border border-gray-100 rounded-2xl shadow-sm flex items-center space-x-3">
             <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
             <span className="text-[10px] font-black uppercase tracking-widest text-gray-400">HU Field Ops v2.4</span>
          </div>
        </div>

        {/* 1. Technician Role Overview */}
        <section className="grid md:grid-cols-2 gap-6">
          <div className="bg-white rounded-[2.5rem] p-8 border border-gray-100 shadow-xl shadow-gray-100/50">
            <h2 className="text-lg font-black text-gray-900 uppercase tracking-widest flex items-center mb-6">
              <Target size={22} className="mr-3 text-emerald-600" /> Core Capabilities
            </h2>
            <ul className="space-y-4">
              {[
                "Execute assigned corrective maintenance tasks",
                "Real-time task status updates (Start/Finish)",
                "Detailed reporting of resolution findings",
                "Official inventory usage recording",
                "Compliance-driven preventive checks"
              ].map((item, i) => (
                <li key={i} className="flex items-start space-x-3 text-sm font-medium text-gray-600">
                  <div className="mt-1 w-4 h-4 rounded-full bg-emerald-50 flex items-center justify-center shrink-0">
                    <div className="w-1.5 h-1.5 rounded-full bg-emerald-600"></div>
                  </div>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="bg-gray-900 rounded-[2.5rem] p-8 border border-gray-800 text-white">
            <h2 className="text-lg font-black text-blue-400 uppercase tracking-widest flex items-center mb-6">
              <XCircle size={22} className="mr-3 text-red-500" /> Access Restrictions
            </h2>
            <div className="space-y-3">
              {[
                "Approving or Rejecting initial requests",
                "Assigning work to other staff members",
                "Modifying global system/campus settings",
                "Viewing private tasks of other technicians"
              ].map((item, i) => (
                <div key={i} className="flex items-center space-x-3 p-3 bg-white/5 rounded-xl text-xs font-bold text-gray-300 border border-white/5">
                  <ShieldCheck size={14} className="text-red-500" /> <span>{item}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* 2. Understanding Assigned Tasks Lifecycle */}
        <section className="bg-white rounded-[3rem] p-10 shadow-2xl shadow-gray-200/50 border border-gray-100">
          <div className="flex items-center justify-between mb-10">
            <h2 className="text-xl font-black text-gray-900 uppercase tracking-widest">Active Task Workflow</h2>
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-2xl"><BookOpen size={20} /></div>
          </div>
          <div className="grid md:grid-cols-3 gap-10">
            <div className="space-y-4">
              <div className="text-5xl font-black text-emerald-50/50 italic select-none">01</div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Review & Accept</h3>
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                Open <span className="text-emerald-600 font-bold">My Tasks</span>. Filter by Priority and Schedule. Check the location, asset, and supervisor notes before departing for the site.
              </p>
            </div>
            <div className="space-y-4">
              <div className="text-5xl font-black text-emerald-50/50 italic select-none">02</div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Execute Task</h3>
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                Set status to <span className="text-emerald-600 font-bold">In Progress</span> when starting. Coordinate with requester if site access is restricted. Use the directory to dial if needed.
              </p>
            </div>
            <div className="space-y-4">
              <div className="text-5xl font-black text-emerald-50/50 italic select-none">03</div>
              <h3 className="text-sm font-black text-gray-900 uppercase tracking-widest">Document Resolution</h3>
              <p className="text-xs text-gray-500 font-medium leading-relaxed">
                Mark as <span className="text-emerald-600 font-bold">Completed</span>. Add concise notes on findings, parts used, and verification of fix. Upload evidence photos if required.
              </p>
            </div>
          </div>
        </section>

        {/* 3. Handling Delays & Problems */}
        <section className="grid md:grid-cols-2 gap-8">
          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
            <h2 className="text-lg font-black text-gray-900 uppercase tracking-widest flex items-center mb-8">
              <AlertTriangle size={22} className="mr-3 text-orange-500" /> Reporting Blocks
            </h2>
            <p className="text-xs text-gray-500 font-medium leading-relaxed mb-6">
              If a task cannot be completed, you must flag it as <span className="text-orange-600 font-bold">Blocked</span> or add a status update immediately for supervisor review. Common reasons:
            </p>
            <div className="grid grid-cols-1 gap-3">
              {[
                { label: "Inventory Deficit", desc: "Critical spare parts are unavailable in stock." },
                { label: "Access Denied", desc: "Requester is absent or site is locked." },
                { label: "Technical Complexity", desc: "Higher-level engineering expertise required." }
              ].map((reason, i) => (
                <div key={i} className="p-4 bg-gray-50 rounded-2xl flex items-center justify-between border border-gray-100">
                   <span className="text-xs font-black text-gray-900 uppercase">{reason.label}</span>
                   <span className="text-[10px] text-gray-400 font-medium">{reason.desc}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
            <h2 className="text-lg font-black text-gray-900 uppercase tracking-widest flex items-center mb-8">
              <Package size={22} className="mr-3 text-blue-600" /> Inventory Protocol
            </h2>
            <div className="space-y-4">
              <div className="p-5 bg-blue-50/50 rounded-2xl border border-blue-100">
                 <p className="text-xs text-blue-900 font-bold leading-relaxed">
                   Recording material usage is critical for university stock reorder levels.
                 </p>
              </div>
              <ul className="space-y-3">
                <li className="flex items-center space-x-3 text-xs font-bold text-gray-600">
                  <CheckCircle size={14} className="text-blue-500" /> <span>Submit inventory requests through the portal</span>
                </li>
                <li className="flex items-center space-x-3 text-xs font-bold text-gray-600">
                  <CheckCircle size={14} className="text-blue-500" /> <span>Wait for Inventory Officer approval for high-value parts</span>
                </li>
                <li className="flex items-center space-x-3 text-xs font-bold text-gray-600">
                  <CheckCircle size={14} className="text-blue-500" /> <span>Record exactly what was used in completion notes</span>
                </li>
              </ul>
            </div>
          </div>
        </section>

        {/* 4. Status Matrix & PM Responsibilities */}
        <section className="bg-white rounded-[2.5rem] p-8 md:p-10 shadow-xl shadow-gray-200/50 border border-gray-100">
           <h2 className="text-lg font-black text-gray-900 uppercase tracking-widest flex items-center mb-8">
             <Activity size={22} className="mr-3 text-emerald-600" /> Status Definition Guide
           </h2>
           <div className="overflow-x-auto">
             <table className="w-full text-left">
               <thead className="text-[10px] font-black text-gray-400 uppercase tracking-widest border-b border-gray-100">
                 <tr>
                    <th className="pb-4">Status</th>
                    <th className="pb-4">Operational Meaning</th>
                 </tr>
               </thead>
               <tbody className="divide-y divide-gray-50">
                 {[
                   { status: TicketStatus.ASSIGNED, meaning: "Task is officially in your queue. You are responsible for scheduling." },
                   { status: TicketStatus.IN_PROGRESS, meaning: "Active on-site intervention has started." },
                   { status: TicketStatus.COMPLETED, meaning: "Technical fix verified. History entry created." },
                   { status: TicketStatus.ON_HOLD, meaning: "Temporarily paused due to external factors (Weather, Parts, etc)." }
                 ].map((row, i) => (
                   <tr key={i}>
                      <td className="py-4"><StatusBadge status={row.status} /></td>
                      <td className="py-4 text-xs font-medium text-gray-500">{row.meaning}</td>
                   </tr>
                 ))}
               </tbody>
             </table>
           </div>
        </section>

        {/* 5. Communication & Support */}
        <section className="bg-gray-900 rounded-[3rem] p-10 shadow-2xl shadow-gray-900/40 border border-gray-800 text-white">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div className="text-center md:text-left">
              <h2 className="text-3xl font-black uppercase tracking-widest mb-2">Internal Assistance</h2>
              <p className="text-gray-400 font-medium max-w-lg">
                If you face technical errors while updating tasks or require site coordination help, contact the Supervisor Desk.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <a href="tel:9911" className="flex items-center justify-center space-x-3 px-8 py-5 bg-white/10 hover:bg-white/20 rounded-2xl transition-all border border-white/10 text-xs font-black uppercase tracking-widest">
                <Phone size={20} />
                <span>Ext. 9911 (Supervisor)</span>
              </a>
              <button 
                onClick={() => navigate('/technician/dashboard')}
                className="flex items-center justify-center space-x-3 px-8 py-5 bg-emerald-600 hover:bg-emerald-700 rounded-2xl transition-all shadow-xl shadow-emerald-900/30 text-xs font-black uppercase tracking-widest"
              >
                <Play size={20} />
                <span>Back to Operations</span>
              </button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  // --- REQUESTER VIEW (FALLBACK) ---
  const statusExplanations = [
    { status: TicketStatus.PENDING, desc: "Your request has been received and is waiting for a supervisor's review." },
    { status: TicketStatus.APPROVED, desc: "A supervisor has verified the issue and confirmed it requires maintenance." },
    { status: TicketStatus.ASSIGNED, desc: "A specialized technician has been assigned to handle your request." },
    { status: TicketStatus.IN_PROGRESS, desc: "Maintenance work is currently being performed at the location." },
    { status: TicketStatus.COMPLETED, desc: "The issue has been resolved. Please provide feedback on the performance." },
    { status: TicketStatus.REJECTED, desc: "The request was denied (e.g., duplicate report or invalid location details)." }
  ];

  const responseTimes = [
    { level: Priority.CRITICAL, time: "30 mins - 2 hours", color: "text-red-600" },
    { level: Priority.HIGH, time: "4 - 8 hours", color: "text-orange-600" },
    { level: Priority.MEDIUM, time: "1 - 2 days", color: "text-blue-600" },
    { level: Priority.LOW, time: "3 - 5 days", color: "text-green-600" }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-12">
      <div className="flex items-center space-x-4">
        <div className="p-3 bg-blue-100 text-blue-600 rounded-2xl">
          <HelpCircle size={32} />
        </div>
        <div>
          <h1 className="text-3xl font-black text-gray-900 leading-none">{t('help')}</h1>
          <p className="text-sm text-gray-500 mt-2 font-medium">Hawassa University CMMS User Guide & Resources</p>
        </div>
      </div>

      <div className="grid md:grid-cols-2 gap-8">
        <section className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
          <h2 className="text-lg font-black text-gray-900 uppercase tracking-widest flex items-center mb-6">
            <Info size={20} className="mr-3 text-blue-600" /> {t('statusGuide')}
          </h2>
          <div className="space-y-6">
            {statusExplanations.map((item, idx) => (
              <div key={idx} className="flex space-x-4">
                <div className="shrink-0 pt-1">
                  <StatusBadge status={item.status} />
                </div>
                <p className="text-xs text-gray-500 font-medium leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-white rounded-[2.5rem] p-8 shadow-xl shadow-gray-200/50 border border-gray-100">
          <h2 className="text-lg font-black text-gray-900 uppercase tracking-widest flex items-center mb-6">
            <Clock size={20} className="mr-3 text-blue-600" /> {t('responseTimes')}
          </h2>
          <p className="text-xs text-gray-400 mb-6 font-medium italic">Estimated response windows based on priority levels:</p>
          <div className="space-y-4">
            {responseTimes.map((item, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-gray-50 rounded-2xl">
                <StatusBadge priority={item.level} />
                <span className={`text-sm font-black ${item.color}`}>{item.time}</span>
              </div>
            ))}
          </div>
        </section>

        <section className="bg-hawassa-blue rounded-[2.5rem] p-8 shadow-2xl shadow-blue-900/40 border border-blue-800 md:col-span-2 text-white">
          <div className="flex flex-col md:flex-row items-center justify-between gap-8">
            <div>
              <h2 className="text-2xl font-black uppercase tracking-widest mb-2">{t('contactAdmin')}</h2>
              <p className="text-blue-200 font-medium max-w-lg">
                Having technical issues with the portal? Need to update your role or department? Contact our IT Support Desk.
              </p>
            </div>
            <div className="flex flex-col sm:flex-row gap-4 w-full md:w-auto">
              <a href="mailto:support@hu.edu.et" className="flex items-center justify-center space-x-3 px-6 py-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all border border-white/10 text-xs font-bold">
                <Mail size={20} />
                <span>support@hu.edu.et</span>
              </a>
              <a href="tel:+2511122334455" className="flex items-center justify-center space-x-3 px-6 py-4 bg-white/10 hover:bg-white/20 rounded-2xl transition-all border border-white/10 text-xs font-bold">
                <Phone size={20} />
                <span>+251 112 233 445</span>
              </a>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
};

export default HelpPage;
