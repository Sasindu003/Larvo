import { useState, useEffect, useCallback } from 'react';
import toast from 'react-hot-toast';
import { CartItem } from '../../context/CartContext';
import { orderService, Order, Payment } from '../../services/order.service';
import { walletService } from '../../services/wallet.service';
import {
  PaymentMethod,
  AppliedCoupon,
  ConversionRate,
  CheckoutStep,
} from './types';
import { useSimulateCard } from './useSimulateCard';
import { useSlipUpload } from './useSlipUpload';

export function useCheckoutPayment(
  items: CartItem[],
  selectedAddressId: string | null,
  appliedCoupon: AppliedCoupon | null,
  currentStep: CheckoutStep,
  setCurrentStep: React.Dispatch<React.SetStateAction<CheckoutStep>>,
  clearCart: () => void,
) {
  const isSimulatorEnabled =
    import.meta.env.VITE_PAYMENT_SIMULATOR_ENABLED !== undefined
      ? import.meta.env.VITE_PAYMENT_SIMULATOR_ENABLED === 'true'
      : import.meta.env.DEV;

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>('bank_transfer');

  const [createdOrder, setCreatedOrder] = useState<Order | null>(null);

  const [createdOrderId, setCreatedOrderId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      // Purge legacy sensitive sessionStorage keys
      try {
        sessionStorage.removeItem('larvo_completed_order');
        sessionStorage.removeItem('larvo_completed_payment');
      } catch {}

      const params = new URLSearchParams(window.location.search);
      if (params.get('step') === '5') {
        const orderIdParam = params.get('orderId');
        if (orderIdParam) return orderIdParam;
        const saved = sessionStorage.getItem('larvo_completed_order_summary');
        if (saved) {
          try {
            return JSON.parse(saved)?.orderId || null;
          } catch {}
        }
      }
    }
    return null;
  });

  const [isCreatingOrder, setIsCreatingOrder] = useState<boolean>(false);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState<boolean>(false);
  const [walletActive, setWalletActive] = useState<boolean>(true);
  const [conversionRate, setConversionRate] = useState<ConversionRate>({
    pointsPerRupee: 100,
    pointValue: 0.01,
  });
  const [payingWithPoints, setPayingWithPoints] = useState<boolean>(false);

  const [submittedPayment, setSubmittedPayment] = useState<Payment | null>(null);

  const createOrderForCheckout = useCallback(async (): Promise<string | null> => {
    if (createdOrderId || isCreatingOrder) return createdOrderId;
    if (!selectedAddressId) {
      toast.error('Please select a delivery address');
      return null;
    }
    if (items.length === 0) {
      toast.error('Your cart is empty');
      return null;
    }

    setIsCreatingOrder(true);
    try {
      const payload = {
        items: items.map((i) => ({
          productId: i.productId,
          variantSku: i.variantSku,
          quantity: i.quantity,
        })),
        shippingAddressId: selectedAddressId,
        couponCode: appliedCoupon?.code,
      };
      const result = await orderService.createOrder(payload);
      setCreatedOrder(result.order);
      setCreatedOrderId(result.order._id);
      if (result.couponWarning) {
        toast.error(result.couponWarning, { duration: 5000 });
      }
      return result.order._id;
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to create order';
      toast.error(message);
      return null;
    } finally {
      setIsCreatingOrder(false);
    }
  }, [createdOrderId, isCreatingOrder, selectedAddressId, items, appliedCoupon?.code]);

  const onPaymentSuccess = useCallback((order: Order, payment: Payment) => {
    setSubmittedPayment(payment);
    setCreatedOrder(order);
  }, []);

  const slip = useSlipUpload(createdOrderId, onPaymentSuccess);
  const card = useSimulateCard(createOrderForCheckout, onPaymentSuccess);

  const loadWalletBalance = useCallback(async () => {
    setWalletLoading(true);
    try {
      const [wallet, rate] = await Promise.all([
        walletService.getMyWallet(),
        walletService.getConversionRate().catch(() => ({ pointsPerRupee: 100, pointValue: 0.01 })),
      ]);
      setWalletBalance(wallet.balancePoints);
      setWalletActive(wallet.active);
      if (rate) setConversionRate(rate);
    } catch (err: unknown) {
      console.error('Failed to fetch wallet:', err);
      setWalletBalance(0);
      setWalletActive(false);
    } finally {
      setWalletLoading(false);
    }
  }, []);

  useEffect(() => {
    if (currentStep === 4) {
      if (!createdOrderId) {
        createOrderForCheckout();
      }
      loadWalletBalance();
    }
  }, [currentStep, createdOrderId, createOrderForCheckout, loadWalletBalance]);

  // Step 5 Confirmation: Clear cart on entry, store minimal non-sensitive summary, and refetch on reload
  useEffect(() => {
    if (currentStep === 5) {
      if (items.length > 0) {
        clearCart();
      }

      if (createdOrder) {
        try {
          // Minimal non-sensitive summary: orderId, status, total, maskedCardLast4 only
          sessionStorage.setItem(
            'larvo_completed_order_summary',
            JSON.stringify({
              orderId: createdOrder._id,
              status: createdOrder.status,
              total: createdOrder.total,
              maskedCardLast4:
                submittedPayment?.maskedCardLast4 || createdOrder.payment?.maskedCardLast4,
            })
          );
          // Purge any legacy sensitive sessionStorage items
          sessionStorage.removeItem('larvo_completed_order');
          sessionStorage.removeItem('larvo_completed_payment');

          const url = new URL(window.location.href);
          if (
            url.searchParams.get('step') !== '5' ||
            url.searchParams.get('orderId') !== createdOrder._id
          ) {
            url.searchParams.set('step', '5');
            url.searchParams.set('orderId', createdOrder._id);
            window.history.replaceState({}, '', url.toString());
          }
        } catch (err) {
          console.error('Failed to cache completed order summary:', err);
        }
      } else if (createdOrderId) {
        // Refetch order from API on page refresh
        orderService
          .getOrderById(createdOrderId)
          .then((res) => {
            if (res?.order) {
              setCreatedOrder(res.order);
              if (res.order.payment) {
                setSubmittedPayment(res.order.payment);
              }
            }
          })
          .catch((err) => {
            console.error('Failed to refetch order on step 5 refresh:', err);
          });
      }
    }
  }, [currentStep, items.length, clearCart, createdOrder, createdOrderId, submittedPayment]);

  const handlePayWithWallet = async () => {
    if (!createdOrderId) {
      toast.error('Order not initialized. Please try again.');
      return;
    }
    setPayingWithPoints(true);
    try {
      const res = await orderService.payWithWallet(createdOrderId);
      setCreatedOrder(res.order);
      setSubmittedPayment(res.payment);
      clearCart();
      toast.success('Payment confirmed with reward points!');
      setCurrentStep(5);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Points payment failed';
      toast.error(message);
    } finally {
      setPayingWithPoints(false);
    }
  };

  useEffect(() => {
    if (!isSimulatorEnabled && paymentMethod === 'simulate') {
      setPaymentMethod('bank_transfer');
    }
  }, [isSimulatorEnabled, paymentMethod]);

  return {
    paymentMethod,
    setPaymentMethod,
    isSimulatorEnabled,
    createdOrder,
    createdOrderId,
    isCreatingOrder,
    slipFile: slip.slipFile,
    setSlipFile: slip.setSlipFile,
    slipPreviewUrl: slip.slipPreviewUrl,
    setSlipPreviewUrl: slip.setSlipPreviewUrl,
    uploadProgress: slip.uploadProgress,
    uploadState: slip.uploadState,
    setUploadState: slip.setUploadState,
    uploadError: slip.uploadError,
    handleFileChange: slip.handleFileChange,
    handleUploadSlip: slip.handleUploadSlip,
    simulateState: card.simulateState,
    setSimulateState: card.setSimulateState,
    cardError: card.cardError,
    setCardError: card.setCardError,
    handleSimulatePayment: card.handleSimulatePayment,
    walletBalance,
    walletLoading,
    walletActive,
    conversionRate,
    payingWithPoints,
    submittedPayment,
    createOrderForCheckout,
    handlePayWithWallet,
  };
}
