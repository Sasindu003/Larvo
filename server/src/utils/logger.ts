import pino from 'pino';
import pinoHttp from 'pino-http';
import { env } from '../config/env';

/**
 * Defensive error serializer that logs err.name, err.message, err.code, and err.stack only,
 * explicitly omitting err.config, err.request, err.response, or any attached body.
 */
export const errorSerializer = (err: any) => {
  if (!err) return err;
  return {
    type: err.name || 'Error',
    message: err.message,
    stack: err.stack,
    ...(err.code ? { code: err.code } : {}),
  };
};

export const logger = pino({
  level: env.LOG_LEVEL || 'info',
  redact: {
    paths: [
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
    ],
    censor: '[Redacted]',
  },
  serializers: {
    err: errorSerializer,
    error: errorSerializer,
  },
  timestamp: pino.stdTimeFunctions.isoTime,
});

export const httpLogger = pinoHttp({
  logger,
  genReqId: (req: any) => req.id || req.headers['x-request-id'],
  customProps: (req: any) => ({
    requestId: req.id || req.headers['x-request-id'],
  }),
  // Prevent logging request bodies to avoid leaking credentials or PII
  serializers: {
    req(req) {
      return {
        id: req.id || req.raw?.id,
        method: req.method,
        url: req.url,
        headers: req.headers,
      };
    },
    err: errorSerializer,
  },
});

export default logger;
