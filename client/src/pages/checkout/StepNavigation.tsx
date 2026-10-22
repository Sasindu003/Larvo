import React from 'react';
import { ArrowLeft, ArrowRight, Info } from 'lucide-react';
import { Button } from '../../components/ui/Button';
import { CheckoutStep } from './types';

interface StepNavigationProps {
  currentStep: CheckoutStep;
  isNextBlocked: boolean;
  nextButtonLabel: string;
  nextButtonBlockedMessage: string;
  handleBackStep: () => void;
  handleNextStep: () => Promise<void>;
}

export const StepNavigation: React.FC<StepNavigationProps> = ({
  currentStep,
  isNextBlocked,
  nextButtonLabel,
  nextButtonBlockedMessage,
  handleBackStep,
  handleNextStep,
}) => {
  if (currentStep >= 5) return null;

  return (
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

        {isNextBlocked && nextButtonBlockedMessage && (
          <p className="text-[11px] text-danger font-medium flex items-center gap-1">
            <Info className="w-3 h-3 flex-shrink-0" />
            <span>{nextButtonBlockedMessage}</span>
          </p>
        )}
      </div>
    </div>
  );
};
