import React, { useEffect, useState, useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  ShoppingBag,
  MapPin,
  Tag,
  CreditCard,
  CheckCircle2,
  AlertTriangle,
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  ShieldCheck,
  Trash2,
  Plus,
  Minus,
  RefreshCw,
  Info,
  Star,
  Phone,
  Building2,
  Percent,
  Sparkles,
  X,
  UploadCloud,
  FileText,
  Coins,
  Loader2,
  Clock,
  Download,
  Package,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useCart, CartItem } from '../context/CartContext';
import { useAuth } from '../context/AuthContext';
import { userService, Address } from '../services/user.service';
import { couponService, Coupon } from '../services/coupon.service';
import { inventoryService, InventoryValidationResponse } from '../services/inventory.service';
import { orderService, Order, Payment } from '../services/order.service';
import { walletService } from '../services/wallet.service';
import { Button } from '../components/ui/Button';

export type CheckoutStep = 1 | 2 | 3 | 4 | 5;

interface StepConfig {
  id: CheckoutStep;
  name: string;
  icon: React.ElementType;
}

const CHECKOUT_STEPS: StepConfig[] = [
  { id: 1, name: 'Bag Summary', icon: ShoppingBag },
  { id: 2, name: 'Delivery Address', icon: MapPin },
  { id: 3, name: 'Promo Code', icon: Tag },
  { id: 4, name: 'Payment', icon: CreditCard },
  { id: 5, name: 'Confirmation', icon: CheckCircle2 },
];

