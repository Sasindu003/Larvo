# <p align="center"><img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=1,12,24,31,43&height=220&section=header&text=LARVO%20E-COMMERCE&fontSize=52&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=Full-Stack%20Modern%20Fashion%20Retail%20%7C%20Multi-Role%20Commerce%20Ecosystem&descAlignY=58&descSize=18" alt="Larvo Banner" width="100%" /></p>

<p align="center">
  <a href="https://github.com/Sasindu003/Larvo/actions/workflows/ci.yml"><img src="https://img.shields.io/github/actions/workflow/status/Sasindu003/Larvo/ci.yml?branch=main&style=for-the-badge&logo=githubactions&logoColor=white&label=CI%20Pipeline" alt="CI Status" /></a>
  <a href="#-tech-stack--ecosystem"><img src="https://img.shields.io/badge/Stack-MERN%20+%20TypeScript-6366f1?style=for-the-badge&logo=react&logoColor=white" alt="Stack" /></a>
  <a href="#-tech-stack--ecosystem"><img src="https://img.shields.io/badge/Database-MongoDB%20%2B%20GridFS-10b981?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" /></a>
  <a href="#-security-cryptography--compliance"><img src="https://img.shields.io/badge/Security-AES--256--GCM%20%2B%20RBAC-f43f5e?style=for-the-badge&logo=shield&logoColor=white" alt="Security" /></a>
  <a href="#-zero-cardholder-payments--pci"><img src="https://img.shields.io/badge/PCI%20DSS-Zero--Cardholder--Data-06b6d4?style=for-the-badge&logo=visa&logoColor=white" alt="PCI DSS" /></a>
  <a href="VERCEL_ATLAS_GUIDE.md"><img src="https://img.shields.io/badge/Deploy-Vercel%20Serverless-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" /></a>
</p>

---

