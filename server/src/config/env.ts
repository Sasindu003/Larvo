import 'dotenv/config';
import path from 'path';
import { z } from 'zod';

// Determine if the current process is executing an automated test suite.
// Use exact script filename check rather than searching arbitrary process.argv paths
// to prevent accidental security validation bypasses if repository paths contain keywords.
const targetScript = process.argv[1] ? path.basename(process.argv[1]) : '';
const isTestExecution =
  process.env.NODE_ENV === 'test' ||
  targetScript.endsWith('.test.ts') ||
  targetScript.endsWith('.test.js') ||
  targetScript === 'product.check.ts';

const baseJwtSchema = z
  .string()
  .min(32, 'JWT_SECRET must be at least 32 characters')
  .refine(
    (val) => !/your_|change/i.test(val),
    "JWT_SECRET must not contain placeholder words ('your_', 'change')"
  );

// In offline test runs where no .env file exists, allow a valid default test secret.
// In all server, production, and non-test executions, JWT_SECRET is strictly required.
const jwtSchema =
  isTestExecution && !process.env.JWT_SECRET
    ? baseJwtSchema.default('test-jwt-secret-key-12345678901234567890')
    : baseJwtSchema;

const mongoUriSchema = z
  .string()
  .refine(
    (val) => /^mongodb(\+srv)?:\/\/.+/i.test(val) || z.string().url().safeParse(val).success,
    'MONGO_URI must be a valid MongoDB URI or URL'
  )
  .default('mongodb://localhost:27017/shop');

export const envSchema = z
  .object({
    NODE_ENV: z
      .enum(['development', 'production', 'test'])
      .default('development'),
    PORT: z.coerce.number().int().positive().default(5000),
    MONGO_URI: mongoUriSchema,
    JWT_SECRET: jwtSchema,
    JWT_EXPIRES_IN: z.string().default('7d'),
    COOKIE_SAMESITE: z.enum(['lax', 'strict', 'none']).default('lax'),
    COOKIE_SECURE: z
      .preprocess((val) => {
        if (val === 'true' || val === true) return true;
        if (val === 'false' || val === false) return false;
        return undefined;
      }, z.boolean().optional()),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
      .default('info'),
    CLIENT_URL: z
      .string()
      .url()
      .default(
        process.env.NODE_ENV === 'production' || process.env.VERCEL
          ? 'https://larvo-client.vercel.app'
          : 'http://localhost:5173'
      ),
    CLIENT_ORIGIN: z.string().optional(),
    GOOGLE_CLIENT_ID: z.string().optional(),
    GOOGLE_CLIENT_SECRET: z.string().optional(),
  })
  .refine(
    (data) => {
      const isSecure =
        data.COOKIE_SECURE ??
        (data.NODE_ENV === 'production' || data.COOKIE_SAMESITE === 'none');
      if (data.COOKIE_SAMESITE === 'none' && !isSecure) {
        return false;
      }
      return true;
    },
    {
      message:
        'COOKIE_SAMESITE=none requires secure cookies, but secure cannot be satisfied',
      path: ['COOKIE_SAMESITE'],
    }
  );

const result = envSchema.safeParse(process.env);

if (!result.success) {
  const invalidVars = Array.from(
    new Set(result.error.issues.map((i) => i.path.join('.')).filter(Boolean))
  );
  console.error(
    `Startup environment validation failed. Invalid or missing environment variables: ${invalidVars.join(', ')}`
  );
  process.exit(1);
}

export const env = result.data;
export type Env = z.infer<typeof envSchema>;

// Strict startup guard per R2: Throw at startup if COOKIE_SAMESITE === 'none' and secure cannot be satisfied
const isSecureSatisfied =
  env.COOKIE_SECURE ??
  (env.NODE_ENV === 'production' || env.COOKIE_SAMESITE === 'none');
if (env.COOKIE_SAMESITE === 'none' && !isSecureSatisfied) {
  throw new Error(
    'Startup environment validation failed: COOKIE_SAMESITE=none requires secure cookies, but secure cannot be satisfied.'
  );
}
