import { OrderStatus, TimelineStageDefinition, DerivedStage, DerivedTimeline, OrderDTO, StatusHistoryEntry, DeliveryDetailsDTO } from '../../../types/order';
import type { Order } from '../../../services/order.service';
import type { IReturnRequest } from '../../../services/return.service';
import type { ReturnRequestDTO } from './orderDetail.types';
import { formatDateTime } from '../../../utils/format';

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

  let activeIndex = TIMELINE_STAGES.findIndex((s) => s.status === order.status);
  if (activeIndex === -1) {
    activeIndex = 0;
  }

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

export const mapBackendStatusToEnum = (s: string): OrderStatus => {
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

export const convertOrderToDTO = (order: Order, returnDoc?: IReturnRequest | null): OrderDTO => {
  const mappedStatus = mapBackendStatusToEnum(order.status);

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
