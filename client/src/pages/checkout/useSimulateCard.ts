import { useState } from 'react';
import toast from 'react-hot-toast';
import { orderService, Order, Payment } from '../../services/order.service';
import { SimulateState } from './types';

export function useSimulateCard(
  getOrderId: () => Promise<string | null>,
  onSuccess: (order: Order, payment: Payment) => void
) {
  const [simulateState, setSimulateState] = useState<SimulateState>('idle');
  const [cardError, setCardError] = useState<string | null>(null);

  const handleSimulatePayment = async (token: 'tok_test_success' | 'tok_test_decline') => {
    const orderId = await getOrderId();
    if (!orderId) return;

    setSimulateState('processing');
    setCardError(null);

    try {
      const res = await orderService.simulatePayment(orderId, { token });

      onSuccess(res.order, res.payment);

      if (res.approved) {
        setSimulateState('approved');
        toast.success('Simulated payment approved! Click "Complete Order" to finish.');
      } else {
        setSimulateState('declined');
        setCardError('Transaction declined: Test card 4000...0002 triggered a simulated decline. You can retry with a valid card.');
        toast.error('Payment declined by card simulator');
      }
    } catch (err: unknown) {
      setSimulateState('error');
      const errObj = err as { response?: { data?: { message?: string } }; message?: string };
      const msg = errObj.response?.data?.message || errObj.message || 'Payment simulation failed';
      setCardError(msg);
      toast.error(msg);
    }
  };

  return {
    simulateState,
    setSimulateState,
    cardError,
    setCardError,
    handleSimulatePayment,
  };
}
