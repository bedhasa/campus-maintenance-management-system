"use client";

import React, { useEffect, useState, createContext, useContext } from "react";
import {
  User,
  UserRole,
  MaintenanceRequest,
  PMPlan,
  InventoryItem,
  InventoryRequest,
  InventoryTransaction,
} from "./types";
import {
  MOCK_REQUESTS,
  MOCK_PM_PLANS,
  MOCK_INVENTORY,
  MOCK_INVENTORY_REQUESTS,
} from "./constants";
import { translations, Language } from "./translations";
import { normalizeUserRole } from "./lib/role-routes";
import { clearAuth, readAuthToken, readAuthUser } from "./lib/api";

export interface Notification {
  id: string;
  title: string;
  message: string;
  time: string;
  read: boolean;
  type: "info" | "success" | "warning" | "error";
  requestId?: string;
  targetPath?: string;
  recipientId?: string;
  recipientRole?: UserRole;
}

interface AppContextType {
  requests: MaintenanceRequest[];
  pmPlans: PMPlan[];
  inventory: InventoryItem[];
  inventoryRequests: InventoryRequest[];
  inventoryTransactions: InventoryTransaction[];
  updateRequest: (id: string, updates: Partial<MaintenanceRequest>) => void;
  updatePMPlan: (id: string, updates: Partial<PMPlan>) => void;
  deletePMPlan: (id: string) => void;
  addPMPlan: (plan: PMPlan) => void;
  addRequest: (request: MaintenanceRequest) => void;
  addRequestMessage: (requestId: string, text: string) => void;
  editRequestMessage: (requestId: string, messageId: string, newText: string) => void;
  deleteRequestMessage: (requestId: string, messageId: string) => void;
  updateInventoryItem: (id: string, updates: Partial<InventoryItem>) => void;
  addInventoryItem: (item: InventoryItem) => void;
  requestInventoryPart: (req: Omit<InventoryRequest, "id" | "status" | "createdAt">) => void;
  handleInventoryRequest: (id: string, status: "APPROVED" | "REJECTED", reason?: string) => void;
  currentUser: User | null;
  login: (user: User) => void;
  logout: () => void;
  notifications: Notification[];
  addNotification: (
    title: string,
    message: string,
    type?: Notification["type"],
    requestId?: string,
    targetPath?: string,
    recipientId?: string,
    recipientRole?: UserRole,
  ) => void;
  markNotificationsRead: () => void;
  markNotificationAsRead: (id: string) => void;
  clearNotifications: () => void;
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: keyof typeof translations["en"]) => string;
  viewedRequestId: string | null;
  setViewedRequestId: (id: string | null) => void;
}

const AppContext = createContext<AppContextType | undefined>(undefined);

export const useApp = () => {
  const context = useContext(AppContext);
  if (!context) throw new Error("useApp must be used within AppProvider");
  return context;
};

interface AppProviderProps {
  children?: React.ReactNode;
}

