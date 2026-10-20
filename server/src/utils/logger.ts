import pino from 'pino';
import pinoHttp from 'pino-http';
import { env } from '../config/env';

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
    ],
    censor: '[Redacted]',
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
  },
});

export default logger;
