"use client";

import { useEffect, useMemo, useState } from "react";
import { apiRequest } from "@/lib/api";
import { KeyRound, Plus, RefreshCw, Search, ShieldCheck, UserCog, UserMinus, UserPlus } from "lucide-react";

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
};

type UsersResponse = {
  success: boolean;
  users: { data: UserItem[] };
  roles: Role[];
  specialties: Specialty[];
};

type FormState = {
  fname: string;
  lname: string;
  username: string;
  email: string;
  phone: string;
  university_id_number: string;
  dept_id: string;
  role_ids: number[];
  specialty_ids: number[];
  temporary_password: string;
  is_active: boolean;
};

const emptyForm: FormState = {
  fname: "",
  lname: "",
  username: "",
  email: "",
  phone: "",
  university_id_number: "",
  dept_id: "",
  role_ids: [],
  specialty_ids: [],
  temporary_password: "",
  is_active: true,
};

export default function UsersPage() {
  const [users, setUsers] = useState<UserItem[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [specialties, setSpecialties] = useState<Specialty[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"all" | "active" | "inactive">("all");

  const [form, setForm] = useState<FormState>(emptyForm);
  const [editingUserId, setEditingUserId] = useState<number | null>(null);
  const [showForm, setShowForm] = useState(false);

  const [passwordUserId, setPasswordUserId] = useState<number | null>(null);
  const [newPassword, setNewPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadUsers = async () => {
    setLoading(true);
    setError(null);
    try {
      const query = new URLSearchParams();
      if (search.trim()) query.set("search", search.trim());
      const data = await apiRequest<UsersResponse>(`/api/admin/users?${query.toString()}`, { method: "GET" }, true);
      setUsers(data.users.data ?? []);
      setRoles(data.roles ?? []);
      setSpecialties(data.specialties ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load users.");
    } finally {
      setLoading(false);
    }
  };

  const loadDepartments = async () => {
    try {
      const data = await apiRequest<{ success: boolean; departments: Department[] }>("/api/departments", { method: "GET" }, true);
      setDepartments(data.departments ?? []);
    } catch {
      // Non-fatal, form still usable if departments fail.
    }
  };

  useEffect(() => {
    void Promise.all([loadUsers(), loadDepartments()]);
  }, []);

  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      if (statusFilter === "active" && !u.is_active) return false;
      if (statusFilter === "inactive" && u.is_active) return false;
      return true;
    });
  }, [users, statusFilter]);

  const openCreate = () => {
    setEditingUserId(null);
    setForm(emptyForm);
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };

  const openEdit = (user: UserItem) => {
    setEditingUserId(user.id);
    setForm({
      fname: user.fname ?? "",
      lname: user.lname ?? "",
      username: user.username ?? "",
      email: user.email ?? "",
      phone: user.phone ?? "",
      university_id_number: user.university_id_number ?? "",
      dept_id: user.dept_id ? String(user.dept_id) : "",
      role_ids: (user.roles ?? []).map((r) => r.id),
      specialty_ids: (user.specialties ?? []).map((s) => s.id),
      temporary_password: "",
      is_active: user.is_active,
    });
    setShowForm(true);
    setError(null);
    setSuccess(null);
  };

  const closePanels = () => {
    setShowForm(false);
    setPasswordUserId(null);
    setNewPassword("");
  };

  const toggleIdInArray = (arr: number[], id: number) => (arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);

  const saveUser = async () => {
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      if (editingUserId === null) {
        await apiRequest("/api/admin/users", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fname: form.fname,
            lname: form.lname,
            username: form.username,
            email: form.email,
            phone: form.phone,
            university_id_number: form.university_id_number,
            dept_id: Number(form.dept_id),
            role_ids: form.role_ids,
            specialty_ids: form.specialty_ids,
            temporary_password: form.temporary_password || undefined,
          }),
        }, true);
        setSuccess("User created.");
      } else {
        await apiRequest(`/api/admin/users/${editingUserId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            fname: form.fname,
            lname: form.lname,
            username: form.username,
            email: form.email,
            phone: form.phone,
            dept_id: form.dept_id ? Number(form.dept_id) : undefined,
            is_active: form.is_active,
            role_ids: form.role_ids,
            specialty_ids: form.specialty_ids,
          }),
        }, true);
        setSuccess("User updated.");
      }
      await loadUsers();
      closePanels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save user.");
    } finally {
      setSaving(false);
    }
  };

  const toggleUserStatus = async (user: UserItem) => {
    setError(null);
    setSuccess(null);
    const next = !user.is_active;
    try {
      await apiRequest(`/api/admin/users/${user.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ is_active: next }),
      }, true);
      setSuccess(`User ${next ? "activated" : "deactivated"}.`);
      await loadUsers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to change status.");
    }
  };

  const resetPassword = async () => {
    if (!passwordUserId) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiRequest(`/api/admin/users/${passwordUserId}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ new_password: newPassword }),
      }, true);
      setSuccess("Password reset successfully.");
      closePanels();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reset password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6 pb-16">
      <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
        <div>
          <h1 className="text-3xl font-black tracking-tight text-slate-900">User Management</h1>
          <p className="text-xs font-black uppercase tracking-wider text-slate-400">
            Admin control over users, roles, access and credentials
          </p>
        </div>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void loadUsers()}
            className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-black uppercase tracking-wider text-slate-700"
          >
            <RefreshCw size={14} /> Refresh
          </button>
          <button
            type="button"
            onClick={openCreate}
            className="inline-flex items-center gap-2 rounded-xl bg-[#003366] px-4 py-2 text-xs font-black uppercase tracking-wider text-white"
          >
            <Plus size={14} /> Add User
          </button>
        </div>
      </div>

      {error && <div className="rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm font-semibold text-rose-700">{error}</div>}
      {success && <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3 text-sm font-semibold text-emerald-700">{success}</div>}

      <div className="rounded-2xl border border-slate-200 bg-white p-4">
        <div className="grid gap-3 md:grid-cols-4">
          <div className="relative md:col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name, email, username..."
              className="w-full rounded-xl border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900"
            />
          </div>
          <select
            className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as "all" | "active" | "inactive")}
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <button
            type="button"
            onClick={() => void loadUsers()}
            className="rounded-xl border border-slate-300 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700"
          >
            {loading ? "Loading..." : "Apply Search"}
          </button>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <StatCard label="Total Users" value={users.length} />
        <StatCard label="Active Users" value={users.filter((u) => u.is_active).length} />
        <StatCard label="Inactive Users" value={users.filter((u) => !u.is_active).length} />
        <StatCard label="Filtered List" value={filteredUsers.length} />
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <table className="w-full">
          <thead className="bg-slate-50 text-left text-xs font-black uppercase tracking-wider text-slate-500">
            <tr>
              <th className="px-4 py-3">User</th>
              <th className="px-4 py-3">Roles</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredUsers.map((u) => (
              <tr key={u.id}>
                <td className="px-4 py-3">
                  <p className="text-sm font-black text-slate-900">
                    {u.fname} {u.lname}
                  </p>
                  <p className="text-xs font-semibold text-slate-500">{u.email}</p>
                  <p className="text-[11px] font-semibold text-slate-400">Username: {u.username ?? "-"}</p>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-wrap gap-1">
                    {(u.roles ?? []).map((r) => (
                      <span key={r.id} className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-0.5 text-[11px] font-bold text-slate-700">
                        {r.name}
                      </span>
                    ))}
                    {(u.roles ?? []).length === 0 && <span className="text-xs text-slate-400">No role</span>}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-black ${u.is_active ? "bg-emerald-50 text-emerald-700" : "bg-rose-50 text-rose-700"}`}>
                    {u.is_active ? <ShieldCheck size={12} /> : <UserMinus size={12} />}
                    {u.is_active ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className="px-4 py-3 text-right">
                  <div className="inline-flex gap-2">
                    <button
                      type="button"
                      onClick={() => openEdit(u)}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-700"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => void toggleUserStatus(u)}
                      className="rounded-lg border border-slate-300 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-700"
                    >
                      {u.is_active ? "Deactivate" : "Activate"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setPasswordUserId(u.id);
                        setNewPassword("");
                      }}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-300 px-3 py-1 text-xs font-black uppercase tracking-wider text-slate-700"
                    >
                      <KeyRound size={12} /> Password
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredUsers.length === 0 && !loading && (
          <div className="p-10 text-center text-sm font-semibold text-slate-400">No users found.</div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 p-4">
          <div className="mx-auto max-h-[92vh] max-w-3xl overflow-y-auto rounded-2xl bg-white p-5">
            <div className="mb-4 flex items-center justify-between">
              <h2 className="text-lg font-black text-slate-900">
                {editingUserId ? "Edit User" : "Create New User"}
              </h2>
              <button type="button" onClick={closePanels} className="text-sm font-black text-slate-500">
                Close
              </button>
            </div>

            <div className="grid gap-3 md:grid-cols-2">
              <TextField label="First Name" value={form.fname} onChange={(v) => setForm((p) => ({ ...p, fname: v }))} />
              <TextField label="Last Name" value={form.lname} onChange={(v) => setForm((p) => ({ ...p, lname: v }))} />
              <TextField label="Username" value={form.username} onChange={(v) => setForm((p) => ({ ...p, username: v }))} />
              <TextField label="Email" value={form.email} onChange={(v) => setForm((p) => ({ ...p, email: v }))} />
              <TextField label="Phone" value={form.phone} onChange={(v) => setForm((p) => ({ ...p, phone: v }))} />
              <TextField
                label="University ID"
                value={form.university_id_number}
                onChange={(v) => setForm((p) => ({ ...p, university_id_number: v }))}
              />
              <div>
                <label className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">Department</label>
                <select
                  className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
                  value={form.dept_id}
                  onChange={(e) => setForm((p) => ({ ...p, dept_id: e.target.value }))}
                >
                  <option value="">Select department</option>
                  {departments.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name}
                    </option>
                  ))}
                </select>
              </div>
              {!editingUserId && (
                <TextField
                  label="Temporary Password"
                  value={form.temporary_password}
                  onChange={(v) => setForm((p) => ({ ...p, temporary_password: v }))}
                />
              )}
            </div>

            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <MultiSelectChecklist
                title="Roles"
                items={roles.map((r) => ({ id: r.id, name: r.name }))}
                selected={form.role_ids}
                onToggle={(id) => setForm((p) => ({ ...p, role_ids: toggleIdInArray(p.role_ids, id) }))}
              />
              <MultiSelectChecklist
                title="Specialties"
                items={specialties.map((s) => ({ id: s.id, name: s.name }))}
                selected={form.specialty_ids}
                onToggle={(id) => setForm((p) => ({ ...p, specialty_ids: toggleIdInArray(p.specialty_ids, id) }))}
              />
            </div>

            {editingUserId && (
              <div className="mt-4">
                <label className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700">
                  <input
                    type="checkbox"
                    checked={form.is_active}
                    onChange={(e) => setForm((p) => ({ ...p, is_active: e.target.checked }))}
                  />
                  Active Account
                </label>
              </div>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button type="button" onClick={closePanels} className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700">
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void saveUser()}
                disabled={saving}
                className="inline-flex items-center gap-2 rounded-xl bg-[#003366] px-4 py-2 text-sm font-black uppercase tracking-wider text-white disabled:opacity-60"
              >
                {editingUserId ? <UserCog size={14} /> : <UserPlus size={14} />}
                {saving ? "Saving..." : editingUserId ? "Update User" : "Create User"}
              </button>
            </div>
          </div>
        </div>
      )}

      {passwordUserId !== null && (
        <div className="fixed inset-0 z-50 bg-slate-900/50 p-4">
          <div className="mx-auto max-w-md rounded-2xl bg-white p-5">
            <h2 className="text-lg font-black text-slate-900">Reset Password</h2>
            <p className="mt-1 text-sm text-slate-500">Enter new password for selected user.</p>
            <input
              type="password"
              value={newPassword}
              onChange={(e) => setNewPassword(e.target.value)}
              className="mt-4 w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
              placeholder="New password (min 6 chars)"
            />
            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={closePanels}
                className="rounded-xl border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void resetPassword()}
                disabled={saving || newPassword.length < 6}
                className="rounded-xl bg-[#003366] px-4 py-2 text-sm font-black uppercase tracking-wider text-white disabled:opacity-60"
              >
                {saving ? "Resetting..." : "Reset Password"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[11px] font-black uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-black text-slate-900">{value}</p>
    </div>
  );
}

function TextField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-black uppercase tracking-wider text-slate-500">{label}</label>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-900"
      />
    </div>
  );
}

function MultiSelectChecklist({
  title,
  items,
  selected,
  onToggle,
}: {
  title: string;
  items: Array<{ id: number; name: string }>;
  selected: number[];
  onToggle: (id: number) => void;
}) {
  return (
    <div className="rounded-xl border border-slate-200 p-3">
      <p className="mb-2 text-xs font-black uppercase tracking-wider text-slate-500">{title}</p>
      <div className="max-h-40 space-y-1 overflow-y-auto pr-1">
        {items.map((item) => (
          <label key={item.id} className="flex items-center gap-2 text-sm text-slate-700">
            <input type="checkbox" checked={selected.includes(item.id)} onChange={() => onToggle(item.id)} />
            {item.name}
          </label>
        ))}
        {items.length === 0 && <p className="text-xs text-slate-400">No options available.</p>}
      </div>
    </div>
  );
}

