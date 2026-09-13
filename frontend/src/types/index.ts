export type UserRole = 'farmer' | 'admin' | 'superadmin';

export interface User {
  id: string;
  name: string;
  phone?: string;
  email?: string;
  role: UserRole;
  googleId?: string;
  emailVerified?: boolean;
  authProviders?: string[];
  village?: string;
  district?: string;
  state?: string;
  preferredLanguage?: 'en' | 'hi';
  createdAt?: string;
}

export interface Crop {
  id: string;
  farmerId: string;
  cropName: string;
  quantity: number;
  unit: string;
  harvestDate: string;
  preferredDate?: string;
  status: 'registered' | 'scheduled' | 'procured';
  createdAt?: string;
}

export interface LocationModel {
  lat: number;
  lng: number;
  address: string;
  district: string;
}

export interface ProcurementCenter {
  id: string;
  name: string;
  location: LocationModel;
  distanceKm: number;
  capacityPerDay: number;
  bookedQuantity: number;
  remainingCapacity: number;
  activeCounters: number;
  avgProcessingMinutes: number;
  status: 'open' | 'closed' | 'low_queue' | 'moderate_queue' | 'high_queue';
  queueLength: number;
  estimatedWaitMinutes: number;
  operatingHours: string;
  contactPhone: string;
}

export interface Slot {
  id: string;
  centerId: string;
  date: string;
  startTime: string;
  endTime: string;
  capacity: number;
  booked: number;
  isFull: boolean;
}

export interface QueueToken {
  id: string;
  tokenNumber: number;
  farmerId: string;
  farmerName: string;
  farmerPhone: string;
  centerId: string;
  centerName: string;
  cropName: string;
  quantity: number;
  status: 'waiting' | 'arrived' | 'processing' | 'completed' | 'absent' | 'rejected' | 'verification';
  positionInQueue: number;
  farmersAhead: number;
  estimatedWaitMinutes: number;
  counterNumber?: number;
  createdAt?: string;
  updatedAt?: string;
}

export interface QueuePrediction {
  tokenNumber: number;
  farmersAhead: number;
  estimatedWaitMinutes: number;
  formattedWaitTime: string;
  confidence: string;
  activeCounters: number;
  modelUsed: string;
  factors: {
    avg_processing_time_min: number;
    crop_quantity_quintal: number;
    active_counters: number;
    peak_hour: boolean;
    time_slot_hour: number;
  };
  advice: string;
}

export interface TimelineStep {
  status: string;
  label: string;
  timestamp?: string;
  completed: boolean;
  current: boolean;
}

export interface Procurement {
  id: string;
  tokenId: string;
  farmerId: string;
  farmerName: string;
  cropName: string;
  quantity: number;
  unit: string;
  centerId: string;
  centerName: string;
  status: string;
  ratePerQuintal: number;
  totalAmount: number;
  timeline: TimelineStep[];
  createdAt?: string;
  updatedAt?: string;
}

export interface Payment {
  id: string;
  procurementId: string;
  farmerId: string;
  amount: number;
  status: 'processing' | 'paid';
  expectedDate: string;
  transactionRef?: string;
  bankAccountMasked: string;
  paidAt?: string;
}

export interface PaymentReceivingAccount {
  upiId?: string;
  accountNumber?: string;
  accountHolderName?: string;
  ifscCode?: string;
  bankName?: string;
  preferredMode?: 'upi' | 'bank' | 'dbt';
  isVerified?: boolean;
}

export interface PaymentReceipt {
  paymentId: string;
  receiptNumber: string;
  procurementId: string;
  farmerId: string;
  farmerName: string;
  farmerPhone?: string;
  cropName: string;
  quantity: number;
  unit: string;
  ratePerQuintal: number;
  grossAmount: number;
  mandiCess: number;
  netPaidAmount: number;
  centerName: string;
  centerAddress?: string;
  payoutMode: string;
  targetAccountMasked: string;
  transactionRef: string;
  status: string;
  paidAt?: string;
  voucherDate: string;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'queue' | 'slot' | 'procurement' | 'payment' | 'system';
  read: boolean;
  createdAt: string;
}

export interface SmartRecommendation {
  hasRecommendation: boolean;
  selectedCenter?: {
    centerId: string;
    name: string;
    distanceKm: number;
    queueCount: number;
    estimatedWaitMinutes: number;
    formattedWaitTime: string;
    remainingCapacity: number;
  };
  recommendedCenter?: {
    centerId: string;
    name: string;
    distanceKm: number;
    queueCount: number;
    estimatedWaitMinutes: number;
    formattedWaitTime: string;
    remainingCapacity: number;
  };
  timeSavedMinutes?: number;
  reasons?: string[];
  whyText?: string;
  message?: string;
}

export interface AdminOverview {
  todayFarmers: number;
  waiting: number;
  processing: number;
  completed: number;
  avgWaitingTimeMinutes: number;
  avgProcessingTimeMinutes: number;
  todayProcurementQuintal: number;
}
