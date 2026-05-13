
export type UserRole = 'requester' | 'supervisor' | 'technician' | 'inventory_officer' | 'admin';

export enum TicketStatus {
  DRAFT = 'DRAFT',
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  ASSIGNED = 'ASSIGNED',
  IN_PROGRESS = 'IN_PROGRESS',
  ON_HOLD = 'ON_HOLD',
  COMPLETED = 'COMPLETED',
  CLOSED = 'CLOSED',
  REJECTED = 'REJECTED',
  CANCELLED = 'CANCELLED'
}

export enum Priority {
  LOW = 'LOW',
  MEDIUM = 'MEDIUM',
  HIGH = 'HIGH',
  CRITICAL = 'CRITICAL'
}

export interface RequestMessage {
  id: string;
  senderId: string;
  senderName: string;
  senderRole: UserRole;
  text: string;
  createdAt: string;
  updatedAt?: string;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  username: string;
  name: string; 
  email: string;
  phone: string;
  profilePicture?: string;
  department: string;
  role: UserRole;
  universityId: string;
  specialty?: string;
  roles?: string[];
}

export interface MaintenanceRequest {
  id: string;
  title: string;
  requesterId: string;
  requesterName: string;
  department: string;
  location: string;
  building?: string;
  room?: string;
  assetId?: string;
  problemType: string;
  urgency: Priority;
  description: string;
  status: TicketStatus;
  createdAt: string;
  updatedAt: string;
  isPreventive?: boolean; 
  messages?: RequestMessage[];
  rejectionReason?: string;
  approvedAt?: string;
  approvedBy?: string;
  technicianId?: string;
  technicianName?: string;
  technicianPhone?: string; // Added for quick contact
  assignedAt?: string;
  scheduledAt?: string; 
  requesterConfirmed?: boolean; 
  completedAt?: string;
  completionNotes?: string;
  rating?: number;
  requesterComment?: string;
}

export interface PMPlan {
  id: string;
  assetName: string;
  assetId: string;
  category: string;
  frequency: 'Daily' | 'Weekly' | 'Monthly' | 'Quarterly';
  description: string;
  technicianId: string;
  technicianName: string;
  startDate: string;
  nextScheduledDate: string;
  status: 'Active' | 'Paused' | 'Archived';
  priority: Priority;
  reminderDays: number;
}

export interface InventoryItem {
  id: string;
  name: string;
  category: string;
  quantityInHand: number;
  reorderLevel: number;
  unit: string;
  pricePerUnit?: number;
}

export interface InventoryRequest {
  id: string;
  requestId: string;
  partId: string;
  partName: string;
  quantity: number;
  technicianId: string;
  technicianName: string;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  createdAt: string;
  rejectionReason?: string;
}

export interface InventoryTransaction {
  id: string;
  partId: string;
  partName: string;
  type: 'IN' | 'OUT' | 'ADJUSTMENT';
  quantity: number;
  reason: string;
  performedBy: string;
  createdAt: string;
}
