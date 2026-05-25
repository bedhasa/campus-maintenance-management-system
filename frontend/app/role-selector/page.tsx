"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { 
  ClipboardList, 
  Wrench, 
  ShieldCheck, 
  Boxes, 
  LogOut, 
  ArrowRight,
  UserCircle
} from "lucide-react";
import { apiRequest, clearAuth, readAuthUser, writeAuthToken, writeAuthUser } from "@/lib/api";
import { normalizeUserRole, roleDashboardPath } from "@/lib/role-routes";

type Role = { id: number; name: string; description: string };
type AuthUser = {
  id: number;
  fname: string;
  lname: string;
  email: string;
  roles: Role[];
  active_role: string | null;
};

type UserResponse = {
  success: boolean;
  user: AuthUser;
};

type SelectRoleResponse = {
  success: boolean;
  message: string;
  token: string;
  user: AuthUser;
};

export default function RoleSelector() {
  const router = useRouter();
  const hasBootstrappedRef = useRef(false);
  const [loadingRole, setLoadingRole] = useState<string | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (hasBootstrappedRef.current) {
      return;
    }
    hasBootstrappedRef.current = true;

    let isActive = true;

    const bootstrap = async () => {
      const cached = readAuthUser<AuthUser>();
      if (cached && isActive) {
        setUser(cached);
      }

      try {
        const data = await apiRequest<UserResponse>("/api/user", { method: "GET" }, true);
        if (!isActive) {
          return;
        }

        setUser(data.user);
        writeAuthUser(data.user);

        const roleNames = (data.user.roles ?? []).map((r) => r.name.toLowerCase());
        if (roleNames.includes("supervisor") && roleNames.includes("admin")) {
          router.replace("/supervisor/dashboard");
          return;
        }
      } catch {
        if (!isActive) {
          return;
        }
        clearAuth();
        router.replace("/login");
      }
    };

    void bootstrap();

    return () => {
      isActive = false;
    };
  }, [router]);

  const handleRoleSelect = async (role: Role) => {
    setError(null);
    setLoadingRole(role.name);

    try {
      const data = await apiRequest<SelectRoleResponse>(
        "/api/select-role",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ role_id: role.id }),
        },
        true
      );
      writeAuthToken(data.token);
      writeAuthUser(data.user);
      const normalizedRole = normalizeUserRole(role.name);
      const destination = normalizedRole ? roleDashboardPath(normalizedRole) : "/requester/dashboard";
      router.push(destination);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Role selection failed.";
      setError(message);
      setLoadingRole(null);
    }
  };

  const roleConfigs: Record<string, { icon: React.ReactNode; desc: string; color: string }> = {
    requester: {
      icon: <ClipboardList size={32} />,
      desc: "Submit maintenance requests and track facility repairs.",
      color: "blue"
    },
    technician: {
      icon: <Wrench size={32} />,
      desc: "Manage assigned work orders and log maintenance tasks.",
      color: "emerald"
    },
    supervisor: {
      icon: <ShieldCheck size={32} />,
      desc: "Approve requests, assign staff, and view analytics.",
      color: "indigo"
    },
    inventory: {
      icon: <Boxes size={32} />,
      desc: "Track spare parts, tools, and procurement orders.",
      color: "amber"
    },
    admin: {
      icon: <ShieldCheck size={32} />,
      desc: "Manage users, roles, and system configuration.",
      color: "slate"
    }
  };

  const roles = useMemo(() => {
    const allRoles = user?.roles ?? [];
    const roleNames = new Set(allRoles.map((r) => r.name.toLowerCase()));

    if (roleNames.has("supervisor") || roleNames.has("admin")) {
      return allRoles.filter((r) => {
        const name = r.name.toLowerCase();
        return name === "supervisor" || name === "admin";
      });
    }

    return allRoles;
  }, [user]);
  const displayName = (roleName: string) =>
    roleName
      .split(/[\s_-]+/)
      .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
      .join(" ");

  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-6 bg-slate-50 text-slate-900">
      {/* Header Section */}
      <div className="w-full max-w-4xl text-center mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-white rounded-full shadow-sm border border-slate-200 mb-6">
          <UserCircle size={20} className="text-blue-600" />
          <span className="text-sm font-bold text-slate-700">
            Welcome, {user ? `${user.fname} ${user.lname}` : "Loading..."}
          </span>
        </div>
        <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight sm:text-5xl">
          Choose Your Perspective
        </h1>
        <p className="text-slate-500 mt-4 text-lg max-w-2xl mx-auto font-medium">
          Select a workspace to manage university facilities and maintenance operations.
        </p>
      </div>

      {error && (
        <div className="mb-6 w-full max-w-2xl p-4 rounded-xl bg-rose-50 border border-rose-100 text-rose-700 text-sm font-semibold text-center">
          {error}
        </div>
      )}

      {/* Role Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-4xl">
        {roles.map((role) => {
          const config = roleConfigs[role.name] ?? roleConfigs.requester;
          const isSelected = loadingRole === role.name;

          return (
            <button
              key={role.id}
              onClick={() => handleRoleSelect(role)}
              disabled={!!loadingRole}
              className={`group relative bg-white p-8 rounded-3xl shadow-md border-2 transition-all duration-300 flex flex-col items-center text-center overflow-hidden
                ${isSelected ? "border-blue-600 ring-4 ring-blue-50" : "border-transparent hover:border-blue-400 hover:shadow-xl hover:-translate-y-1"}
                ${loadingRole && !isSelected ? "opacity-50 grayscale-[0.5]" : "opacity-100"}
              `}
            >
              {/* Icon Container */}
              <div className={`w-20 h-20 rounded-2xl flex items-center justify-center mb-6 transition-all duration-500 
                ${isSelected ? "bg-blue-600 text-white rotate-12" : "bg-slate-50 text-slate-600 group-hover:bg-blue-50 group-hover:text-blue-600"}
              `}>
                {config.icon}
              </div>

              <h3 className="text-2xl font-bold text-slate-800 mb-3">{displayName(role.name)}</h3>
              <p className="text-slate-500 text-sm leading-relaxed font-medium">
                {role.description || config.desc}
              </p>

              {/* Action Hint */}
              <div className="mt-8 flex items-center gap-2 text-blue-600 font-bold text-sm uppercase tracking-wider opacity-0 group-hover:opacity-100 translate-y-2 group-hover:translate-y-0 transition-all">
                <span>Enter Dashboard</span>
                <ArrowRight size={16} />
              </div>

              {/* Selection Overlay */}
              {isSelected && (
                <div className="absolute inset-0 bg-white/40 backdrop-blur-[2px] flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
                </div>
              )}
            </button>
          );
        })}
      </div>

      {/* Logout Link */}
      <button 
        onClick={async () => {
          try {
            await apiRequest("/api/logout", { method: "POST" }, true);
          } catch {
            // Ignore logout API failures and clear local auth regardless.
          } finally {
            clearAuth();
            router.push("/login");
          }
        }}
        className="mt-16 flex items-center space-x-2 text-slate-400 hover:text-rose-600 font-bold transition-all hover:gap-3"
      >
        <LogOut size={20} />
        <span className="uppercase tracking-widest text-xs">Terminate Session</span>
      </button>

      {/* Footer Branding */}
      <div className="mt-12 text-slate-300 font-bold text-[10px] uppercase tracking-[0.2em]">
        University CMMS v2.0 | Secured Portal
      </div>
    </div>
  );
}

