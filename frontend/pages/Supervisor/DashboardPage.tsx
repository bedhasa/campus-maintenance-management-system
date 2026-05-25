"use client";

import Link from "next/link";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useState } from "react";
import { apiRequest } from "@/lib/api";
import PageSkeleton from "@/components/PageSkeleton";
import { useLiveRefresh } from "@/lib/use-live-refresh";
import {
  Activity,
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Clock3,
  ClipboardCheck,
  PlusCircle,
  Wrench,
} from "lucide-react";

type DashboardPayload = {
  success: boolean;
  summary: {
    new_requests: number;
    approved_pending_assignment: number;
    in_progress: number;
    completed_waiting_closure: number;
    overdue: number;
  };
  pm_overview: {
    upcoming_this_week: number;
    overdue_preventive: number;
  };
};

type RequestsPayload = {
  success: boolean;
  requests: {
    data: Array<{
      id: number;
      title: string;
      status: string;
      created_at: string;
      updated_at?: string;
      department?: { name?: string };
    }>;
  };
};

type AnalyticsLitePayload = {
  success: boolean;
  by_category: Array<{ name: string; total: number; percentage: number }>;
  trend: Array<{ date: string; total: number }>;
  by_department: Array<{ name: string; total: number }>;
  by_building: Array<{ name: string; total: number }>;
};

type RecentActivity = {
  key: string;
  action: string;
  title: string;
  description: string;
  at: string;
  href?: string;
  source: "request" | "system";
  meta?: string;
};

type UserPayload = {
  success: boolean;
  user: {
    roles?: Array<{ id: number; name: string; description?: string }>;
  };
};

type WorkOrdersPayload = {
  success: boolean;
  work_orders: {
    data: Array<{
      id: number;
      work_status: string;
      created_at?: string;
      updated_at?: string;
      request?: {
        title?: string | null;
      } | null;
      assignee?: {
        fname?: string;
        lname?: string;
      } | null;
    }>;
  };
};

type SystemLogsPayload = {
  success: boolean;
  logs: {
    data: Array<{
      id: number;
      module?: string | null;
      action?: string | null;
      status?: string | null;
      reference_id?: number | string | null;
      description?: string | null;
      created_at: string;
      user?: {
        fname?: string | null;
        lname?: string | null;
        email?: string | null;
      } | null;
    }>;
  };
};

const DonutChart = dynamic(() => import("@/components/supervisor/analytics/DonutChart"), {
  ssr: false,
  loading: () => <div className="h-[280px] animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />,
});

const TrendLineChart = dynamic(() => import("@/components/supervisor/analytics/TrendLineChart"), {
  ssr: false,
  loading: () => <div className="h-[280px] animate-pulse rounded-2xl border border-slate-200 bg-slate-100" />,
});

