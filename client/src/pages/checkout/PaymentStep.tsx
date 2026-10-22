import React from 'react';
import {
  CreditCard,
  Building2,
  Sparkles,
  Coins,
} from 'lucide-react';
import { Order } from '../../services/order.service';
import { PaymentMethod } from './types';
import { BankTransferPayment } from './BankTransferPayment';
import { CardSimulatePayment } from './CardSimulatePayment';
import { RewardPointsPayment } from './RewardPointsPayment';
import { useCheckoutPayment } from './useCheckoutPayment';

interface PaymentStepProps {
  payment: ReturnType<typeof useCheckoutPayment>;
  createdOrder: Order | null;
  grandTotal: number;
  pointsRequired: number;
}

export const PaymentStep: React.FC<PaymentStepProps> = ({
  payment,
  createdOrder,
  grandTotal,
  pointsRequired,
}) => {
  const {
    paymentMethod,
    setPaymentMethod,
    slipFile,
    setSlipFile,
    slipPreviewUrl,
    setSlipPreviewUrl,
    uploadProgress,
    uploadState,
    setUploadState,
    uploadError,
    createdOrderId,
    handleFileChange,
    handleUploadSlip,
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
    walletBalance,
    walletLoading,
    walletActive,
    conversionRate,
    payingWithPoints,
    handlePayWithWallet,
  } = payment;

  return (
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

            {paymentMethod === 'bank_transfer' && (
              <BankTransferPayment
                grandTotal={grandTotal}
                slipFile={slipFile}
                setSlipFile={setSlipFile}
                slipPreviewUrl={slipPreviewUrl}
                setSlipPreviewUrl={setSlipPreviewUrl}
                uploadProgress={uploadProgress}
                uploadState={uploadState}
                setUploadState={setUploadState}
                uploadError={uploadError}
                createdOrderId={createdOrderId}
                handleFileChange={handleFileChange}
                handleUploadSlip={handleUploadSlip}
              />
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
              <CardSimulatePayment
                grandTotal={grandTotal}
                simulateState={simulateState}
                setSimulateState={setSimulateState}
                cardNumber={cardNumber}
                cardExpiry={cardExpiry}
                cardCvv={cardCvv}
                cardName={cardName}
                setCardName={setCardName}
                cardError={cardError}
                setCardError={setCardError}
                submittedPayment={submittedPayment}
                fillSuccessCard={fillSuccessCard}
                fillDeclineCard={fillDeclineCard}
                handleCardNumberChange={handleCardNumberChange}
                handleCardExpiryChange={handleCardExpiryChange}
                handleCardCvvChange={handleCardCvvChange}
                handleSimulatePayment={handleSimulatePayment}
              />
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

            {paymentMethod === 'reward_points' && (
              <RewardPointsPayment
                grandTotal={grandTotal}
                walletBalance={walletBalance}
                walletLoading={walletLoading}
                walletActive={walletActive}
                pointsRequired={pointsRequired}
                conversionRate={conversionRate}
                payingWithPoints={payingWithPoints}
                createdOrderId={createdOrderId}
                handlePayWithWallet={handlePayWithWallet}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