## 📑 Table of Contents
- [✨ Project Overview & Uses](#-project-overview--uses)
- [🧩 Architecture & Roles](#-architecture--roles)
- [🛠️ Tech Stack & Ecosystem](#️-tech-stack--ecosystem)
- [🛡️ Security, Cryptography & Compliance](#️-security-cryptography--compliance)
- [💳 Zero-Cardholder Payments & PCI](#-zero-cardholder-payments--pci)
- [📦 Core Features & Modules](#-core-features--modules)
- [📂 Directory Architecture](#-directory-architecture)
- [🚀 Quick Start](#-quick-start)
- [🔑 Demo & Seed Accounts](#-demo--seed-accounts)
- [⚙️ Environment Configuration](#️-environment-configuration)
- [📜 Scripts & Verification](#-scripts--verification)

---

## ✨ Project Overview & Uses

**Larvo** is a resilient, enterprise-ready **Multi-Role Fashion E-Commerce Ecosystem** engineered for modern retail operations. It combines high-conversion storefront experiences with robust internal supply-chain management, strict data confidentiality, and automated logistics.

### 🌟 Primary Use Cases & Personas

<table>
  <tr>
    <td width="25%" align="center">
      <img src="https://img.shields.io/badge/Shopper-Customer-4f46e5?style=for-the-badge&logo=shopify&logoColor=white"/><br/><br/>
      <b>Direct-to-Consumer Retail</b>
      <p align="left">Faceted search, multi-department browsing, shopping bag persistence, wallet loyalty points, express checkout, and instant PDF order receipt downloads.</p>
    </td>
    <td width="25%" align="center">
      <img src="https://img.shields.io/badge/Merchant-Admin%20%26%20Owner-059669?style=for-the-badge&logo=googleanalytics&logoColor=white"/><br/><br/>
      <b>Store Operations & Governance</b>
      <p align="left">Real-time sales analytics, inventory threshold alerts, promotional coupon engines, employee role permissions, and return dispute resolution.</p>
    </td>
    <td width="25%" align="center">
      <img src="https://img.shields.io/badge/Inventory-Supplier-d97706?style=for-the-badge&logo=airplayvideo&logoColor=white"/><br/><br/>
      <b>B2B Supply Logistics</b>
      <p align="left">Supplier portal for purchase order (PO) fulfillment, incoming replenishment tracking, and catalog stock synchronization.</p>
    </td>
    <td width="25%" align="center">
      <img src="https://img.shields.io/badge/Fulfillment-Courier-dc2626?style=for-the-badge&logo=fastly&logoColor=white"/><br/><br/>
      <b>Last-Mile Delivery Dispatch</b>
      <p align="left">Delivery agent routing, staged state updates (<code>Assigned</code> ➔ <code>Dispatched</code> ➔ <code>Delivered</code>), proof-of-delivery uploads, and courier audit logs.</p>
    </td>
  </tr>
</table>

---

## 🧩 Architecture & Roles

```mermaid
graph TB
    subgraph ClientLayer["🖥️ Frontend Client Layer (React 18 + Vite + TailwindCSS)"]
        UI_Storefront["🛍️ Customer Storefront\n(Catalog, Cart, Wallet, Checkout)"]
        UI_Admin["📊 Admin Dashboard\n(KPIs, Revenue, Coupons, Users)"]
        UI_Supplier["🏭 Supplier Portal\n(PO Shipments, Inventory Restock)"]
        UI_Delivery["🚚 Logistics Hub\n(Dispatch Map, Order Status, POD)"]
    end

    subgraph SecurityGateway["🛡️ Security & API Gateway (Express 4.19 + TypeScript)"]
        MW_RateLimit["⏱️ Rate Limiting & Proxy Trust"]
        MW_Helmet["🛡️ HTTP Security Headers & CORS Policy"]
        MW_Auth["🔐 JWT / HTTP-Only Cookies / CSRF Guards"]
        MW_RBAC["👑 RBAC: customer | staff | admin | owner | supplier | delivery"]
        MW_Validate["✅ Express-Validator & Zod Payload Guards"]
    end

    subgraph DomainServices["⚙️ Micro-Service Business Logic"]
        SVC_Catalog["🏷️ Catalog & Inventory Engine"]
        SVC_Checkout["🛒 Checkout & Coupon Orchestrator"]
        SVC_Wallet["👛 Wallet & Points Ledger"]
        SVC_Crypto["🔒 AES-256-GCM Envelope Encryption"]
        SVC_Invoice["🧾 PDFKit Invoice Generator"]
        SVC_GridFS["🖼️ GridFS Zero-Disk Stream Controller"]
    end

    subgraph StorageLayer["🗄️ MongoDB Atlas & Zero-Disk Storage"]
        DB_Core[("📦 Collections\nUsers, Products, Orders, Ledger")]
        DB_Crypto[("🔐 Encrypted PII Fields\nCiphertext + IV + Auth Tag")]
        DB_GridFS[("📂 GridFS Binary Chunks\nProduct Media & Isolated Payment Slips")]
    end

    ClientLayer -->|HTTPS / Strict SameSite Cookies| SecurityGateway
    SecurityGateway --> DomainServices
    DomainServices --> DB_Core
    DomainServices --> DB_Crypto
    DomainServices --> DB_GridFS
```

---

## 🛠️ Tech Stack & Ecosystem

### 🎨 Frontend Architecture
<table>
  <tr>
    <td><b>Framework</b></td>
    <td>
      <img src="https://img.shields.io/badge/React_18.3-20232A?style=flat-square&logo=react&logoColor=61DAFB"/>
      <img src="https://img.shields.io/badge/TypeScript_5.2-3178C6?style=flat-square&logo=typescript&logoColor=white"/>
    </td>
    <td>Component-driven SPA architecture with strong type contracts.</td>
  </tr>
  <tr>
    <td><b>Build Tooling</b></td>
    <td>
      <img src="https://img.shields.io/badge/Vite_5.4-646CFF?style=flat-square&logo=vite&logoColor=white"/>
    </td>
    <td>Ultra-fast HMR and optimized production rollup code-splitting.</td>
  </tr>
  <tr>
    <td><b>Design & UI</b></td>
    <td>
      <img src="https://img.shields.io/badge/TailwindCSS_3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white"/>
      <img src="https://img.shields.io/badge/Lucide_Icons-F56565?style=flat-square&logo=feather&logoColor=white"/>
    </td>
    <td>Custom fashion retail design tokens, fully accessible, zero AI-cliché palettes.</td>
  </tr>
  <tr>
    <td><b>State & Routing</b></td>
    <td>
      <img src="https://img.shields.io/badge/React_Router_6.23-CA4245?style=flat-square&logo=react-router&logoColor=white"/>
      <img src="https://img.shields.io/badge/Recharts_3.10-22c55e?style=flat-square&logo=chartdotjs&logoColor=white"/>
    </td>
    <td>Role-protected route guards, contextual global state, and dynamic KPI dashboards.</td>
  </tr>
</table>

### ⚙️ Backend & Infrastructure
<table>
  <tr>
    <td><b>Runtime & Server</b></td>
    <td>
      <img src="https://img.shields.io/badge/Node.js_20_LTS-339933?style=flat-square&logo=node.js&logoColor=white"/>
      <img src="https://img.shields.io/badge/Express_4.19-000000?style=flat-square&logo=express&logoColor=white"/>
      <img src="https://img.shields.io/badge/TypeScript_5.4-3178C6?style=flat-square&logo=typescript&logoColor=white"/>
    </td>
    <td>Strict TypeScript serverless and long-running runtime with asyncHandler encapsulation.</td>
  </tr>
  <tr>
    <td><b>Database & Storage</b></td>
    <td>
      <img src="https://img.shields.io/badge/MongoDB_Atlas-47A248?style=flat-square&logo=mongodb&logoColor=white"/>
      <img src="https://img.shields.io/badge/Mongoose_8.3-880000?style=flat-square&logo=mongoose&logoColor=white"/>
      <img src="https://img.shields.io/badge/GridFS_Bucket-00684A?style=flat-square&logo=mongodb&logoColor=white"/>
    </td>
    <td>Zero local-disk file writes. Media, documents, and payment slips live strictly in MongoDB GridFS chunks.</td>
  </tr>
  <tr>
    <td><b>Security & Validation</b></td>
    <td>
      <img src="https://img.shields.io/badge/JWT-Secure_Tokens-000000?style=flat-square&logo=JSON%20web%20tokens"/>
      <img src="https://img.shields.io/badge/Zod-Validation-3E67B1?style=flat-square&logo=zod&logoColor=white"/>
      <img src="https://img.shields.io/badge/AES--256--GCM-Encryption-f43f5e?style=flat-square&logo=keybase&logoColor=white"/>
    </td>
    <td>Military-grade symmetric authenticated encryption for sensitive fields, schema validation pipelines, and strict CORS.</td>
  </tr>
  <tr>
    <td><b>Continuous Delivery</b></td>
    <td>
      <img src="https://img.shields.io/badge/GitHub_Actions-2088FF?style=flat-square&logo=githubactions&logoColor=white"/>
      <img src="https://img.shields.io/badge/Vite%20+%20TSC%20CI-Pass-success?style=flat-square"/>
    </td>
    <td>Automated pull request regression checks and single-project monorepo deployments.</td>
  </tr>
</table>

---

## 🛡️ Security, Cryptography & Compliance

Larvo follows a **Defense-in-Depth** security philosophy across network, application, and database tiers.

```mermaid
sequenceDiagram
    autonumber
    actor User as Client Application
    participant API as Express Gateway
    participant Guard as RBAC & Validation Layer
    participant Crypto as AES-256-GCM Engine
    participant DB as MongoDB Atlas

    User->>API: Mutating Request with Bearer / Cookie
    API->>Guard: Verify JWT, CSRF Header, and Origin
    Guard->>Guard: Validate Schema (Express-Validator / Zod)
    alt Validation Failed
        Guard-->>User: 422 Unprocessable Entity
    else Authenticated & Authorized
        Guard->>Crypto: Encrypt PII Fields (Recipient, Phone, Address)
        Crypto->>Crypto: Generate Random IV + Auth Tag + Ciphertext
        Crypto->>DB: Store Document with Encrypted Payload
        DB-->>Crypto: Acknowledge Write
        Crypto-->>User: Standardized 200/201 JSON Envelope
    end
```

### 🔒 Key Security Controls
* **🔐 AES-256-GCM Field-Level Encryption**: Sensitive personal identification data (recipient names, telephone numbers, and street delivery addresses) is encrypted at rest prior to MongoDB serialization using authenticated 256-bit Galois/Counter Mode.
* **👑 Multi-Tier RBAC Guards**: Endpoints enforce role authorization (`owner`, `admin`, `staff`, `delivery`, `supplier`, `customer`). Elevating privileges or cross-role data leaks are blocked at middleware boundaries.
* **🍪 Hardened Session Protection**: Auth tokens are transmitted via HTTP-only, `SameSite: strict`, and SSL-enforced cookies with double-submit CSRF headers.
* **🛡️ Network & Ingress Security**: Configured with strict reverse proxy trust (`app.set('trust proxy', 1)`), granular CORS whitelisting (preventing wildcard origins), and IP rate limiters defending auth and checkout vectors.
* **📁 Isolated GridFS Assets**: Bank transfer payment slips and private order attachments return `HTTP 404` to unauthenticated users and disallow public CDN caching (`Cache-Control: private, no-store`).

---

## 💳 Zero-Cardholder Payments & PCI

Larvo complies with the strictest payment security standard: **Total Cardholder Data Elimination**.

```mermaid
graph LR
    subgraph Browser["Customer Device"]
        CardForm["🔒 Card Checkout Form\n(Client-Side Validation Only)"]
        Simulator["🧪 Dev Tokenizer\n(Allowlisted Test Tokens)"]
    end

    subgraph LarvoServer["Larvo Backend API"]
        GatewaySeam["🔌 PaymentGateway Interface\n(Zero PAN / Zero CVV Processing)"]
        AuditLog["📝 Non-Sensitive Audit Trail\n(Receipt ID, Status, Amount)"]
    end

    subgraph CertifiedProvider["PCI-Certified Gateway (Production Target)"]
        StripePayHere["🏦 Hosted Fields / Vault\n(PCI DSS Level 1 Certified)"]
    end

    CardForm -->|Test Mode Token Only| Simulator
    Simulator -->|tok_test_success| GatewaySeam
    GatewaySeam --> AuditLog
    CardForm -.->|Production Hosted Fields| StripePayHere
    StripePayHere -.->|Opaque Payment Reference| GatewaySeam
```

* **Zero PAN / Zero CVV**: Primary Account Numbers, CVVs, expiration dates, and cardholder security details never traverse or touch the Larvo server.
* **Allowlisted Test Tokens**: The built-in simulator operates exclusively via deterministic test tokens (`tok_test_success`, `tok_test_decline`), instantly rejecting real credit card sequences.
* **Strict Production Guardrails**: The test simulator is automatically turned off in production (`PAYMENT_SIMULATOR_ENABLED=false` and `VITE_PAYMENT_SIMULATOR_ENABLED=false`).
* **Audit & Documentation**: Full data-flow diagrams and audit specifications are maintained in [docs/PCI_SCOPE.md](docs/PCI_SCOPE.md) and [docs/DATA_CLASSIFICATION.md](docs/DATA_CLASSIFICATION.md).

---

## 📦 Core Features & Modules

<table>
  <tr>
    <th width="33%">🛍️ Catalog & Merchandising</th>
    <th width="33%">👛 Checkout & Financials</th>
    <th width="33%">🚚 Supply Chain & Delivery</th>
  </tr>
  <tr>
    <td valign="top">
      <ul>
        <li>Nested departments & category classification.</li>
        <li>Multi-variant inventory tracking (Color, Size, SKU).</li>
        <li>Dynamic tags (Trending, New Arrival, Sale).</li>
        <li>GridFS streaming image storage with zero local storage.</li>
      </ul>
    </td>
    <td valign="top">
      <ul>
        <li>Multi-stage checkout with coupon redemption.</li>
        <li>Store credit digital wallet with refund balance.</li>
        <li>Gamified points loyalty system (Earn & Burn).</li>
        <li>Automated downloadable PDFKit invoices.</li>
      </ul>
    </td>
    <td valign="top">
      <ul>
        <li>Supplier replenishment purchase order (PO) workflow.</li>
        <li>Carrier routing & delivery stage updates.</li>
        <li>Proof-of-delivery upload support.</li>
        <li>Historical order audit trail with timestamps.</li>
      </ul>
    </td>
  </tr>
</table>

---

## 📂 Directory Architecture

```text
Larvo/
├── 📁 .github/                      # CI/CD Workflows (GitHub Actions automated build validation)
├── 📁 client/                       # Frontend SPA (React 18 + Vite 5 + TailwindCSS)
│   ├── 📁 src/
│   │   ├── 📁 api/                  # Axios services, interceptors, and typed API clients
│   │   ├── 📁 components/           # Reusable UI primitives, Modals, Navbar, Footer
│   │   ├── 📁 context/              # Auth, Cart, Theme, and App state providers
│   │   ├── 📁 pages/                # Route components (Storefront, Admin, Supplier, Delivery)
│   │   └── index.css                # Custom theme tokens & Tailwind utility baseline
│   └── package.json
│
├── 📁 server/                       # Backend RESTful API (Express + Mongoose + TypeScript)
│   ├── 📁 src/
│   │   ├── 📁 config/               # Database connection, GridFS buckets, environment validation
│   │   ├── 📁 controllers/          # Modular business logic controllers
│   │   ├── 📁 middleware/           # Auth, RBAC, Rate-limit, ErrorHandler, and Multer GridFS
│   │   ├── 📁 models/               # Mongoose schemas (User, Product, Order, Wallet, Counter)
│   │   ├── 📁 routes/               # Express router endpoints
│   │   ├── 📁 services/             # PDF generation, payment seams, and encryption utils
│   │   ├── 📁 validators/           # Zod & Express-Validator request guards
│   │   └── server.ts                # Application boot, database connection, and graceful shutdown
│   └── package.json
│
├── 📁 docs/                         # Security audits, PCI scopes, and deployment manuals
├── 📄 start-dev.bat                 # One-click Windows development runner
├── 📄 VERCEL_ATLAS_GUIDE.md         # Production serverless & MongoDB Atlas deployment manual
└── 📄 package.json                  # Root monorepo workspace configuration
```

---

## 🚀 Quick Start

### Prerequisites
* **Node.js**: `v18.x` or `v20.x` LTS
* **MongoDB**: Local MongoDB instance or MongoDB Atlas Connection URI
* **npm**: `v9+` or `pnpm` / `yarn`

### 1. Clone & Install
```bash
git clone https://github.com/Sasindu003/Larvo.git
cd Larvo
npm install
```

### 2. Configure Environment Variables
Copy `.env.example` templates in both `server` and `client` directories:
```bash
cp server/.env.example server/.env
cp client/.env.example client/.env
```

Generate secure 64-character secrets for `JWT_SECRET` and `ENCRYPTION_KEY`:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

#### In `server/.env`:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/shop
JWT_SECRET=your_generated_jwt_secret
JWT_EXPIRES_IN=7d
ENCRYPTION_KEY=your_generated_32_byte_hex_key
CLIENT_URL=http://localhost:5173
PAYMENT_SIMULATOR_ENABLED=true
```

#### In `client/.env`:
```env
VITE_API_URL=http://localhost:5000/api
VITE_PAYMENT_SIMULATOR_ENABLED=true
```

### 3. Start Development Mode

#### Option A: One-Click Windows Runner
```cmd
.\start-dev.bat
```

#### Option B: Terminal Execution
```bash
# Terminal 1 - Backend Server (Auto-Reloading via ts-node-dev)
cd server
npm run dev

# Terminal 2 - Frontend Client (Vite HMR)
cd client
npm run dev
```

Visit **Frontend**: [http://localhost:5173](http://localhost:5173) | **Backend API**: [http://localhost:5000](http://localhost:5000)

---

## 🔑 Demo & Seed Accounts

Pre-configured accounts for role-based authentication testing (Password: `Password123!`):

| Role | Email | Password | Access / Scope |
| :--- | :--- | :--- | :--- |
| **Owner** | `owner@larvo.com` | `Password123!` | Complete platform authority & financial control |
| **Admin** | `admin@larvo.com` | `Password123!` | Management suite, analytics, catalog, coupons |
| **Staff** | `staff@larvo.com` | `Password123!` | Product editing & order review operations |
| **Delivery Manager** | `delivery@larvo.com` | `Password123!` | Logistics dispatch & delivery stage tracking |
| **Supplier** | `supplier@larvo.com` | `Password123!` | Supplier portal & purchase order replenishment |
| **Customer** | `customer@larvo.com` | `Password123!` | Customer storefront with orders & wallet ledger |
| **Test Customer** | `customer_test@demo.com` | `Password123!` | Clean shopper profile for checkout runs |

---

## ⚙️ Environment Configuration

| Variable | Scope | Description | Default / Example |
| :--- | :--- | :--- | :--- |
| `PORT` | Server | Application port | `5000` |
| `NODE_ENV` | Server | Runtime environment | `development` / `production` |
| `MONGO_URI` | Server | MongoDB Atlas or local connection string | `mongodb+srv://...` |
| `JWT_SECRET` | Server | Cryptographic token signing key | `64-char hex` |
| `JWT_EXPIRES_IN` | Server | Token expiration duration | `7d` |
| `ENCRYPTION_KEY` | Server | 32-byte secret for AES-256-GCM data encryption | `64-char hex` |
| `CLIENT_URL` | Server | Allowed CORS origin | `http://localhost:5173` |
| `PAYMENT_SIMULATOR_ENABLED` | Server | Toggle test payment simulator | `false` (Prod) / `true` (Dev) |
| `VITE_API_URL` | Client | API endpoint base URL | `http://localhost:5000/api` |

---

## 📜 Scripts & Verification

| Command | Location | Description |
| :--- | :--- | :--- |
| `npm run dev` | `server/` | Boots backend with live reload via `ts-node-dev` |
| `npm run dev` | `client/` | Starts Vite local HMR development server |
| `npm run build` | `root` | Concurrently builds both backend (`tsc`) and frontend bundle |
| `npm run seed` | `server/` | Populates database with departments, categories, and test products |
| `npm run test:pci` | `server/` | Runs automated PCI DSS zero-card-data & slip isolation regression tests |
| `npm run test:all` | `server/` | Runs comprehensive verification suite across all backend modules |
| `npm run export:local` | `server/` | Exports local MongoDB snapshot to `server/.local/local-data.json` |
| `npm run import:local` | `server/` | Restores local MongoDB snapshot from export |
| `npm run sync:atlas` | `server/` | Synchronizes local export snapshot into MongoDB Atlas |

---

<p align="center">
  <sub>Built with ❤️ for high-performance, secure, and multi-role modern fashion retail.</sub>
</p>
