import { useState } from 'react';
import toast from 'react-hot-toast';
import { orderService, Order, Payment } from '../../services/order.service';
import { SimulateState } from './types';

export function useSimulateCard(
  getOrderId: () => Promise<string | null>,
  onSuccess: (order: Order, payment: Payment) => void,
) {
  const [simulateState, setSimulateState] = useState<SimulateState>('idle');
  const [cardNumber, setCardNumber] = useState<string>('4242 4242 4242 4242');
  const [cardExpiry, setCardExpiry] = useState<string>('12/28');
  const [cardCvv, setCardCvv] = useState<string>('123');
  const [cardName, setCardName] = useState<string>('Test Cardholder');
  const [cardError, setCardError] = useState<string | null>(null);

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
    const orderId = await getOrderId();
    if (!orderId) return;

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
    cardNumber,
    cardExpiry,
    cardCvv,
    cardName,
    setCardName,
    cardError,
    setCardError,
    handleCardNumberChange,
    handleCardExpiryChange,
    handleCardCvvChange,
    fillSuccessCard,
    fillDeclineCard,
    handleSimulatePayment,
  };
}
