
import { TicketStatus, Priority, MaintenanceRequest, InventoryItem, User, PMPlan, InventoryRequest } from './types';

export const COLORS = {
  primary: '#003366', 
  secondary: '#F9FAFB',
  status: {
    PENDING: '#FBBF24',      // 🟡 Yellow: Submitted
    APPROVED: '#3B82F6',     // 🔵 Blue: Approved
    ASSIGNED: '#3B82F6',     // 🔵 Blue
    IN_PROGRESS: '#F97316',  // 🟠 Orange: In Progress
    COMPLETED: '#10B981',    // 🟢 Green: Success
    REJECTED: '#EF4444',     // 🔴 Red: Error
  }
};

export const DEPARTMENTS = [
  'Computer Science',
  'Civil Engineering',
  'Electrical Engineering',
  'Medicine & Health Sciences',
  'Business & Economics',
  'Law & Governance',
  'Agriculture',
  'Social Sciences & Humanities',
  'Admin / Staff'
];

export const BUILDINGS = [
  'Block 101 (Engineering)',
  'Block 201 (Natural Sciences)',
  'Block 300 (Social Sciences)',
  'Main Library',
  'Student Cafe / Lounge',
  'Dormitory Area A',
  'Dormitory Area B',
  'Admin Building'
];

export const ROOMS = [
  'G-01', '101', '102', '201', '202', '301', 'Lab 1', 'Office A', 'Common Area'
];

export const ASSETS = [
  { id: 'HU-PC-102', name: 'Lab Computer - Dell OptiPlex' },
  { id: 'HU-AC-04', name: 'AC Unit - LG Dual Inverter' },
  { id: 'HU-GEN-01', name: 'Main Power Generator' },
  { id: 'HU-PUMP-22', name: 'Water Pump - Area B' },
  { id: 'HU-PROJ-09', name: 'Projector - Hall 101' },
];

export const MOCK_USERS: User[] = [
  { 
    id: 'u1', 
    firstName: 'Abebe',
    lastName: 'Bikila',
    username: 'abikila',
    name: 'Abebe Bikila', 
    email: 'abebe@hu.edu.et', 
    phone: '+251 911 223344',
    department: 'Software Engineering',
    role: 'requester', 
    universityId: 'HU/1234/15' 
  },
  { 
    id: 'u2', 
    firstName: 'Zeleke',
    lastName: 'Belay',
    username: 'zbelay',
    name: 'Zeleke Belay', 
    email: 'zeleke@hu.edu.et', 
    phone: '+251 911 556677',
    department: 'Facilities Management',
    role: 'supervisor', 
    universityId: 'HU/S/001' 
  },
  { 
    id: 'u3', 
    firstName: 'Hirut',
    lastName: 'Tadesse',
    username: 'htadesse',
    name: 'Hirut Tadesse', 
    email: 'hirut@hu.edu.et', 
    phone: '+251 911 889900',
    department: 'Maintenance',
    role: 'technician', 
    universityId: 'HU/T/045',
    specialty: 'Plumbing'
  },
  { 
    id: 'u4', 
    firstName: 'Dawit',
    lastName: 'Solomon',
    username: 'dsolomon',
    name: 'Dawit Solomon', 
    email: 'dawit@hu.edu.et', 
    phone: '+251 911 112233',
    department: 'Inventory Control',
    role: 'inventory_officer', 
    universityId: 'HU/I/002' 
  },
];

export const MOCK_REQUESTS: MaintenanceRequest[] = [
  {
    id: 'REQ-001',
    title: 'Projector not working',
    requesterId: 'u1',
    requesterName: 'Abebe Bikila',
    department: 'Software Engineering',
    location: 'Engineering Building - Room 204',
    problemType: 'IT Equipment',
    urgency: Priority.HIGH,
    description: 'The projector in Lab 204 does not power on.',
    status: TicketStatus.IN_PROGRESS,
    createdAt: '2026-02-10T09:15:00Z',
    updatedAt: '2026-02-11T08:40:00Z',
    technicianId: 'u3',
    technicianName: 'Hirut Tadesse',
    messages: [
      {
        id: 'msg1',
        senderId: 'u1',
        senderName: 'Abebe Bikila',
        senderRole: 'requester',
        text: 'Please check this urgently.',
        createdAt: '2026-02-10T09:20:00Z'
      },
      {
        id: 'msg2',
        senderId: 'u2',
        senderName: 'Zeleke Belay',
        senderRole: 'supervisor',
        text: 'We are reviewing it.',
        createdAt: '2026-02-10T10:00:00Z'
      }
    ]
  },
  {
    id: 'REQ-002',
    title: 'Water leakage near lab',
    requesterId: 'u1',
    requesterName: 'Abebe Bikila',
    department: 'Software Engineering',
    location: 'Building 14, Hallway',
    problemType: 'Plumbing',
    urgency: Priority.CRITICAL,
    description: 'Severe water leak under the sink causing floor damage.',
    status: TicketStatus.PENDING,
    createdAt: '2026-02-11T10:00:00Z',
    updatedAt: '2026-02-11T10:00:00Z'
  }
];

export const MOCK_PM_PLANS: PMPlan[] = [
  {
    id: 'PM-001',
    assetName: 'Main Power Generator',
    assetId: 'HU-GEN-01',
    category: 'Electrical',
    frequency: 'Monthly',
    description: 'Check oil levels, battery voltage, and cooling system integrity.',
    technicianId: 'u3',
    technicianName: 'Hirut Tadesse',
    startDate: '2024-01-01',
    nextScheduledDate: '2024-04-01',
    status: 'Active',
    priority: Priority.HIGH,
    reminderDays: 3
  }
];

export const MOCK_INVENTORY: InventoryItem[] = [
  { id: 'inv-1', name: 'PVC Pipe 2"', category: 'Plumbing', quantityInHand: 45, reorderLevel: 50, unit: 'Meters', pricePerUnit: 120 },
  { id: 'inv-2', name: 'LED Bulb 12W', category: 'Electrical', quantityInHand: 120, reorderLevel: 30, unit: 'Units', pricePerUnit: 85 },
];

export const MOCK_INVENTORY_REQUESTS: InventoryRequest[] = [];

export const PROBLEM_TYPES = ['Plumbing', 'Electrical', 'IT Equipment', 'HVAC', 'Structural', 'Other'];
export const URGENCY_LEVELS = [Priority.LOW, Priority.MEDIUM, Priority.HIGH, Priority.CRITICAL];
