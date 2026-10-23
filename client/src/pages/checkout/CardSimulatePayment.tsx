import React from 'react';
import {
  CreditCard,
  CheckCircle2,
  AlertCircle,
  Loader2,
  XCircle,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { Payment } from '../../services/order.service';
import { SimulateState } from './types';

interface CardSimulatePaymentProps {
  grandTotal: number;
  simulateState: SimulateState;
  setSimulateState: (state: SimulateState) => void;
  cardError: string | null;
  setCardError: (err: string | null) => void;
  submittedPayment: Payment | null;
  handleSimulatePayment: (token: 'tok_test_success' | 'tok_test_decline') => Promise<void>;
}

export const CardSimulatePayment: React.FC<CardSimulatePaymentProps> = ({
  grandTotal,
  simulateState,
  setSimulateState,
  cardError,
  submittedPayment,
  handleSimulatePayment,
}) => {
  const isProcessing = simulateState === 'processing';
  const isApproved = simulateState === 'approved';

  return (
    <div
      className="mt-5 pt-5 border-t border-sand-200/80 space-y-4"
      onClick={(e) => e.stopPropagation()}
    >
      <div className="bg-sand-50/60 p-4 rounded-xl border border-sand-200 space-y-4">
        <div>
          <h4 className="text-sm font-semibold text-ink-900 flex items-center gap-2">
            <CreditCard className="w-4 h-4 text-ink-700" />
            Simulated Test Card Scenarios
          </h4>
          <p className="text-xs text-ink-600 mt-1">
            Choose a non-sensitive test scenario to simulate gateway authorization. No raw card data is collected or sent to the server.
          </p>
        </div>

        {/* Scenario Action Buttons */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Button
            id="btn-simulate-approve"
            type="button"
            onClick={() => handleSimulatePayment('tok_test_success')}
            disabled={isProcessing || isApproved}
            className="flex items-center justify-center gap-2 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white font-medium"
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Authorizing...</span>
              </>
            ) : isApproved ? (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Authorized</span>
              </>
            ) : (
              <>
                <CheckCircle2 className="w-4 h-4" />
                <span>Pay with test card (approve)</span>
              </>
            )}
          </Button>

          <Button
            id="btn-simulate-decline"
            type="button"
            variant="secondary"
            onClick={() => handleSimulatePayment('tok_test_decline')}
            disabled={isProcessing || isApproved}
            className="flex items-center justify-center gap-2 py-2.5 border-rose-300 text-rose-700 hover:bg-rose-50 font-medium"
          >
            <XCircle className="w-4 h-4 text-rose-600" />
            <span>Pay with test card (decline)</span>
          </Button>
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
              <p>Card: •••• {submittedPayment?.maskedCardLast4 || '4242'}</p>
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
              <p>The simulated bank declined authorization for card {submittedPayment?.maskedCardLast4 || '0002'}.</p>
              <p className="pt-1 text-rose-900 font-medium">
                Click &quot;Pay with test card (approve)&quot; above to switch to an authorized test card and retry.
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
      </div>
    </div>
  );
};
