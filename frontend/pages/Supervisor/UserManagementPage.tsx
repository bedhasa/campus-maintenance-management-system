"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest, readAuthUser } from "@/lib/api";
import {
  Activity,
  AlertCircle,
  Briefcase,
  CheckCircle2,
  Eye,
  History,
  Lock,
  Mail,
  MoreVertical,
  Pencil,
  Phone,
  Power,
  Search,
  ShieldCheck,
  Star,
  UserPlus,
  Users,
} from "lucide-react";

type Role = { id: number; name: string };
type Specialty = { id: number; name: string; category_id?: number };
type Department = { id: number; name: string };

type UserItem = {
  id: number;
  fname: string;
  lname: string;
  username?: string;
  email: string;
  phone?: string;
  university_id_number?: string;
  dept_id?: number | null;
  is_active: boolean;
  roles?: Role[];
  specialties?: Specialty[];
  last_login_at?: string;
  created_requests_count?: number;
  completed_tasks_count?: number;
};

type UsersResponse = {
  success: boolean;
  users: { data: UserItem[] };
  roles?: Role[];
};

type TechProfile = {
  success: boolean;
  technician: {
    id: number;
    fname: string;
    lname: string;
    phone?: string;
    email?: string;
    avg_rating: number;
    total_ratings: number;
    active_jobs: number;
    completed_jobs: number;
    overdue_jobs: number;
    completion_rate: number;
    specialties: Array<{ id: number; name: string }>;
    history: Array<{ id: number; work_status: string; completed_at?: string | null; request?: { title?: string } }>;
  };
};

type RoleTab = "all" | "requester" | "technician" | "supervisor" | "admin";

const roleTabs: Array<{ id: RoleTab; label: string }> = [
  { id: "all", label: "All Users" },
  { id: "requester", label: "Requesters" },
  { id: "technician", label: "Technicians" },
  { id: "supervisor", label: "Supervisors" },
  { id: "admin", label: "Admins" },
];

