import React from 'react';
import { CheckCircle2 } from 'lucide-react';
import { CHECKOUT_STEPS } from './constants';
import { CheckoutStep } from './types';

interface CheckoutProgressBarProps {
  currentStep: CheckoutStep;
  onStepClick: (stepId: CheckoutStep) => void;
}

export const CheckoutProgressBar: React.FC<CheckoutProgressBarProps> = ({
  currentStep,
  onStepClick,
}) => {
  return (
    <div className="bg-white rounded-2xl border border-sand-200 p-4 sm:p-6 mb-8 shadow-sm">
      <nav aria-label="Checkout Progress">
        <ol className="flex items-center justify-between relative">
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
                    if (step.id < currentStep && currentStep < 5) onStepClick(step.id);
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
  );
};
