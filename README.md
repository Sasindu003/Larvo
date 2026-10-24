# Larvo E-Commerce

<p align="center">
  <a href="https://github.com/Sasindu003/Larvo/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Sasindu003/Larvo/ci.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=CI%20Pipeline" alt="CI Status" /></a>
</p>

Larvo is a multi-role fashion e-commerce platform engineered for modern retail operations with an integrated customer storefront, supply chain portal, last-mile logistics dispatch, and strict data confidentiality.

---

## Roles & Demo Accounts

Default test password for all seed accounts: `Password123!`

| Role                 | Email                    | Access Scope                                                             |
| :------------------- | :----------------------- | :----------------------------------------------------------------------- |
| **Owner**            | `owner@larvo.com`        | Complete platform governance, financials, and administrative settings    |
| **Admin**            | `admin@larvo.com`        | Store operations, sales analytics, catalog, coupons, and user management |
| **Staff**            | `staff@larvo.com`        | Product editing, inventory review, and customer order management         |
| **Delivery Manager** | `delivery@larvo.com`     | Logistics queue, dispatch routing, and fulfillment tracking              |
| **Supplier**         | `supplier@larvo.com`     | Supplier portal, purchase order fulfillment, and replenishment tracking  |
| **Customer**         | `customer@larvo.com`     | Storefront browsing, cart, checkout, wallet points, and order history    |
| **Test Customer**    | `customer_test@demo.com` | Clean shopper profile for testing checkout flows                         |

---

## Security & PCI DSS Compliance

- **Zero Cardholder Data**: PANs, CVVs, and magnetic stripe data never touch or traverse the Larvo server. Production transactions use hosted fields / vault tokens from certified gateways.
- **AES-256-GCM At-Rest Encryption**: Sensitive personal data (recipient names, telephone numbers, and street delivery addresses) is encrypted at rest using authenticated 256-bit Galois/Counter Mode.
- **Multi-Tier RBAC & CSRF Protection**: Every mutating endpoint enforces strict role validation and CSRF origin guards.
- **Hardened Cookies**: Auth tokens reside in `SameSite: strict`, HTTP-only, SSL-enforced cookies.
- **Private Media Isolation**: Payment slips and sensitive documents in MongoDB GridFS are isolated behind strict role checks returning 404 to unauthorized requests with `Cache-Control: private, no-store`.
- **Test Mode Guardrails**: Built-in payment simulator operates only via deterministic test tokens (`tok_test_success`, `tok_test_decline`) and is strictly disabled in production.
- **Zero Local Disk Writes**: All persistent files, images, and documents stream directly into MongoDB GridFS chunks.

---

## Quick Start

### Prerequisites

- Node.js 18+ or 20+ LTS
- MongoDB 6+ (local or Atlas)
- npm 9+

### 1. Clone & Install

```bash
git clone https://github.com/Sasindu003/Larvo.git
cd Larvo
npm install
```

### 2. Configure Environment

Copy `.env.example` templates in both `server` and `client` workspaces:

```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Generate secure 64-character secrets for `JWT_SECRET` and `ENCRYPTION_KEY`:

```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 3. Seed Database & Start

```bash
# Seed initial data (departments, categories, products, demo accounts)
npm run seed --workspace=server

# Run development servers concurrently
npm run dev
```

Visit **Frontend**: [http://localhost:5173](http://localhost:5173) | **Backend API**: [http://localhost:5000](http://localhost:5000)

---

## Environment Configuration

| Variable                          | Scope  | Description                              | Default / Example               |
| :-------------------------------- | :----- | :--------------------------------------- | :------------------------------ |
| `PORT`                            | Server | Application port                         | `5000`                          |
| `NODE_ENV`                        | Server | Runtime environment                      | `development` / `production`    |
| `MONGO_URI`                       | Server | MongoDB Atlas or local connection string | `mongodb+srv://...`             |
| `JWT_SECRET`                      | Server | Cryptographic token signing key          | `64-char hex`                   |
| `JWT_EXPIRES_IN`                  | Server | Token expiration duration                | `7d`                            |
| `FIELD_ENCRYPTION_KEYS`           | Server | Keyring for AES-256-GCM data encryption  | JSON / comma-separated hex keys |
| `FIELD_ENCRYPTION_ACTIVE_VERSION` | Server | Active version key identifier            | `v1`                            |
| `CLIENT_URL`                      | Server | Allowed CORS origin                      | `http://localhost:5173`         |
| `PAYMENT_SIMULATOR_ENABLED`       | Server | Toggle test payment simulator            | `false` (Prod) / `true` (Dev)   |
| `VITE_API_URL`                    | Client | API endpoint base URL                    | `http://localhost:5000/api`     |

---

## Scripts & Verification

| Command                | Location  | Description                                                        |
| :--------------------- | :-------- | :----------------------------------------------------------------- |
| `npm run dev`          | `root`    | Starts backend and frontend development servers concurrently       |
| `npm run build`        | `root`    | Builds both backend (`tsc`) and frontend Vite bundle               |
| `npm run lint`         | `root`    | Runs ESLint across client and server                               |
| `npm run format:check` | `root`    | Verifies code formatting with Prettier                             |
| `npm test`             | `server/` | Runs comprehensive Jest test suites (14 suites, 104 tests)         |
| `npm run seed`         | `server/` | Populates database with departments, categories, and test products |
| `npm run seed:users`   | `server/` | Seeds pre-configured role-based demo accounts                      |
| `npm run export:local` | `server/` | Exports local MongoDB snapshot to `server/.local/local-data.json`  |
| `npm run import:local` | `server/` | Restores local MongoDB snapshot from export                        |
| `npm run sync:atlas`   | `server/` | Synchronizes local export snapshot into MongoDB Atlas              |
