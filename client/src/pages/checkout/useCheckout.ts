import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';
import { useCart } from '../../context/CartContext';
import { useAuth } from '../../context/AuthContext';
import { CheckoutStep } from './types';
import { useCheckoutInventory } from './useCheckoutInventory';
import { useCheckoutAddress } from './useCheckoutAddress';
import { useCheckoutCoupon } from './useCheckoutCoupon';
import { useCheckoutPayment } from './useCheckoutPayment';

export function useCheckout() {
  const { items, subtotal, totalItems, updateQuantity, removeItem, clearCart } = useCart();
  const { user, refreshUser } = useAuth();
  const navigate = useNavigate();

  const [currentStep, setCurrentStep] = useState<CheckoutStep>(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('step') === '5') return 5;
    }
    return 1;
  });

  const inventory = useCheckoutInventory(items);
  const address = useCheckoutAddress(user?.addresses, refreshUser);
  const coupon = useCheckoutCoupon(subtotal);
  const payment = useCheckoutPayment(
    items,
    address.selectedAddressId,
    coupon.appliedCoupon,
    currentStep,
    setCurrentStep,
    clearCart,
  );

  // Empty cart redirect guard
  useEffect(() => {
    const isStep5 = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('step') === '5';
    if (items.length === 0 && currentStep < 4 && !payment.createdOrderId && !isStep5) {
      toast.error('Your cart is empty. Please add items before checking out.');
      navigate('/cart', { replace: true });
    }
  }, [items.length, currentStep, payment.createdOrderId, navigate]);

  // Calculations
  const effectiveSubtotal = payment.createdOrder ? (payment.createdOrder.subtotal ?? subtotal) : subtotal;
  const discountAmount = payment.createdOrder
    ? (payment.createdOrder.discountTotal ?? payment.createdOrder.discountAmount ?? 0)
    : (coupon.appliedCoupon?.discountAmount || 0);
  const shippingFee = payment.createdOrder ? (payment.createdOrder.shippingFee ?? 0) : (subtotal >= 1500 ? 0 : 60);
  const grandTotal = payment.createdOrder
    ? (payment.createdOrder.total ?? 0)
    : (Math.max(0, subtotal - discountAmount) + shippingFee);
  const pointsRequired = Math.ceil(grandTotal * (payment.conversionRate?.pointsPerRupee || 100));

  // Next button blocked evaluation
  const isNextBlocked = useMemo(() => {
    if (currentStep === 1) {
      return inventory.validating || inventory.unavailableItems.length > 0;
    }
    if (currentStep === 2) {
      return !address.selectedAddressId || address.addressLoading;
    }
    if (currentStep === 3) {
      return coupon.validatingPromo || payment.isCreatingOrder;
    }
    if (currentStep === 4) {
      if (payment.isCreatingOrder || !payment.createdOrderId) return true;
      if (!payment.paymentMethod) return true;
      if (payment.paymentMethod === 'bank_transfer') return payment.uploadState !== 'success';
      if (payment.paymentMethod === 'reward_points') return true;
      if (payment.paymentMethod === 'simulate') return payment.simulateState !== 'approved';
    }
    return false;
  }, [
    currentStep,
    inventory.validating,
    inventory.unavailableItems.length,
    address.selectedAddressId,
    address.addressLoading,
    coupon.validatingPromo,
    payment.isCreatingOrder,
    payment.createdOrderId,
    payment.paymentMethod,
    payment.uploadState,
    payment.simulateState,
  ]);

  const nextButtonLabel = useMemo(() => {
    switch (currentStep) {
      case 1:
        return 'Proceed to Delivery';
      case 2:
        return 'Proceed to Promo Code';
      case 3:
        return payment.isCreatingOrder ? 'Creating Order...' : 'Proceed to Payment';
      case 4:
        return 'Complete Order';
      default:
        return 'Next Step';
    }
  }, [currentStep, payment.isCreatingOrder]);

  const nextButtonBlockedMessage = useMemo(() => {
    if (currentStep === 1) {
      if (inventory.validating) return 'Validating inventory stock...';
      if (inventory.unavailableItems.length > 0) return 'Resolve out-of-stock items above to proceed';
    }
    if (currentStep === 2) {
      if (address.addressLoading) return 'Saving address...';
      if (!address.selectedAddressId) return 'Please select or add a delivery address to proceed';
    }
    if (currentStep === 3) {
      if (coupon.validatingPromo) return 'Validating promo code...';
      if (payment.isCreatingOrder) return 'Creating order...';
    }
    if (currentStep === 4) {
      if (payment.isCreatingOrder) return 'Creating order...';
      if (!payment.createdOrderId) return 'Order initialization failed. Please retry.';
      if (!payment.paymentMethod) return 'Please select a payment method.';
      if (payment.paymentMethod === 'bank_transfer') {
        if (payment.uploadState === 'uploading') return 'Uploading payment slip...';
        if (payment.uploadState !== 'success') return 'Please upload and submit your payment slip to complete order.';
      }
      if (payment.paymentMethod === 'reward_points') return 'Use the "Pay with Reward Points" button above to complete.';
      if (payment.paymentMethod === 'simulate') {
        if (payment.simulateState === 'processing') return 'Authorizing simulated payment...';
        if (payment.simulateState === 'declined') return 'Payment declined. Please retry with an authorized test card.';
        if (payment.simulateState !== 'approved') return 'Please authorize your card payment to complete order.';
      }
    }
    return '';
  }, [
    currentStep,
    inventory.validating,
    inventory.unavailableItems.length,
    address.selectedAddressId,
    address.addressLoading,
    coupon.validatingPromo,
    payment.isCreatingOrder,
    payment.createdOrderId,
    payment.paymentMethod,
    payment.uploadState,
    payment.simulateState,
  ]);

  const handleNextStep = async () => {
    if (isNextBlocked) return;
    if (currentStep === 3) {
      if (!payment.createdOrderId) {
        const orderId = await payment.createOrderForCheckout();
        if (!orderId) return;
      }
      setCurrentStep(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (currentStep === 4) {
      if (payment.paymentMethod === 'bank_transfer' && payment.uploadState === 'success') {
        clearCart();
        setCurrentStep(5);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (payment.paymentMethod === 'simulate' && payment.simulateState === 'approved') {
        clearCart();
        setCurrentStep(5);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      return;
    }
    if (currentStep < 5) {
      setCurrentStep((prev) => (prev + 1) as CheckoutStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  const handleBackStep = () => {
    if (currentStep > 1) {
      setCurrentStep((prev) => (prev - 1) as CheckoutStep);
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } else {
      navigate('/cart');
    }
  };

  const isStep5Param = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('step') === '5';
  const shouldRender = !(items.length === 0 && currentStep < 4 && !payment.createdOrderId && !isStep5Param);

  return {
    items,
    subtotal,
    totalItems,
    updateQuantity,
    removeItem,
    clearCart,
    user,
    currentStep,
    setCurrentStep,
    inventory,
    address,
    coupon,
    payment,
    effectiveSubtotal,
    discountAmount,
    shippingFee,
    grandTotal,
    pointsRequired,
    isNextBlocked,
    nextButtonLabel,
    nextButtonBlockedMessage,
    handleNextStep,
    handleBackStep,
    shouldRender,
  };
}
