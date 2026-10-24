import React, { useState, useEffect, useId, useRef, useCallback, useMemo } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import {
  Package,
  Clock,
  CheckCircle2,
  AlertCircle,
  XCircle,
  Truck,
  Copy,
  Check,
  ArrowLeft,
  Coins,
  MapPin,
  Calendar,
  ChevronRight,
  Loader2,
  RefreshCw,
  Ban,
  ShoppingBag,
  FileText,
  RotateCcw,
  ImagePlus,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { orderService, Order, OrderStatus as ServiceOrderStatus } from '../services/order.service';
import { returnService, IReturnRequest, ReturnStatus } from '../services/return.service';
import { ReturnRefundTimeline } from './orders/detail/ReturnRefundTimeline';
import { ReturnRequestDTO } from './orders/detail/orderDetail.types';
import { deriveReturnTimeline } from './orders/detail/deriveReturnTimeline';
import { RETURN_STAGES } from './orders/detail/returnTimeline.config';

const LIFECYCLE_STEPS: { status: ServiceOrderStatus; label: string; description: string }[] = [
  { status: 'pending_payment', label: 'Order Placed', description: 'Awaiting payment confirmation' },
  { status: 'payment_review', label: 'Payment Review', description: 'Manual slip under review' },
  { status: 'confirmed', label: 'Confirmed', description: 'Payment verified & approved' },
  { status: 'processing', label: 'Processing', description: 'Items being picked & packed' },
  { status: 'ready_for_dispatch', label: 'Ready for Dispatch', description: 'Packed & ready at facility' },
  { status: 'picked_up', label: 'Picked Up', description: 'Collected by courier' },
  { status: 'in_transit', label: 'In Transit', description: 'Moving to delivery hub' },
  { status: 'out_for_delivery', label: 'Out for Delivery', description: 'Courier on final route' },
  { status: 'delivered', label: 'Delivered', description: 'Package safely delivered' },
];

const STATUS_CONFIG: Record<
  ServiceOrderStatus,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  pending_payment: {
    label: 'Pending Payment',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    icon: <Clock className="w-3.5 h-3.5 text-amber-600" />,
  },
  payment_review: {
    label: 'Payment Review',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    icon: <Clock className="w-3.5 h-3.5 text-blue-600" />,
  },
  confirmed: {
    label: 'Confirmed',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />,
  },
  processing: {
    label: 'Processing',
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    icon: <Package className="w-3.5 h-3.5 text-indigo-600" />,
  },
  ready_for_dispatch: {
    label: 'Ready for Dispatch',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
    icon: <Package className="w-3.5 h-3.5 text-purple-600" />,
  },
  picked_up: {
    label: 'Picked Up',
    bg: 'bg-violet-50',
    text: 'text-violet-800',
    border: 'border-violet-200',
    icon: <Truck className="w-3.5 h-3.5 text-violet-600" />,
  },
  in_transit: {
    label: 'In Transit',
    bg: 'bg-sky-50',
    text: 'text-sky-800',
    border: 'border-sky-200',
    icon: <Truck className="w-3.5 h-3.5 text-sky-600" />,
  },
  out_for_delivery: {
    label: 'Out for Delivery',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-300',
    icon: <Truck className="w-3.5 h-3.5 text-amber-600" />,
  },
  delivered: {
    label: 'Delivered',
    bg: 'bg-teal-50',
    text: 'text-teal-800',
    border: 'border-teal-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5 text-teal-600" />,
  },
  cancelled: {
    label: 'Cancelled',
    bg: 'bg-red-50',
    text: 'text-red-800',
    border: 'border-red-200',
    icon: <XCircle className="w-3.5 h-3.5 text-red-600" />,
  },
};

const RETURN_STATUS_CONFIG: Record<
  ReturnStatus,
  { label: string; bg: string; text: string; border: string; icon: React.ReactNode }
> = {
  requested: {
    label: 'Return Requested',
    bg: 'bg-amber-50',
    text: 'text-amber-800',
    border: 'border-amber-200',
    icon: <RotateCcw className="w-3.5 h-3.5" />,
  },
  under_review: {
    label: 'Under Review',
    bg: 'bg-blue-50',
    text: 'text-blue-800',
    border: 'border-blue-200',
    icon: <Clock className="w-3.5 h-3.5" />,
  },
  approved: {
    label: 'Return Approved',
    bg: 'bg-emerald-50',
    text: 'text-emerald-800',
    border: 'border-emerald-200',
    icon: <CheckCircle2 className="w-3.5 h-3.5" />,
  },
  rejected: {
    label: 'Return Rejected',
    bg: 'bg-rose-50',
    text: 'text-rose-800',
    border: 'border-rose-200',
    icon: <XCircle className="w-3.5 h-3.5" />,
  },
  pickup_scheduled: {
    label: 'Pickup Scheduled',
    bg: 'bg-purple-50',
    text: 'text-purple-800',
    border: 'border-purple-200',
    icon: <Truck className="w-3.5 h-3.5" />,
  },
  picked_up: {
    label: 'Package Picked Up',
    bg: 'bg-indigo-50',
    text: 'text-indigo-800',
    border: 'border-indigo-200',
    icon: <Truck className="w-3.5 h-3.5" />,
  },
  received: {
    label: 'Return Received',
    bg: 'bg-teal-50',
    text: 'text-teal-800',
    border: 'border-teal-200',
    icon: <Package className="w-3.5 h-3.5" />,
  },
  refunded: {
    label: 'Refunded',
    bg: 'bg-emerald-100',
    text: 'text-emerald-900',
    border: 'border-emerald-300',
    icon: <Coins className="w-3.5 h-3.5" />,
  },
};

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

export const TIMELINE_STAGES: TimelineStageDefinition[] = [
  {
    status: OrderStatus.ORDER_PLACED,
    title: 'Order Placed',
    defaultDescription: 'Order received and encrypted transaction initiated in the LARVO ordering system.',
    defaultLocation: 'Web Checkout, Colombo',
  },
  {
    status: OrderStatus.PAYMENT_REVIEW,
    title: 'Payment Review',
    defaultDescription: 'Transaction cleared 3D-Secure fraud evaluation and payment verified successfully.',
    defaultLocation: 'Payment Gateway Central',
  },
  {
    status: OrderStatus.CONFIRMED,
    title: 'Confirmed',
    defaultDescription: 'Merchant accepted your order. Item allocation ticket generated for warehouse picking.',
    defaultLocation: 'Colombo Central Fulfillment Depot',
  },
  {
    status: OrderStatus.PROCESSING,
    title: 'Processing',
    defaultDescription: 'Garment retrieved from climate-controlled inventory, quality inspected and steamed.',
    defaultLocation: 'Depot Warehouse Bay 4',
  },
  {
    status: OrderStatus.READY_FOR_DISPATCH,
    title: 'Ready for Dispatch',
    defaultDescription: 'Dress packaged in LARVO signature garment box with tamper-evident seal and express waybill.',
    defaultLocation: 'Packaging Terminal 2',
  },
  {
    status: OrderStatus.PICKED_UP,
    title: 'Picked Up',
    defaultDescription: 'Express Courier logistics driver scanned parcel barcode and boarded outbound courier vehicle.',
    defaultLocation: 'Dock 3, Colombo Hub',
  },
  {
    status: OrderStatus.IN_TRANSIT,
    title: 'In Transit',
    defaultDescription: 'Shipment moving through regional distribution center for sorting.',
    defaultLocation: 'Regional Sorting Facility (Western)',
  },
  {
    status: OrderStatus.OUT_FOR_DELIVERY,
    title: 'Out for Delivery',
    defaultDescription: 'Courier driver is en route to deliver to recipient address.',
    defaultLocation: 'Local Courier Route',
  },
  {
    status: OrderStatus.DELIVERED,
    title: 'Delivered',
    defaultDescription: 'Package delivered safely to destination address and handed over.',
    defaultLocation: 'Destination Address',
  },
];

export const TERMINAL_STATUSES = new Set<OrderStatus>([
  OrderStatus.CANCELLED,
  OrderStatus.REJECTED,
  OrderStatus.RETURNED,
]);

export const formatLKR = (amount: number): string => {
  return new Intl.NumberFormat('en-LK', {
    style: 'currency',
    currency: 'LKR',
    currencyDisplay: 'symbol',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
    .format(amount)
    .replace('LKR', 'Rs.')
    .trim();
};

export const formatDateTime = (isoString?: string): string => {
  if (!isoString) return 'Pending';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'Pending';
    return new Intl.DateTimeFormat('en-LK', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: true,
    }).format(date);
  } catch {
    return 'Pending';
  }
};

export const formatDateRange = (from?: string, to?: string): string => {
  if (!from && !to) return 'Not available';
  try {
    const fDate = from ? new Date(from) : null;
    const tDate = to ? new Date(to) : null;
    const formatter = new Intl.DateTimeFormat('en-LK', {
      month: 'short',
      day: 'numeric',
    });
    if (fDate && tDate) {
      return `${formatter.format(fDate)} – ${formatter.format(tDate)}`;
    }
    return formatter.format((fDate || tDate)!);
  } catch {
    return 'Not available';
  }
};

export const deriveInvoiceNumber = (orderId: string, createdAt: string): string => {
  const shortId = orderId.slice(-8).toUpperCase();
  const year = new Date(createdAt).getFullYear() || 2026;
  return `INV-${shortId}-${year}`;
};

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

export const deriveTimeline = (order: OrderDTO): DerivedTimeline => {
  const isTerminal = TERMINAL_STATUSES.has(order.status);

  if (isTerminal) {
    const terminalEntry = [...order.statusHistory]
      .reverse()
      .find((h) => h.status === order.status);

    return {
      isTerminal: true,
      terminalStatus: order.status,
      terminalNote: terminalEntry?.note || `This order has been marked as ${order.status.toLowerCase().replace(/_/g, ' ')}.`,
      terminalAt: terminalEntry?.at || order.createdAt,
      stages: [],
      activeIndex: -1,
      percent: 0,
      currentTitle: order.status.replace(/_/g, ' '),
      currentDescription: terminalEntry?.note || 'No further fulfillment steps will be processed.',
      lastUpdatedAt: terminalEntry?.at || order.createdAt,
    };
  }

  // Find stage index
  let activeIndex = TIMELINE_STAGES.findIndex((s) => s.status === order.status);
  if (activeIndex === -1) {
    activeIndex = 0;
  }

  // Map history map for O(1) lookup
  const historyMap = new Map<OrderStatus, StatusHistoryEntry>();
  order.statusHistory.forEach((item) => {
    historyMap.set(item.status, item);
  });

  const stages: DerivedStage[] = TIMELINE_STAGES.map((def, idx) => {
    const isCompleted = idx < activeIndex;
    const isActive = idx === activeIndex;
    const isPending = idx > activeIndex;

    const historyEntry = historyMap.get(def.status);

    return {
      id: idx + 1,
      status: def.status,
      title: def.title,
      description: historyEntry?.note || def.defaultDescription,
      location: historyEntry?.location || def.defaultLocation,
      timestamp: historyEntry?.at ? formatDateTime(historyEntry.at) : 'Pending',
      isCompleted,
      isActive,
      isPending,
    };
  });

  const percent = Math.min(100, Math.round(((activeIndex + 1) / TIMELINE_STAGES.length) * 100));
  const activeStage = stages[activeIndex] || stages[0];
  const lastHistoryEntry = order.statusHistory[order.statusHistory.length - 1];

  return {
    isTerminal: false,
    stages,
    activeIndex,
    percent,
    currentTitle: activeStage.title,
    currentDescription: activeStage.description,
    lastUpdatedAt: lastHistoryEntry?.at,
  };
};