export default function SupervisorDashboardPage() {
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [analytics, setAnalytics] = useState<AnalyticsLitePayload | null>(null);
  const [recentActivity, setRecentActivity] = useState<RecentActivity[]>([]);
  const [dashboardTab, setDashboardTab] = useState<"overview" | "activity">("overview");
  const [hasSupervisorAdminAccess, setHasSupervisorAdminAccess] = useState(false);

  const run = useCallback(async () => {
    const [dashboard, analyticsData, approved, assigned, rejected, userData] = await Promise.all([
      apiRequest<DashboardPayload>("/api/supervisor/dashboard", { method: "GET" }, true),
      apiRequest<AnalyticsLitePayload>("/api/supervisor/analytics?period=yearly", { method: "GET" }, true),
      apiRequest<RequestsPayload>("/api/supervisor/requests?status=approved", { method: "GET" }, true),
      apiRequest<WorkOrdersPayload>("/api/supervisor/work-orders?status=assigned", { method: "GET" }, true),
      apiRequest<RequestsPayload>("/api/supervisor/requests?status=rejected", { method: "GET" }, true),
      apiRequest<UserPayload>("/api/user", { method: "GET" }, true),
    ]);

    const roleNames = (userData.user.roles ?? []).map((role) => role.name.toLowerCase());
    const isSupervisorAdmin = roleNames.includes("supervisor") && roleNames.includes("admin");
    setHasSupervisorAdminAccess(isSupervisorAdmin);

    let systemLogs: SystemLogsPayload | null = null;
    if (isSupervisorAdmin) {
      try {
        systemLogs = await apiRequest<SystemLogsPayload>("/api/admin/system-logs", { method: "GET" }, true);
      } catch {
        systemLogs = null;
      }
    }

    const toRequestActivity = (
      rows: RequestsPayload["requests"]["data"],
      action: "APPROVED" | "REJECTED"
    ): RecentActivity[] =>
      rows.map((item) => ({
        key: `request-${action}-${item.id}`,
        action,
        title: item.title,
        description:
          action === "APPROVED"
            ? `Status set to APPROVED. Department: ${item.department?.name ?? "General"}. Next step: assign technician.`
            : `Status set to REJECTED. Department: ${item.department?.name ?? "General"}. Next step: requester updates and resubmits.`,
        at: item.updated_at ?? item.created_at,
        href: `/supervisor/requests?request=${item.id}`,
        source: "request",
        meta: `Request ID #${item.id}`,
      }));

    const toWorkOrderActivity = (
      rows: WorkOrdersPayload["work_orders"]["data"]
    ): RecentActivity[] =>
      rows.map((item) => {
        const technicianName = `${item.assignee?.fname ?? ""} ${item.assignee?.lname ?? ""}`.trim() || "Assigned technician";

        return {
          key: `work-order-${item.id}`,
          action: "ASSIGNED",
          title: item.request?.title ?? `Work Order #${item.id}`,
          description: `Assigned to ${technicianName}. Work order is ready for technician action.`,
          at: item.updated_at ?? item.created_at ?? new Date().toISOString(),
          href: `/supervisor/work-orders/${item.id}`,
          source: "request",
          meta: `Work Order #${item.id}`,
        };
      });

    const toSystemActivity = (
      rows: SystemLogsPayload["logs"]["data"]
    ): RecentActivity[] =>
      rows.slice(0, 5).map((log) => {
        const actor = `${log.user?.fname ?? ""} ${log.user?.lname ?? ""}`.trim() || log.user?.email || "System";
        const moduleLabel = (log.module ?? "system").replace(/_/g, " ").toUpperCase();
        const actionLabel = (log.action ?? "updated").replace(/_/g, " ").toUpperCase();
        const statusLabel = (log.status ?? "").toUpperCase();

        return {
          key: `system-${log.id}`,
          action: statusLabel ? `${moduleLabel} ${statusLabel}` : moduleLabel,
          title: `${actor} - ${actionLabel}`,
          description: log.description ?? "System activity recorded.",
          at: log.created_at,
          href: `/admin/system-logs?log=${log.id}`,
          source: "system",
          meta: log.reference_id ? `Ref #${log.reference_id}` : "System Log",
        };
      });

    const merged = [
      ...toRequestActivity(approved.requests?.data ?? [], "APPROVED"),
      ...toWorkOrderActivity(assigned.work_orders?.data ?? []),
      ...toRequestActivity(rejected.requests?.data ?? [], "REJECTED"),
      ...(systemLogs ? toSystemActivity(systemLogs.logs?.data ?? []) : []),
    ]
      .sort((a, b) => new Date(b.at).getTime() - new Date(a.at).getTime())
      .slice(0, 10);

    setRecentActivity(merged);
    setData(dashboard);
    setAnalytics(analyticsData);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void run();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [run]);

  useLiveRefresh(run, {
    enabled: true,
    topics: ['supervisor.dashboard', 'supervisor.requests', 'supervisor.work-orders', 'requests', 'work-orders'],
    refreshOnFocus: false,
  });

  if (!data) return <PageSkeleton cards={5} rows={6} />;

  const primaryCards = [
    {
      label: "Pending Requests",
      value: data.summary.new_requests,
      href: "/supervisor/requests?status=submitted",
      tone: "border-amber-200 bg-amber-50 text-amber-900",
      icon: <Clock3 size={18} className="text-amber-600" />,
    },
    {
      label: "Approved",
      value: data.summary.approved_pending_assignment,
      href: "/supervisor/requests?status=approved",
      tone: "border-emerald-200 bg-emerald-50 text-emerald-900",
      icon: <CheckCircle2 size={18} className="text-emerald-600" />,
    },
    {
      label: "In Progress",
      value: data.summary.in_progress,
      href: "/supervisor/work-orders?status=in_progress",
      tone: "border-blue-200 bg-blue-50 text-blue-900",
      icon: <Wrench size={18} className="text-blue-600" />,
    },
    {
      label: "Pending Closure",
      value: data.summary.completed_waiting_closure,
      href: "/supervisor/work-orders?status=completed",
      tone: "border-violet-200 bg-violet-50 text-violet-900",
      icon: <ClipboardCheck size={18} className="text-violet-600" />,
    },
  ];

  const donutSlices =
    analytics?.by_category?.slice(0, 6).map((row) => ({
      name: row.name,
      total: row.total,
      percentage: row.percentage,
    })) ?? [];

  const trendPoints =
    analytics?.trend?.reduce((acc, row) => {
      const label = new Date(row.date).toLocaleDateString("en-US", { month: "short", year: "numeric" });
      const last = acc[acc.length - 1];
      if (last && last.label === label) {
        last.value += row.total;
      } else {
        acc.push({ label, value: row.total });
      }
      return acc;
    }, [] as Array<{ label: string; value: number }>) ?? [];

  const topDepartments = analytics?.by_department?.slice(0, 5) ?? [];
  const topBuildings = analytics?.by_building?.slice(0, 5) ?? [];

  const actionBadge = (activity: RecentActivity) => {
    if (activity.source === "system") return "bg-slate-100 text-slate-700";
    const action = activity.action;
    if (action === "APPROVED") return "bg-emerald-100 text-emerald-700";
    if (action === "ASSIGNED") return "bg-blue-100 text-blue-700";
    return "bg-rose-100 text-rose-700";
  };

  return (
    <div className="space-y-6 pb-12">
      <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm md:flex-row md:items-center md:justify-between">
        <div>
          <p className="text-[11px] font-black uppercase tracking-[0.2em] text-slate-500">Supervisor Dashboard</p>
          <h1 className="mt-1 text-2xl font-black tracking-tight text-slate-900">Maintenance Analytics Overview</h1>
        </div>
        <Link
          href="/supervisor/maintenance-center"
          className="inline-flex items-center gap-2 rounded-xl bg-[#003366] px-4 py-2 text-xs font-black uppercase tracking-wider text-white transition hover:bg-[#0b4480]"
        >
          <PlusCircle size={16} />
          New Work Order
        </Link>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:col-span-8">
          {primaryCards.map((card) => (
            <Link
              key={card.label}
              href={card.href}
              className={`rounded-2xl border p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md ${card.tone}`}
            >
              <div className="flex items-center justify-between">
                <p className="text-[11px] font-black uppercase tracking-[0.15em]">{card.label}</p>
                {card.icon}
              </div>
              <p className="mt-3 text-3xl font-black">{card.value}</p>
            </Link>
          ))}
        </div>

        <div className="space-y-4 xl:col-span-4">
          <Link
            href="/supervisor/work-orders?filter=overdue"
            className="block rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-[0.15em] text-rose-700">Overdue</p>
              <AlertTriangle size={18} className="text-rose-600" />
            </div>
            <p className="mt-2 text-3xl font-black text-rose-900">{data.summary.overdue}</p>
            <p className="text-xs font-semibold text-rose-700">Work orders past due date</p>
          </Link>

          <Link
            href="/supervisor/maintenance-center?tab=pm"
            className="block rounded-2xl border border-sky-200 bg-sky-50 p-5 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
          >
            <div className="flex items-center justify-between">
              <p className="text-[11px] font-black uppercase tracking-[0.15em] text-sky-700">PM</p>
              <Activity size={18} className="text-sky-600" />
            </div>
            <p className="mt-2 text-2xl font-black text-sky-900">
              {data.pm_overview.upcoming_this_week} / {data.pm_overview.overdue_preventive}
            </p>
            <p className="text-xs font-semibold text-sky-700">Upcoming vs overdue preventive tasks</p>
          </Link>
        </div>
      </div>

      <div className="grid gap-4 xl:grid-cols-12">
        <div className="xl:col-span-5">
          <DonutChart title="Issue Categories (Pie)" slices={donutSlices} mode="number" />
        </div>
        <div className="xl:col-span-7">
          <TrendLineChart title="Request Trend (Line)" points={trendPoints} />
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h3 className="text-sm font-black uppercase tracking-[0.15em] text-slate-800">Dashboard Panels</h3>
            <p className="mt-1 text-xs font-semibold text-slate-500">
              Switch between quick overview panels and the broader recent activity feed.
            </p>
          </div>
          <div className="inline-flex rounded-2xl bg-slate-100 p-1">
            <button
              type="button"
              onClick={() => setDashboardTab("overview")}
              className={`rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] transition ${
                dashboardTab === "overview" ? "bg-white text-[#003366] shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Overview
            </button>
            <button
              type="button"
              onClick={() => setDashboardTab("activity")}
              className={`rounded-xl px-4 py-2 text-[11px] font-black uppercase tracking-[0.12em] transition ${
                dashboardTab === "activity" ? "bg-white text-[#003366] shadow-sm" : "text-slate-500 hover:text-slate-700"
              }`}
            >
              Recent Activity
            </button>
          </div>
        </div>

        {dashboardTab === "overview" ? (
          <div className="space-y-6">
            <div>
              <h4 className="mb-3 text-sm font-black uppercase tracking-[0.14em] text-slate-800">
                Top 5 Departments & Buildings
              </h4>
              <div className="grid gap-4 md:grid-cols-2">
                <div>
                  <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Departments</p>
                  <div className="overflow-hidden rounded-xl border border-slate-100">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2">Department</th>
                          <th className="px-3 py-2 text-right">Requests</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {topDepartments.map((row) => (
                          <tr key={`dep-${row.name}`} className="text-sm">
                            <td className="px-3 py-2 font-semibold text-slate-700">{row.name}</td>
                            <td className="px-3 py-2 text-right font-black text-slate-900">{row.total}</td>
                          </tr>
                        ))}
                        {topDepartments.length === 0 && (
                          <tr>
                            <td colSpan={2} className="px-3 py-3 text-center text-xs font-semibold text-slate-400">
                              No department data
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
                <div>
                  <p className="mb-2 text-[11px] font-black uppercase tracking-[0.12em] text-slate-500">Buildings</p>
                  <div className="overflow-hidden rounded-xl border border-slate-100">
                    <table className="w-full text-left">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-black uppercase tracking-wide text-slate-500">
                          <th className="px-3 py-2">Building</th>
                          <th className="px-3 py-2 text-right">Requests</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {topBuildings.map((row) => (
                          <tr key={`building-${row.name}`} className="text-sm">
                            <td className="px-3 py-2 font-semibold text-slate-700">{row.name}</td>
                            <td className="px-3 py-2 text-right font-black text-slate-900">{row.total}</td>
                          </tr>
                        ))}
                        {topBuildings.length === 0 && (
                          <tr>
                            <td colSpan={2} className="px-3 py-3 text-center text-xs font-semibold text-slate-400">
                              No building data
                            </td>
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>

          </div>
        ) : (
          <div>
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h4 className="text-sm font-black uppercase tracking-[0.15em] text-slate-800">Recent Activity (Top 10)</h4>
                <p className="mt-1 text-xs font-semibold text-slate-500">
                  {hasSupervisorAdminAccess
                    ? "Includes request flow and the latest system logs such as user updates and admin actions."
                    : "Includes the latest request review and assignment activity."}
                </p>
              </div>
              <Link
                href={hasSupervisorAdminAccess ? "/admin/system-logs" : "/supervisor/requests"}
                className="text-xs font-black uppercase tracking-wider text-[#003366] hover:text-[#0b4480]"
              >
                View All
              </Link>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-left">
                <thead>
                  <tr className="border-b border-slate-200 text-[11px] font-black uppercase tracking-[0.14em] text-slate-500">
                    <th className="pb-3">Action</th>
                    <th className="pb-3">Item</th>
                    <th className="pb-3">Description</th>
                    <th className="pb-3 text-right">Time</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recentActivity.map((activity) => (
                    <tr key={activity.key} className="text-sm transition hover:bg-slate-50/70">
                      <td className="py-3">
                        <span className={`rounded-full px-2.5 py-1 text-[10px] font-black uppercase tracking-wider ${actionBadge(activity)}`}>
                          {activity.action}
                        </span>
                      </td>
                      <td className="py-3">
                        {activity.href ? (
                          <Link href={activity.href} className="group inline-flex items-center gap-2 font-black text-slate-900 hover:text-[#003366]">
                            {activity.title}
                            <ArrowUpRight size={14} className="text-slate-400 transition group-hover:text-[#003366]" />
                          </Link>
                        ) : (
                          <p className="font-black text-slate-900">{activity.title}</p>
                        )}
                        <p className="mt-1 text-[11px] font-semibold text-slate-400">{activity.meta}</p>
                      </td>
                      <td className="py-3 text-slate-600">
                        <p className="max-w-[420px] text-sm leading-relaxed">{activity.description}</p>
                      </td>
                      <td className="py-3 text-right">
                        <p className="text-xs font-black text-slate-700">{new Date(activity.at).toLocaleDateString()}</p>
                        <p className="text-[11px] font-semibold text-slate-400">
                          {new Date(activity.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                        </p>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {recentActivity.length === 0 && (
              <p className="py-6 text-center text-sm font-semibold text-slate-500">
                No recent activity found yet.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
