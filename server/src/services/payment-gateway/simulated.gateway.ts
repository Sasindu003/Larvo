import { randomUUID } from 'crypto';
import { AppError } from '../../utils/AppError';
import {
  PaymentGateway,
  PaymentGatewayAuthorizeInput,
  PaymentGatewayAuthorizeResult,
} from './types';

export class SimulatedPaymentGateway implements PaymentGateway {
  async authorize(
    input: PaymentGatewayAuthorizeInput
  ): Promise<PaymentGatewayAuthorizeResult> {
    if (input.token === 'tok_test_success') {
      return {
        approved: true,
        transactionId: randomUUID(),
        responseCode: '00_success',
        last4: '4242',
      };
    }

    if (input.token === 'tok_test_decline') {
      return {
        approved: false,
        transactionId: 'declined',
        responseCode: 'card_declined',
        last4: '0002',
      };
    }

    throw new AppError('Invalid test scenario token', 400, 'invalid_test_token');
  }
}
