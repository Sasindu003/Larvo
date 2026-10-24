export interface PaymentGatewayAuthorizeInput {
  orderId: string;
  amount: number;
  currency: string;
  token: string;
}

export interface PaymentGatewayAuthorizeResult {
  approved: boolean;
  transactionId: string;
  responseCode: string;
  last4?: string;
}

export interface PaymentGateway {
  authorize(input: PaymentGatewayAuthorizeInput): Promise<PaymentGatewayAuthorizeResult>;
}