export default function UserManagementPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [allRoles, setAllRoles] = useState<Role[]>([]);
  const [activeTab, setActiveTab] = useState<RoleTab>("all");
  const [selectedUserId, setSelectedUserId] = useState<number | null>(null);
  const [techProfile, setTechProfile] = useState<TechProfile["technician"] | null>(null);
  const [isLoadingTechProfile, setIsLoadingTechProfile] = useState(false);

  const [search, setSearch] = useState("");
  const [deptFilter, setDeptFilter] = useState("all");
  const [statusFilter, setStatusFilter] = useState("all");
  const [isAdmin, setIsAdmin] = useState(false);

  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const viewProfile = (user: UserItem) => setSelectedUserId(user.id);

  const toggleStatus = async (user: UserItem) => {
    try {
      setError(null);
      // Sends a PATCH request to toggle the user's active status
      const res = await apiRequest<{ success: boolean }>(
        `/api/admin/users/${user.id}/toggle-status`,
        { method: "PATCH" },
        true
      );
      if (res.success) {
        setUsers((prev) =>
          prev.map((u) => (u.id === user.id ? { ...u, is_active: !u.is_active } : u))
        );
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update user status.");
    }
  };

  useEffect(() => {
    const currentUser = readAuthUser<{ roles?: Role[] }>();
    setIsAdmin(currentUser?.roles?.some(r => r.name.toLowerCase() === 'admin') ?? false);
  }, []);

  useEffect(() => {
    const run = async () => {
      setIsLoading(true);
      setError(null);
      try {
        const [usersRes, deptRes] = await Promise.all([
          apiRequest<UsersResponse>("/api/admin/users", { method: "GET" }, true),
          apiRequest<{ success: boolean; departments: Department[] }>("/api/departments", { method: "GET" }, true),
        ]);
        setUsers(usersRes.users.data ?? []);
        setDepartments(deptRes.departments ?? []);
        setAllRoles(usersRes.roles ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to load users.");
      } finally {
        setIsLoading(false);
      }
    };

    void run();
  }, []);

  const usersForTab = useMemo(() => {
    const term = search.trim().toLowerCase();
    return users.filter((user) => {
      const roleMatch = activeTab === "all" || (user.roles ?? []).some((role) => role.name.toLowerCase() === activeTab);
      if (!roleMatch) return false;

      const deptMatch = deptFilter === "all" || String(user.dept_id) === deptFilter;
      const statusMatch = statusFilter === "all" || (statusFilter === "active" ? user.is_active : !user.is_active);
      if (!deptMatch || !statusMatch) return false;

      if (!term) return true;
      const haystack = [
        user.fname,
        user.lname,
        user.email,
        user.username ?? "",
        user.phone ?? "",
        ...(user.specialties ?? []).map((specialty) => specialty.name),
      ]
        .join(" ")
        .toLowerCase();

      return haystack.includes(term);
    });
  }, [activeTab, search, users]);

  const selectedUser = useMemo(
    () => users.find((user) => user.id === selectedUserId) ?? null,
    [selectedUserId, users]
  );

  useEffect(() => {
    if (!usersForTab.length) {
      setSelectedUserId(null);
      return;
    }

    if (!selectedUserId || !usersForTab.some((user) => user.id === selectedUserId)) {
      setSelectedUserId(usersForTab[0].id);
    }
  }, [selectedUserId, usersForTab]);

  useEffect(() => {
    if (activeTab !== "technician" || !selectedUserId) {
      setTechProfile(null);
      return;
    }

    const run = async () => {
      setIsLoadingTechProfile(true);
      try {
        const response = await apiRequest<TechProfile>(`/api/supervisor/technicians/${selectedUserId}`, { method: "GET" }, true);
        setTechProfile(response.technician);
      } catch {
        setTechProfile(null);
      } finally {
        setIsLoadingTechProfile(false);
      }
    };

    void run();
  }, [activeTab, selectedUserId]);

  const departmentName = (deptId?: number | null) =>
    departments.find((department) => department.id === deptId)?.name ?? "No department";

  const countsByRole = useMemo(
    () =>
      roleTabs.reduce<Record<RoleTab, number>>((acc, tab) => {
        if (tab.id === "all") acc[tab.id] = users.length;
        else acc[tab.id] = users.filter((user) => (user.roles ?? []).some((role) => role.name.toLowerCase() === tab.id)).length;
        return acc;
      }, { all: 0, requester: 0, technician: 0, supervisor: 0, admin: 0 }),
    [users]
  );

  const getRoleBadge = (roleName: string) => {
    const name = roleName.toLowerCase();
    if (name === 'admin') return "bg-purple-100 text-purple-700";
    if (name === 'technician') return "bg-orange-100 text-orange-700";
    if (name === 'requester') return "bg-blue-100 text-blue-700";
    return "bg-slate-100 text-slate-700";
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="flex items-center gap-3">
             <h1 className="text-3xl font-black tracking-tight text-slate-900">User Management</h1>
             {isAdmin && (
               <button className="flex items-center gap-2 px-4 py-2 bg-[#003366] text-white rounded-xl text-xs font-black uppercase tracking-wider hover:opacity-90 transition shadow-lg shadow-blue-900/20">
                 <UserPlus size={16}/> Create User
               </button>
             )}
          </div>
          <p className="text-sm font-semibold text-slate-500">Browse all user groups from one simple directory and inspect each profile in place.</p>
        </div>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {roleTabs.map((tab) => (
            <div key={tab.id} className={`rounded-xl border p-3 text-center shadow-sm transition-all ${activeTab === tab.id ? 'border-blue-200 bg-blue-50' : 'border-slate-100 bg-white'}`}>
              <p className="text-[9px] font-black uppercase tracking-wider text-slate-400">{tab.label}</p>
              <p className="text-xl font-black text-slate-900">{countsByRole[tab.id]}</p>
            </div>
          ))}
        </div>
      </div>

      {/* FILTER BAR */}
      <div className="flex flex-wrap gap-4 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm items-center">
        <div className="inline-flex rounded-xl bg-slate-100 p-1">
          {roleTabs.map((tab) => (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`rounded-lg px-4 py-2 text-xs font-black uppercase tracking-wider transition-all ${
                activeTab === tab.id ? "bg-white text-[#003366] shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              {tab.id}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-[200px]">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search by name or email..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2 pl-9 pr-3 text-sm font-semibold outline-none focus:ring-2 focus:ring-blue-500/10"
          />
        </div>

        <select 
          value={deptFilter} 
          onChange={(e) => setDeptFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase outline-none"
        >
          <option value="all">All Departments</option>
          {departments.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>

        <select 
          value={statusFilter} 
          onChange={(e) => setStatusFilter(e.target.value)}
          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-black uppercase outline-none"
        >
          <option value="all">Any Status</option>
          <option value="active">Active</option>
          <option value="inactive">Inactive</option>
        </select>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>}

      <div className="grid gap-6">
        <section className="rounded-[2.5rem] border border-slate-200 bg-white shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50 text-[10px] font-black uppercase tracking-[0.2em] text-slate-400">
                  <th className="px-6 py-4">ID</th>
                  <th className="px-6 py-4">User Details</th>
                  <th className="px-6 py-4">Roles & Dept</th>
                  <th className="px-6 py-4">Activity</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {isLoading ? (
                  <tr><td colSpan={6} className="py-20 text-center text-sm font-black text-slate-300 uppercase animate-pulse">Accessing Directory...</td></tr>
                ) : usersForTab.length === 0 ? (
                  <tr><td colSpan={6} className="py-20 text-center text-sm font-semibold text-slate-400">No users match your filters.</td></tr>
                ) : (
                  usersForTab.map((user) => (
                    <tr key={user.id} className="group hover:bg-slate-50/70 transition-colors">
                      <td className="px-6 py-4">
                         <span className="text-xs font-black text-slate-300">#{user.id}</span>
                      </td>
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 rounded-xl bg-slate-100 flex items-center justify-center text-sm font-black text-[#003366] group-hover:bg-[#003366] group-hover:text-white transition-all">
                            {user.fname[0]}{user.lname[0]}
                          </div>
                          <div>
                            <p className="text-sm font-black text-slate-900">{user.fname} {user.lname}</p>
                            <p className="text-[11px] font-bold text-slate-400">{user.email}</p>
                          </div>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                         <div className="flex flex-wrap gap-1.5 mb-1">
                           {user.roles?.map(r => (
                             <span key={r.id} className={`px-2 py-0.5 rounded-lg text-[9px] font-black uppercase tracking-wider ${getRoleBadge(r.name)}`}>
                               {r.name}
                             </span>
                           ))}
                         </div>
                         <p className="text-[10px] font-bold text-slate-500 uppercase">{departmentName(user.dept_id)}</p>
                      </td>
                      <td className="px-6 py-4">
                         <div className="space-y-1">
                           <p className="text-[10px] font-bold text-slate-400 uppercase">
                             Last Login: <span className="text-slate-700">{user.last_login_at ? new Date(user.last_login_at).toLocaleDateString() : "Never"}</span>
                           </p>
                           {user.roles?.some(r => r.name.toLowerCase() === 'technician') && (
                             <p className="text-[10px] font-black text-blue-600 uppercase">Done: {user.completed_tasks_count ?? 0} Tasks</p>
                           )}
                           {user.roles?.some(r => r.name.toLowerCase() === 'requester') && (
                             <p className="text-[10px] font-black text-emerald-600 uppercase">Sent: {user.created_requests_count ?? 0} Req</p>
                           )}
                         </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${
                          user.is_active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"
                        }`}>
                          <div className={`w-1.5 h-1.5 rounded-full ${user.is_active ? 'bg-emerald-500' : 'bg-rose-500'}`} />
                          {user.is_active ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex justify-end gap-2">
                          <button onClick={() => viewProfile(user)} className="p-2 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-[#003366] hover:border-blue-200 transition-all shadow-sm" title="View Profile">
                            <Eye size={16}/>
                          </button>
                          {isAdmin && (
                            <>
                              <button className="p-2 bg-white border border-slate-100 rounded-xl text-slate-400 hover:text-blue-600 hover:border-blue-200 transition-all shadow-sm" title="Edit User">
                                <Pencil size={16}/>
                              </button>
                              <button onClick={() => toggleStatus(user)} className={`p-2 bg-white border border-slate-100 rounded-xl transition-all shadow-sm ${user.is_active ? 'text-rose-400 hover:text-rose-600 hover:border-rose-200' : 'text-emerald-400 hover:text-emerald-600 hover:border-emerald-200'}`} title={user.is_active ? "Deactivate" : "Activate"}>
                                <Power size={16}/>
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        {/* SLIDE-OUT DETAIL PANEL OR MODAL (Showing when selected) */}
        {selectedUser && (
          <section className="rounded-3xl border border-slate-200 bg-white p-8 shadow-2xl animate-in slide-in-from-right-4 duration-500">
            <div className="flex justify-between items-center mb-8">
               <h2 className="text-xl font-black text-slate-900 uppercase tracking-tight">User Inspector</h2>
               <button onClick={() => setSelectedUserId(null)} className="p-2 bg-slate-100 rounded-xl text-slate-400 hover:text-slate-900 transition-colors">Close</button>
            </div>
            
            {techProfile ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                  <div>
                    <h2 className="text-2xl font-black text-slate-900">
                      {techProfile.fname} {techProfile.lname}
                    </h2>
                    <div className="mt-3 flex flex-wrap gap-2">
                      {techProfile.specialties.map((specialty) => (
                        <span key={specialty.id} className="rounded-full border border-blue-100 bg-blue-50 px-3 py-1 text-[9px] font-black uppercase tracking-wider text-[#003366]">
                          {specialty.name}
                        </span>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right">
                    <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Trust Score</p>
                    <div className="mt-1 flex items-center justify-end gap-1">
                      <Star size={16} className="fill-amber-400 text-amber-400" />
                      <span className="text-xl font-black text-slate-900">{Number(techProfile.avg_rating ?? 0).toFixed(1)}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
                  {[
                    { label: "Active", value: techProfile.active_jobs, icon: Briefcase, tone: "bg-blue-50 text-blue-600" },
                    { label: "Completed", value: techProfile.completed_jobs, icon: CheckCircle2, tone: "bg-emerald-50 text-emerald-600" },
                    { label: "Overdue", value: techProfile.overdue_jobs, icon: AlertCircle, tone: "bg-rose-50 text-rose-600" },
                    { label: "Completion", value: `${techProfile.completion_rate}%`, icon: Activity, tone: "bg-slate-100 text-slate-700" },
                  ].map((item) => (
                    <div key={item.label} className="rounded-2xl border border-slate-200 bg-white p-4">
                      <div className={`mb-3 inline-flex rounded-xl p-2 ${item.tone}`}>
                        <item.icon size={16} />
                      </div>
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{item.label}</p>
                      <p className="mt-1 text-2xl font-black text-slate-900">{item.value}</p>
                    </div>
                  ))}
                </div>

                <div className="grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
                  <div className="space-y-4">
                    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                      <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Contact</p>
                      <div className="space-y-3">
                        <div className="flex items-center gap-3">
                          <Phone size={16} className="text-blue-500" />
                          <span className="text-sm font-semibold text-slate-700">{techProfile.phone || "No phone"}</span>
                        </div>
                        <div className="flex items-center gap-3">
                          <Mail size={16} className="text-blue-500" />
                          <span className="text-sm font-semibold text-slate-700">{techProfile.email || "No email"}</span>
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">Assignment Archive</p>
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">{techProfile.history.length} records</span>
                    </div>
                    {techProfile.history.length === 0 ? (
                      <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm font-semibold text-slate-400">
                        No service history found.
                      </div>
                    ) : (
                      techProfile.history.map((item) => (
                        <div key={item.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <p className="text-sm font-black text-slate-900">{item.request?.title ?? `Work Order #${item.id}`}</p>
                              <p className="mt-1 text-[11px] font-bold uppercase tracking-wider text-slate-400">
                                WO-{item.id} | {item.completed_at ? new Date(item.completed_at).toLocaleDateString() : "In Progress"}
                              </p>
                            </div>
                            <span
                              className={`rounded-lg px-2 py-1 text-[10px] font-black uppercase tracking-wider ${
                                item.work_status === "completed"
                                  ? "border border-emerald-100 bg-emerald-50 text-emerald-600"
                                  : "border border-amber-100 bg-amber-50 text-amber-600"
                              }`}
                            >
                              {item.work_status}
                            </span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
          ) : (
            <div className="space-y-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black text-slate-900">
                    {selectedUser.fname} {selectedUser.lname}
                  </h2>
                  <p className="mt-1 text-sm font-semibold text-slate-500">{selectedUser.email}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-wider ${
                    selectedUser.is_active ? "bg-emerald-100 text-emerald-700" : "bg-rose-100 text-rose-700"
                  }`}
                >
                  {selectedUser.is_active ? "Active" : "Inactive"}
                </span>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <InfoCard label="Username" value={selectedUser.username || "Not set"} />
                <InfoCard label="Phone" value={selectedUser.phone || "Not set"} />
                <InfoCard label="University ID" value={selectedUser.university_id_number || "Not set"} />
                <InfoCard label="Department" value={departmentName(selectedUser.dept_id)} />
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Assigned Roles</p>
                <div className="flex flex-wrap gap-2">
                  {(selectedUser.roles ?? []).map((role) => (
                    <span key={role.id} className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700">
                      {role.name}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <p className="mb-3 text-[10px] font-black uppercase tracking-wider text-slate-400">Specialties</p>
                <div className="flex flex-wrap gap-2">
                  {(selectedUser.specialties ?? []).length ? (
                    (selectedUser.specialties ?? []).map((specialty) => (
                      <span key={specialty.id} className="rounded-full bg-white px-3 py-1 text-[10px] font-black uppercase tracking-wider text-slate-700">
                        {specialty.name}
                      </span>
                    ))
                  ) : (
                    <span className="text-sm font-semibold text-slate-400">No specialties assigned.</span>
                  )}
                </div>
              </div>
            </div>
          )}
          </section>
        )}
      </div>
    </div>
  );
}

function InfoCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-black uppercase tracking-wider text-slate-400">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-700">{value}</p>
    </div>
  );
}