const mapStoredUser = (raw: unknown): User | null => {
  if (!raw || typeof raw !== "object") return null;
  const source = raw as Record<string, unknown>;

  const normalizedRole = normalizeUserRole(
    (source.role as string | undefined) ??
      (source.active_role as string | undefined) ??
      ((source.roles as Array<{ name?: string }> | undefined)?.[0]?.name ?? undefined),
  );

  const rawRoles = source.roles as Array<{ name?: string }> | undefined;
  const roleNames = Array.isArray(rawRoles)
    ? rawRoles.map((r) => (r?.name ?? "").toString().toLowerCase()).filter(Boolean)
    : [];

  if (!normalizedRole) return null;

  const firstName = (source.firstName as string | undefined) ?? (source.fname as string | undefined) ?? "";
  const lastName = (source.lastName as string | undefined) ?? (source.lname as string | undefined) ?? "";
  const departmentValue = source.department as { name?: string; faculty?: string } | string | undefined;
  const normalizedDepartment =
    typeof departmentValue === "string"
      ? departmentValue
      : departmentValue?.name
        ? departmentValue.faculty
          ? `${departmentValue.name} (${departmentValue.faculty})`
          : departmentValue.name
        : "";
  const username =
    (source.username as string | undefined) ??
    (typeof source.email === "string" ? source.email.split("@")[0] : "user");
  const email = (source.email as string | undefined) ?? "";
  const fullName = `${firstName} ${lastName}`.trim();

  return {
    id: String(source.id ?? ""),
    firstName,
    lastName,
    username,
    name: (source.name as string | undefined) ?? (fullName || username),
    email,
    phone: (source.phone as string | undefined) ?? "",
    profilePicture:
      (source.profilePicture as string | undefined) ??
      (source.profile_picture_url as string | undefined) ??
      (source.profile_picture as string | undefined),
    department: normalizedDepartment,
    role: normalizedRole,
    universityId:
      (source.universityId as string | undefined) ??
      (source.university_id_number as string | undefined) ??
      "",
    specialty: source.specialty as string | undefined,
    roles: roleNames,
  };
};

const safeParse = (raw: string | null): unknown => {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
};

const resolveStoredUser = (): User | null => {
  if (typeof window === "undefined") return null;
  const token = readAuthToken();
  if (!token) {
    localStorage.removeItem("user");
    localStorage.removeItem("auth_user");
    sessionStorage.removeItem("auth_user");
    return null;
  }

  const savedUser = localStorage.getItem("user");
  const savedAuthUser = readAuthUser();

  const parsedAuthUser = mapStoredUser(savedAuthUser);
  if (parsedAuthUser) {
    localStorage.setItem("user", JSON.stringify(parsedAuthUser));
    return parsedAuthUser;
  }

  const parsedUser = mapStoredUser(safeParse(savedUser));
  if (parsedUser) {
    localStorage.setItem("user", JSON.stringify(parsedUser));
    return parsedUser;
  }

  return null;
};

