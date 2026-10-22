import React from 'react';
import {
  RefreshCw,
  AlertCircle,
  AlertTriangle,
  CheckCircle2,
  Sparkles,
} from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { ConversionRate } from './types';

interface RewardPointsPaymentProps {
  grandTotal: number;
  walletBalance: number | null;
  walletLoading: boolean;
  walletActive: boolean;
  pointsRequired: number;
  conversionRate: ConversionRate;
  payingWithPoints: boolean;
  createdOrderId: string | null;
  handlePayWithWallet: () => Promise<void>;
}

export const RewardPointsPayment: React.FC<RewardPointsPaymentProps> = ({
  grandTotal,
  walletBalance,
  walletLoading,
  walletActive,
  pointsRequired,
  conversionRate,
  payingWithPoints,
  createdOrderId,
  handlePayWithWallet,
}) => {
  return (
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
  );
};
