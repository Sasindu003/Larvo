import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, ShieldCheck } from 'lucide-react';
import {
  useCheckout,
  CheckoutProgressBar,
  BagSummaryStep,
  AddressStep,
  CouponStep,
  PaymentStep,
  ConfirmationStep,
  StepNavigation,
  OrderSummary,
  CheckoutStep,
} from './checkout';

export type { CheckoutStep };

export const CheckoutPage: React.FC = () => {
  const {
    items,
    totalItems,
    updateQuantity,
    removeItem,
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
  } = useCheckout();

  if (!shouldRender) {
    return null;
  }

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
        <CheckoutProgressBar
          currentStep={currentStep}
          onStepClick={(stepId) => setCurrentStep(stepId)}
        />

        {/* Main Content Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Main Step Body */}
          <div className="lg:col-span-8 space-y-6">
            {currentStep === 1 && (
              <BagSummaryStep
                items={items}
                totalItems={totalItems}
                validating={inventory.validating}
                hasValidated={inventory.hasValidated}
                validationResults={inventory.validationResults}
                unavailableItems={inventory.unavailableItems}
                runValidation={inventory.runValidation}
                updateQuantity={updateQuantity}
                removeItem={removeItem}
              />
            )}

            {currentStep === 2 && (
              <AddressStep
                addresses={address.addresses}
                selectedAddressId={address.selectedAddressId}
                setSelectedAddressId={address.setSelectedAddressId}
                isAddingAddress={address.isAddingAddress}
                setIsAddingAddress={address.setIsAddingAddress}
                addressLoading={address.addressLoading}
                addressForm={address.addressForm}
                setAddressForm={address.setAddressForm}
                handleSaveAddress={address.handleSaveAddress}
              />
            )}

            {currentStep === 3 && (
              <CouponStep
                appliedCoupon={coupon.appliedCoupon}
                promoCodeInput={coupon.promoCodeInput}
                setPromoCodeInput={coupon.setPromoCodeInput}
                validatingPromo={coupon.validatingPromo}
                promoError={coupon.promoError}
                setPromoError={coupon.setPromoError}
                handleApplyCoupon={coupon.handleApplyCoupon}
                handleRemoveCoupon={coupon.handleRemoveCoupon}
              />
            )}

            {currentStep === 4 && (
              <PaymentStep
                payment={payment}
                createdOrder={payment.createdOrder}
                grandTotal={grandTotal}
                pointsRequired={pointsRequired}
              />
            )}

            {currentStep === 5 && (
              <ConfirmationStep
                createdOrder={payment.createdOrder}
                submittedPayment={payment.submittedPayment}
                paymentMethod={payment.paymentMethod}
                userName={user?.name}
              />
            )}

            <StepNavigation
              currentStep={currentStep}
              isNextBlocked={isNextBlocked}
              nextButtonLabel={nextButtonLabel}
              nextButtonBlockedMessage={nextButtonBlockedMessage}
              handleBackStep={handleBackStep}
              handleNextStep={handleNextStep}
            />
          </div>

          {/* Sticky Order Summary Sidebar */}
          <OrderSummary
            createdOrder={payment.createdOrder}
            totalItems={totalItems}
            effectiveSubtotal={effectiveSubtotal}
            appliedCoupon={coupon.appliedCoupon}
            discountAmount={discountAmount}
            shippingFee={shippingFee}
            grandTotal={grandTotal}
            selectedAddress={address.selectedAddress}
            currentStep={currentStep}
            setCurrentStep={setCurrentStep}
          />
        </div>
      </div>
    </div>
  );
};

export default CheckoutPage;
