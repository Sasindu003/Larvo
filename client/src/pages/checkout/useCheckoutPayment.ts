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
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod | null>('bank_transfer');

  const [createdOrder, setCreatedOrder] = useState<Order | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('step') === '5') {
        const saved = sessionStorage.getItem('larvo_completed_order');
        if (saved) {
          try {
            return JSON.parse(saved);
          } catch {}
        }
      }
    }
    return null;
  });

  const [createdOrderId, setCreatedOrderId] = useState<string | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('step') === '5') {
        const orderIdParam = params.get('orderId');
        if (orderIdParam) return orderIdParam;
        const saved = sessionStorage.getItem('larvo_completed_order');
        if (saved) {
          try {
            return JSON.parse(saved)?._id || null;
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

  const [submittedPayment, setSubmittedPayment] = useState<Payment | null>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('step') === '5') {
        const saved = sessionStorage.getItem('larvo_completed_payment');
        if (saved) {
          try {
            return JSON.parse(saved);
          } catch {}
        }
      }
    }
    return null;
  });

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

  // Step 5 Confirmation: Clear cart on entry and cache completed order in sessionStorage
  useEffect(() => {
    if (currentStep === 5) {
      if (items.length > 0) {
        clearCart();
      }
      if (createdOrder) {
        try {
          sessionStorage.setItem('larvo_completed_order', JSON.stringify(createdOrder));
          if (submittedPayment) {
            sessionStorage.setItem('larvo_completed_payment', JSON.stringify(submittedPayment));
          }
          const url = new URL(window.location.href);
          if (url.searchParams.get('step') !== '5' || url.searchParams.get('orderId') !== createdOrder._id) {
            url.searchParams.set('step', '5');
            url.searchParams.set('orderId', createdOrder._id);
            window.history.replaceState({}, '', url.toString());
          }
        } catch (err) {
          console.error('Failed to cache completed order:', err);
        }
      }
    }
  }, [currentStep, items.length, clearCart, createdOrder, submittedPayment]);

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

  return {
    paymentMethod,
    setPaymentMethod,
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
    cardNumber: card.cardNumber,
    cardExpiry: card.cardExpiry,
    cardCvv: card.cardCvv,
    cardName: card.cardName,
    setCardName: card.setCardName,
    cardError: card.cardError,
    setCardError: card.setCardError,
    handleCardNumberChange: card.handleCardNumberChange,
    handleCardExpiryChange: card.handleCardExpiryChange,
    handleCardCvvChange: card.handleCardCvvChange,
    fillSuccessCard: card.fillSuccessCard,
    fillDeclineCard: card.fillDeclineCard,
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