export const OrderSummaryBar: React.FC<{ order: OrderDTO; onOpenInvoice: () => void }> = ({
  order,
  onOpenInvoice,
}) => {
  const shortId = order.id.slice(-8).toUpperCase();
  const isTerminal = TERMINAL_STATUSES.has(order.status);
  const isConfirmed = order.status === OrderStatus.CONFIRMED || order.status === OrderStatus.DELIVERED;

  let badgeColor = 'bg-[#FAF7F2] text-[#141414] border-[#DDD6CA]';
  if (isConfirmed) {
    badgeColor = 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]';
  } else if (isTerminal) {
    badgeColor = 'bg-rose-50 text-rose-700 border-rose-200';
  } else {
    badgeColor = 'bg-neutral-900 text-white border-neutral-800';
  }

  const statusLabel = order.status.replace(/_/g, ' ');

  const returnReq = order.returnRequest;
  const isFullyRefunded = returnReq?.status === 'refunded';
  const isReturnOpen =
    returnReq &&
    !['refunded', 'rejected', 'inspection_failed', 'cancelled'].includes(returnReq.status);

  const returnStatusLabels: Record<string, string> = {
    requested: 'Return Requested',
    under_review: 'Under Review',
    approved: 'Return Approved',
    pickup_scheduled: 'Pickup Scheduled',
    picked_up: 'Picked Up',
    received: 'Return Inspecting',
    refund_processing: 'Refund Processing',
    refunded: 'Refunded',
    rejected: 'Return Rejected',
    inspection_failed: 'Inspection Failed',
    cancelled: 'Return Cancelled',
  };

  const returnLabel = returnReq
    ? returnReq.status === 'refunded'
      ? 'Refunded'
      : `Return: ${returnStatusLabels[returnReq.status] || returnReq.status.replace(/_/g, ' ')}`
    : '';

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-[0_4px_20px_-2px_rgba(20,20,20,0.04)] border border-[#EFEAE2] flex flex-col md:flex-row md:items-center justify-between gap-5 transition-all">
      <div className="space-y-1.5">
        <div className="flex items-center flex-wrap gap-3">
          <h1 className="text-2xl sm:text-3xl font-serif text-[#141414] tracking-tight">
            Order <span className="font-normal text-[#1F1E1B]">#{shortId}</span>
          </h1>

          <span
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${badgeColor}`}
          >
            {isConfirmed && (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
            )}
            {isTerminal && (
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            )}
            <span className="capitalize">{statusLabel.toLowerCase()}</span>
          </span>

          {/* Return & Refund Header Badge when return is open */}
          {isReturnOpen && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border bg-amber-50 text-amber-900 border-amber-200">
              <RotateCcw className="w-3.5 h-3.5 text-amber-700" />
              <span>Return & Refund</span>
            </span>
          )}

          {returnReq && returnLabel && (
            <span
              className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${
                isFullyRefunded
                  ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
                  : 'bg-[#FAF7F2] text-[#524D46] border-[#DDD6CA]'
              }`}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              <span>{returnLabel}</span>
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-[#7A756D]">
          <svg className="w-3.5 h-3.5 text-[#9E988F]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
          <span>Placed on {formatDateTime(order.createdAt)}</span>
        </div>
      </div>

      <div className="flex items-start md:items-end flex-col gap-2">
        <div className="text-left md:text-right">
          <span className="text-[11px] font-semibold text-[#8C867D] uppercase tracking-wider block">
            Total Amount
          </span>
          <div className="text-2xl sm:text-3xl font-serif font-bold text-[#141414] leading-tight">
            {formatLKR(order.total)}
          </div>
          {isFullyRefunded && (
            <span className="text-xs font-semibold text-emerald-700 block mt-0.5">
              Refunded {formatLKR(returnReq?.refundAmount ?? order.total)}
            </span>
          )}
        </div>

        <button
          type="button"
          onClick={onOpenInvoice}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-semibold bg-[#FAF7F2] hover:bg-[#F2ECE1] text-[#22211F] border border-[#E2DBD0] transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-black cursor-pointer shadow-xs"
        >
          <svg className="w-3.5 h-3.5 text-[#6B655D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
          <span>View Invoice</span>
        </button>
      </div>
    </div>
  );
};