export const AppProvider: React.FC<AppProviderProps> = ({ children }) => {
  const [requests, setRequests] = useState<MaintenanceRequest[]>(MOCK_REQUESTS);
  const [pmPlans, setPmPlans] = useState<PMPlan[]>(MOCK_PM_PLANS);
  const [inventory, setInventory] = useState<InventoryItem[]>(MOCK_INVENTORY);
  const [inventoryRequests, setInventoryRequests] = useState<InventoryRequest[]>(MOCK_INVENTORY_REQUESTS);
  const [inventoryTransactions, setInventoryTransactions] = useState<InventoryTransaction[]>([]);
  const [notifications, setNotifications] = useState<Notification[]>([
    {
      id: "1",
      title: "System Welcome",
      message: "Welcome to the HU Campus Maintenance System.",
      time: "2h ago",
      read: false,
      type: "info",
    },
  ]);
  const [language, setLanguage] = useState<Language>(() => {
    if (typeof window === "undefined") return "en";
    const saved = localStorage.getItem("language");
    return saved === "am" ? "am" : "en";
  });
  const [currentUser, setCurrentUser] = useState<User | null>(() => {
    return resolveStoredUser();
  });
  const [viewedRequestId, setViewedRequestId] = useState<string | null>(null);

  useEffect(() => {
    const syncCurrentUser = () => {
      setCurrentUser(resolveStoredUser());
    };

    syncCurrentUser();
    window.addEventListener("storage", syncCurrentUser);
    window.addEventListener("auth-user-updated", syncCurrentUser);
    window.addEventListener("auth-state-changed", syncCurrentUser);

    return () => {
      window.removeEventListener("storage", syncCurrentUser);
      window.removeEventListener("auth-user-updated", syncCurrentUser);
      window.removeEventListener("auth-state-changed", syncCurrentUser);
    };
  }, []);

  useEffect(() => {
    localStorage.setItem("language", language);
  }, [language]);

  const t = (key: keyof typeof translations["en"]) => {
    return translations[language][key] || translations.en[key];
  };

  const login = (user: User) => {
    setCurrentUser(user);
    localStorage.setItem("user", JSON.stringify(user));
  };

  const logout = () => {
    setCurrentUser(null);
    clearAuth();
  };

  const addNotification = (
    title: string,
    message: string,
    type: Notification["type"] = "info",
    requestId?: string,
    targetPath?: string,
    recipientId?: string,
    recipientRole?: UserRole,
  ) => {
    const newNotif: Notification = {
      id: Date.now().toString(),
      title,
      message,
      time: "Just now",
      read: false,
      type,
      requestId,
      targetPath,
      recipientId,
      recipientRole,
    };
    setNotifications((prev) => [newNotif, ...prev]);
  };

  const updateInventoryItem = (id: string, updates: Partial<InventoryItem>) => {
    setInventory((prev) =>
      prev.map((item) => {
        if (item.id === id) {
          if (updates.quantityInHand !== undefined && updates.quantityInHand > item.quantityInHand) {
            const diff = updates.quantityInHand - item.quantityInHand;
            setInventoryTransactions((txs) => [
              {
                id: Date.now().toString(),
                partId: id,
                partName: item.name,
                type: "IN",
                quantity: diff,
                reason: "Manual Restock",
                performedBy: currentUser?.name || "Officer",
                createdAt: new Date().toISOString(),
              },
              ...txs,
            ]);
          }
          return { ...item, ...updates };
        }
        return item;
      }),
    );
  };

  const addInventoryItem = (item: InventoryItem) => {
    setInventory((prev) => [item, ...prev]);
    setInventoryTransactions((txs) => [
      {
        id: Date.now().toString(),
        partId: item.id,
        partName: item.name,
        type: "IN",
        quantity: item.quantityInHand,
        reason: "Initial Registration",
        performedBy: currentUser?.name || "Officer",
        createdAt: new Date().toISOString(),
      },
      ...txs,
    ]);
  };

  const requestInventoryPart = (req: Omit<InventoryRequest, "id" | "status" | "createdAt">) => {
    const newReq: InventoryRequest = {
      ...req,
      id: `INVRQ-${Date.now()}`,
      status: "PENDING",
      createdAt: new Date().toISOString(),
    };
    setInventoryRequests((prev) => [newReq, ...prev]);
    addNotification(
      "New Material Request",
      `Technician ${req.technicianName} requested ${req.partName}.`,
      "info",
      req.requestId,
      "/inventory/requests",
      undefined,
      "inventory_officer",
    );
  };

  const handleInventoryRequest = (id: string, status: "APPROVED" | "REJECTED", reason?: string) => {
    setInventoryRequests((prev) =>
      prev.map((req) => {
        if (req.id === id) {
          if (status === "APPROVED") {
            setInventory((inv) =>
              inv.map((i) => {
                if (i.id === req.partId) {
                  const newQty = i.quantityInHand - req.quantity;
                  setInventoryTransactions((txs) => [
                    {
                      id: Date.now().toString(),
                      partId: i.id,
                      partName: i.name,
                      type: "OUT",
                      quantity: req.quantity,
                      reason: `Task ${req.requestId} fulfillment`,
                      performedBy: currentUser?.name || "Officer",
                      createdAt: new Date().toISOString(),
                    },
                    ...txs,
                  ]);
                  return { ...i, quantityInHand: newQty };
                }
                return i;
              }),
            );
            addNotification(
              "Materials Ready",
              `Your request for ${req.partName} has been approved.`,
              "success",
              req.requestId,
              "/technician/dashboard",
              req.technicianId,
            );
          } else {
            addNotification(
              "Materials Request Denied",
              `Request for ${req.partName} was rejected: ${reason}`,
              "error",
              req.requestId,
              "/technician/dashboard",
              req.technicianId,
            );
          }
          return { ...req, status, rejectionReason: reason };
        }
        return req;
      }),
    );
  };

  const markNotificationsRead = () => {
    setNotifications((prev) =>
      prev.map((n) => {
        const isRelevant = (n.recipientId ? n.recipientId === currentUser?.id : true) &&
          (n.recipientRole ? n.recipientRole === currentUser?.role : true);
        return isRelevant ? { ...n, read: true } : n;
      }),
    );
  };

  const markNotificationAsRead = (id: string) => {
    setNotifications((prev) => prev.map((n) => (n.id === id ? { ...n, read: true } : n)));
  };

  const clearNotifications = () => {
    setNotifications((prev) =>
      prev.filter(
        (n) =>
          (n.recipientId ? n.recipientId !== currentUser?.id : false) ||
          (n.recipientRole ? n.recipientRole !== currentUser?.role : false),
      ),
    );
  };

  const addRequest = (request: MaintenanceRequest) => {
    setRequests((prev) => [request, ...prev]);
    addNotification(
      "Request Submitted",
      "Request successfully submitted.",
      "success",
      request.id,
      "/requester/dashboard",
      request.requesterId,
    );
    addNotification(
      "New Request",
      "A new maintenance request awaits review.",
      "info",
      request.id,
      "/supervisor/requests",
      undefined,
      "supervisor",
    );
  };

  const updateRequest = (id: string, updates: Partial<MaintenanceRequest>) => {
    setRequests((prev) =>
      prev.map((req) => (req.id === id ? { ...req, ...updates, updatedAt: new Date().toISOString() } : req)),
    );
  };

  const addRequestMessage = (requestId: string, text: string) => {
    setRequests((prev) =>
      prev.map((r) =>
        r.id === requestId
          ? {
              ...r,
              messages: [
                ...(r.messages || []),
                {
                  id: Date.now().toString(),
                  senderId: currentUser?.id || "",
                  senderName: currentUser?.name || "",
                  senderRole: currentUser?.role || "requester",
                  text,
                  createdAt: new Date().toISOString(),
                },
              ],
            }
          : r,
      ),
    );
  };

  const editRequestMessage = (requestId: string, messageId: string, newText: string) => {
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id === requestId) {
          const updatedMessages = (r.messages || []).map((m) =>
            m.id === messageId ? { ...m, text: newText, updatedAt: new Date().toISOString() } : m,
          );
          return { ...r, messages: updatedMessages };
        }
        return r;
      }),
    );
  };

  const deleteRequestMessage = (requestId: string, messageId: string) => {
    setRequests((prev) =>
      prev.map((r) => {
        if (r.id === requestId) {
          const filteredMessages = (r.messages || []).filter((m) => m.id !== messageId);
          return { ...r, messages: filteredMessages };
        }
        return r;
      }),
    );
  };

  const addPMPlan = (plan: PMPlan) => setPmPlans((prev) => [...prev, plan]);
  const updatePMPlan = (id: string, updates: Partial<PMPlan>) => {
    setPmPlans((prev) => prev.map((p) => (p.id === id ? { ...p, ...updates } : p)));
  };
  const deletePMPlan = (id: string) => setPmPlans((prev) => prev.filter((p) => p.id !== id));

  return (
    <AppContext.Provider
      value={{
        requests,
        pmPlans,
        inventory,
        inventoryRequests,
        inventoryTransactions,
        updateRequest,
        updatePMPlan,
        deletePMPlan,
        addPMPlan,
        addRequest,
        addRequestMessage,
        editRequestMessage,
        deleteRequestMessage,
        updateInventoryItem,
        addInventoryItem,
        requestInventoryPart,
        handleInventoryRequest,
        currentUser,
        login,
        logout,
        notifications,
        addNotification,
        markNotificationsRead,
        markNotificationAsRead,
        clearNotifications,
        language,
        setLanguage,
        t,
        viewedRequestId,
        setViewedRequestId,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export default AppProvider;
