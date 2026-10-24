export interface ReturnStatusHistoryEntryDTO {
  status: string;
  at: string;
  note?: string;
}

export interface ReturnItemDTO {
  productName: string;
  sku: string;
  size: string;
  color: string;
  qty: number;
  unitPrice: number;
}

export interface ReturnPickupDTO {
  courier?: string | null;
  waybill?: string | null;
  scheduledDate?: string | null;
  timeWindow?: string | null;
  address?: string | null;
}

export interface ReturnRequestDTO {
  id: string;
  status: string;
  statusHistory: ReturnStatusHistoryEntryDTO[];
  reason?: string | null;
  items: ReturnItemDTO[];
  refundAmount?: number | null;
  refundMethod?: string | null;
  refundedAt?: string | null;
  pickup?: ReturnPickupDTO | null;
  rejectionReason?: string | null;
}

export interface ReturnStageConfig {
  key: string;
  backendStatus: string;
  title: string;
  description: string;
  locationChip: string;
}

export interface DerivedReturnStage {
  id: number;
  key: string;
  title: string;
  description: string;
  timestamp: string;
  isCompleted: boolean;
  isActive: boolean;
  isPending: boolean;
  locationChip: string;
}

export interface TerminalInfo {
  key: 'REJECTED' | 'INSPECTION_FAILED' | 'CANCELLED';
  title: string;
  reason: string;
  at?: string;
}

export interface DerivedReturnTimeline {
  stages: DerivedReturnStage[];
  activeIndex: number;
  percent: number;
  terminal: TerminalInfo | null;
  isTerminal: boolean;
  terminalKey?: 'REJECTED' | 'INSPECTION_FAILED' | 'CANCELLED';
  terminalTitle?: string;
  terminalReason?: string;
  terminalAt?: string;
  currentTitle: string;
  currentDescription: string;
}
