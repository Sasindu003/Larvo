import React from 'react';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Payment } from '../../services/order.service';
import { SimulateState } from './types';

interface CardSimulatePaymentProps {
  grandTotal: number;
  simulateState: SimulateState;
  setSimulateState: (state: SimulateState) => void;
  cardNumber: string;
  cardExpiry: string;
  cardCvv: string;
  cardName: string;
  setCardName: (name: string) => void;
  cardError: string | null;
  setCardError: (err: string | null) => void;
  submittedPayment: Payment | null;
  fillSuccessCard: () => void;
  fillDeclineCard: () => void;
  handleCardNumberChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCardExpiryChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleCardCvvChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleSimulatePayment: () => Promise<void>;
}

export const CardSimulatePayment: React.FC<CardSimulatePaymentProps> = ({
  grandTotal,
  simulateState,
  setSimulateState,
  cardNumber,
  cardExpiry,
  cardCvv,
  cardName,
  setCardName,
  cardError,
  setCardError,
  submittedPayment,
  fillSuccessCard,
  fillDeclineCard,
  handleCardNumberChange,
  handleCardExpiryChange,
  handleCardCvvChange,
  handleSimulatePayment,
}) => {
  return (
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
  );
};
