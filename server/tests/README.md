# Larvo Server Test Suite

This directory contains automated unit and integration tests powered by **Jest**, **ts-jest**, **Supertest**, and **mongodb-memory-server**.

All tests run completely offline against an in-memory MongoDB replica, with **zero external dependencies, real database connections, or network requirements**.

---

## Running Tests

From root directory:
```bash
npm test --workspace=server
```

Or from the `server/` directory:
```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Generate code coverage report
npm run test:coverage

# Run legacy ad-hoc verification scripts
npm run test:legacy
```

---

## Test Files & Coverage

### 1. `tests/setup.ts`
- Bootstraps in-memory MongoDB server via `mongodb-memory-server`.
- Enforces isolated test environment variables (`NODE_ENV=test`, test `JWT_SECRET`, localhost client origins) prior to module imports.
- Connects Mongoose before tests, purges all collections between individual tests (`afterEach`), and disconnects/stops memory server after all tests (`afterAll`).

### 2. `tests/helpers/index.ts`
- `createUser(role, overrides)`: Persists user with hashed password and default addresses.
- `loginAs(role, overrides)`: Creates user and returns an authenticated Supertest agent pre-loaded with `slt` auth cookie and JWT token.
- `createProduct(overrides)`: Persists a test category and product with variants, SKUs, and stock.
- `createOrder(user, overrides)`: Persists an order with items, shipping address, and calculated totals.

### 3. `tests/auth.test.ts`
- Customer registration flow (`POST /api/auth/register`).
- Privilege escalation defense: verifies submitted `role` in registration body is ignored.
- Credential leak prevention: asserts `passwordHash` is absent in API responses.
- Duplicate account prevention (409 Conflict).
- Login success (`POST /api/auth/login`) with `slt` HTTP-only cookie issuance.
- User enumeration defense: asserts identical 401 error message for wrong password vs. unknown email.
- Deactivated account login rejection (403 Forbidden).

### 4. `tests/rbac.test.ts`
- Unauthenticated access rejection (401 Unauthorized) across customer, admin, delivery, and supplier routes.
- Customer role boundaries: asserts 403 Forbidden on staff, coupon administration, delivery queues, and supplier portal routes.
- Privileged role validation: asserts 200 OK for admin and owner roles.
- Granular permission bounds: asserts staff cannot access owner-only routes.

### 5. `tests/csrf.test.ts`
- Cross-Site Request Forgery (CSRF) guard verification.
- Rejection of state-changing requests (`POST`, `PUT`, `PATCH`, `DELETE`) bearing foreign or untrusted `Origin` headers with 403 Forbidden.
- Preservation of safe read methods (`GET`, `HEAD`, `OPTIONS`) across foreign origins.
- Allowance of state-changing requests originating from configured client allowlist.

### 6. `tests/validation.test.ts`
- Verification of standard `{ success: false, message, errors }` envelope on input validation failures.
- Express-validator / Zod schema checks for missing fields, malformed emails, and short passwords.
- Rejection of malformed coupon creation payloads.
- Rejection of malformed MongoDB ObjectId parameters (CastError -> 400).

### 7. `tests/health.test.ts`
- Liveness probe (`GET /api/health/live`) returning 200 with uptime and timestamp.
- Readiness probe (`GET /api/health/ready`) confirming MongoDB connectivity.
- System diagnostics endpoint (`GET /api/health/diagnostics`) restricted to admin/owner roles.

### 8. `tests/business.test.ts`
- Inventory stock lifecycle: atomic decrement on order creation and complete stock restoration on order cancellation via `inventory.service.ts`.
- Inventory floor protection: verifies atomic decrement cannot drive variant stock negative (409 Conflict).
- Coupon usage limits: verifies coupon application is rejected once global `usageLimit` is reached.
- Reward points wallet integrity: verifies wallet debit cannot drive balance negative.
- Refund idempotency: verifies refund transactions credit customer wallet exactly once under identical idempotency keys.
- Order state machine transitions: validates legal transitions and strictly rejects illegal status jumps or transitions out of terminal states.