export const MilestoneCard: React.FC<{
  order: OrderDTO;
  timeline: DerivedTimeline;
  copiedTracking?: boolean;
  onCopyTracking?: (tracking: string) => void;
}> = ({ order, timeline, copiedTracking, onCopyTracking }) => {
  const returnReq = order.returnRequest;

  // ── Return Mode ─────────────────────────────────────────────────────────────
  if (returnReq) {
    const isRefunded = returnReq.status === 'refunded';
    const isRejectedOrFailed =
      returnReq.status === 'rejected' || returnReq.status === 'inspection_failed';
    const isCancelled = returnReq.status === 'cancelled';

    // Terminal branch: REJECTED or INSPECTION_FAILED
    if (isRejectedOrFailed) {
      const isFailed = returnReq.status === 'inspection_failed';
      const title = isFailed ? 'Return Inspection Failed' : 'Return Not Approved';
      const reason =
        returnReq.rejectionReason ||
        (isFailed
          ? 'The returned item did not meet condition guidelines during warehouse inspection.'
          : 'Staff reviewed and rejected this return request.');
      const lastEntry = returnReq.statusHistory?.slice(-1)[0];

      return (
        <div className="bg-[#FAF7F2] text-[#141414] rounded-3xl p-6 sm:p-7 shadow-[0_4px_20px_-2px_rgba(20,20,20,0.04)] border border-[#EAE4D9]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#7A756D] bg-[#EFEAE2] border border-[#DDD6CA] px-3 py-1 rounded-full inline-flex items-center gap-1.5">
              <AlertCircle className="w-3.5 h-3.5 text-[#8C867D]" />
              {title}
            </span>
            {lastEntry?.at && (
              <span className="text-xs font-mono text-[#8C867D]">
                {formatDateTime(lastEntry.at)}
              </span>
            )}
          </div>
          <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#141414] tracking-tight">
            {title}
          </h3>
          <p className="text-xs sm:text-sm text-[#524D46] leading-relaxed mt-2">
            {reason}
          </p>
          {isFailed && (
            <div className="mt-4 pt-3 border-t border-[#EAE4D9] flex items-center justify-between">
              <span className="text-xs text-[#7A756D]">
                Have questions regarding this inspection result?
              </span>
              <a
                href="#concierge"
                onClick={(e) => {
                  e.preventDefault();
                  toast('Our concierge team has been notified and will assist you shortly.', { icon: '💬' });
                }}
                className="text-xs font-semibold text-[#141414] hover:text-[#524D46] underline transition-colors cursor-pointer"
              >
                Contact Concierge
              </a>
            </div>
          )}
        </div>
      );
    }

    // Terminal branch: CANCELLED
    if (isCancelled) {
      const lastEntry = returnReq.statusHistory?.slice(-1)[0];

      return (
        <div className="bg-[#FAF7F2] text-[#141414] rounded-3xl p-6 sm:p-7 shadow-[0_4px_20px_-2px_rgba(20,20,20,0.04)] border border-[#EAE4D9]">
          <div className="flex items-center justify-between gap-2 mb-3">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-[#7A756D] bg-[#EFEAE2] border border-[#DDD6CA] px-3 py-1 rounded-full inline-flex items-center gap-1.5">
              <Ban className="w-3.5 h-3.5 text-[#8C867D]" />
              Return Cancelled
            </span>
            {lastEntry?.at && (
              <span className="text-xs font-mono text-[#8C867D]">
                {formatDateTime(lastEntry.at)}
              </span>
            )}
          </div>
          <h3 className="text-xl sm:text-2xl font-serif font-bold text-[#141414] tracking-tight">
            Return Cancelled
          </h3>
          <p className="text-xs sm:text-sm text-[#524D46] leading-relaxed mt-2">
            {returnReq.rejectionReason || 'Return request was cancelled by the customer.'}
          </p>
        </div>
      );
    }

    // Completed state: REFUNDED
    if (isRefunded) {
      const refundAmount = returnReq.refundAmount ?? order.total;

      return (
        <div className="bg-gradient-to-br from-[#064E3B] to-[#022C22] text-white rounded-3xl p-6 sm:p-7 shadow-[0_8px_30px_-4px_rgba(20,20,20,0.05)] relative overflow-hidden border border-emerald-800">
          <div className="flex items-center justify-between gap-2 mb-4">
            <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-300 bg-emerald-950/80 border border-emerald-500/40 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400" />
              Refund Completed
            </span>
            <span className="text-xs font-mono text-emerald-200">
              100% Completed
            </span>
          </div>

          <div className="space-y-1">
            <h3 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-tight">
              Refund Completed
            </h3>
            <p className="text-xs sm:text-sm text-emerald-200/90 leading-relaxed">
              Refund of {formatLKR(refundAmount)} has been credited to your Store Wallet.
            </p>
          </div>

          <div className="mt-6 pt-5 border-t border-emerald-800/80 grid grid-cols-2 gap-4">
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-300/80 block">
                Refunded On
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white mt-0.5 block">
                {formatDateTime(returnReq.refundedAt ?? undefined)}
              </span>
            </div>
            <div>
              <span className="text-[10px] uppercase font-bold tracking-wider text-emerald-300/80 block">
                Refund Amount
              </span>
              <span className="text-xs sm:text-sm font-semibold text-white mt-0.5 block">
                {formatLKR(refundAmount)}
              </span>
            </div>
          </div>

          <div className="mt-5" aria-label="Progress: 100%" role="progressbar" aria-valuenow={100} aria-valuemin={0} aria-valuemax={100}>
            <div className="w-full bg-emerald-950 h-2 rounded-full overflow-hidden">
              <div className="bg-emerald-400 h-full rounded-full w-full" />
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-emerald-900/60 flex items-center justify-between text-[11px] text-emerald-200">
            <span className="inline-flex items-center gap-1.5">
              <Coins className="w-3.5 h-3.5 text-emerald-400" />
              Credited to Store Wallet
            </span>
            <Link to="/wallet" className="text-emerald-300 hover:text-white underline font-semibold transition-colors">
              View Wallet
            </Link>
          </div>
        </div>
      );
    }

    // Active Return in Progress Mode
    const returnTimeline = deriveReturnTimeline(returnReq);
    const totalStages = RETURN_STAGES.length;
    const currentStepNum = returnTimeline.activeIndex + 1;
    const pickupData = returnReq.pickup;
    const courierName = pickupData?.courier?.trim() || 'Courier to be assigned';
    const waybill = pickupData?.waybill?.trim();
    const pickupAddress = pickupData?.address || `${order.shippingAddress.line1}, ${order.shippingAddress.city}`;

    const isPickupScheduled = returnReq.status === 'pickup_scheduled';
    const isPickedUpOrLater = ['picked_up', 'received', 'refund_processing'].includes(returnReq.status);

    let leftGridLabel = 'Pickup';
    let leftGridValue = 'Scheduling pickup';

    if (isPickupScheduled) {
      leftGridLabel = 'Pickup';
      leftGridValue = pickupData?.scheduledDate
        ? `${formatDateTime(pickupData.scheduledDate)}${pickupData.timeWindow ? ` (${pickupData.timeWindow})` : ''}`
        : 'Pickup scheduled';
    } else if (returnReq.status === 'picked_up') {
      leftGridLabel = 'Picked Up On';
      const pickedUpHist = returnReq.statusHistory?.find((h) => h.status === 'picked_up');
      leftGridValue = formatDateTime(pickedUpHist?.at);
    } else if (returnReq.status === 'received' || returnReq.status === 'refund_processing') {
      leftGridLabel = 'Refund Expected';
      leftGridValue =
        returnReq.status === 'received'
          ? 'Pending inspection approval'
          : 'Finance processing';
    }

    const rightGridLabel = isPickedUpOrLater ? 'Refund Amount' : 'Pickup Address';
    const rightGridValue = isPickedUpOrLater
      ? (returnReq.refundAmount != null ? formatLKR(returnReq.refundAmount) : 'Pending')
      : pickupAddress;

    return (
      <div className="bg-gradient-to-br from-[#1C1B19] to-[#2C2925] text-white rounded-3xl p-6 sm:p-7 shadow-[0_8px_30px_-4px_rgba(20,20,20,0.05)] relative overflow-hidden">
        {/* Soft amber glow background */}
        <div
          className="absolute -right-10 -bottom-10 w-44 h-44 bg-amber-500/15 rounded-full blur-2xl pointer-events-none"
          aria-hidden="true"
        />

        <div className="flex items-center justify-between gap-2 mb-4">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-amber-400 bg-amber-950/70 border border-amber-500/30 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-amber-400 motion-safe:animate-ping" aria-hidden="true" />
            Return in Progress
          </span>
          <span className="text-xs font-mono text-neutral-300">
            {returnTimeline.percent}% Completed ({currentStepNum}/{totalStages})
          </span>
        </div>

        <div className="space-y-1">
          <h3 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-tight">
            {returnTimeline.currentTitle}
          </h3>
          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
            {returnTimeline.currentDescription}
          </p>
        </div>

        {/* 2-col Return Details grid */}
        <div className="mt-6 pt-5 border-t border-neutral-700/60 grid grid-cols-2 gap-4">
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">
              {leftGridLabel}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-white mt-0.5 block truncate" title={leftGridValue}>
              {leftGridValue}
            </span>
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">
              {rightGridLabel}
            </span>
            <span className="text-xs sm:text-sm font-semibold text-white mt-0.5 block truncate" title={rightGridValue}>
              {rightGridValue}
            </span>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="mt-5" aria-label={`Return Progress: ${returnTimeline.percent}%`} role="progressbar" aria-valuenow={returnTimeline.percent} aria-valuemin={0} aria-valuemax={100}>
          <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
            <div
              className="bg-amber-400 h-full rounded-full transition-all duration-500"
              style={{ width: `${returnTimeline.percent}%` }}
            />
          </div>
        </div>

        {/* Courier & Waybill footer row */}
        <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400">
          <span className="inline-flex items-center gap-1.5">
            <Truck className="w-3.5 h-3.5 text-amber-400" />
            {courierName}
          </span>
          {waybill && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-neutral-300">
                Waybill #{waybill}
              </span>
              {onCopyTracking && (
                <button
                  type="button"
                  onClick={() => onCopyTracking(waybill)}
                  className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] text-neutral-300 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Copy Waybill"
                >
                  {copiedTracking ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ── No Return: Standard Fulfillment Milestone Card ──────────────────────────
  const isTerminal = timeline.isTerminal;

  if (isTerminal) {
    return (
      <div className="bg-gradient-to-br from-[#27272A] to-[#3F3F46] text-white rounded-3xl p-6 sm:p-7 shadow-[0_8px_30px_-4px_rgba(20,20,20,0.05)] border border-neutral-700">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className="text-[11px] uppercase tracking-wider font-semibold text-rose-300 bg-rose-950/70 border border-rose-500/30 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
            Terminal State
          </span>
          <span className="text-xs font-mono text-neutral-300">
            {formatDateTime(timeline.terminalAt)}
          </span>
        </div>
        <h3 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-tight">
          {timeline.currentTitle}
        </h3>
        <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed mt-1">
          {timeline.terminalNote}
        </p>
      </div>
    );
  }

  const destinationSummary = `${order.shippingAddress.line1}, ${order.shippingAddress.city}`;
  const totalStages = TIMELINE_STAGES.length;
  const currentStepNum = timeline.activeIndex + 1;
  const hasCourierDetails = Boolean(order.delivery?.courier || order.delivery?.waybill);

  return (
    <div className="bg-gradient-to-br from-[#1C1B19] to-[#2C2925] text-white rounded-3xl p-6 sm:p-7 shadow-[0_8px_30px_-4px_rgba(20,20,20,0.05)] relative overflow-hidden">
      {/* Soft emerald glow background */}
      <div
        className="absolute -right-10 -bottom-10 w-44 h-44 bg-emerald-500/15 rounded-full blur-2xl pointer-events-none"
        aria-hidden="true"
      />

      <div className="flex items-center justify-between gap-2 mb-4">
        <span className="text-[11px] uppercase tracking-wider font-semibold text-emerald-400 bg-emerald-950/70 border border-emerald-500/30 px-3 py-1 rounded-full inline-flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 motion-safe:animate-ping" aria-hidden="true" />
          Active Milestone
        </span>
        <span className="text-xs font-mono text-neutral-300">
          {timeline.percent}% Completed ({currentStepNum}/{totalStages})
        </span>
      </div>

      <div className="space-y-1">
        <h3 className="text-xl sm:text-2xl font-serif font-bold text-white tracking-tight">
          {timeline.currentTitle}
        </h3>
        <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed">
          {timeline.currentDescription}
        </p>
      </div>

      {/* 2-col Estimated Arrival / Destination grid */}
      <div className="mt-6 pt-5 border-t border-neutral-700/60 grid grid-cols-2 gap-4">
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">
            Estimated Arrival
          </span>
          <span className="text-xs sm:text-sm font-semibold text-white mt-0.5 block">
            {formatDateRange(order.delivery?.estimatedFrom, order.delivery?.estimatedTo)}
          </span>
        </div>
        <div>
          <span className="text-[10px] uppercase font-bold tracking-wider text-neutral-400 block">
            Destination
          </span>
          <span className="text-xs sm:text-sm font-semibold text-white mt-0.5 block truncate" title={destinationSummary}>
            {destinationSummary}
          </span>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="mt-5" aria-label={`Progress: ${timeline.percent}%`} role="progressbar" aria-valuenow={timeline.percent} aria-valuemin={0} aria-valuemax={100}>
        <div className="w-full bg-neutral-800 h-2 rounded-full overflow-hidden">
          <div
            className="bg-emerald-400 h-full rounded-full transition-all duration-500"
            style={{ width: `${timeline.percent}%` }}
          />
        </div>
      </div>

      {/* Courier & Waybill footer row */}
      {hasCourierDetails && (
        <div className="mt-4 pt-3 border-t border-neutral-800/80 flex items-center justify-between text-[11px] text-neutral-400">
          <span className="inline-flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16V6a1 1 0 00-1-1H4a1 1 0 00-1 1v10a1 1 0 001 1h1m8-1a1 1 0 01-1 1H9m4-1V8a1 1 0 011-1h2.586a1 1 0 01.707.293l3.414 3.414a1 1 0 01.293.707V16a1 1 0 01-1 1h-1m-6-1a1 1 0 001 1h1M5 17a2 2 0 104 0m-4 0a2 2 0 114 0m6 0a2 2 0 104 0m-4 0a2 2 0 114 0" />
            </svg>
            {order.delivery?.courier || 'Designated Courier'}
          </span>
          {order.delivery?.waybill && (
            <div className="flex items-center gap-2">
              <span className="font-mono text-neutral-300">
                Waybill #{order.delivery.waybill}
              </span>
              {onCopyTracking && (
                <button
                  type="button"
                  onClick={() => onCopyTracking(order.delivery!.waybill!)}
                  className="px-2 py-0.5 rounded bg-neutral-800 hover:bg-neutral-700 text-[10px] text-neutral-300 transition-colors flex items-center gap-1 cursor-pointer"
                  title="Copy Waybill / Tracking number"
                >
                  {copiedTracking ? 'Copied' : 'Copy'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export const OrderItemsCard: React.FC<{ items: OrderItemDTO[] }> = ({ items }) => {
  const [imageErrorMap, setImageErrorMap] = useState<Record<string, boolean>>({});

  const handleImageError = (sku: string) => {
    setImageErrorMap((prev) => ({ ...prev, [sku]: true }));
  };

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-[0_4px_20px_-2px_rgba(20,20,20,0.04)] border border-[#EFEAE2] space-y-6">
      <div className="flex items-center gap-2 pb-4 border-b border-[#F0EBE2]">
        <svg className="w-4 h-4 text-[#6B655D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M16 11V7a4 4 0 00-8 0v4M5 9h14l1 12H4L5 9z" />
        </svg>
        <h2 className="text-sm font-bold text-[#141414]">
          Order Items ({items.length})
        </h2>
      </div>

      <div className="divide-y divide-[#F0EBE2]">
        {items.map((item, idx) => {
          const itemKey = `${item.sku}-${idx}`;
          const hasError = !item.imageUrl || imageErrorMap[itemKey];

          return (
            <div key={itemKey} className="py-4 first:pt-0 last:pb-0 flex items-start justify-between gap-4">
              <div className="flex items-start gap-4">
                <div className="w-20 h-24 rounded-2xl bg-[#F6F2EB] border border-[#EAE4D9] overflow-hidden shrink-0 flex items-center justify-center relative">
                  {!hasError && item.imageUrl ? (
                    <img
                      src={item.imageUrl}
                      alt={item.productName}
                      className="w-full h-full object-cover object-top"
                      onError={() => handleImageError(itemKey)}
                    />
                  ) : (
                    <div className="flex flex-col items-center justify-center p-2 text-center text-[#8C867D]">
                      <svg className="w-6 h-6 stroke-[#8C867D]" fill="none" viewBox="0 0 24 24" strokeWidth="1.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 10.5V6a3.75 3.75 0 10-7.5 0v4.5m11.356-1.993l1.263 12c.07.665-.45 1.243-1.119 1.243H4.25a1.125 1.125 0 01-1.12-1.243l1.264-12A1.125 1.125 0 015.513 7.5h12.974c.576 0 1.059.435 1.119 1.007zM8.625 10.5a.375.375 0 11-.75 0 .375.375 0 01.75 0zm7.5 0a.375.375 0 11-.75 0 .375.375 0 01.75 0z" />
                      </svg>
                      <span className="text-[9px] font-mono mt-1 uppercase">LARVO</span>
                    </div>
                  )}
                </div>

                <div className="space-y-1.5">
                  <h3 className="text-sm font-bold text-[#141414] leading-snug">
                    {item.productName}
                  </h3>
                  <p className="text-[11px] font-mono text-[#8C867D]">
                    SKU: {item.sku}
                  </p>

                  <div className="flex items-center gap-1.5 pt-1 flex-wrap">
                    <span className="text-[11px] font-medium bg-[#FAF7F2] text-[#47433E] border border-[#EAE4D9] px-2.5 py-0.5 rounded-md">
                      Size: {item.size}
                    </span>
                    <span className="text-[11px] font-medium bg-[#FAF7F2] text-[#47433E] border border-[#EAE4D9] px-2.5 py-0.5 rounded-md">
                      Color: {item.color}
                    </span>
                    <span className="text-[11px] font-medium bg-[#FAF7F2] text-[#47433E] border border-[#EAE4D9] px-2.5 py-0.5 rounded-md">
                      Qty: {item.qty}
                    </span>
                  </div>
                </div>
              </div>

              <div className="text-right shrink-0">
                <span className="text-base font-bold font-serif text-[#141414] block">
                  {formatLKR(item.unitPrice * item.qty)}
                </span>
                <span className="text-[11px] text-[#8C867D] block">
                  {formatLKR(item.unitPrice)} each
                </span>
              </div>
            </div>
          );
        })}
      </div>

      <div className="p-3.5 rounded-2xl bg-[#F0FDF4] border border-[#DCFCE7] flex items-center gap-3">
        <div className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-700 flex items-center justify-center shrink-0">
          <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
          </svg>
        </div>
        <p className="text-xs text-[#166534] font-medium">
          Item verified in warehouse inventory. Securely packaged in protective garment wrap.
        </p>
      </div>
    </div>
  );
};

export const ShippingCard: React.FC<{ address: ShippingAddressDTO }> = ({ address }) => {
  return (
    <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(20,20,20,0.04)] border border-[#EFEAE2] space-y-3 h-full">
      <div className="flex items-center gap-2 text-sm font-bold text-[#141414]">
        <svg className="w-4 h-4 text-[#6B655D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <span>Shipping Destination</span>
      </div>

      <div className="pt-1">
        <span className="inline-block text-[11px] font-semibold bg-[#FAF7F2] text-[#47433E] border border-[#EAE4D9] px-2.5 py-0.5 rounded-full mb-2">
          {address.label}
        </span>

        <div className="text-xs text-[#47433E] leading-relaxed space-y-0.5">
          <p className="font-bold text-[#141414]">{address.line1}</p>
          <p>{address.city}</p>
          <p>{address.province}</p>
          <p>
            {address.postalCode}, {address.country}
          </p>
        </div>
      </div>
    </div>
  );
};

export const CostBreakdownCard: React.FC<{
  subtotal: number;
  shippingFee: number;
  discount?: number;
  total: number;
}> = ({ subtotal, shippingFee, discount, total }) => {
  const hasDiscount = typeof discount === 'number' && discount > 0;

  return (
    <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(20,20,20,0.04)] border border-[#EFEAE2] space-y-3.5 h-full">
      <h2 className="text-sm font-bold text-[#141414]">Cost Breakdown</h2>

      <div className="space-y-2 text-xs text-[#524D46]">
        <div className="flex items-center justify-between">
          <span>Subtotal</span>
          <span className="font-medium text-[#141414]">{formatLKR(subtotal)}</span>
        </div>

        <div className="flex items-center justify-between">
          <span>Shipping Fee</span>
          <span className="font-medium text-[#141414]">{formatLKR(shippingFee)}</span>
        </div>

        {hasDiscount && (
          <div className="flex items-center justify-between text-emerald-700">
            <span>Special Discount</span>
            <span className="font-medium">-{formatLKR(discount!)}</span>
          </div>
        )}

        <div className="pt-2 border-t border-[#F0EBE2] flex items-center justify-between text-sm font-bold text-[#141414]">
          <span>Total</span>
          <span className="font-serif text-base text-[#141414]">{formatLKR(total)}</span>
        </div>
      </div>
    </div>
  );
};

export const PaymentCard: React.FC<{ payment: PaymentDetailsDTO }> = ({ payment }) => {
  const isApproved =
    payment.status.toLowerCase() === 'approved' ||
    payment.status.toLowerCase() === 'paid' ||
    payment.status.toLowerCase() === 'verified';

  return (
    <div className="bg-white rounded-3xl p-6 shadow-[0_4px_20px_-2px_rgba(20,20,20,0.04)] border border-[#EFEAE2] space-y-3 h-full">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#141414]">Payment Details</h2>
        <span
          className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${
            isApproved
              ? 'bg-[#ECFDF5] text-[#059669] border-[#A7F3D0]'
              : 'bg-neutral-100 text-neutral-700 border-neutral-300'
          }`}
        >
          {payment.status}
        </span>
      </div>

      <div className="space-y-2 text-xs text-[#524D46] pt-1">
        <div className="flex items-center justify-between">
          <span>Method</span>
          <span className="font-semibold text-[#141414] capitalize">{payment.method}</span>
        </div>

        <div className="flex items-center justify-between">
          <span>Amount</span>
          <span className="font-semibold text-[#141414]">{formatLKR(payment.amount)}</span>
        </div>
      </div>
    </div>
  );
};

export const FulfillmentTimeline: React.FC<{ timeline: DerivedTimeline; hasReturn?: boolean }> = ({
  timeline,
  hasReturn = false,
}) => {
  const [isExpanded, setIsExpanded] = useState(false);

  if (timeline.isTerminal) {
    return (
      <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-[0_4px_20px_-2px_rgba(20,20,20,0.04)] border border-[#EFEAE2] space-y-4">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#8C867D]">
          FULFILLMENT & DELIVERY TIMELINE
        </h2>
        <div className="p-4 rounded-2xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-600 leading-relaxed">
          <p className="font-bold text-neutral-800">
            Order Status: {timeline.currentTitle}
          </p>
          <p className="mt-1">
            Fulfillment timeline is inactive because this order reached a terminal state.
          </p>
          {timeline.lastUpdatedAt && (
            <p className="mt-2 font-mono text-[11px] text-neutral-400">
              Recorded at: {formatDateTime(timeline.lastUpdatedAt)}
            </p>
          )}
        </div>
      </div>
    );
  }

  const allStages = timeline.stages;
  const stages = hasReturn && !isExpanded ? allStages.slice(-3) : allStages;

  return (
    <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-[0_4px_20px_-2px_rgba(20,20,20,0.04)] border border-[#EFEAE2] space-y-6">
      <div className="space-y-1 pb-4 border-b border-[#F0EBE2]">
        <h2 className="text-xs font-bold uppercase tracking-[0.16em] text-[#8C867D]">
          FULFILLMENT & DELIVERY TIMELINE
        </h2>
        <p className="text-xs text-[#7A756D]">
          Live status recorded by LARVO Express Logistics
        </p>
      </div>

      <ol
        className="relative space-y-6 pt-1"
        aria-label="Fulfillment and delivery timeline"
      >
        {stages.map((stage, idx) => {
          const isLast = idx === stages.length - 1;
          const isDone = stage.isCompleted;
          const isActive = stage.isActive;
          const connectorColor = isDone ? 'bg-[#059669]' : 'bg-[#EAE4D9]';

          return (
            <li
              key={stage.id}
              className="relative flex items-start gap-4"
              aria-current={isActive ? 'step' : undefined}
            >
              {!isLast && (
                <div
                  className={`absolute top-6 bottom-[-24px] left-[17px] w-[2px] z-0 transition-colors duration-300 ${connectorColor}`}
                  aria-hidden="true"
                />
              )}

              <div className="relative z-10 shrink-0">
                {isDone ? (
                  <div
                    className="w-9 h-9 rounded-full bg-[#059669] text-white flex items-center justify-center shadow-xs"
                    aria-label={`Completed: Step ${stage.id}, ${stage.title}`}
                  >
                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                ) : isActive ? (
                  <div
                    className="w-9 h-9 rounded-full bg-[#141414] text-white flex items-center justify-center ring-4 ring-emerald-200/80 shadow-md scale-105"
                    aria-label={`Current Step: ${stage.id}, ${stage.title}`}
                  >
                    <span
                      className="w-2.5 h-2.5 rounded-full bg-[#34D399] motion-safe:animate-pulse"
                      aria-hidden="true"
                    />
                  </div>
                ) : (
                  <div
                    className="w-9 h-9 rounded-full bg-[#FAF7F2] text-[#8C867D] border border-[#DDD6CA] flex items-center justify-center font-mono text-[11px] font-semibold"
                    aria-label={`Pending Step: ${stage.id}, ${stage.title}`}
                  >
                    {stage.id}
                  </div>
                )}
              </div>

              <div className="flex-1 pb-2">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <div className="flex items-center gap-2">
                    <h3
                      className={`text-sm font-bold ${
                        isActive
                          ? 'text-[#059669] text-base font-serif'
                          : isDone
                          ? 'text-[#141414]'
                          : 'text-[#8C867D]'
                      }`}
                    >
                      {stage.title}
                    </h3>
                    {isActive && (
                      <span className="text-[10px] uppercase font-bold tracking-wider bg-[#ECFDF5] text-[#059669] px-2 py-0.5 rounded-full border border-[#A7F3D0]">
                        Current
                      </span>
                    )}
                  </div>

                  <span
                    className={`text-[11px] font-mono ${
                      isActive ? 'text-[#059669] font-semibold' : 'text-[#8C867D]'
                    }`}
                  >
                    {stage.timestamp}
                  </span>
                </div>

                <p
                  className={`text-xs ${
                    isActive ? 'text-[#3D3A35] font-medium' : 'text-[#7A756D]'
                  } mt-1 leading-relaxed`}
                >
                  {stage.description}
                </p>

                <div className="flex items-center gap-2 mt-2">
                  <span className="inline-flex items-center text-[10px] font-medium text-[#6B655D] bg-[#FAF7F2] border border-[#EAE4D9] px-2.5 py-0.5 rounded-md">
                    <svg className="w-3 h-3 mr-1 text-[#8C867D]" fill="none" viewBox="0 0 24 24" stroke="currentColor" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    </svg>
                    {stage.location}
                  </span>
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {hasReturn && allStages.length > 3 && (
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          aria-expanded={isExpanded}
          className="w-full mt-4 py-2.5 px-3.5 text-xs font-semibold text-[#524D46] hover:text-[#141414] bg-[#FAF7F2] hover:bg-[#F2ECE1] border border-[#EAE4D9] rounded-xl transition-colors flex items-center justify-center gap-1.5 cursor-pointer shadow-xs"
        >
          <span>{isExpanded ? 'Collapse timeline' : `Show full timeline (${allStages.length} steps)`}</span>
          <ChevronRight className={`w-3.5 h-3.5 transition-transform ${isExpanded ? '-rotate-90' : 'rotate-90'}`} />
        </button>
      )}
    </div>
  );
};

export const ReturnDetailsCard: React.FC<{ returnRequest: ReturnRequestDTO }> = ({ returnRequest }) => {
  return (
    <div className="bg-white rounded-3xl p-6 sm:p-7 shadow-[0_4px_20px_-2px_rgba(20,20,20,0.04)] border border-[#EFEAE2] space-y-6">
      <div className="flex items-center justify-between pb-4 border-b border-[#F0EBE2]">
        <div className="flex items-center gap-2">
          <RotateCcw className="w-4 h-4 text-[#6B655D]" />
          <h2 className="text-sm font-bold text-[#141414]">
            Return Details ({returnRequest.items.length})
          </h2>
        </div>
        <span className="text-[11px] font-mono text-[#8C867D]">
          Requested {formatDateTime(returnRequest.statusHistory?.[0]?.at)}
        </span>
      </div>

      <div className="divide-y divide-[#F0EBE2]">
        {returnRequest.items.map((item, idx) => (
          <div key={`${item.sku}-${idx}`} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-[#141414]">
                {item.productName}
              </h3>
              <div className="flex items-center gap-2 text-[11px] font-mono text-[#8C867D]">
                <span>SKU: {item.sku}</span>
                <span>•</span>
                <span>Size: {item.size}</span>
                <span>•</span>
                <span>Qty: {item.qty}</span>
              </div>
            </div>
            <span className="text-xs font-serif font-bold text-[#141414]">
              {formatLKR(item.unitPrice * item.qty)}
            </span>
          </div>
        ))}
      </div>

      {returnRequest.reason && (
        <div className="p-3.5 rounded-2xl bg-[#FAF7F2] border border-[#EAE4D9] text-xs text-[#524D46] space-y-1">
          <span className="text-[10px] uppercase font-bold tracking-wider text-[#8C867D] block">
            Return Reason
          </span>
          <p className="leading-relaxed text-[#2B2927]">
            {returnRequest.reason}
          </p>
        </div>
      )}
    </div>
  );
};

export const InvoiceModal: React.FC<{ isOpen: boolean; onClose: () => void; order: OrderDTO }> = ({
  isOpen,
  onClose,
  order,
}) => {
  const modalRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const titleId = useId();

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      closeButtonRef.current?.focus();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const invoiceNumber = deriveInvoiceNumber(order.id, order.createdAt);
  const hasDiscount = typeof order.discount === 'number' && order.discount > 0;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs print:p-0 print:bg-transparent"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={modalRef}
        className="bg-white rounded-3xl max-w-lg w-full p-6 sm:p-8 shadow-2xl border border-[#EAE4D9] space-y-5 print:shadow-none print:border-none print:p-0 print:max-w-none"
      >
        <div className="flex items-center justify-between pb-4 border-b border-[#F0EBE2] print:border-black">
          <div className="flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-full bg-black text-white flex items-center justify-center font-bold text-xs">
              L
            </div>
            <h2 id={titleId} className="font-serif font-bold text-base tracking-widest text-[#141414]">
              LARVO INVOICE
            </h2>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={onClose}
            className="w-8 h-8 rounded-full bg-[#FAF7F2] hover:bg-neutral-200 flex items-center justify-center text-slate-600 transition-colors print:hidden focus:outline-none focus-visible:ring-2 focus-visible:ring-black cursor-pointer"
            aria-label="Close invoice dialog"
          >
            &times;
          </button>
        </div>

        <div className="space-y-4 text-xs">
          <div className="flex justify-between">
            <div>
              <span className="text-[#8C867D] block">Invoice No:</span>
              <span className="font-mono font-bold text-[#141414]">{invoiceNumber}</span>
            </div>
            <div className="text-right">
              <span className="text-[#8C867D] block">Issue Date:</span>
              <span className="font-bold text-[#141414]">{formatDateTime(order.createdAt)}</span>
            </div>
          </div>

          <div className="p-3.5 rounded-xl bg-[#FAF7F2] border border-[#EAE4D9] space-y-1 print:bg-white print:border-black">
            <div className="font-bold text-[#141414]">Billed To:</div>
            <div>{order.shippingAddress.line1}</div>
            <div>
              {order.shippingAddress.city}, {order.shippingAddress.province}{' '}
              {order.shippingAddress.postalCode}
            </div>
            <div>{order.shippingAddress.country}</div>
          </div>

          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-[#EAE4D9] text-[#8C867D] print:border-black">
                <th className="py-2 font-semibold">Item</th>
                <th className="py-2 text-center font-semibold">Qty</th>
                <th className="py-2 text-right font-semibold">Price</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#F0EBE2] print:divide-neutral-300">
              {order.items.map((item, i) => (
                <tr key={`${item.sku}-${i}`}>
                  <td className="py-2 font-medium text-[#141414]">
                    {item.productName} ({item.color}, {item.size})
                  </td>
                  <td className="py-2 text-center text-[#524D46]">{item.qty}</td>
                  <td className="py-2 text-right text-[#141414]">
                    {formatLKR(item.unitPrice * item.qty)}
                  </td>
                </tr>
              ))}
              <tr>
                <td className="py-2 text-[#7A756D]">Standard Express Shipping</td>
                <td className="py-2 text-center text-[#524D46]">1</td>
                <td className="py-2 text-right text-[#141414]">
                  {formatLKR(order.shippingFee)}
                </td>
              </tr>
              {hasDiscount && (
                <tr className="text-emerald-700">
                  <td className="py-2">Discount Applied</td>
                  <td className="py-2 text-center">1</td>
                  <td className="py-2 text-right">-{formatLKR(order.discount!)}</td>
                </tr>
              )}
            </tbody>
          </table>

          <div className="pt-2 border-t border-[#EAE4D9] flex justify-between font-bold text-sm text-[#141414] print:border-black">
            <span>Total Paid ({order.payment.method})</span>
            <span className="font-serif">{formatLKR(order.total)}</span>
          </div>
        </div>

        <div className="pt-2 flex gap-2.5 print:hidden">
          <button
            type="button"
            onClick={() => window.print()}
            className="flex-1 py-2.5 rounded-xl bg-black hover:bg-neutral-800 text-white text-xs font-semibold transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-black cursor-pointer"
          >
            Print / Save as PDF
          </button>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2.5 rounded-xl bg-[#FAF7F2] hover:bg-neutral-100 text-xs font-semibold text-[#141414] border border-[#EAE4D9] focus:outline-none focus-visible:ring-2 focus-visible:ring-black cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};

export const OrderDetailSkeleton: React.FC = () => {
  return (
    <div className="space-y-6 animate-pulse" aria-busy="true" aria-label="Loading order details">
      <div className="bg-white rounded-3xl p-7 border border-[#EFEAE2] h-28 flex items-center justify-between">
        <div className="space-y-2">
          <div className="w-48 h-7 bg-neutral-200 rounded-md" />
          <div className="w-36 h-4 bg-neutral-100 rounded-md" />
        </div>
        <div className="w-32 h-10 bg-neutral-200 rounded-xl" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 2xl:col-span-8 space-y-6">
          <div className="h-64 bg-neutral-200 rounded-3xl" />
          <div className="h-56 bg-neutral-200 rounded-3xl" />
          <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
            <div className="h-44 bg-neutral-200 rounded-3xl" />
            <div className="h-44 bg-neutral-200 rounded-3xl" />
            <div className="h-44 bg-neutral-200 rounded-3xl" />
          </div>
        </div>
        <div className="lg:col-span-5 2xl:col-span-4 h-96 bg-neutral-200 rounded-3xl" />
      </div>
    </div>
  );
};

export const OrderNotFoundState: React.FC<{ onRetry?: () => void }> = ({ onRetry }) => {
  return (
    <div className="bg-white rounded-3xl p-12 text-center max-w-xl mx-auto border border-[#EFEAE2] shadow-sm space-y-4 my-12">
      <div className="w-12 h-12 rounded-full bg-neutral-100 text-[#141414] flex items-center justify-center mx-auto">
        <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9.172 16.172a4 4 0 015.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </div>
      <h2 className="text-xl font-serif font-bold text-[#141414]">Order Not Found</h2>
      <p className="text-xs text-[#7A756D]">
        We could not locate the requested order ID in your account history. It may have expired or belongs to another customer session.
      </p>
      <div className="pt-2 flex justify-center gap-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-4 py-2 text-xs font-semibold bg-[#141414] text-white rounded-xl hover:bg-neutral-800 transition-colors cursor-pointer"
          >
            Try Again
          </button>
        )}
        <Link
          to="/orders"
          className="px-4 py-2 text-xs font-semibold bg-[#FAF7F2] text-[#141414] border border-[#DDD6CA] rounded-xl hover:bg-neutral-100 transition-colors"
        >
          Back to My Orders
        </Link>
      </div>
    </div>
  );
};

const mapBackendStatusToEnum = (status: string): OrderStatus => {
  const s = (status || '').toLowerCase();
  switch (s) {
    case 'pending_payment':
      return OrderStatus.ORDER_PLACED;
    case 'payment_review':
      return OrderStatus.PAYMENT_REVIEW;
    case 'confirmed':
      return OrderStatus.CONFIRMED;
    case 'processing':
      return OrderStatus.PROCESSING;
    case 'ready_for_dispatch':
      return OrderStatus.READY_FOR_DISPATCH;
    case 'picked_up':
      return OrderStatus.PICKED_UP;
    case 'in_transit':
      return OrderStatus.IN_TRANSIT;
    case 'out_for_delivery':
      return OrderStatus.OUT_FOR_DELIVERY;
    case 'delivered':
      return OrderStatus.DELIVERED;
    case 'cancelled':
      return OrderStatus.CANCELLED;
    case 'rejected':
      return OrderStatus.REJECTED;
    case 'returned':
      return OrderStatus.RETURNED;
    default:
      return OrderStatus.ORDER_PLACED;
  }
};

const convertOrderToDTO = (order: Order, returnDoc?: IReturnRequest | null): OrderDTO => {
  let mappedStatus = mapBackendStatusToEnum(order.status);

  const allStagesList = TIMELINE_STAGES.map((s) => s.status);
  const targetIndex = allStagesList.indexOf(mappedStatus);

  let statusHistory: StatusHistoryEntry[] = [];
  const baseDate = new Date(order.createdAt).getTime();

  if (TERMINAL_STATUSES.has(mappedStatus)) {
    statusHistory = [
      {
        status: OrderStatus.ORDER_PLACED,
        at: order.createdAt,
        note: TIMELINE_STAGES[0].defaultDescription,
        location: TIMELINE_STAGES[0].defaultLocation,
      },
      {
        status: mappedStatus,
        at: order.updatedAt || order.createdAt,
        note: `Order was marked as ${mappedStatus.toLowerCase().replace(/_/g, ' ')}.`,
        location: 'Colombo Resolution Hub',
      },
    ];
  } else if (targetIndex >= 0) {
    statusHistory = allStagesList.slice(0, targetIndex + 1).map((st, i) => {
      const config = TIMELINE_STAGES[i];
      let stageTime = new Date(baseDate + i * 2 * 60 * 60 * 1000).toISOString();
      if (st === OrderStatus.DELIVERED && order.deliveredAt) {
        stageTime = new Date(order.deliveredAt).toISOString();
      }
      return {
        status: st,
        at: stageTime,
        note: config.defaultDescription,
        location: config.defaultLocation,
      };
    });
  }

  const estFrom = new Date(baseDate + 2 * 24 * 60 * 60 * 1000).toISOString();
  const estTo = new Date(baseDate + 4 * 24 * 60 * 60 * 1000).toISOString();

  const delivery: DeliveryDetailsDTO = {
    courier: order.trackingNumber ? 'Express Courier LK • Van #12' : 'LARVO Express Logistics',
    waybill: order.trackingNumber || undefined,
    estimatedFrom: estFrom,
    estimatedTo: estTo,
  };

  let effectiveReturnRequest: ReturnRequestDTO | null = null;
  if (order.returnRequest) {
    effectiveReturnRequest = order.returnRequest;
  } else if (returnDoc) {
    effectiveReturnRequest = {
      id: returnDoc._id,
      status: returnDoc.status,
      statusHistory: (returnDoc as any).statusHistory?.length
        ? (returnDoc as any).statusHistory
        : [{ status: returnDoc.status, at: returnDoc.createdAt, note: 'Return requested' }],
      reason: (returnDoc as any).reason || returnDoc.items?.[0]?.reason || null,
      items: returnDoc.items.map((it) => {
        const matching = (order.items || []).find((oi) => oi.variantSku === it.sku) || order.items?.[it.orderItemRef];
        return {
          productName: matching?.name || 'Product Item',
          sku: it.sku,
          size: matching?.size || 'Standard',
          color: matching?.color || 'Standard',
          qty: it.qty,
          unitPrice: matching?.unitPrice || 0,
        };
      }),
      refundAmount: (returnDoc as any).refundAmount ?? (returnDoc.refundPoints != null ? returnDoc.refundPoints : null),
      refundMethod: returnDoc.refundMethod || null,
      refundedAt: returnDoc.refundedAt || null,
      pickup: (returnDoc as any).pickup || null,
      rejectionReason: returnDoc.rejectionReason || null,
    };
  }

  return {
    id: order._id,
    status: mappedStatus,
    statusHistory,
    createdAt: order.createdAt,
    items: (order.items || []).map((it) => ({
      productName: it.name,
      sku: it.variantSku || 'SKU-STANDARD',
      size: it.size || 'Standard',
      color: it.color || 'Standard',
      qty: it.quantity,
      unitPrice: it.unitPrice,
      imageUrl: it.image,
    })),
    subtotal: order.subtotal,
    shippingFee: order.shippingFee,
    discount: order.discountAmount || 0,
    total: order.total,
    shippingAddress: {
      label: order.shippingAddress?.label || 'Home',
      line1: order.shippingAddress?.line1 || '',
      city: order.shippingAddress?.city || '',
      province: order.shippingAddress?.province || 'Western Province',
      postalCode: order.shippingAddress?.postalCode || '',
      country: order.shippingAddress?.country || 'Sri Lanka',
    },
    payment: {
      method: (order.payment?.method || 'Simulated Online').replace(/_/g, ' '),
      status: order.payment?.status ? order.payment.status.charAt(0).toUpperCase() + order.payment.status.slice(1) : 'Approved',
      amount: order.payment?.amount ?? order.total,
    },
    delivery,
    returnRequest: effectiveReturnRequest,
  };
};

export const OrdersPage: React.FC = () => {
  const { orderId } = useParams<{ orderId?: string }>();
  const navigate = useNavigate();

  // List state
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [page, setPage] = useState<number>(1);
  const [totalPages, setTotalPages] = useState<number>(1);
  const [totalOrders, setTotalOrders] = useState<number>(0);

  // Detail state (when orderId is set or selected)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [detailLoading, setDetailLoading] = useState<boolean>(false);
  const [copiedTracking, setCopiedTracking] = useState<boolean>(false);
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState<boolean>(false);

  // Return Request state (P56)
  const [orderReturn, setOrderReturn] = useState<IReturnRequest | null>(null);
  const [showReturnModal, setShowReturnModal] = useState<boolean>(false);
  const [selectedReturnItems, setSelectedReturnItems] = useState<{
    [itemIndex: number]: { selected: boolean; qty: number; reason: string };
  }>({});
  const [submittingReturn, setSubmittingReturn] = useState<boolean>(false);
  const [returnImages, setReturnImages] = useState<File[]>([]);
  const [returnImagePreviews, setReturnImagePreviews] = useState<string[]>([]);

  // Fetch paginated list
  const fetchOrders = async (targetPage = 1) => {
    setLoading(true);
    try {
      const res = await orderService.getMyOrders({ page: targetPage, limit: 8 });
      setOrders(res.orders || []);
      setPage(res.page || 1);
      setTotalPages(res.pages || 1);
      setTotalOrders(res.total || 0);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to load order history');
    } finally {
      setLoading(false);
    }
  };

  // Fetch single order detail
  const fetchOrderDetail = async (id: string, silent = false) => {
    if (!silent) setDetailLoading(true);
    try {
      const res = await orderService.getOrderById(id);
      setSelectedOrder(res.order);
      try {
        const returnDoc = await returnService.getReturnByOrderId(id);
        setOrderReturn(returnDoc);
      } catch {
        setOrderReturn(null);
      }
    } catch (err: any) {
      if (!silent) {
        toast.error(err?.message || 'Failed to load order details');
        navigate('/orders', { replace: true });
      }
    } finally {
      if (!silent) setDetailLoading(false);
    }
  };

  useEffect(() => {
    if (orderId) {
      fetchOrderDetail(orderId);
    } else {
      setSelectedOrder(null);
      setOrderReturn(null);
      fetchOrders(page);
    }
  }, [orderId, page]);

  // 30s background poll when tab visible and return is active
  useEffect(() => {
    if (!orderId || !selectedOrder) return;
    const currentReturn = selectedOrder.returnRequest || orderReturn;
    if (!currentReturn) return;

    const terminalReturnStatuses = ['refunded', 'rejected', 'inspection_failed', 'cancelled'];
    if (terminalReturnStatuses.includes(currentReturn.status)) return;

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        fetchOrderDetail(orderId, true);
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [orderId, selectedOrder?.returnRequest?.status, orderReturn?.status]);

  const handleCopyTracking = (tracking: string) => {
    navigator.clipboard.writeText(tracking);
    setCopiedTracking(true);
    toast.success('Tracking number copied to clipboard');
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  const handleCancelOrder = async () => {
    if (!selectedOrder) return;
    setCancelling(true);
    try {
      const res = await orderService.cancelOrder(selectedOrder._id);
      setSelectedOrder(res.order);
      toast.success('Order cancelled successfully');
      setShowCancelModal(false);
      // Refresh list in background
      fetchOrders(page);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const handleOpenReturnModal = () => {
    if (!selectedOrder) return;
    const initialItems: { [itemIndex: number]: { selected: boolean; qty: number; reason: string } } = {};
    selectedOrder.items.forEach((item, idx) => {
      initialItems[idx] = {
        selected: true,
        qty: item.quantity,
        reason: '',
      };
    });
    setSelectedReturnItems(initialItems);
    setReturnImages([]);
    setReturnImagePreviews([]);
    setShowReturnModal(true);
  };

  const handleReturnImagePick = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files) return;
    const files = Array.from(e.target.files);
    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    const maxFiles = 3;
    const remainingSlots = maxFiles - returnImages.length;

    if (remainingSlots <= 0) {
      toast.error('You can upload a maximum of 3 images');
      e.target.value = '';
      return;
    }

    const selected = files.slice(0, remainingSlots);
    const validFiles: File[] = [];

    for (const file of selected) {
      if (!validTypes.includes(file.type)) {
        toast.error(`${file.name}: only JPEG, PNG, WebP, and GIF images are allowed`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error(`${file.name}: file size exceeds 5MB limit`);
        continue;
      }
      validFiles.push(file);
    }

    if (validFiles.length > 0) {
      const newImages = [...returnImages, ...validFiles];
      setReturnImages(newImages);
      const newPreviews = validFiles.map((f) => URL.createObjectURL(f));
      setReturnImagePreviews((prev) => [...prev, ...newPreviews]);
    }

    e.target.value = '';
  };

  const handleRemoveReturnImage = (index: number) => {
    if (returnImagePreviews[index]) {
      URL.revokeObjectURL(returnImagePreviews[index]);
    }
    setReturnImages((prev) => prev.filter((_, i) => i !== index));
    setReturnImagePreviews((prev) => prev.filter((_, i) => i !== index));
  };

  const handleSubmitReturn = async () => {
    if (!selectedOrder) return;
    const chosen = Object.entries(selectedReturnItems)
      .filter(([_, it]) => it.selected)
      .map(([idxStr, it]) => ({
        orderItemRef: Number(idxStr),
        qty: Number(it.qty),
        reason: it.reason.trim(),
      }));

    if (chosen.length === 0) {
      toast.error('Please select at least one item to return');
      return;
    }

    for (const it of chosen) {
      if (!it.reason || it.reason.length < 5) {
        toast.error('Each return item must include a reason of at least 5 characters');
        return;
      }
    }

    const fd = new FormData();
    fd.append('orderId', selectedOrder._id);
    fd.append('items', JSON.stringify(chosen));
    returnImages.forEach((img) => {
      fd.append('images', img);
    });

    setSubmittingReturn(true);
    try {
      const created = await returnService.createReturn(fd);
      setOrderReturn(created);
      setShowReturnModal(false);
      returnImagePreviews.forEach((url) => URL.revokeObjectURL(url));
      setReturnImages([]);
      setReturnImagePreviews([]);
      toast.success('Return request submitted successfully');
      fetchOrderDetail(selectedOrder._id, true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to submit return request');
    } finally {
      setSubmittingReturn(false);
    }
  };

  // Helper to determine step progression
  const getStepIndex = (status: ServiceOrderStatus): number => {
    return LIFECYCLE_STEPS.findIndex((s) => s.status === status);
  };

  // Render Order Detail View
  if (orderId || selectedOrder) {
    if (detailLoading) {
      return (
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-8 w-full">
          <OrderDetailSkeleton />
        </div>
      );
    }

    if (!selectedOrder) {
      return (
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-8 w-full">
          <OrderNotFoundState onRetry={() => orderId && fetchOrderDetail(orderId)} />
        </div>
      );
    }

    const dto = convertOrderToDTO(selectedOrder, orderReturn);
    const timeline = deriveTimeline(dto);

    // P46 customer legality: customer can self-cancel only from pending_payment
    const canCustomerCancel = selectedOrder.status === 'pending_payment';

    // P56 Return Eligibility
    const isDelivered = selectedOrder.status === 'delivered';
    const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
    const isWithinReturnWindow = selectedOrder.deliveredAt
      ? Date.now() - new Date(selectedOrder.deliveredAt).getTime() <= SEVEN_DAYS_MS
      : false;
    const currentReturn = selectedOrder.returnRequest || orderReturn;
    const hasActiveReturn = Boolean(
      currentReturn &&
      !['rejected', 'cancelled', 'inspection_failed'].includes(currentReturn.status)
    );
    const canRequestReturn = isDelivered && isWithinReturnWindow && !hasActiveReturn;
    const returnCfg = orderReturn ? RETURN_STATUS_CONFIG[orderReturn.status] : null;

    return (
      <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-8 w-full space-y-6">
        {/* Navigation & Actions Top Bar */}
        <div className="flex items-center justify-between gap-4 print:hidden">
          <Link
            to="/orders"
            className="inline-flex items-center gap-2 text-xs sm:text-sm font-semibold text-[#524D46] hover:text-[#141414] transition-colors"
          >
            <ArrowLeft className="w-4 h-4" /> Back to All Orders
          </Link>
          <div className="flex items-center gap-2">
            {canCustomerCancel && (
              <button
                type="button"
                onClick={() => setShowCancelModal(true)}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200 rounded-xl transition-colors cursor-pointer"
              >
                <Ban className="w-3.5 h-3.5 text-rose-600" /> Cancel Order
              </button>
            )}
            {canRequestReturn && (
              <button
                type="button"
                onClick={handleOpenReturnModal}
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-amber-900 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-xl transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5 text-amber-700" /> Request Return
              </button>
            )}
            <button
              type="button"
              onClick={() => fetchOrderDetail(selectedOrder._id)}
              className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#524D46] hover:text-[#141414] bg-white border border-[#EFEAE2] rounded-xl transition-colors shadow-xs cursor-pointer"
              title="Refresh order status"
            >
              <RefreshCw className="w-3.5 h-3.5 text-[#7A756D]" /> Refresh
            </button>
          </div>
        </div>

        {/* Reward Points Banner */}
        {selectedOrder.pointsPaid > 0 && (
          <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/70 flex items-center gap-3 text-xs text-amber-950">
            <Coins className="w-4 h-4 text-amber-700 shrink-0" />
            <div>
              <p className="font-semibold">
                Paid with Reward Points ({selectedOrder.pointsPaid.toLocaleString()} pts)
              </p>
              <p className="text-[11px] text-amber-800">
                Order total fully covered via loyalty point redemption.
              </p>
            </div>
          </div>
        )}


        {/* Payment Verification Feedback Alert */}
        {selectedOrder.payment?.status === 'rejected' && selectedOrder.payment?.reviewNote && (
          <div className="p-4 rounded-2xl bg-rose-50 border border-rose-200 flex items-start gap-3">
            <div className="w-8 h-8 rounded-full bg-rose-100 text-rose-700 flex items-center justify-center shrink-0 mt-0.5">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div className="space-y-1">
              <h3 className="text-xs font-bold text-rose-900 uppercase tracking-wider">
                Payment Verification Notice
              </h3>
              <p className="text-xs text-rose-800 leading-relaxed">
                <span className="font-semibold">Reviewer note: </span>
                {selectedOrder.payment.reviewNote}
              </p>
              <p className="text-[11px] text-rose-600">
                Your submitted bank transfer receipt could not be approved. Please upload a valid receipt or contact support.
              </p>
            </div>
          </div>
        )}

        {/* Top Master Summary Bar */}
        <OrderSummaryBar
          order={dto}
          onOpenInvoice={() => setIsInvoiceOpen(true)}
        />

        {/* Main Content Layout (Dual Column 12-Grid) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Milestones, Items, and 3-Up Info Grid */}
          <div className="lg:col-span-7 2xl:col-span-8 space-y-8">
            <MilestoneCard
              order={dto}
              timeline={timeline}
              copiedTracking={copiedTracking}
              onCopyTracking={handleCopyTracking}
            />

            {/* Mobile: Return & Refund Timeline placed directly below Milestone */}
            {dto.returnRequest && (
              <div className="block lg:hidden">
                <ReturnRefundTimeline
                  returnRequest={dto.returnRequest}
                  onContactConcierge={() =>
                    toast('Our concierge team has been notified and will assist you shortly.', { icon: '💬' })
                  }
                />
              </div>
            )}

            <OrderItemsCard items={dto.items} />

            {/* Read-only Return Details Card under Order Items */}
            {dto.returnRequest && (
              <ReturnDetailsCard returnRequest={dto.returnRequest} />
            )}

            <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
              <ShippingCard address={dto.shippingAddress} />
              <CostBreakdownCard
                subtotal={dto.subtotal}
                shippingFee={dto.shippingFee}
                discount={dto.discount}
                total={dto.total}
              />
              <PaymentCard payment={dto.payment} />
            </div>
          </div>

          {/* Right Column: Sticky Fulfillment and Return Timelines */}
          <div className="lg:col-span-5 2xl:col-span-4 lg:sticky lg:top-6 lg:max-h-[calc(100vh-3rem)] overflow-y-auto space-y-6 pr-1">
            <FulfillmentTimeline
              timeline={timeline}
              hasReturn={Boolean(dto.returnRequest)}
            />

            {dto.returnRequest && (
              <div className="hidden lg:block">
                <ReturnRefundTimeline
                  returnRequest={dto.returnRequest}
                  onContactConcierge={() =>
                    toast('Our concierge team has been notified and will assist you shortly.', { icon: '💬' })
                  }
                />
              </div>
            )}
          </div>
        </div>

        {/* Invoice Modal */}
        <InvoiceModal
          isOpen={isInvoiceOpen}
          onClose={() => setIsInvoiceOpen(false)}
          order={dto}
        />

        {/* Cancel Confirmation Modal */}
        {showCancelModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/40 backdrop-blur-sm animate-fade-in">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-sand-200">
              <div className="w-10 h-10 rounded-full bg-red-50 text-red-600 flex items-center justify-center mb-4">
                <AlertCircle className="w-6 h-6" />
              </div>
              <h3 className="text-base font-bold text-ink-950 font-display">Cancel Order #{selectedOrder._id.slice(-8).toUpperCase()}?</h3>
              <p className="text-xs text-ink-600 mt-2">
                Are you sure you want to cancel this order? Any reserved inventory will be released and this action cannot be undone.
              </p>
              <div className="mt-6 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={() => setShowCancelModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-ink-700 hover:bg-sand-100 rounded-lg transition-colors"
                >
                  Keep Order
                </button>
                <button
                  type="button"
                  disabled={cancelling}
                  onClick={handleCancelOrder}
                  className="px-4 py-2 text-xs font-semibold text-white bg-red-600 hover:bg-red-700 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm"
                >
                  {cancelling ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Ban className="w-3.5 h-3.5" />}
                  {cancelling ? 'Cancelling...' : 'Confirm Cancellation'}
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Return Request Modal (P56) */}
        {showReturnModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-ink-950/50 backdrop-blur-sm animate-fade-in overflow-y-auto">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 sm:p-7 shadow-2xl border border-sand-200 my-8">
              <div className="flex items-center justify-between pb-4 border-b border-sand-200">
                <div className="flex items-center gap-2.5">
                  <div className="w-9 h-9 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 flex items-center justify-center">
                    <RotateCcw className="w-4 h-4" />
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-ink-950 font-display">
                      Request Return
                    </h3>
                    <p className="text-xs text-ink-500">
                      Order #{selectedOrder._id.slice(-8).toUpperCase()}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setShowReturnModal(false)}
                  className="text-ink-400 hover:text-ink-700 p-1"
                >
                  <XCircle className="w-5 h-5" />
                </button>
              </div>

              <p className="text-xs text-ink-600 mt-3 mb-4 leading-relaxed">
                Select the items and quantities you wish to return. Please provide a clear reason for each item (at least 5 characters).
              </p>

              <div className="space-y-4 max-h-[55vh] overflow-y-auto pr-1">
                {selectedOrder.items.map((item, idx) => {
                  const itemState = selectedReturnItems[idx] || { selected: false, qty: item.quantity, reason: '' };
                  return (
                    <div
                      key={idx}
                      className={`p-4 rounded-xl border transition-all ${
                        itemState.selected
                          ? 'bg-amber-50/40 border-amber-200 ring-1 ring-amber-200'
                          : 'bg-sand-50/50 border-sand-200 opacity-75'
                      }`}
                    >
                      <div className="flex items-start gap-3">
                        <input
                          type="checkbox"
                          id={`return-item-check-${idx}`}
                          checked={itemState.selected}
                          onChange={(e) => {
                            setSelectedReturnItems((prev) => ({
                              ...prev,
                              [idx]: { ...itemState, selected: e.target.checked },
                            }));
                          }}
                          className="mt-1 h-4 w-4 rounded border-sand-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                        />
                        <div className="w-12 h-14 rounded-lg bg-white border border-sand-200 overflow-hidden flex-shrink-0 flex items-center justify-center">
                          {item.image ? (
                            <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                          ) : (
                            <Package className="w-5 h-5 text-sand-400" />
                          )}
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold text-ink-900 truncate">{item.name}</p>
                          <p className="text-[11px] text-ink-500 font-mono">SKU: {item.variantSku}</p>
                          <p className="text-[11px] text-ink-600">
                            Ordered: {item.quantity} • ${item.unitPrice} each
                          </p>
                        </div>
                      </div>

                      {itemState.selected && (
                        <div className="mt-3.5 pt-3 border-t border-amber-200/60 space-y-2.5">
                          <div className="flex items-center justify-between gap-4">
                            <label className="text-[11px] font-semibold text-ink-700">
                              Return Quantity:
                            </label>
                            <select
                              value={itemState.qty}
                              onChange={(e) => {
                                const val = Number(e.target.value);
                                setSelectedReturnItems((prev) => ({
                                  ...prev,
                                  [idx]: { ...itemState, qty: val },
                                }));
                              }}
                              className="text-xs px-2.5 py-1 border border-sand-300 rounded-lg bg-white text-ink-900 focus:ring-amber-500 focus:border-amber-500"
                            >
                              {Array.from({ length: item.quantity }, (_, i) => i + 1).map((q) => (
                                <option key={q} value={q}>
                                  {q} of {item.quantity}
                                </option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="text-[11px] font-semibold text-ink-700 block mb-1">
                              Reason for Return:
                            </label>
                            <textarea
                              rows={2}
                              value={itemState.reason}
                              placeholder="e.g. Size didn't fit, defective seam, received wrong color..."
                              onChange={(e) => {
                                const val = e.target.value;
                                setSelectedReturnItems((prev) => ({
                                  ...prev,
                                  [idx]: { ...itemState, reason: val },
                                }));
                              }}
                              className="w-full text-xs p-2.5 border border-sand-300 rounded-lg bg-white text-ink-900 placeholder:text-ink-400 focus:ring-amber-500 focus:border-amber-500 resize-none"
                            />
                            <p className="text-[10px] text-ink-500 text-right">
                              {itemState.reason.length}/500 (min 5 characters)
                            </p>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Attach Photos Section */}
              <div className="mt-4 pt-4 border-t border-sand-200">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-semibold text-ink-800 flex items-center gap-1.5">
                    <ImagePlus className="w-4 h-4 text-amber-700" />
                    Attach Photos
                    <span className="text-ink-400 font-normal text-[11px]">(optional, max 3)</span>
                  </label>
                  <span className="text-[11px] text-ink-500 font-medium">
                    {returnImages.length} / 3 images
                  </span>
                </div>

                <div className="flex flex-wrap gap-2.5 items-center">
                  {returnImagePreviews.map((previewUrl, idx) => (
                    <div
                      key={idx}
                      className="relative w-16 h-16 rounded-xl border border-sand-300 overflow-hidden bg-sand-50 shadow-xs group"
                    >
                      <img
                        src={previewUrl}
                        alt={`Attachment preview ${idx + 1}`}
                        className="w-full h-full object-cover"
                      />
                      <button
                        type="button"
                        onClick={() => handleRemoveReturnImage(idx)}
                        className="absolute top-1 right-1 p-0.5 rounded-full bg-ink-900/70 text-white hover:bg-rose-600 transition-colors cursor-pointer"
                        title="Remove photo"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                  ))}

                  {returnImages.length < 3 && (
                    <label className="w-16 h-16 rounded-xl border-2 border-dashed border-sand-300 hover:border-amber-500 bg-sand-50/50 hover:bg-amber-50/30 flex flex-col items-center justify-center cursor-pointer transition-colors text-ink-400 hover:text-amber-700">
                      <ImagePlus className="w-5 h-5" />
                      <span className="text-[10px] font-medium mt-0.5">Add</span>
                      <input
                        type="file"
                        accept="image/jpeg,image/png,image/webp,image/gif"
                        multiple
                        onChange={handleReturnImagePick}
                        className="hidden"
                      />
                    </label>
                  )}
                </div>
                <p className="text-[10px] text-ink-400 mt-1.5">
                  Supported formats: JPEG, PNG, WebP (up to 5MB each). Helpful for showing item defects or damage.
                </p>
              </div>

              <div className="mt-6 pt-4 border-t border-sand-200 flex items-center justify-end gap-3">
                <button
                  type="button"
                  disabled={submittingReturn}
                  onClick={() => setShowReturnModal(false)}
                  className="px-4 py-2 text-xs font-semibold text-ink-700 hover:bg-sand-100 rounded-lg transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  id="submit-return-request-btn"
                  disabled={submittingReturn}
                  onClick={handleSubmitReturn}
                  className="px-4 py-2 text-xs font-semibold text-white bg-amber-700 hover:bg-amber-800 rounded-lg transition-colors flex items-center gap-1.5 shadow-sm disabled:opacity-50"
                >
                  {submittingReturn ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <RotateCcw className="w-3.5 h-3.5" />
                  )}
                  {submittingReturn ? 'Submitting...' : 'Submit Return Request'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // Render Orders List View (/orders)
  return (
    <div className="max-w-5xl mx-auto py-8 sm:py-12 px-4 sm:px-6">
      {/* Title */}
      <div className="flex flex-wrap items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl sm:text-3xl font-display font-bold text-ink-950">My Orders</h1>
          <p className="text-xs sm:text-sm text-ink-600 mt-1">
            Track your order deliveries, status history, and points payments.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-ink-500">
            {totalOrders} {totalOrders === 1 ? 'Order' : 'Orders'} Total
          </span>
        </div>
      </div>

      {/* Orders List Content */}
      {loading ? (
        <div className="bg-white rounded-2xl border border-sand-200 shadow-sm p-12 text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto text-ink-600 mb-3" />
          <p className="text-sm text-ink-600 font-medium">Loading your orders...</p>
        </div>
      ) : orders.length === 0 ? (
        <div className="bg-white rounded-2xl border border-sand-200 shadow-sm p-12 text-center">
          <div className="w-14 h-14 rounded-full bg-sand-100 flex items-center justify-center text-sand-500 mx-auto mb-4">
            <Package className="w-7 h-7" />
          </div>
          <h3 className="text-base font-bold text-ink-950 font-display">No Orders Yet</h3>
          <p className="text-xs text-ink-500 max-w-sm mx-auto mt-1 mb-6">
            You haven't placed any orders yet. Discover our latest collection and start your wardrobe upgrade!
          </p>
          <Link
            to="/products"
            className="inline-flex items-center gap-2 px-5 py-2.5 text-xs font-semibold text-white bg-ink-900 rounded-lg hover:bg-ink-800 transition-colors shadow-sm"
          >
            Start Shopping <ChevronRight className="w-3.5 h-3.5" />
          </Link>
        </div>
      ) : (
        <div className="space-y-4">
          {orders.map((order) => {
            const statusCfg = STATUS_CONFIG[order.status] || STATUS_CONFIG.pending_payment;

            return (
              <div
                key={order._id}
                className="bg-white rounded-2xl border border-sand-200 shadow-sm hover:shadow-md transition-shadow p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4 pb-4 border-b border-sand-100">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2.5">
                      <span className="font-mono text-sm font-bold text-ink-950">
                        #{order._id.slice(-8).toUpperCase()}
                      </span>
                      <span
                        className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-semibold rounded-full border ${statusCfg.bg} ${statusCfg.text} ${statusCfg.border}`}
                      >
                        {statusCfg.icon}
                        {statusCfg.label}
                      </span>
                      {order.pointsPaid > 0 && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-200">
                          <Coins className="w-3 h-3 text-amber-600" />
                          {order.pointsPaid.toLocaleString()} pts
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-ink-400 flex items-center gap-1.5">
                      <Calendar className="w-3 h-3" />
                      {new Date(order.createdAt).toLocaleDateString('en-US', {
                        year: 'numeric',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </p>
                  </div>

                  <div className="text-right">
                    <span className="text-base sm:text-lg font-bold font-display text-ink-950">
                      Rs. {order.total?.toLocaleString() || '0'}
                    </span>
                    <span className="text-[11px] text-ink-400 block">
                      {order.items.reduce((sum, it) => sum + it.quantity, 0)} items
                    </span>
                  </div>
                </div>

                {/* Items Thumbnails Row */}
                <div className="py-4 flex items-center justify-between gap-4">
                  <div className="flex items-center gap-2.5 overflow-x-auto py-1">
                    {order.items.slice(0, 4).map((item, idx) => (
                      <div
                        key={idx}
                        className="w-12 h-14 rounded-lg bg-sand-100 border border-sand-200 overflow-hidden flex-shrink-0 flex items-center justify-center relative"
                        title={`${item.name} (${item.quantity})`}
                      >
                        {item.image ? (
                          <img src={item.image} alt={item.name} className="w-full h-full object-cover" />
                        ) : (
                          <Package className="w-5 h-5 text-sand-400" />
                        )}
                        {item.quantity > 1 && (
                          <span className="absolute top-0.5 right-0.5 px-1 py-0.2 text-[9px] font-bold bg-ink-900 text-white rounded-full">
                            {item.quantity}
                          </span>
                        )}
                      </div>
                    ))}
                    {order.items.length > 4 && (
                      <div className="w-12 h-14 rounded-lg bg-sand-50 border border-sand-200 flex items-center justify-center text-xs font-semibold text-ink-500">
                        +{order.items.length - 4}
                      </div>
                    )}
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {order.status !== 'pending_payment' &&
                      order.status !== 'payment_review' &&
                      order.status !== 'cancelled' && (
                        <Link
                          to={`/orders/${order._id}/invoice`}
                          className="inline-flex items-center gap-1 px-3 py-2 text-xs font-semibold text-ink-700 hover:text-ink-950 bg-white hover:bg-sand-50 border border-sand-300 rounded-lg transition-colors"
                        >
                          <FileText className="w-3.5 h-3.5 text-ink-500" /> Invoice
                        </Link>
                      )}
                    <Link
                      to={`/orders/${order._id}`}
                      className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-ink-900 bg-sand-50 hover:bg-sand-100 border border-sand-300 rounded-lg transition-colors"
                    >
                      View Details & Tracking <ChevronRight className="w-3.5 h-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            );
          })}

          {/* Pagination Controls */}
          {totalPages > 1 && (
            <div className="pt-6 flex items-center justify-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-xs font-medium text-ink-700 bg-white border border-sand-200 rounded-lg hover:bg-sand-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Previous
              </button>
              <span className="text-xs text-ink-600 px-2 font-medium">
                Page {page} of {totalPages}
              </span>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-xs font-medium text-ink-700 bg-white border border-sand-200 rounded-lg hover:bg-sand-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
              >
                Next
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default OrdersPage;
