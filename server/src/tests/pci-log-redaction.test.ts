/// <reference types="jest" />
import pino from 'pino';
import { Writable } from 'stream';
import { Request, Response } from 'express';
import { errorSerializer } from '../utils/logger';
import { errorHandler } from '../middleware/errorHandler';

describe('PCI04: Log Redaction & Error Sanitization', () => {
  describe('Pino Logger Sensitive Field Redaction', () => {
    // Redaction paths mirroring server/src/utils/logger.ts
    const redactPaths = [
      'req.headers.cookie',
      'req.headers.authorization',
      'headers.cookie',
      'headers.authorization',
      'cookie',
      'authorization',
      '*.password',
      '*.passwordHash',
      '*.token',
      'password',
      'passwordHash',
      'token',
      'req.body',
      'body.cardNumber',
      'body.cvv',
      'body.cvc',
      'body.expiry',
      'body.cardholderName',
      'body.token',
      '*.cardNumber',
      '*.cvv',
      '*.cvc',
      '*.expiry',
      '*.cardholderName',
      '*.slipImageUrl',
    ];

    it('redacts request body and nested cardholder data using [Redacted] censor', () => {
      let logOutput = '';
      const destination = new Writable({
        write(chunk, _encoding, callback) {
          logOutput += chunk.toString();
          callback();
        },
      });

      const testLogger = pino(
        {
          level: 'info',
          redact: {
            paths: redactPaths,
            censor: '[Redacted]',
          },
          serializers: {
            err: errorSerializer,
            error: errorSerializer,
          },
        },
        destination
      );

      const requestPayload = {
        token: 'tok_top_level_token_123',
        body: {
          cardNumber: '4000000000000002',
          cvv: '123',
          cvc: '123',
          expiry: '01/29',
          cardholderName: 'Jane Doe',
          token: 'tok_inner_token',
        },
        req: {
          body: {
            sensitiveOperation: true,
            cardNumber: '4242424242424242',
          },
        },
      };

      testLogger.info(requestPayload, 'Testing request-like body and nested cardholder redaction');

      // Assert censor appears in log output
      expect(logOutput).toContain('[Redacted]');

      // Assert token at root and all fields under body and req.body are redacted
      expect(logOutput).not.toContain('tok_top_level_token_123');
      expect(logOutput).not.toContain('4000000000000002');
      expect(logOutput).not.toContain('123');
      expect(logOutput).not.toContain('01/29');
      expect(logOutput).not.toContain('Jane Doe');
      expect(logOutput).not.toContain('tok_inner_token');
      expect(logOutput).not.toContain('4242424242424242');
    });

    /**
     * DEFECT REPORT (PCI04 / DEFECT-PCI-01):
     * In server/src/utils/logger.ts, fast-redact wildcard '*.cardNumber' only matches nested
     * properties of objects (e.g. data.cardNumber). Bare root properties (e.g. { cardNumber: '...' })
     * are not redacted unless explicitly specified as root paths ('cardNumber', 'cvv', 'expiry', 'cardholderName')
     * without wildcard prefix.
     * Per PCI04 rule: Do not modify application code; keep assertion strict and mark test.failing.
     */
    test.failing(
      'DEFECT-PCI-01: bare top-level cardholder properties without body/object prefix are redacted by pino logger',
      () => {
        let logOutput = '';
        const destination = new Writable({
          write(chunk, _encoding, callback) {
            logOutput += chunk.toString();
            callback();
          },
        });

        const testLogger = pino(
          {
            level: 'info',
            redact: {
              paths: redactPaths,
              censor: '[Redacted]',
            },
            serializers: {
              err: errorSerializer,
              error: errorSerializer,
            },
          },
          destination
        );

        const bareTopLevelPayload = {
          cardNumber: '4111111111111111',
          cvv: '999',
          cvc: '888',
          expiry: '11/30',
          cardholderName: 'Alice Secret',
          token: 'tok_root_secret',
        };

        testLogger.info(bareTopLevelPayload, 'Testing bare top-level cardholder properties');

        // Root 'token' is in redact paths and gets redacted, but root cardNumber/cvv/expiry/cardholderName are not
        expect(logOutput).not.toContain('4111111111111111');
        expect(logOutput).not.toContain('999');
        expect(logOutput).not.toContain('888');
        expect(logOutput).not.toContain('11/30');
        expect(logOutput).not.toContain('Alice Secret');
      }
    );

    it('errorSerializer defensively strips err.config, err.request, err.response, and attached body', () => {
      const leakyError = {
        name: 'PaymentGatewayNetworkError',
        message: 'Connection timed out to card authorization server',
        code: 'GATEWAY_TIMEOUT',
        stack: 'PaymentGatewayNetworkError: Connection timed out\n    at Object.<anonymous>',
        config: {
          headers: { Authorization: 'Bearer secret_gateway_key' },
          data: '{"cardNumber":"4242424242424242"}',
        },
        request: {
          path: '/v1/charges',
          body: { cardNumber: '4242424242424242', cvv: '123' },
        },
        response: {
          status: 504,
          data: { error: 'Gateway timeout' },
        },
        body: {
          token: 'tok_test_success',
        },
      };

      const serialized = errorSerializer(leakyError);

      expect(serialized.type).toBe('PaymentGatewayNetworkError');
      expect(serialized.message).toBe('Connection timed out to card authorization server');
      expect(serialized.code).toBe('GATEWAY_TIMEOUT');
      expect(serialized.stack).toBeDefined();

      // Assert stripped sensitive properties
      expect((serialized as Record<string, unknown>).config).toBeUndefined();
      expect((serialized as Record<string, unknown>).request).toBeUndefined();
      expect((serialized as Record<string, unknown>).response).toBeUndefined();
      expect((serialized as Record<string, unknown>).body).toBeUndefined();
    });
  });

  describe('Error Response Sanitization', () => {
    it('errorHandler with CastError carrying a card-like value does not echo the value', () => {
      const mockReq = {} as Request;
      let responseStatusCode = 200;
      let responseJson: Record<string, unknown> = {};

      const mockRes = {
        statusCode: 200,
        status(code: number) {
          responseStatusCode = code;
          return this;
        },
        json(payload: Record<string, unknown>) {
          responseJson = payload;
          return this;
        },
      } as unknown as Response;

      const mockNext = jest.fn();

      const cardLikeValue = '4242424242424242';
      const castError = {
        name: 'CastError',
        path: 'orderId',
        value: cardLikeValue,
        message: `Cast to ObjectId failed for value "${cardLikeValue}" (type string) at path "orderId" for model "Order"`,
      };

      errorHandler(castError, mockReq, mockRes, mockNext);

      expect(responseStatusCode).toBe(400);
      expect(responseJson.success).toBe(false);
      expect(responseJson.code).toBe('INVALID_ID');
      expect(responseJson.message).toBe('Invalid orderId');

      // Assert raw card-like input is completely absent from the JSON response
      expect(responseJson.message).not.toContain(cardLikeValue);
      expect(JSON.stringify(responseJson)).not.toContain(cardLikeValue);
    });
  });
});
