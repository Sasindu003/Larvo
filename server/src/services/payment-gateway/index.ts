import { env } from '../../config/env';
import { AppError } from '../../utils/AppError';
import { PaymentGateway } from './types';
import { SimulatedPaymentGateway } from './simulated.gateway';

export * from './types';
export * from './simulated.gateway';

export function getPaymentGateway(): PaymentGateway {
  if (!env.PAYMENT_SIMULATOR_ENABLED) {
    throw new AppError('Payment simulator gateway is disabled', 404, 'gateway_disabled');
  }
  return new SimulatedPaymentGateway();
}
