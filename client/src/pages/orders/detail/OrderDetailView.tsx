import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  Ban,
  RotateCcw,
  RefreshCw,
  Coins,
  AlertCircle,
  Loader2,
  XCircle,
  Package,
  ImagePlus,
  X,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { Order, orderService } from '../../../services/order.service';
import { IReturnRequest, returnService } from '../../../services/return.service';
import { convertOrderToDTO, deriveTimeline } from './orderTimeline';
import { OrderSummaryBar } from './OrderSummaryBar';
import { MilestoneCard } from './MilestoneCard';
import { OrderItemsCard } from './OrderItemsCard';
import { ReturnDetailsCard } from './ReturnDetailsCard';
import { ShippingCard } from './ShippingCard';
import { CostBreakdownCard } from './CostBreakdownCard';
import { PaymentCard } from './PaymentCard';
import { FulfillmentTimeline } from './FulfillmentTimeline';
import { ReturnRefundTimeline } from './ReturnRefundTimeline';
import { InvoiceModal } from './InvoiceModal';

export interface OrderDetailViewProps {
  order: Order;
  orderReturn: IReturnRequest | null;
  onRefresh: (silent?: boolean) => void;
  onOrderUpdated?: (order: Order) => void;
  onReturnUpdated?: (returnDoc: IReturnRequest) => void;
}

export const OrderDetailView: React.FC<OrderDetailViewProps> = ({
  order,
  orderReturn,
  onRefresh,
  onOrderUpdated,
  onReturnUpdated,
}) => {
  const [copiedTracking, setCopiedTracking] = useState<boolean>(false);
  const [cancelling, setCancelling] = useState<boolean>(false);
  const [showCancelModal, setShowCancelModal] = useState<boolean>(false);
  const [isInvoiceOpen, setIsInvoiceOpen] = useState<boolean>(false);

  // Return modal state
  const [showReturnModal, setShowReturnModal] = useState<boolean>(false);
  const [selectedReturnItems, setSelectedReturnItems] = useState<{
    [itemIndex: number]: { selected: boolean; qty: number; reason: string };
  }>({});
  const [submittingReturn, setSubmittingReturn] = useState<boolean>(false);
  const [returnImages, setReturnImages] = useState<File[]>([]);
  const [returnImagePreviews, setReturnImagePreviews] = useState<string[]>([]);

  const dto = convertOrderToDTO(order, orderReturn);
  const timeline = deriveTimeline(dto);

  // Customer legality: customer can self-cancel only from pending_payment
  const canCustomerCancel = order.status === 'pending_payment';

  // Return Eligibility
  const isDelivered = order.status === 'delivered';
  const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
  const isWithinReturnWindow = order.deliveredAt
    ? Date.now() - new Date(order.deliveredAt).getTime() <= SEVEN_DAYS_MS
    : false;
  const currentReturn = order.returnRequest || orderReturn;
  const hasActiveReturn = Boolean(
    currentReturn &&
    !['rejected', 'cancelled', 'inspection_failed'].includes(currentReturn.status)
  );
  const canRequestReturn = isDelivered && isWithinReturnWindow && !hasActiveReturn;

  // 30s background poll when tab visible and return is active
  useEffect(() => {
    if (!currentReturn) return;
    const terminalReturnStatuses = ['refunded', 'rejected', 'inspection_failed', 'cancelled'];
    if (terminalReturnStatuses.includes(currentReturn.status)) return;

    const intervalId = setInterval(() => {
      if (document.visibilityState === 'visible') {
        onRefresh(true);
      }
    }, 30000);

    return () => clearInterval(intervalId);
  }, [currentReturn, onRefresh]);

  const handleCopyTracking = (tracking: string) => {
    navigator.clipboard.writeText(tracking);
    setCopiedTracking(true);
    toast.success('Tracking number copied to clipboard');
    setTimeout(() => setCopiedTracking(false), 2000);
  };

  const handleCancelOrder = async () => {
    setCancelling(true);
    try {
      const res = await orderService.cancelOrder(order._id);
      toast.success('Order cancelled successfully');
      setShowCancelModal(false);
      onOrderUpdated?.(res.order);
    } catch (err: any) {
      toast.error(err?.message || 'Failed to cancel order');
    } finally {
      setCancelling(false);
    }
  };

  const handleOpenReturnModal = () => {
    const initialItems: { [itemIndex: number]: { selected: boolean; qty: number; reason: string } } = {};
    order.items.forEach((item, idx) => {
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
    fd.append('orderId', order._id);
    fd.append('items', JSON.stringify(chosen));
    returnImages.forEach((img) => {
      fd.append('images', img);
    });

    setSubmittingReturn(true);
    try {
      const created = await returnService.createReturn(fd);
      onReturnUpdated?.(created);
      setShowReturnModal(false);
      returnImagePreviews.forEach((url) => URL.revokeObjectURL(url));
      setReturnImages([]);
      setReturnImagePreviews([]);
      toast.success('Return request submitted successfully');
      onRefresh(true);
    } catch (err: any) {
      toast.error(err?.response?.data?.message || err?.message || 'Failed to submit return request');
    } finally {
      setSubmittingReturn(false);
    }
  };

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
            onClick={() => onRefresh(false)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-[#524D46] hover:text-[#141414] bg-white border border-[#EFEAE2] rounded-xl transition-colors shadow-xs cursor-pointer"
            title="Refresh order status"
          >
            <RefreshCw className="w-3.5 h-3.5 text-[#7A756D]" /> Refresh
          </button>
        </div>
      </div>

      {/* Reward Points Banner */}
      {order.pointsPaid > 0 && (
        <div className="p-3.5 rounded-2xl bg-amber-50/80 border border-amber-200/70 flex items-center gap-3 text-xs text-amber-950">
          <Coins className="w-4 h-4 text-amber-700 shrink-0" />
          <div>
            <p className="font-semibold">
              Paid with Reward Points ({order.pointsPaid.toLocaleString()} pts)
            </p>
            <p className="text-[11px] text-amber-800">
              Order total fully covered via loyalty point redemption.
            </p>
          </div>
        </div>
      )}

      {/* Payment Verification Feedback Alert */}
      {order.payment?.status === 'rejected' && order.payment?.reviewNote && (
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
              {order.payment.reviewNote}
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
            <h3 className="text-base font-bold text-ink-950 font-display">Cancel Order #{order._id.slice(-8).toUpperCase()}?</h3>
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
                    Order #{order._id.slice(-8).toUpperCase()}
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
              {order.items.map((item, idx) => {
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
};
