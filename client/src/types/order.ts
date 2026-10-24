import type { ReturnRequestDTO } from '../pages/orders/detail/orderDetail.types';

/**
 * OrderStatus enum representing all lifecycle states of an order in the system.
 */
export enum OrderStatus {
  ORDER_PLACED = 'ORDER_PLACED',
  PAYMENT_REVIEW = 'PAYMENT_REVIEW',
  CONFIRMED = 'CONFIRMED',
  PROCESSING = 'PROCESSING',
  READY_FOR_DISPATCH = 'READY_FOR_DISPATCH',
  PICKED_UP = 'PICKED_UP',
  IN_TRANSIT = 'IN_TRANSIT',
  OUT_FOR_DELIVERY = 'OUT_FOR_DELIVERY',
  DELIVERED = 'DELIVERED',
  CANCELLED = 'CANCELLED',
  REJECTED = 'REJECTED',
  RETURNED = 'RETURNED',
}

export interface StatusHistoryEntry {
  status: OrderStatus;
  at: string;
  note?: string;
  location?: string;
}

export interface OrderItemDTO {
  productName: string;
  sku: string;
  size: string;
  color: string;
  qty: number;
  unitPrice: number;
  imageUrl?: string;
}

export interface ShippingAddressDTO {
  label: string;
  line1: string;
  city: string;
  province: string;
  postalCode: string;
  country: string;
}

export interface PaymentDetailsDTO {
  method: string;
  status: string;
  amount: number;
}

export interface DeliveryDetailsDTO {
  courier?: string;
  waybill?: string;
  estimatedFrom?: string;
  estimatedTo?: string;
}

export interface OrderDTO {
  id: string;
  status: OrderStatus;
  statusHistory: StatusHistoryEntry[];
  createdAt: string;
  items: OrderItemDTO[];
  subtotal: number;
  shippingFee: number;
  discount?: number;
  total: number;
  shippingAddress: ShippingAddressDTO;
  payment: PaymentDetailsDTO;
  delivery?: DeliveryDetailsDTO;
  returnRequest?: ReturnRequestDTO | null;
}

export interface TimelineStageDefinition {
  status: OrderStatus;
  title: string;
  defaultDescription: string;
  defaultLocation: string;
}

export interface DerivedStage {
  id: number;
  status: OrderStatus;
  title: string;
  description: string;
  location: string;
  timestamp: string;
  isCompleted: boolean;
  isActive: boolean;
  isPending: boolean;
}

export interface DerivedTimeline {
  isTerminal: boolean;
  terminalStatus?: OrderStatus;
  terminalNote?: string;
  terminalAt?: string;
  stages: DerivedStage[];
  activeIndex: number;
  percent: number;
  currentTitle: string;
  currentDescription: string;
  lastUpdatedAt?: string;
}