export const CheckoutPage: React.FC = () => {
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
  const [validating, setValidating] = useState<boolean>(false);
  const [validationResults, setValidationResults] = useState<Record<string, InventoryValidationResponse>>({});
  const [hasValidated, setHasValidated] = useState<boolean>(false);

  // Address state for Step 2
  const addresses = useMemo(() => user?.addresses || [], [user?.addresses]);
  const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
  const [isAddingAddress, setIsAddingAddress] = useState<boolean>(false);
  const [addressLoading, setAddressLoading] = useState<boolean>(false);

  const initialAddressForm: Omit<Address, '_id'> = {
    label: 'Home',
    line1: '',
    line2: '',
    city: '',
    province: '',
    postalCode: '',
    country: 'Bangladesh',
    phone: '',
    isDefault: false,
  };
  const [addressForm, setAddressForm] = useState<Omit<Address, '_id'>>(initialAddressForm);

  // Promo code state for Step 3
  const [promoCodeInput, setPromoCodeInput] = useState<string>('');
  const [validatingPromo, setValidatingPromo] = useState<boolean>(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [appliedCoupon, setAppliedCoupon] = useState<{
    code: string;
    discountAmount: number;
    coupon?: Coupon;
    message?: string;
  } | null>(null);

  // Step 4 Payment state
  type PaymentMethod = 'bank_transfer' | 'reward_points' | 'simulate';
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
  const [slipFile, setSlipFile] = useState<File | null>(null);
  const [slipPreviewUrl, setSlipPreviewUrl] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<number>(0);
  const [uploadState, setUploadState] = useState<'idle' | 'uploading' | 'success' | 'error'>('idle');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [walletBalance, setWalletBalance] = useState<number | null>(null);
  const [walletLoading, setWalletLoading] = useState<boolean>(false);
  const [walletActive, setWalletActive] = useState<boolean>(true);
  const [conversionRate, setConversionRate] = useState<{ pointsPerRupee: number; pointValue: number }>({ pointsPerRupee: 100, pointValue: 0.01 });
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

  // Step 4 Simulated Online Payment state
  const [simulateState, setSimulateState] = useState<'idle' | 'processing' | 'approved' | 'declined' | 'error'>('idle');
  const [cardNumber, setCardNumber] = useState<string>('4242 4242 4242 4242');
  const [cardExpiry, setCardExpiry] = useState<string>('12/28');
  const [cardCvv, setCardCvv] = useState<string>('123');
  const [cardName, setCardName] = useState<string>('Test Cardholder');
  const [cardError, setCardError] = useState<string | null>(null);

  // Acceptance criteria: Default address pre-selected on first entering this step
  useEffect(() => {
    if (addresses.length > 0) {
      if (!selectedAddressId || !addresses.some((a) => a._id === selectedAddressId)) {
        const defaultAddr = addresses.find((a) => a.isDefault) || addresses[0];
        if (defaultAddr?._id) {
          setSelectedAddressId(defaultAddr._id);
        }
      }
    } else {
      setSelectedAddressId(null);
      setIsAddingAddress(true); // Auto-open address form if zero addresses exist
    }
  }, [addresses, selectedAddressId]);

  const selectedAddress = useMemo(() => {
    return addresses.find((a) => a._id === selectedAddressId) || null;
  }, [addresses, selectedAddressId]);

  // Re-validate applied coupon if subtotal changes
  useEffect(() => {
    if (appliedCoupon && subtotal > 0) {
      couponService
        .validateCoupon(appliedCoupon.code, subtotal)
        .then((res) => {
          if (res.valid) {
            setAppliedCoupon({
              ...appliedCoupon,
              discountAmount: res.discountAmount || 0,
            });
          } else {
            setAppliedCoupon(null);
            toast.error(`Coupon ${appliedCoupon.code} removed: ${res.message || 'No longer applicable'}`);
          }
        })
        .catch(() => {
          // silently catch
        });
    }
  }, [subtotal]);

  // Acceptance criteria: Checkout is unreachable with an empty cart (redirects to /cart with a message)
  useEffect(() => {
    const isStep5 = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('step') === '5';
    if (items.length === 0 && currentStep < 4 && !createdOrderId && !isStep5) {
      toast.error('Your cart is empty. Please add items before checking out.');
      navigate('/cart', { replace: true });
    }
  }, [items.length, currentStep, createdOrderId, navigate]);

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

  // Live Inventory Validation on mount and when items change
  const runValidation = async () => {
    if (items.length === 0) return;
    setValidating(true);
    try {
      const requests = items.map((item) => ({
        sku: item.variantSku,
        qty: item.quantity,
      }));
      const results = await inventoryService.validate(requests);
      const map: Record<string, InventoryValidationResponse> = {};
      results.forEach((r) => {
        map[r.sku] = r;
      });
      setValidationResults(map);
      setHasValidated(true);
    } catch (err: any) {
      console.error('Checkout inventory validation failed:', err);
      toast.error(err.message || 'Failed to check real-time inventory availability');
    } finally {
      setValidating(false);
    }
  };

  useEffect(() => {
    runValidation();
  }, [items]);

  // Identify unavailable items
  const unavailableItems = useMemo(() => {
    return items
      .map((item) => {
        const val = validationResults[item.variantSku];
        if (!val) return null;
        const avail = val.available ?? 0;
        if (!val.ok || avail < item.quantity) {
          return {
            item,
            available: avail,
            shortfall: Math.max(1, item.quantity - avail),
          };
        }
        return null;
      })
      .filter((entry): entry is { item: CartItem; available: number; shortfall: number } => entry !== null);
  }, [items, validationResults]);

  // Step 4: Create order and load customer wallet
  const createOrderForCheckout = async () => {
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
    } catch (err: any) {
      toast.error(err.message || 'Failed to create order');
      return null;
    } finally {
      setIsCreatingOrder(false);
    }
  };

  const loadWalletBalance = async () => {
    setWalletLoading(true);
    try {
      const [wallet, rate] = await Promise.all([
        walletService.getMyWallet(),
        walletService.getConversionRate().catch(() => ({ pointsPerRupee: 100, pointValue: 0.01 })),
      ]);
      setWalletBalance(wallet.balancePoints);
      setWalletActive(wallet.active);
      if (rate) setConversionRate(rate);
    } catch (err: any) {
      console.error('Failed to fetch wallet:', err);
      setWalletBalance(0);
      setWalletActive(false);
    } finally {
      setWalletLoading(false);
    }
  };

  useEffect(() => {
    if (currentStep === 4) {
      if (!createdOrderId) {
        createOrderForCheckout();
      }
      loadWalletBalance();
    }
  }, [currentStep, createdOrderId]);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploadError(null);
    // 5MB client-side guard
    if (file.size > 5 * 1024 * 1024) {
      setUploadError('File size exceeds the 5MB limit. Please upload a smaller file.');
      return;
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf'];
    if (!validTypes.includes(file.type)) {
      setUploadError('Only image (JPEG, PNG, WebP, GIF) or PDF files are accepted.');
      return;
    }

    setSlipFile(file);
    if (file.type.startsWith('image/')) {
      setSlipPreviewUrl(URL.createObjectURL(file));
    } else {
      setSlipPreviewUrl(null);
    }
    setUploadState('idle');
    setUploadProgress(0);
  };

  const handleUploadSlip = async () => {
    if (!slipFile) {
      setUploadError('Please select a file to upload');
      return;
    }
    if (!createdOrderId) {
      setUploadError('Order not initialized. Please retry.');
      return;
    }

    setUploadState('uploading');
    setUploadProgress(0);
    setUploadError(null);

    try {
      const res = await orderService.uploadPaymentSlip(
        createdOrderId,
        slipFile,
        (percent) => setUploadProgress(percent)
      );
      setSubmittedPayment(res.payment);
      setCreatedOrder(res.order);
      setUploadState('success');
      toast.success('Payment slip uploaded successfully! Under review.');
    } catch (err: any) {
      setUploadState('error');
      setUploadError(err.message || 'Failed to upload payment slip');
      toast.error(err.message || 'Upload failed');
    }
  };

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
    } catch (err: any) {
      toast.error(err.message || 'Points payment failed');
    } finally {
      setPayingWithPoints(false);
    }
  };

  const handleCardNumberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 19);
    const formatted = raw.replace(/(\d{4})(?=\d)/g, '$1 ');
    setCardNumber(formatted);
    if (simulateState !== 'idle' && simulateState !== 'processing') {
      setSimulateState('idle');
    }
    setCardError(null);
  };

  const handleCardExpiryChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    let raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    if (raw.length >= 3) {
      raw = raw.slice(0, 2) + '/' + raw.slice(2);
    }
    setCardExpiry(raw);
    if (simulateState !== 'idle' && simulateState !== 'processing') {
      setSimulateState('idle');
    }
    setCardError(null);
  };

  const handleCardCvvChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/\D/g, '').slice(0, 4);
    setCardCvv(raw);
    if (simulateState !== 'idle' && simulateState !== 'processing') {
      setSimulateState('idle');
    }
    setCardError(null);
  };

  const fillSuccessCard = () => {
    setCardNumber('4242 4242 4242 4242');
    setCardExpiry('12/28');
    setCardCvv('123');
    setCardName('Test Cardholder');
    setSimulateState('idle');
    setCardError(null);
  };

  const fillDeclineCard = () => {
    setCardNumber('4000 0000 0000 0002');
    setCardExpiry('12/28');
    setCardCvv('000');
    setCardName('Declined Test');
    setSimulateState('idle');
    setCardError(null);
  };

  const handleSimulatePayment = async () => {
    let orderId = createdOrderId;
    if (!orderId) {
      orderId = await createOrderForCheckout();
      if (!orderId) return;
    }

    const cleanCard = cardNumber.replace(/\s+/g, '');
    if (cleanCard.length < 13 || cleanCard.length > 19) {
      setCardError('Please enter a valid card number (13-19 digits)');
      return;
    }
    if (!/^(0[1-9]|1[0-2])\/\d{2}$/.test(cardExpiry)) {
      setCardError('Please enter expiry as MM/YY');
      return;
    }
    if (cardCvv.length < 3) {
      setCardError('Please enter a valid CVV (3-4 digits)');
      return;
    }
    if (!cardName.trim()) {
      setCardError('Please enter the cardholder name');
      return;
    }

    setSimulateState('processing');
    setCardError(null);

    try {
      const res = await orderService.simulatePayment(orderId, {
        cardNumber: cleanCard,
        expiry: cardExpiry,
        cvv: cardCvv,
        cardholderName: cardName.trim(),
      });

      setSubmittedPayment(res.payment);
      setCreatedOrder(res.order);

      if (res.approved) {
        setSimulateState('approved');
        toast.success('Simulated payment approved! Click "Complete Order" to finish.');
      } else {
        setSimulateState('declined');
        setCardError('Transaction declined: Test card 4000...0002 triggered a simulated decline. You can retry with a valid card.');
        toast.error('Payment declined by card simulator');
      }
    } catch (err: any) {
      setSimulateState('error');
      const msg = err.response?.data?.message || err.message || 'Payment simulation failed';
      setCardError(msg);
      toast.error(msg);
    }
  };

  // Acceptance criteria: Next button disabled logic
  const isNextBlocked = useMemo(() => {
    if (currentStep === 1) {
      return validating || unavailableItems.length > 0;
    }
    if (currentStep === 2) {
      return !selectedAddressId || addressLoading;
    }
    if (currentStep === 3) {
      return validatingPromo || isCreatingOrder;
    }
    if (currentStep === 4) {
      if (isCreatingOrder || !createdOrderId) return true;
      if (!paymentMethod) return true;
      if (paymentMethod === 'bank_transfer') return uploadState !== 'success';
      if (paymentMethod === 'reward_points') return true; // Handled directly by pay button
      if (paymentMethod === 'simulate') return simulateState !== 'approved';
    }
    return false;
  }, [
    currentStep,
    validating,
    unavailableItems.length,
    selectedAddressId,
    addressLoading,
    validatingPromo,
    isCreatingOrder,
    createdOrderId,
    paymentMethod,
    uploadState,
    simulateState,
  ]);

  const handleNextStep = async () => {
    if (isNextBlocked) return;
    if (currentStep === 3) {
      if (!createdOrderId) {
        const orderId = await createOrderForCheckout();
        if (!orderId) return;
      }
      setCurrentStep(4);
      window.scrollTo({ top: 0, behavior: 'smooth' });
      return;
    }
    if (currentStep === 4) {
      if (paymentMethod === 'bank_transfer' && uploadState === 'success') {
        clearCart();
        setCurrentStep(5);
        window.scrollTo({ top: 0, behavior: 'smooth' });
        return;
      }
      if (paymentMethod === 'simulate' && simulateState === 'approved') {
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

  const handleSaveAddress = async (e: React.FormEvent) => {
    e.preventDefault();
    if (
      !addressForm.line1.trim() ||
      !addressForm.city.trim() ||
      !addressForm.postalCode.trim() ||
      !addressForm.province.trim()
    ) {
      toast.error('Please fill in all required address fields');
      return;
    }

    if (addressForm.phone && !/^\d{10,13}$/.test(addressForm.phone.trim())) {
      toast.error('Phone number must contain only numbers and be 10 to 13 digits long');
      return;
    }

    setAddressLoading(true);
    try {
      const isFirst = addresses.length === 0;
      const updatedAddresses = await userService.addAddress({
        ...addressForm,
        isDefault: addressForm.isDefault || isFirst,
      });
      await refreshUser();
      if (Array.isArray(updatedAddresses) && updatedAddresses.length > 0) {
        const newlyAdded = updatedAddresses[updatedAddresses.length - 1];
        if (newlyAdded?._id) {
          setSelectedAddressId(newlyAdded._id);
        }
      }
      setAddressForm(initialAddressForm);
      setIsAddingAddress(false);
      toast.success('Delivery address added and selected');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save address');
    } finally {
      setAddressLoading(false);
    }
  };

  const handleApplyCoupon = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const cleanCode = promoCodeInput.trim().toUpperCase();
    if (!cleanCode) {
      setPromoError('Please enter a promo code');
      return;
    }

    setValidatingPromo(true);
    setPromoError(null);
    try {
      const res = await couponService.validateCoupon(cleanCode, subtotal);
      if (res.valid) {
        setAppliedCoupon({
          code: cleanCode,
          discountAmount: res.discountAmount || 0,
          coupon: res.coupon,
          message: res.message || 'Coupon applied successfully',
        });
        setPromoCodeInput('');
        toast.success(res.message || 'Coupon applied successfully');
      } else {
        const errorMsg = res.message || 'Invalid or inapplicable coupon code';
        setPromoError(errorMsg);
        toast.error(errorMsg);
      }
    } catch (err: any) {
      const msg = err.response?.data?.message || err.message || 'Failed to validate coupon';
      setPromoError(msg);
      toast.error(msg);
    } finally {
      setValidatingPromo(false);
    }
  };

  const handleRemoveCoupon = () => {
    setAppliedCoupon(null);
    setPromoError(null);
    toast.success('Promo code removed');
  };

  const nextButtonLabel = useMemo(() => {
    switch (currentStep) {
      case 1:
        return 'Proceed to Delivery';
      case 2:
        return 'Proceed to Promo Code';
      case 3:
        return isCreatingOrder ? 'Creating Order...' : 'Proceed to Payment';
      case 4:
        return 'Complete Order';
      default:
        return 'Next Step';
    }
  }, [currentStep, isCreatingOrder]);

  const nextButtonBlockedMessage = useMemo(() => {
    if (currentStep === 1) {
      if (validating) return 'Validating inventory stock...';
      if (unavailableItems.length > 0) return 'Resolve out-of-stock items above to proceed';
    }
    if (currentStep === 2) {
      if (addressLoading) return 'Saving address...';
      if (!selectedAddressId) return 'Please select or add a delivery address to proceed';
    }
    if (currentStep === 3) {
      if (validatingPromo) return 'Validating promo code...';
      if (isCreatingOrder) return 'Creating order...';
    }
    if (currentStep === 4) {
      if (isCreatingOrder) return 'Creating order...';
      if (!createdOrderId) return 'Order initialization failed. Please retry.';
      if (!paymentMethod) return 'Please select a payment method.';
      if (paymentMethod === 'bank_transfer') {
        if (uploadState === 'uploading') return 'Uploading payment slip...';
        if (uploadState !== 'success') return 'Please upload and submit your payment slip to complete order.';
      }
      if (paymentMethod === 'reward_points') return 'Use the "Pay with Reward Points" button above to complete.';
      if (paymentMethod === 'simulate') {
        if (simulateState === 'processing') return 'Authorizing simulated payment...';
        if (simulateState === 'declined') return 'Payment declined. Please retry with an authorized test card.';
        if (simulateState !== 'approved') return 'Please authorize your card payment to complete order.';
      }
    }
    return '';
  }, [
    currentStep,
    validating,
    unavailableItems.length,
    selectedAddressId,
    addressLoading,
    validatingPromo,
    isCreatingOrder,
    createdOrderId,
    paymentMethod,
    uploadState,
    simulateState,
  ]);

  const isStep5Param = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('step') === '5';
  if (items.length === 0 && currentStep < 4 && !createdOrderId && !isStep5Param) {
    return null; // Redirecting via useEffect
  }

  // Summary calculations (uses createdOrder values if order already created, else cart/coupon)
  const effectiveSubtotal = createdOrder ? (createdOrder.subtotal ?? subtotal) : subtotal;
  const discountAmount = createdOrder
    ? (createdOrder.discountTotal ?? createdOrder.discountAmount ?? 0)
    : (appliedCoupon?.discountAmount || 0);
  const shippingFee = createdOrder ? (createdOrder.shippingFee ?? 0) : (subtotal >= 1500 ? 0 : 60);
  const grandTotal = createdOrder
    ? (createdOrder.total ?? 0)
    : (Math.max(0, subtotal - discountAmount) + shippingFee);
  const pointsRequired = Math.ceil(grandTotal * (conversionRate?.pointsPerRupee || 100));

  return (
    <div className="min-h-screen bg-sand-50/50 py-8 sm:py-12">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Page Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-500 mb-1">
              <Link to="/cart" className="hover:text-ink-900 transition-colors inline-flex items-center gap-1">
                <ArrowLeft className="w-3.5 h-3.5" />
                Back to Cart
              </Link>
              <span>/</span>
              <span>Checkout</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-display font-bold text-ink-950">
              Guided Checkout
            </h1>
          </div>
          <div className="flex items-center gap-2 text-xs text-ink-600 bg-white px-3 py-1.5 rounded-full border border-sand-200 shadow-sm self-start sm:self-auto">
            <ShieldCheck className="w-4 h-4 text-emerald-600" />
            <span>Secure 256-Bit SSL Checkout</span>
          </div>
        </div>

        {/* 5-Step Guided Progress Indicator */}
        <div className="bg-white rounded-2xl border border-sand-200 p-4 sm:p-6 mb-8 shadow-sm">
          <nav aria-label="Checkout Progress">
            <ol className="flex items-center justify-between relative">
              {/* Connector line behind steps */}
              <div
                className="absolute top-1/2 left-0 right-0 -translate-y-1/2 h-0.5 bg-sand-200 z-0"
                aria-hidden="true"
              />
              <div
                className="absolute top-1/2 left-0 -translate-y-1/2 h-0.5 bg-ink-900 z-0 transition-all duration-300"
                style={{
                  width: `${((currentStep - 1) / (CHECKOUT_STEPS.length - 1)) * 100}%`,
                }}
                aria-hidden="true"
              />

              {CHECKOUT_STEPS.map((step) => {
                const isCompleted = step.id < currentStep;
                const isCurrent = step.id === currentStep;
                const StepIcon = step.icon;

                return (
                  <li
                    key={step.id}
                    className="relative z-10 flex flex-col items-center group cursor-default"
                  >
                    <button
                      type="button"
                      disabled={step.id > currentStep || currentStep === 5}
                      onClick={() => {
                        if (step.id < currentStep && currentStep < 5) setCurrentStep(step.id);
                      }}
                      className={`w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center font-semibold text-xs sm:text-sm transition-all duration-200 ${
                        isCompleted
                          ? 'bg-ink-900 text-white shadow-sm hover:bg-ink-800 cursor-pointer'
                          : isCurrent
                          ? 'bg-ink-950 text-white ring-4 ring-ink-900/20 shadow-md scale-105'
                          : 'bg-white border-2 border-sand-300 text-ink-400'
                      }`}
                      aria-current={isCurrent ? 'step' : undefined}
                    >
                      {isCompleted ? (
                        <CheckCircle2 className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <StepIcon className="w-4 h-4 sm:w-5 sm:h-5" />
                      )}
                    </button>
                    <span
                      className={`mt-2 text-[11px] sm:text-xs font-medium tracking-tight text-center hidden sm:block ${
                        isCurrent
                          ? 'text-ink-950 font-bold'
                          : isCompleted
                          ? 'text-ink-700'
                          : 'text-ink-400'
                      }`}
                    >
                      {step.name}
                    </span>
                  </li>
                );
              })}
            </ol>
          </nav>
        </div>

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Step Body */}
          <div className="lg:col-span-8 space-y-6">
            {/* STEP 1: BAG SUMMARY */}
            {currentStep === 1 && (
              <div className="bg-white rounded-2xl border border-sand-200 p-6 sm:p-8 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-sand-200">
                  <div>
                    <h2 className="text-xl font-display font-bold text-ink-950 flex items-center gap-2">
                      <span>1. Review Your Bag Items</span>
                      <span className="text-xs font-sans font-normal text-ink-500 bg-sand-100 px-2.5 py-0.5 rounded-full">
                        {totalItems} {totalItems === 1 ? 'item' : 'items'}
                      </span>
                    </h2>
                    <p className="text-xs text-ink-600 mt-0.5">
                      Verify sizes, quantities, and live inventory availability before moving to delivery.
                    </p>
                  </div>

                  <button
                    type="button"
                    onClick={runValidation}
                    disabled={validating}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-ink-600 hover:text-ink-950 transition-colors disabled:opacity-50 self-start sm:self-auto bg-sand-50 hover:bg-sand-100 px-3 py-1.5 rounded-lg border border-sand-200"
                    title="Re-check inventory stock now"
                  >
                    <RefreshCw className={`w-3.5 h-3.5 ${validating ? 'animate-spin' : ''}`} />
                    <span>{validating ? 'Checking Stock...' : 'Verify Stock'}</span>
                  </button>
                </div>

                {/* Blocking Stock Shortage Alert Banner */}
                {unavailableItems.length > 0 && (
                  <div
                    className="bg-danger-light border-2 border-danger/30 rounded-xl p-4 sm:p-5 space-y-3 animate-fade-in"
                    role="alert"
                  >
                    <div className="flex items-start gap-3">
                      <AlertTriangle className="w-5 h-5 text-danger flex-shrink-0 mt-0.5" />
                      <div className="space-y-1">
                        <h3 className="text-sm font-bold text-danger-dark">
                          Inventory Shortage Detected — Cannot Proceed
                        </h3>
                        <p className="text-xs text-danger-dark/90 leading-relaxed">
                          The following item(s) in your bag exceed current available stock in our warehouse.
                          Adjust your quantities or remove unavailable items to continue checkout:
                        </p>
                      </div>
                    </div>

                    <div className="divide-y divide-danger/20 border-t border-danger/20 pt-2 text-xs">
                      {unavailableItems.map(({ item, available }) => (
                        <div
                          key={item.variantSku}
                          className="py-2 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
                        >
                          <div className="font-medium text-ink-900">
                            <span className="font-bold text-danger-dark">{item.name}</span>{' '}
                            <span className="text-ink-600">
                              (Size: {item.size}, Color: {item.color})
                            </span>
                            <div className="text-[11px] text-danger-dark">
                              Requested: <strong className="underline">{item.quantity}</strong> | Available in Stock:{' '}
                              <strong>{available}</strong>
                            </div>
                          </div>

                          <div className="flex items-center gap-2 self-start sm:self-auto">
                            {available > 0 ? (
                              <button
                                type="button"
                                onClick={() => updateQuantity(item.variantSku, available)}
                                className="text-xs bg-white text-ink-900 hover:bg-sand-100 font-semibold px-2.5 py-1 rounded border border-danger/40 shadow-xs transition-colors"
                              >
                                Set to {available}
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => removeItem(item.variantSku)}
                              className="text-xs bg-danger text-white hover:bg-danger-dark font-semibold px-2.5 py-1 rounded shadow-xs transition-colors"
                            >
                              Remove Item
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Line Items List */}
                <div className="divide-y divide-sand-200 border border-sand-200 rounded-xl overflow-hidden">
                  {items.map((item) => {
                    const validation = validationResults[item.variantSku];
                    const isOutOfStock = validation && (validation.available ?? 0) <= 0;
                    const isPartialStock = validation && !validation.ok && (validation.available ?? 0) > 0;
                    const isAvailable = validation && validation.ok;

                    return (
                      <div
                        key={item.variantSku}
                        className={`p-4 sm:p-5 flex flex-col sm:flex-row gap-4 transition-colors ${
                          !isAvailable && hasValidated ? 'bg-danger-light/20' : 'bg-white hover:bg-sand-50/40'
                        }`}
                      >
                        {/* Thumbnail */}
                        <Link
                          to={`/products/${item.slug}`}
                          className="w-20 h-24 sm:w-24 sm:h-28 rounded-lg bg-sand-100 overflow-hidden flex-shrink-0 border border-sand-200 relative group"
                        >
                          <img
                            src={item.image}
                            alt={item.name}
                            className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                            onError={(e) => {
                              (e.target as HTMLImageElement).src =
                                'https://images.unsplash.com/photo-1515886657613-9f3515b0c78f?auto=format&fit=crop&w=800&q=80';
                            }}
                          />
                        </Link>

                        {/* Details */}
                        <div className="flex-1 flex flex-col justify-between gap-3">
                          <div className="space-y-1">
                            <div className="flex items-start justify-between gap-3">
                              <Link
                                to={`/products/${item.slug}`}
                                className="font-display text-base font-bold text-ink-950 hover:text-ink-700 transition-colors line-clamp-1"
                              >
                                {item.name}
                              </Link>
                              <span className="font-bold text-ink-950 text-base whitespace-nowrap">
                                Rs. {(item.unitPrice * item.quantity).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2 pt-0.5">
                              <span className="text-xs font-medium text-ink-700 bg-sand-100 px-2 py-0.5 rounded">
                                Size: {item.size}
                              </span>
                              <span className="text-xs font-medium text-ink-700 bg-sand-100 px-2 py-0.5 rounded">
                                Color: {item.color}
                              </span>
                              <span className="text-[11px] text-ink-400 font-mono">
                                SKU: {item.variantSku}
                              </span>
                            </div>

                            {/* Live Availability Badges */}
                            <div className="pt-1.5 flex items-center gap-2">
                              {validating ? (
                                <span className="inline-flex items-center gap-1 text-xs text-ink-400">
                                  <RefreshCw className="w-3 h-3 animate-spin" />
                                  Checking live inventory...
                                </span>
                              ) : isOutOfStock ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-danger bg-danger-light px-2.5 py-0.5 rounded-full border border-danger/20">
                                  <AlertTriangle className="w-3.5 h-3.5" />
                                  Out of Stock (0 remaining)
                                </span>
                              ) : isPartialStock ? (
                                <span className="inline-flex items-center gap-1 text-xs font-bold text-amber-700 bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200">
                                  <AlertTriangle className="w-3.5 h-3.5 text-amber-600" />
                                  Only {validation.available} left in stock (need {item.quantity})
                                </span>
                              ) : isAvailable ? (
                                <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                  In Stock ({validation.available} available)
                                </span>
                              ) : (
                                <span className="text-xs text-ink-400">Stock pending verification</span>
                              )}
                            </div>
                          </div>

                          {/* Controls: Quantity & Remove */}
                          <div className="flex items-center justify-between pt-2 border-t border-sand-100 text-xs text-ink-500">
                            <div className="flex items-center gap-2">
                              <span>Quantity:</span>
                              <div className="flex items-center border border-sand-300 rounded-lg bg-white overflow-hidden">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.variantSku, item.quantity - 1)}
                                  className="w-7 h-7 flex items-center justify-center text-ink-600 hover:bg-sand-100 transition-colors"
                                  aria-label="Decrease quantity"
                                >
                                  <Minus className="w-3 h-3" />
                                </button>
                                <span className="w-8 text-center font-bold text-ink-950">
                                  {item.quantity}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.variantSku, item.quantity + 1)}
                                  className="w-7 h-7 flex items-center justify-center text-ink-600 hover:bg-sand-100 transition-colors"
                                  aria-label="Increase quantity"
                                >
                                  <Plus className="w-3 h-3" />
                                </button>
                              </div>
                              <span className="text-ink-400 ml-1">
                                × Rs. {item.unitPrice.toLocaleString(undefined, { minimumFractionDigits: 2 })} each
                              </span>
                            </div>

                            <button
                              type="button"
                              onClick={() => removeItem(item.variantSku)}
                              className="text-xs font-semibold text-ink-400 hover:text-danger transition-colors inline-flex items-center gap-1"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>Remove</span>
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* STEP 2: DELIVERY ADDRESS */}
            {currentStep === 2 && (
              <div className="bg-white rounded-2xl border border-sand-200 p-6 sm:p-8 shadow-sm space-y-6">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-sand-200">
                  <div>
                    <h2 className="text-xl font-display font-bold text-ink-950 flex items-center gap-2">
                      <span>2. Choose Delivery Address</span>
                      <span className="text-xs font-sans font-normal text-ink-500 bg-sand-100 px-2.5 py-0.5 rounded-full">
                        {addresses.length} saved {addresses.length === 1 ? 'address' : 'addresses'}
                      </span>
                    </h2>
                    <p className="text-xs text-ink-600 mt-0.5">
                      Select where your items should be delivered, or add a new delivery destination.
                    </p>
                  </div>

                  {!isAddingAddress && addresses.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setIsAddingAddress(true)}
                      className="inline-flex items-center gap-1.5 text-xs font-semibold text-ink-900 bg-sand-100 hover:bg-sand-200 px-3.5 py-2 rounded-lg transition-colors border border-sand-300 self-start sm:self-auto"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add New Address</span>
                    </button>
                  )}
                </div>

                {/* Zero Saved Addresses Notice */}
                {addresses.length === 0 && !isAddingAddress && (
                  <div className="bg-amber-50 border border-amber-200 rounded-xl p-5 text-center space-y-3">
                    <MapPin className="w-8 h-8 text-amber-600 mx-auto" />
                    <h3 className="text-sm font-bold text-amber-900">No Delivery Addresses Saved</h3>
                    <p className="text-xs text-amber-800 max-w-md mx-auto">
                      You have no saved delivery addresses. Please add a shipping destination to proceed with checkout.
                    </p>
                    <Button
                      variant="primary"
                      onClick={() => setIsAddingAddress(true)}
                      className="text-xs inline-flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>Add Shipping Address</span>
                    </Button>
                  </div>
                )}

                {/* Saved Address Radio Cards */}
                {addresses.length > 0 && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {addresses.map((addr) => {
                      const isSelected = addr._id === selectedAddressId;

                      return (
                        <div
                          key={addr._id}
                          onClick={() => addr._id && setSelectedAddressId(addr._id)}
                          className={`relative rounded-xl p-5 border-2 transition-all cursor-pointer flex flex-col justify-between ${
                            isSelected
                              ? 'border-ink-950 bg-sand-50/80 shadow-md ring-2 ring-ink-950/10'
                              : 'border-sand-200 bg-white hover:border-sand-400 hover:bg-sand-50/30'
                          }`}
                        >
                          <div className="space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <input
                                  type="radio"
                                  id={`address-${addr._id}`}
                                  name="deliveryAddress"
                                  checked={isSelected}
                                  onChange={() => addr._id && setSelectedAddressId(addr._id)}
                                  className="w-4 h-4 text-ink-950 border-sand-300 focus:ring-ink-950 focus:ring-2"
                                />
                                <label
                                  htmlFor={`address-${addr._id}`}
                                  className="text-xs font-bold uppercase tracking-wider text-ink-900 cursor-pointer"
                                >
                                  {addr.label}
                                </label>
                              </div>

                              {addr.isDefault && (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-50 text-amber-800 border border-amber-300">
                                  <Star className="w-3 h-3 fill-amber-500 text-amber-500" />
                                  Default
                                </span>
                              )}
                            </div>

                            <div className="text-xs text-ink-700 space-y-1 pl-6">
                              <p className="font-semibold text-ink-950 text-sm">{addr.line1}</p>
                              {addr.line2 && <p className="text-ink-600">{addr.line2}</p>}
                              <p>
                                {addr.city}, {addr.province} {addr.postalCode}
                              </p>
                              <p className="text-ink-500 font-medium">{addr.country}</p>
                              {addr.phone && (
                                <p className="flex items-center gap-1 text-ink-600 pt-1 text-[11px]">
                                  <Phone className="w-3 h-3" />
                                  <span>{addr.phone}</span>
                                </p>
                              )}
                            </div>
                          </div>

                          {isSelected && (
                            <div className="mt-4 pt-3 border-t border-sand-200/80 flex items-center justify-between text-xs text-emerald-700 font-semibold">
                              <span className="inline-flex items-center gap-1">
                                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                                Delivering to this address
                              </span>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Inline Add Address Form */}
                {isAddingAddress && (
                  <div className="border border-sand-300 rounded-xl p-5 sm:p-6 bg-sand-50/50 space-y-4 animate-fade-in">
                    <div className="flex items-center justify-between border-b border-sand-200 pb-3">
                      <div className="flex items-center gap-2">
                        <Building2 className="w-4 h-4 text-ink-700" />
                        <h3 className="text-sm font-bold text-ink-950">Add New Delivery Destination</h3>
                      </div>
                      {addresses.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            setIsAddingAddress(false);
                            setAddressForm(initialAddressForm);
                          }}
                          className="text-xs text-ink-500 hover:text-ink-900 underline underline-offset-2"
                        >
                          Cancel
                        </button>
                      )}
                    </div>

                    <form onSubmit={handleSaveAddress} className="space-y-4 text-xs">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-ink-700 font-semibold mb-1">
                            Address Label (e.g. Home, Office, Studio) *
                          </label>
                          <input
                            type="text"
                            required
                            value={addressForm.label}
                            onChange={(e) => setAddressForm({ ...addressForm, label: e.target.value })}
                            placeholder="Home"
                            className="w-full px-3 py-2 rounded-lg border border-sand-300 bg-white text-ink-900 focus:ring-2 focus:ring-ink-900 focus:border-transparent outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-ink-700 font-semibold mb-1">
                            Contact Phone
                          </label>
                          <input
                            type="tel"
                            maxLength={13}
                            value={addressForm.phone || ''}
                            onChange={(e) => setAddressForm({ ...addressForm, phone: e.target.value.replace(/\D/g, '').slice(0, 13) })}
                            placeholder="e.g. 0771234567"
                            className="w-full px-3 py-2 rounded-lg border border-sand-300 bg-white text-ink-900 focus:ring-2 focus:ring-ink-900 focus:border-transparent outline-none font-mono"
                          />
                          <span className="text-[11px] text-ink-500 mt-1 block">
                            Numbers only, 10–13 digits {addressForm.phone ? `(${addressForm.phone.length}/13)` : ''}
                          </span>
                        </div>
                      </div>

                      <div>
                        <label className="block text-ink-700 font-semibold mb-1">
                          Street Address *
                        </label>
                        <input
                          type="text"
                          required
                          value={addressForm.line1}
                          onChange={(e) => setAddressForm({ ...addressForm, line1: e.target.value })}
                          placeholder="Road 11, House 45, Banani"
                          className="w-full px-3 py-2 rounded-lg border border-sand-300 bg-white text-ink-900 focus:ring-2 focus:ring-ink-900 focus:border-transparent outline-none"
                        />
                      </div>

                      <div>
                        <label className="block text-ink-700 font-semibold mb-1">
                          Apartment, Suite, Unit, Floor (Optional)
                        </label>
                        <input
                          type="text"
                          value={addressForm.line2 || ''}
                          onChange={(e) => setAddressForm({ ...addressForm, line2: e.target.value })}
                          placeholder="Apt 4B, Level 4"
                          className="w-full px-3 py-2 rounded-lg border border-sand-300 bg-white text-ink-900 focus:ring-2 focus:ring-ink-900 focus:border-transparent outline-none"
                        />
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div>
                          <label className="block text-ink-700 font-semibold mb-1">
                            City *
                          </label>
                          <input
                            type="text"
                            required
                            value={addressForm.city}
                            onChange={(e) => setAddressForm({ ...addressForm, city: e.target.value })}
                            placeholder="Dhaka"
                            className="w-full px-3 py-2 rounded-lg border border-sand-300 bg-white text-ink-900 focus:ring-2 focus:ring-ink-900 focus:border-transparent outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-ink-700 font-semibold mb-1">
                            State / Province *
                          </label>
                          <input
                            type="text"
                            required
                            value={addressForm.province}
                            onChange={(e) => setAddressForm({ ...addressForm, province: e.target.value })}
                            placeholder="Dhaka Division"
                            className="w-full px-3 py-2 rounded-lg border border-sand-300 bg-white text-ink-900 focus:ring-2 focus:ring-ink-900 focus:border-transparent outline-none"
                          />
                        </div>

                        <div>
                          <label className="block text-ink-700 font-semibold mb-1">
                            Postal Code *
                          </label>
                          <input
                            type="text"
                            required
                            value={addressForm.postalCode}
                            onChange={(e) => setAddressForm({ ...addressForm, postalCode: e.target.value })}
                            placeholder="1213"
                            className="w-full px-3 py-2 rounded-lg border border-sand-300 bg-white text-ink-900 focus:ring-2 focus:ring-ink-900 focus:border-transparent outline-none"
                          />
                        </div>
                      </div>

                      <div>
                        <label className="block text-ink-700 font-semibold mb-1">
                          Country *
                        </label>
                        <input
                          type="text"
                          required
                          value={addressForm.country}
                          onChange={(e) => setAddressForm({ ...addressForm, country: e.target.value })}
                          placeholder="Bangladesh"
                          className="w-full px-3 py-2 rounded-lg border border-sand-300 bg-white text-ink-900 focus:ring-2 focus:ring-ink-900 focus:border-transparent outline-none"
                        />
                      </div>

                      <div className="flex items-center gap-2 pt-1">
                        <input
                          type="checkbox"
                          id="setAsDefaultAddress"
                          checked={addressForm.isDefault || addresses.length === 0}
                          disabled={addresses.length === 0}
                          onChange={(e) => setAddressForm({ ...addressForm, isDefault: e.target.checked })}
                          className="w-4 h-4 rounded text-ink-900 border-sand-300 focus:ring-ink-950"
                        />
                        <label htmlFor="setAsDefaultAddress" className="text-xs text-ink-700 font-medium cursor-pointer">
                          Set as my default delivery address
                        </label>
                      </div>

                      <div className="flex items-center justify-end gap-3 pt-3 border-t border-sand-200">
                        {addresses.length > 0 && (
                          <Button
                            type="button"
                            variant="secondary"
                            onClick={() => {
                              setIsAddingAddress(false);
                              setAddressForm(initialAddressForm);
                            }}
                            disabled={addressLoading}
                          >
                            Cancel
                          </Button>
                        )}

                        <Button
                          type="submit"
                          variant="primary"
                          disabled={addressLoading}
                          className="inline-flex items-center gap-2"
                        >
                          {addressLoading && <RefreshCw className="w-3.5 h-3.5 animate-spin" />}
                          <span>{addressLoading ? 'Saving Address...' : 'Save & Select Address'}</span>
                        </Button>
                      </div>
                    </form>
                  </div>
                )}
              </div>
            )}

            {/* STEP 3: PROMO CODE */}
            {currentStep === 3 && (
              <div className="bg-white rounded-2xl border border-sand-200 p-6 sm:p-8 shadow-sm space-y-6">
                <div>
                  <h2 className="text-xl font-display font-bold text-ink-950 flex items-center gap-2">
                    <Tag className="w-5 h-5 text-ink-900" />
                    <span>Apply Promotional Code</span>
                  </h2>
                  <p className="text-sm text-ink-600 mt-1">
                    Have a coupon, seasonal promotion, or voucher code? Enter it below to calculate your savings.
                  </p>
                </div>

                {/* If a coupon is already applied */}
                {appliedCoupon ? (
                  <div className="bg-emerald-50/70 border border-emerald-200 rounded-2xl p-5 sm:p-6 space-y-4">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-start gap-3.5">
                        <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center text-emerald-700 flex-shrink-0 mt-0.5">
                          <CheckCircle2 className="w-5 h-5" />
                        </div>
                        <div className="space-y-1">
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-sm sm:text-base text-emerald-950 tracking-wider bg-white px-2.5 py-0.5 rounded border border-emerald-300 shadow-2xs">
                              {appliedCoupon.code}
                            </span>
                            <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-200/70 text-emerald-900">
                              Applied
                            </span>
                          </div>
                          <p className="text-sm font-semibold text-emerald-900">
                            {appliedCoupon.message || 'Promo code applied successfully!'}
                          </p>
                          {appliedCoupon.coupon?.minOrderAmount && appliedCoupon.coupon.minOrderAmount > 0 && (
                            <p className="text-xs text-emerald-700">
                              Min. order requirement of Rs. {appliedCoupon.coupon.minOrderAmount} met
                            </p>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center sm:flex-col sm:items-end justify-between border-t sm:border-t-0 pt-3 sm:pt-0 border-emerald-200/60">
                        <span className="text-xs text-emerald-700 font-medium">You Save</span>
                        <span className="text-lg sm:text-xl font-bold text-emerald-800 font-display">
                          -Rs. {appliedCoupon.discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                        </span>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-3 border-t border-emerald-200/80">
                      <p className="text-xs text-emerald-800">
                        To use a different code, remove the current one first.
                      </p>
                      <Button
                        type="button"
                        variant="secondary"
                        size="sm"
                        onClick={handleRemoveCoupon}
                        className="text-xs text-danger hover:bg-danger/10 border-danger/20 hover:border-danger/40 inline-flex items-center gap-1.5"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        <span>Remove Code</span>
                      </Button>
                    </div>
                  </div>
                ) : (
                  /* Form to enter promo code */
                  <div className="space-y-4">
                    <form onSubmit={handleApplyCoupon} className="flex flex-col sm:flex-row gap-3">
                      <div className="relative flex-1">
                        <input
                          type="text"
                          id="promoCodeInput"
                          value={promoCodeInput}
                          onChange={(e) => {
                            setPromoCodeInput(e.target.value);
                            if (promoError) setPromoError(null);
                          }}
                          disabled={validatingPromo}
                          placeholder="e.g. SAVE10, WELCOME20"
                          className="w-full px-4 py-3 rounded-xl border border-sand-300 bg-sand-50/50 text-ink-950 uppercase font-mono tracking-wider placeholder:normal-case placeholder:font-sans placeholder:tracking-normal focus:ring-2 focus:ring-ink-900 focus:bg-white focus:border-transparent outline-none transition-all disabled:opacity-50"
                        />
                        {promoCodeInput && (
                          <button
                            type="button"
                            onClick={() => {
                              setPromoCodeInput('');
                              setPromoError(null);
                            }}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-ink-400 hover:text-ink-600 p-1"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        )}
                      </div>

                      <Button
                        type="submit"
                        variant="primary"
                        disabled={validatingPromo || !promoCodeInput.trim()}
                        className="px-6 py-3 justify-center inline-flex items-center gap-2 shadow-sm font-semibold"
                      >
                        {validatingPromo ? (
                          <>
                            <RefreshCw className="w-4 h-4 animate-spin" />
                            <span>Validating...</span>
                          </>
                        ) : (
                          <>
                            <Tag className="w-4 h-4" />
                            <span>Apply Code</span>
                          </>
                        )}
                      </Button>
                    </form>

                    {/* Specific Rejection Message */}
                    {promoError && (
                      <div className="bg-danger/10 border border-danger/30 rounded-xl p-3.5 text-danger flex items-start gap-2.5 text-sm animate-fadeIn">
                        <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                        <div className="space-y-0.5">
                          <p className="font-semibold text-xs uppercase tracking-wide">Invalid or Inapplicable Code</p>
                          <p className="text-xs">{promoError}</p>
                        </div>
                      </div>
                    )}

                    <div className="bg-sand-50 rounded-xl p-4 border border-sand-200/80 text-xs text-ink-600 space-y-1.5">
                      <div className="flex items-center gap-1.5 font-semibold text-ink-900">
                        <Sparkles className="w-3.5 h-3.5 text-ink-700" />
                        <span>Promo Code Guidelines</span>
                      </div>
                      <ul className="list-disc list-inside space-y-0.5 text-ink-600 pl-1">
                        <li>Promo codes apply exclusively to the items subtotal before delivery charges.</li>
                        <li>Only one promotional code may be applied per checkout session.</li>
                        <li>Promo codes are optional. If you do not have one, click <strong>Proceed to Payment</strong> below.</li>
                      </ul>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* STEP 4: PAYMENT SELECTION */}
            {currentStep === 4 && (
              <div className="space-y-6">
                <div className="bg-white rounded-2xl border border-sand-200 p-6 sm:p-8 shadow-sm">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-sand-200">
                    <div>
                      <h2 className="text-xl font-display font-bold text-ink-950 flex items-center gap-2">
                        <CreditCard className="w-5 h-5 text-ink-900" />
                        <span>Select Payment Method</span>
                      </h2>
                      <p className="text-xs text-ink-600 mt-1">
                        Choose how you would like to pay for your order.
                      </p>
                    </div>
                    {createdOrder && (
                      <div className="bg-sand-50 border border-sand-200 px-3 py-1.5 rounded-xl text-right self-start sm:self-auto">
                        <div className="text-[10px] uppercase font-bold tracking-wider text-ink-500">Order Reference</div>
                        <div className="text-xs font-mono font-bold text-ink-950">#{createdOrder.orderNumber}</div>
                      </div>
                    )}
                  </div>

                  {/* Payment Options */}
                  <div className="space-y-4 mt-6">
                    {/* OPTION 1: Bank Transfer (Manual Slip Upload) */}
                    <div
                      id="payment-option-bank-transfer"
                      onClick={() => setPaymentMethod('bank_transfer')}
                      className={`border rounded-2xl p-5 cursor-pointer transition-all ${
                        paymentMethod === 'bank_transfer'
                          ? 'border-ink-950 bg-sand-50/40 shadow-sm'
                          : 'border-sand-200 hover:border-sand-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 transition-colors ${
                              paymentMethod === 'bank_transfer'
                                ? 'border-ink-950 bg-ink-950'
                                : 'border-sand-300 bg-white'
                            }`}
                          >
                            {paymentMethod === 'bank_transfer' && (
                              <div className="w-2 h-2 rounded-full bg-white" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Building2 className="w-4 h-4 text-ink-800" />
                              <span className="font-display font-bold text-ink-950 text-base">
                                Bank Transfer (Manual Proof of Payment)
                              </span>
                            </div>
                            <p className="text-xs text-ink-600 mt-1">
                              Transfer the exact amount to our bank account and upload your deposit slip or transaction receipt.
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-ink-700 px-2.5 py-1 bg-sand-100 rounded-full flex-shrink-0">
                          Manual Review
                        </span>
                      </div>

                      {/* Sub-panel when Bank Transfer is selected */}
                      {paymentMethod === 'bank_transfer' && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mt-5 pt-5 border-t border-sand-200 space-y-5"
                        >
                          {/* Beneficiary Details Card */}
                          <div className="bg-white rounded-xl border border-sand-200 p-4 space-y-3">
                            <div className="flex items-center justify-between">
                              <div className="text-xs font-bold uppercase tracking-wider text-ink-500">
                                Beneficiary Bank Details
                              </div>
                              <div className="text-xs font-bold text-ink-900">City Bank Ltd.</div>
                            </div>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
                              <div>
                                <span className="text-ink-500">Account Name:</span>{' '}
                                <strong className="text-ink-900">Shop Online Ltd.</strong>
                              </div>
                              <div>
                                <span className="text-ink-500">Account Number:</span>{' '}
                                <strong className="text-ink-900 font-mono">1102938475001</strong>
                              </div>
                              <div>
                                <span className="text-ink-500">Branch:</span>{' '}
                                <strong className="text-ink-900">Gulshan-2, Dhaka</strong>
                              </div>
                              <div>
                                <span className="text-ink-500">Amount Due:</span>{' '}
                                <strong className="text-ink-900 font-bold text-sm">
                                  Rs. {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                                </strong>
                              </div>
                            </div>
                          </div>

                          {/* File Upload Section */}
                          <div className="space-y-3">
                            <label className="block text-xs font-bold uppercase tracking-wider text-ink-700">
                              Upload Deposit Slip / Transaction Screenshot
                            </label>

                            <div className="relative border-2 border-dashed border-sand-300 hover:border-ink-400 rounded-xl p-6 text-center transition-colors bg-white">
                              <input
                                id="slip-file-input"
                                type="file"
                                accept="image/*,application/pdf"
                                onChange={handleFileChange}
                                disabled={uploadState === 'uploading' || uploadState === 'success'}
                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                              />

                              {!slipFile ? (
                                <div className="space-y-2 pointer-events-none">
                                  <div className="w-10 h-10 rounded-full bg-sand-100 flex items-center justify-center mx-auto text-ink-600">
                                    <UploadCloud className="w-5 h-5" />
                                  </div>
                                  <div className="text-xs font-semibold text-ink-900">
                                    Click to select or drag and drop your slip
                                  </div>
                                  <div className="text-[11px] text-ink-500">
                                    JPEG, PNG, WebP, GIF, or PDF (Max 5MB)
                                  </div>
                                </div>
                              ) : (
                                <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
                                  <div className="flex items-center gap-3 text-left">
                                    {slipPreviewUrl ? (
                                      <img
                                        src={slipPreviewUrl}
                                        alt="Slip Preview"
                                        className="w-14 h-14 object-cover rounded-lg border border-sand-200"
                                      />
                                    ) : (
                                      <div className="w-12 h-12 rounded-lg bg-sand-100 flex items-center justify-center text-ink-700">
                                        <FileText className="w-6 h-6" />
                                      </div>
                                    )}
                                    <div>
                                      <p className="text-xs font-bold text-ink-900 truncate max-w-xs">
                                        {slipFile.name}
                                      </p>
                                      <p className="text-[11px] text-ink-500">
                                        {(slipFile.size / 1024).toFixed(1)} KB • {slipFile.type || 'Document'}
                                      </p>
                                    </div>
                                  </div>

                                  {uploadState !== 'uploading' && uploadState !== 'success' && (
                                    <Button
                                      type="button"
                                      variant="secondary"
                                      size="sm"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        setSlipFile(null);
                                        setSlipPreviewUrl(null);
                                        setUploadState('idle');
                                      }}
                                    >
                                      Change File
                                    </Button>
                                  )}
                                </div>
                              )}
                            </div>

                            {/* Client-side or Server Error message */}
                            {uploadError && (
                              <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{uploadError}</span>
                              </div>
                            )}

                            {/* Upload Progress Bar */}
                            {uploadState === 'uploading' && (
                              <div className="space-y-1.5 pt-1">
                                <div className="flex justify-between text-xs text-ink-600 font-medium">
                                  <span>Uploading slip...</span>
                                  <span>{uploadProgress}%</span>
                                </div>
                                <div className="w-full h-2 bg-sand-100 rounded-full overflow-hidden">
                                  <div
                                    className="h-full bg-ink-950 transition-all duration-200 rounded-full"
                                    style={{ width: `${uploadProgress}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {/* Upload Success Banner */}
                            {uploadState === 'success' && (
                              <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start gap-3 text-xs text-emerald-800">
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                <div className="space-y-1">
                                  <div className="font-bold text-sm">Payment Slip Submitted!</div>
                                  <p>
                                    Your slip has been uploaded and your order is now <strong>Under Review</strong>. Click &quot;Complete Order&quot; below to proceed.
                                  </p>
                                </div>
                              </div>
                            )}

                            {/* Submit Slip Button */}
                            {uploadState !== 'success' && (
                              <div className="pt-2 flex justify-end">
                                <Button
                                  id="btn-upload-slip"
                                  type="button"
                                  variant="primary"
                                  onClick={handleUploadSlip}
                                  disabled={!slipFile || uploadState === 'uploading' || !createdOrderId}
                                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2"
                                >
                                  {uploadState === 'uploading' ? (
                                    <>
                                      <RefreshCw className="w-4 h-4 animate-spin" />
                                      <span>Submitting Slip...</span>
                                    </>
                                  ) : (
                                    <>
                                      <UploadCloud className="w-4 h-4" />
                                      <span>Upload Slip & Submit</span>
                                    </>
                                  )}
                                </Button>
                              </div>
                            )}
                          </div>
                        </div>
                      )}
                    </div>

                    {/* OPTION 2: Simulated Online Payment (Card Gateway) */}
                    <div
                      id="payment-option-simulate"
                      onClick={() => setPaymentMethod('simulate')}
                      className={`border rounded-2xl p-5 cursor-pointer transition-all ${
                        paymentMethod === 'simulate'
                          ? 'border-ink-950 bg-sand-50/40 shadow-sm'
                          : 'border-sand-200 hover:border-sand-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 transition-colors ${
                              paymentMethod === 'simulate'
                                ? 'border-ink-950 bg-ink-950'
                                : 'border-sand-300 bg-white'
                            }`}
                          >
                            {paymentMethod === 'simulate' && (
                              <div className="w-2 h-2 rounded-full bg-white" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <CreditCard className="w-4 h-4 text-ink-800" />
                              <span className="font-display font-bold text-ink-950 text-base">
                                Pay Online (Simulated Card Gateway)
                              </span>
                            </div>
                            <p className="text-xs text-ink-600 mt-1">
                              Simulate instant card authorization end-to-end without real card charges.
                            </p>
                          </div>
                        </div>
                        <span className="text-xs font-semibold text-ink-700 px-2.5 py-1 bg-sand-100 rounded-full flex-shrink-0">
                          Instant Authorization
                        </span>
                      </div>

                      {paymentMethod === 'simulate' && (
                        <div
                          className="mt-5 pt-5 border-t border-sand-200/80 space-y-4"
                          onClick={(e) => e.stopPropagation()}
                        >
                          {/* Quick fill buttons */}
                          <div className="flex flex-wrap items-center gap-2 text-xs">
                            <span className="text-ink-500 font-medium">Quick Test Cards:</span>
                            <button
                              type="button"
                              id="btn-fill-success-card"
                              onClick={fillSuccessCard}
                              className="px-2.5 py-1 rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-200 hover:bg-emerald-100 font-mono transition-colors"
                            >
                              4242 (Success)
                            </button>
                            <button
                              type="button"
                              id="btn-fill-decline-card"
                              onClick={fillDeclineCard}
                              className="px-2.5 py-1 rounded-lg bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-mono transition-colors"
                            >
                              4000...0002 (Decline)
                            </button>
                          </div>

                          {/* Card input form */}
                          <div className="space-y-3 bg-white p-4 rounded-xl border border-sand-200">
                            <div>
                              <label className="block text-xs font-semibold text-ink-700 mb-1">
                                Cardholder Name
                              </label>
                              <input
                                id="input-cardholder-name"
                                type="text"
                                value={cardName}
                                onChange={(e) => {
                                  setCardName(e.target.value);
                                  if (simulateState !== 'idle' && simulateState !== 'processing') setSimulateState('idle');
                                  setCardError(null);
                                }}
                                disabled={simulateState === 'approved' || simulateState === 'processing'}
                                placeholder="e.g. Jane Doe"
                                className="w-full text-sm px-3 py-2 rounded-lg border border-sand-300 focus:outline-none focus:ring-2 focus:ring-ink-950/20 disabled:bg-sand-50"
                              />
                            </div>

                            <div>
                              <label className="block text-xs font-semibold text-ink-700 mb-1">
                                Card Number
                              </label>
                              <div className="relative">
                                <input
                                  id="input-card-number"
                                  type="text"
                                  value={cardNumber}
                                  onChange={handleCardNumberChange}
                                  disabled={simulateState === 'approved' || simulateState === 'processing'}
                                  placeholder="4242 4242 4242 4242"
                                  maxLength={23}
                                  className="w-full text-sm font-mono px-3 py-2 pl-9 rounded-lg border border-sand-300 focus:outline-none focus:ring-2 focus:ring-ink-950/20 disabled:bg-sand-50"
                                />
                                <CreditCard className="w-4 h-4 text-ink-400 absolute left-3 top-2.5" />
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-3">
                              <div>
                                <label className="block text-xs font-semibold text-ink-700 mb-1">
                                  Expiration (MM/YY)
                                </label>
                                <input
                                  id="input-card-expiry"
                                  type="text"
                                  value={cardExpiry}
                                  onChange={handleCardExpiryChange}
                                  disabled={simulateState === 'approved' || simulateState === 'processing'}
                                  placeholder="MM/YY"
                                  maxLength={5}
                                  className="w-full text-sm font-mono px-3 py-2 rounded-lg border border-sand-300 focus:outline-none focus:ring-2 focus:ring-ink-950/20 disabled:bg-sand-50"
                                />
                              </div>
                              <div>
                                <label className="block text-xs font-semibold text-ink-700 mb-1">
                                  CVV / CVC
                                </label>
                                <input
                                  id="input-card-cvv"
                                  type="password"
                                  value={cardCvv}
                                  onChange={handleCardCvvChange}
                                  disabled={simulateState === 'approved' || simulateState === 'processing'}
                                  placeholder="•••"
                                  maxLength={4}
                                  className="w-full text-sm font-mono px-3 py-2 rounded-lg border border-sand-300 focus:outline-none focus:ring-2 focus:ring-ink-950/20 disabled:bg-sand-50"
                                />
                              </div>
                            </div>

                            {/* Status Messages */}
                            {simulateState === 'approved' && (
                              <div
                                id="simulate-approved-banner"
                                className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg flex items-start gap-2.5 text-emerald-800"
                              >
                                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0 mt-0.5" />
                                <div className="text-xs space-y-0.5">
                                  <p className="font-semibold text-emerald-900">Payment Authorized Successfully</p>
                                  <p>Card: •••• {submittedPayment?.maskedCardLast4 || cardNumber.slice(-4)}</p>
                                  {submittedPayment?.transactionId && (
                                    <p className="font-mono text-[11px] text-emerald-700">TXN: {submittedPayment.transactionId}</p>
                                  )}
                                  <p className="pt-1 text-emerald-900 font-medium">
                                    Click &quot;Complete Order&quot; below to finalize and view confirmation.
                                  </p>
                                </div>
                              </div>
                            )}

                            {simulateState === 'declined' && (
                              <div
                                id="simulate-declined-banner"
                                className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-start gap-2.5 text-rose-800"
                              >
                                <AlertCircle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
                                <div className="text-xs space-y-0.5">
                                  <p className="font-semibold text-rose-900">Transaction Declined</p>
                                  <p>The simulated bank declined authorization for card {cardNumber.slice(-4)}.</p>
                                  <p className="pt-1 text-rose-900 font-medium">
                                    Click &quot;4242 (Success)&quot; above to switch to an authorized test card and retry.
                                  </p>
                                </div>
                              </div>
                            )}

                            {cardError && simulateState !== 'declined' && (
                              <div
                                id="simulate-error-banner"
                                className="p-3 bg-rose-50 border border-rose-200 rounded-lg flex items-center gap-2 text-xs text-rose-700"
                              >
                                <AlertCircle className="w-4 h-4 flex-shrink-0" />
                                <span>{cardError}</span>
                              </div>
                            )}

                            {/* Action Button */}
                            <Button
                              id="btn-simulate-pay"
                              type="button"
                              onClick={handleSimulatePayment}
                              disabled={simulateState === 'processing' || simulateState === 'approved'}
                              className="w-full flex items-center justify-center gap-2 py-2.5"
                            >
                              {simulateState === 'processing' ? (
                                <>
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>Authorizing with Gateway...</span>
                                </>
                              ) : simulateState === 'approved' ? (
                                <>
                                  <CheckCircle2 className="w-4 h-4 text-emerald-300" />
                                  <span>Payment Authorized</span>
                                </>
                              ) : (
                                <>
                                  <CreditCard className="w-4 h-4" />
                                  <span>
                                    Authorize Payment (Rs. {grandTotal.toFixed(2)})
                                  </span>
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* OPTION 3: Reward Points */}
                    <div
                      id="payment-option-reward-points"
                      onClick={() => setPaymentMethod('reward_points')}
                      className={`border rounded-2xl p-5 cursor-pointer transition-all ${
                        paymentMethod === 'reward_points'
                          ? 'border-ink-950 bg-sand-50/40 shadow-sm'
                          : 'border-sand-200 hover:border-sand-300'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex items-start gap-3.5">
                          <div
                            className={`w-5 h-5 rounded-full border flex items-center justify-center mt-0.5 transition-colors ${
                              paymentMethod === 'reward_points'
                                ? 'border-ink-950 bg-ink-950'
                                : 'border-sand-300 bg-white'
                            }`}
                          >
                            {paymentMethod === 'reward_points' && (
                              <div className="w-2 h-2 rounded-full bg-white" />
                            )}
                          </div>
                          <div>
                            <div className="flex items-center gap-2">
                              <Sparkles className="w-4 h-4 text-amber-500" />
                              <span className="font-display font-bold text-ink-950 text-base">
                                Pay with Reward Points Wallet
                              </span>
                            </div>
                            <p className="text-xs text-ink-600 mt-1">
                              Use your accumulated customer reward points balance to pay the entire order total instantly.
                            </p>
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <span className="text-xs font-bold text-amber-700 px-2.5 py-1 bg-amber-50 border border-amber-200 rounded-full inline-flex items-center gap-1">
                            <Coins className="w-3 h-3" />
                            {walletBalance !== null ? `${walletBalance.toLocaleString()} pts` : 'Checking...'}
                          </span>
                        </div>
                      </div>

                      {/* Sub-panel when Reward Points is selected */}
                      {paymentMethod === 'reward_points' && (
                        <div
                          onClick={(e) => e.stopPropagation()}
                          className="mt-5 pt-5 border-t border-sand-200 space-y-4"
                        >
                          <div className="bg-white rounded-xl border border-sand-200 p-4 space-y-3">
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-ink-600">Your Current Balance:</span>
                              <strong className="text-ink-950">
                                {walletBalance !== null ? `${walletBalance.toLocaleString()} Points` : '...'}
                                {walletBalance !== null && (
                                  <span className="text-ink-500 font-normal ml-1">
                                    (Rs. {(walletBalance / (conversionRate?.pointsPerRupee || 100)).toFixed(2)})
                                  </span>
                                )}
                              </strong>
                            </div>
                            <div className="flex items-center justify-between text-xs">
                              <span className="text-ink-600">Points Required for Order:</span>
                              <strong className="text-ink-950">
                                {pointsRequired.toLocaleString()} Points
                                <span className="text-ink-500 font-normal ml-1">
                                  (Rs. {grandTotal.toFixed(2)})
                                </span>
                              </strong>
                            </div>
                            <div className="border-t border-sand-100 pt-2 flex items-center justify-between text-xs">
                              <span className="text-ink-600">Conversion Rate:</span>
                              <span className="text-ink-500 font-mono">
                                {(conversionRate?.pointsPerRupee || 100)} Points = Rs. 1.00
                                <span className="text-[11px] text-ink-400 ml-1">
                                  (1 pt = Rs. {(conversionRate?.pointValue || 0.01).toFixed(4)})
                                </span>
                              </span>
                            </div>
                          </div>

                          {/* Sufficient or Insufficient Alert */}
                          {walletLoading ? (
                            <div className="p-3 bg-sand-50 border border-sand-200 rounded-xl flex items-center gap-2 text-xs text-ink-600">
                              <RefreshCw className="w-4 h-4 animate-spin text-ink-600" />
                              <span>Loading wallet balance...</span>
                            </div>
                          ) : !walletActive ? (
                            <div className="p-3 bg-red-50 border border-red-200 rounded-xl flex items-center gap-2 text-xs text-red-700">
                              <AlertCircle className="w-4 h-4 flex-shrink-0" />
                              <span>Your reward wallet is deactivated. Please contact customer support.</span>
                            </div>
                          ) : (walletBalance ?? 0) < pointsRequired ? (
                            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl space-y-1 text-xs text-amber-900">
                              <div className="font-bold flex items-center gap-1.5">
                                <AlertTriangle className="w-4 h-4 text-amber-600 flex-shrink-0" />
                                <span>Insufficient Reward Points Balance</span>
                              </div>
                              <p>
                                You need {pointsRequired.toLocaleString()} points to cover this order, but currently have {(walletBalance ?? 0).toLocaleString()} points (shortfall of {(pointsRequired - (walletBalance ?? 0)).toLocaleString()} points).
                              </p>
                            </div>
                          ) : (
                            <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-xl space-y-1 text-xs text-emerald-900">
                              <div className="font-bold flex items-center gap-1.5">
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                                <span>You have enough points to pay for this order!</span>
                              </div>
                              <p>
                                Click the button below to deduct {pointsRequired.toLocaleString()} points from your wallet and instantly confirm your order.
                              </p>
                            </div>
                          )}

                          {/* Pay with Points Button */}
                          <div className="pt-2 flex justify-end">
                            <Button
                              id="btn-pay-points"
                              type="button"
                              variant="primary"
                              onClick={handlePayWithWallet}
                              disabled={
                                walletLoading ||
                                !walletActive ||
                                (walletBalance ?? 0) < pointsRequired ||
                                payingWithPoints ||
                                !createdOrderId
                              }
                              className="w-full sm:w-auto inline-flex items-center justify-center gap-2"
                            >
                              {payingWithPoints ? (
                                <>
                                  <RefreshCw className="w-4 h-4 animate-spin" />
                                  <span>Processing Points Payment...</span>
                                </>
                              ) : (
                                <>
                                  <Sparkles className="w-4 h-4 text-amber-300" />
                                  <span>Pay Rs. {grandTotal.toFixed(2)} with Points</span>
                                </>
                              )}
                            </Button>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 5: CONFIRMATION */}
            {currentStep === 5 && (
              <div className="space-y-6">
                {/* Hero Status Card */}
                {(() => {
                  const method = submittedPayment?.method || (createdOrder?.pointsPaid ? 'reward_points' : paymentMethod);
                  const isPoints = method === 'reward_points';
                  const isSimulated = method === 'simulated_online';
                  const isBank = method === 'bank_transfer';
                  const pointsUsedCount = submittedPayment?.pointsUsed || createdOrder?.pointsPaid || (createdOrder ? Math.ceil(createdOrder.total / 0.01) : 0);

                  return (
                    <div className="bg-white rounded-2xl border border-sand-200 p-6 sm:p-8 shadow-sm text-center space-y-5">
                      <div
                        className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto ${
                          isBank
                            ? 'bg-amber-100 text-amber-700 ring-8 ring-amber-50'
                            : 'bg-emerald-100 text-emerald-700 ring-8 ring-emerald-50'
                        }`}
                      >
                        {isBank ? (
                          <Clock className="w-8 h-8 text-amber-600" />
                        ) : isPoints ? (
                          <Coins className="w-8 h-8 text-emerald-600" />
                        ) : (
                          <CheckCircle2 className="w-8 h-8 text-emerald-600" />
                        )}
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-center gap-2">
                          <span
                            className={`text-xs font-semibold px-3 py-1 rounded-full uppercase tracking-wider ${
                              isBank
                                ? 'bg-amber-100 text-amber-800 border border-amber-200'
                                : 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            }`}
                          >
                            {isBank
                              ? 'Under Review'
                              : isPoints
                              ? 'Confirmed - Paid with Reward Points'
                              : 'Confirmed'}
                          </span>
                        </div>

                        <h2 className="text-2xl sm:text-3xl font-display font-bold text-ink-950">
                          {isBank ? 'Payment Under Review' : 'Order Confirmed!'}
                        </h2>

                        <p className="text-sm text-ink-600 max-w-xl mx-auto leading-relaxed">
                          {isBank
                            ? 'Your bank transfer receipt was received and is currently under review by our operations team. You will receive an email confirmation once verified.'
                            : isPoints
                            ? `Your order was paid in full using ${pointsUsedCount.toLocaleString()} reward points and is now confirmed. No further payment is needed.`
                            : `Your simulated card payment (•••• ${submittedPayment?.maskedCardLast4 || '4242'}) was authorized successfully. We have received your order and are preparing your shipment.`}
                        </p>
                      </div>

                      {createdOrder && (
                        <div className="flex flex-wrap items-center justify-center gap-3 pt-2 text-xs">
                          <div className="bg-sand-100 border border-sand-200 px-3.5 py-1.5 rounded-lg font-mono font-bold text-ink-950">
                            Order #{createdOrder.orderNumber || createdOrder._id.slice(-8).toUpperCase()}
                          </div>
                          {submittedPayment?.transactionId && submittedPayment.transactionId !== 'declined' && (
                            <div className="bg-sand-50 border border-sand-200 px-3 py-1.5 rounded-lg font-mono text-ink-600 text-[11px]">
                              TXN: {submittedPayment.transactionId}
                            </div>
                          )}
                          <div className="bg-sand-50 border border-sand-200 px-3 py-1.5 rounded-lg text-ink-600">
                            Status: <span className="font-semibold text-ink-900 capitalize">{createdOrder.status.replace('_', ' ')}</span>
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Purchased Items Section */}
                {createdOrder && createdOrder.items && createdOrder.items.length > 0 && (
                  <div className="bg-white rounded-2xl border border-sand-200 p-6 shadow-sm space-y-4">
                    <div className="flex items-center justify-between pb-3 border-b border-sand-100">
                      <div className="flex items-center gap-2">
                        <Package className="w-5 h-5 text-ink-700" />
                        <h3 className="font-display font-bold text-ink-950 text-base">
                          Purchased Items ({createdOrder.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 0})
                        </h3>
                      </div>
                      <span className="text-xs text-ink-500 font-medium">Standard Delivery</span>
                    </div>

                    <div className="divide-y divide-sand-100">
                      {createdOrder.items.map((item, idx) => (
                        <div key={idx} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3.5 min-w-0">
                            {item.image ? (
                              <img
                                src={item.image}
                                alt={item.name}
                                className="w-14 h-14 object-cover rounded-xl border border-sand-200 bg-sand-50 flex-shrink-0"
                              />
                            ) : (
                              <div className="w-14 h-14 rounded-xl border border-sand-200 bg-sand-50 flex items-center justify-center flex-shrink-0 text-ink-400">
                                <ShoppingBag className="w-6 h-6" />
                              </div>
                            )}
                            <div className="min-w-0">
                              <h4 className="text-sm font-semibold text-ink-950 truncate">
                                {item.name}
                              </h4>
                              <div className="flex flex-wrap items-center gap-2 text-xs text-ink-500 mt-0.5">
                                {item.size && <span>Size: <strong className="text-ink-700">{item.size}</strong></span>}
                                {item.size && item.color && <span>•</span>}
                                {item.color && <span>Color: <strong className="text-ink-700">{item.color}</strong></span>}
                                <span>•</span>
                                <span>Qty: <strong className="text-ink-700">{item.quantity}</strong></span>
                              </div>
                            </div>
                          </div>

                          <div className="text-right flex-shrink-0">
                            <span className="text-sm font-bold text-ink-950">
                              Rs. {((item.lineTotal ?? (item.unitPrice * item.quantity)) || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                            </span>
                            {item.quantity > 1 && (
                              <p className="text-[11px] text-ink-500">
                                Rs. {(item.unitPrice || 0).toLocaleString(undefined, { minimumFractionDigits: 2 })} each
                              </p>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Delivery & Payment Details Grid */}
                {createdOrder && (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {/* Delivery Address Card */}
                    <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-3">
                      <div className="flex items-center gap-2 text-ink-800 font-semibold text-sm">
                        <MapPin className="w-4 h-4 text-ink-600" />
                        <span>Delivery Address</span>
                      </div>
                      <div className="text-xs text-ink-600 space-y-1 pl-6">
                        <p className="font-semibold text-ink-950 text-sm">{user?.name || 'Customer'}</p>
                        <p>{createdOrder.shippingAddress?.line1}</p>
                        {createdOrder.shippingAddress?.line2 && <p>{createdOrder.shippingAddress.line2}</p>}
                        <p>
                          {createdOrder.shippingAddress?.city}, {createdOrder.shippingAddress?.province || ''} {createdOrder.shippingAddress?.postalCode}
                        </p>
                        <p>{createdOrder.shippingAddress?.country}</p>
                      </div>
                    </div>

                    {/* Payment Summary Card */}
                    <div className="bg-white rounded-2xl border border-sand-200 p-5 shadow-sm space-y-3">
                      <div className="flex items-center gap-2 text-ink-800 font-semibold text-sm">
                        <CreditCard className="w-4 h-4 text-ink-600" />
                        <span>Payment Breakdown</span>
                      </div>
                      <div className="space-y-1.5 text-xs text-ink-600 pl-6">
                        <div className="flex justify-between">
                          <span>Subtotal:</span>
                          <span className="font-medium text-ink-900">
                            Rs. {(createdOrder.subtotal ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                          </span>
                        </div>
                        {((createdOrder.discountTotal ?? createdOrder.discountAmount ?? 0) > 0) && (
                          <div className="flex justify-between text-emerald-700 font-semibold">
                            <span>Discount:</span>
                            <span>-Rs. {(createdOrder.discountTotal ?? createdOrder.discountAmount ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                          </div>
                        )}
                        <div className="flex justify-between">
                          <span>Shipping:</span>
                          <span className="font-medium text-ink-900">
                            {(createdOrder.shippingFee ?? 0) === 0 ? 'FREE' : `Rs. ${(createdOrder.shippingFee ?? 0).toFixed(2)}`}
                          </span>
                        </div>
                        <div className="border-t border-sand-200 pt-2 flex justify-between font-bold text-sm text-ink-950">
                          <span>Total:</span>
                          <span>Rs. {(createdOrder.total ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                        </div>
                        <div className="pt-1.5 text-[11px] text-ink-500">
                          Method:{' '}
                          <strong className="text-ink-800 capitalize">
                            {submittedPayment?.method === 'reward_points'
                              ? 'Reward Points'
                              : submittedPayment?.method === 'simulated_online'
                              ? `Online Card (•••• ${submittedPayment.maskedCardLast4 || '4242'})`
                              : 'Bank Transfer'}
                          </strong>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Actions Bar */}
                <div className="bg-sand-50/70 rounded-2xl border border-sand-200 p-5 flex flex-col sm:flex-row items-center justify-between gap-3">
                  <div className="flex flex-wrap items-center gap-2.5 w-full sm:w-auto">
                    {createdOrder && (
                      <Link to={`/orders/${createdOrder._id}`} className="w-full sm:w-auto">
                        <Button variant="primary" className="w-full sm:w-auto inline-flex items-center justify-center gap-2">
                          <FileText className="w-4 h-4" />
                          <span>View Order Details</span>
                        </Button>
                      </Link>
                    )}
                    {createdOrder && (
                      <Link to={`/orders/${createdOrder._id}/invoice`} className="w-full sm:w-auto">
                        <Button
                          variant="secondary"
                          className="w-full sm:w-auto inline-flex items-center justify-center gap-2"
                        >
                          <Download className="w-4 h-4" />
                          <span>View & Download Invoice</span>
                        </Button>
                      </Link>
                    )}
                  </div>

                  <Link to="/" className="w-full sm:w-auto">
                    <Button variant="secondary" className="w-full sm:w-auto inline-flex items-center justify-center gap-2">
                      <ArrowLeft className="w-4 h-4" />
                      <span>Continue Shopping</span>
                    </Button>
                  </Link>
                </div>
              </div>
            )}

            {/* Step Navigation Actions */}
            {currentStep < 5 && (
              <div className="flex flex-col-reverse sm:flex-row items-center justify-between gap-4 pt-2">
                <Button
                  variant="secondary"
                  onClick={handleBackStep}
                  className="w-full sm:w-auto inline-flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>
                    {currentStep === 1
                      ? 'Return to Shopping Bag'
                      : currentStep === 2
                      ? 'Back to Bag Summary'
                      : currentStep === 3
                      ? 'Back to Delivery Address'
                      : 'Previous Step'}
                  </span>
                </Button>

                <div className="flex flex-col items-end gap-1.5 w-full sm:w-auto">
                  <Button
                    variant="primary"
                    onClick={handleNextStep}
                    disabled={isNextBlocked || currentStep === 5}
                    className="w-full sm:w-auto min-w-[200px] justify-center inline-flex items-center gap-2 shadow-md"
                  >
                    <span>{nextButtonLabel}</span>
                    <ArrowRight className="w-4 h-4" />
                  </Button>

                  {/* Explanatory notice when Next is disabled */}
                  {isNextBlocked && nextButtonBlockedMessage && (
                    <p className="text-[11px] text-danger font-medium flex items-center gap-1">
                      <Info className="w-3 h-3 flex-shrink-0" />
                      <span>{nextButtonBlockedMessage}</span>
                    </p>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Sticky Order Summary Sidebar */}
          <div className="lg:col-span-4 lg:sticky lg:top-24 space-y-6">
            <div className="bg-white rounded-2xl border border-sand-200 p-6 shadow-sm space-y-5">
              <h2 className="font-display text-lg font-bold text-ink-950 pb-3 border-b border-sand-200">
                Order Summary
              </h2>

              <div className="space-y-3 text-xs sm:text-sm">
                <div className="flex justify-between text-ink-600">
                  <span>Items Subtotal ({createdOrder ? (createdOrder.items?.reduce((s, i) => s + (i.quantity || 1), 0) || 0) : totalItems})</span>
                  <span className="font-semibold text-ink-950">
                    Rs. {effectiveSubtotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {(appliedCoupon || (createdOrder && (createdOrder.discountTotal ?? createdOrder.discountAmount ?? 0) > 0)) && (
                  <div className="flex justify-between text-emerald-700 text-xs sm:text-sm font-semibold">
                    <span className="flex items-center gap-1.5">
                      <Tag className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                      Promo ({createdOrder?.coupon?.code || appliedCoupon?.code || 'Applied'})
                    </span>
                    <span>
                      -Rs. {discountAmount.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                  </div>
                )}

                <div className="flex justify-between text-ink-600">
                  <span>Estimated Delivery</span>
                  <span className="font-semibold text-ink-950">
                    {shippingFee === 0 ? (
                      <span className="text-emerald-700 font-bold">FREE (Over Rs. 1,500)</span>
                    ) : (
                      `Rs. ${shippingFee.toFixed(2)}`
                    )}
                  </span>
                </div>

                <div className="border-t border-sand-200 pt-3 flex justify-between text-base font-bold text-ink-950">
                  <span>Estimated Total</span>
                  <span>
                    Rs. {grandTotal.toLocaleString(undefined, { minimumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Selected Shipping Destination Preview */}
                {selectedAddress && (
                  <div className="pt-3 border-t border-sand-200 space-y-1">
                    <div className="flex items-center justify-between text-xs text-ink-500 font-semibold uppercase tracking-wider">
                      <span>Delivery Destination</span>
                      {currentStep !== 2 && (
                        <button
                          type="button"
                          onClick={() => setCurrentStep(2)}
                          className="text-ink-900 hover:underline capitalize font-bold"
                        >
                          Change
                        </button>
                      )}
                    </div>
                    <p className="text-xs font-bold text-ink-950">
                      {selectedAddress.label} — {selectedAddress.line1}
                    </p>
                    <p className="text-[11px] text-ink-600">
                      {selectedAddress.city}, {selectedAddress.province} {selectedAddress.postalCode}
                    </p>
                    <p className="text-[11px] text-ink-500">{selectedAddress.country}</p>
                  </div>
                )}
              </div>

              {/* Guarantees */}
              <div className="space-y-2.5 pt-2 border-t border-sand-100 text-[11px] text-ink-600">
                <div className="flex items-start gap-2">
                  <ShieldCheck className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>Real-time warehouse inventory locked upon order placement.</span>
                </div>
                <div className="flex items-start gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0 mt-0.5" />
                  <span>Supports Bank Slip, Simulated Online, & Reward Points (P42).</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
