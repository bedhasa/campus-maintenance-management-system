"use client";

import { useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";

type User = { id: number; fname: string; lname: string; email: string; is_active: boolean };

export default function UsersPage() {
  const [users, setUsers] = useState<User[]>([]);

  useEffect(() => {
    let ignore = false;
    (async () => {
      const data = await apiRequest<{ success: boolean; users: { data: User[] } }>("/api/admin/users", { method: "GET" }, true);
      if (!ignore) {
        setUsers(data.users.data ?? []);
      }
    })();
    return () => {
      ignore = true;
    };
  }, []);

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-black text-slate-900">User Management</h1>
      <div className="space-y-3">
        {users.map((u) => (
          <div key={u.id} className="bg-white border border-slate-200 rounded-xl p-4">
            <p className="font-bold">{u.fname} {u.lname}</p>
            <p className="text-xs text-slate-500">{u.email} - {u.is_active ? "Active" : "Inactive"}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
