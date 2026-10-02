# <p align="center"><img src="https://capsule-render.vercel.app/api?type=waving&color=gradient&customColorList=1,12,24,31,43&height=220&section=header&text=LARVO%20E-COMMERCE&fontSize=52&fontColor=ffffff&animation=fadeIn&fontAlignY=38&desc=Full-Stack%20Modern%20Fashion%20Retail%20%7C%20Multi-Role%20Commerce%20Ecosystem&descAlignY=58&descSize=18" alt="Larvo Banner" width="100%" /></p>

<p align="center">
  <a href="#-tech-stack"><img src="https://img.shields.io/badge/Stack-MERN%20+%20TypeScript-6366f1?style=for-the-badge&logo=react&logoColor=white" alt="Stack" /></a>
  <a href="#-architecture"><img src="https://img.shields.io/badge/Architecture-Monorepo%20Workspaces-ec4899?style=for-the-badge&logo=pnpm&logoColor=white" alt="Architecture" /></a>
  <a href="#-database--storage"><img src="https://img.shields.io/badge/Database-MongoDB%20%2B%20GridFS-10b981?style=for-the-badge&logo=mongodb&logoColor=white" alt="MongoDB" /></a>
  <a href="#-security--auth"><img src="https://img.shields.io/badge/Auth-JWT%20%2B%20RBAC%20%2B%20Google-f59e0b?style=for-the-badge&logo=jsonwebtokens&logoColor=white" alt="Auth" /></a>
  <a href="#-deployment"><img src="https://img.shields.io/badge/Deployment-Vercel%20Serverless-000000?style=for-the-badge&logo=vercel&logoColor=white" alt="Vercel" /></a>
</p>

---

## 📑 Table of Contents
- [✨ Key Highlights](#-key-highlights)
- [🧩 Architecture & Roles](#-architecture--roles)
- [🛠️ Tech Stack](#️-tech-stack)
- [📂 Directory Structure](#-directory-structure)
- [🚀 Quick Start](#-quick-start)
- [⚙️ Environment Configuration](#️-environment-configuration)
- [📦 Core Modules & Features](#-core-modules--features)
- [🛡️ Security & Validation](#️-security--validation)
- [📜 Scripts & Verification](#-scripts--verification)

---

## ✨ Key Highlights

<table>
  <tr>
    <td width="50%">
      <h3>🛍️ Customer Experience</h3>
      <ul>
        <li><b>Dynamic Catalog:</b> Multi-level category hierarchy, department navigation, and multi-filter faceted search.</li>
        <li><b>Cart & Checkout:</b> Express checkout, address management, coupon redemptions, and order tracking.</li>
        <li><b>Digital Wallet & Loyalty:</b> Built-in store wallet, refund balance management, and points loyalty program.</li>
        <li><b>PDF Invoices:</b> Auto-generated download-ready receipts powered by PDFKit.</li>
      </ul>
    </td>
    <td width="50%">
      <h3>👑 Multi-Role Operations</h3>
      <ul>
        <li><b>Role-Based Access Control (RBAC):</b> Discrete interfaces for <code>customer</code>, <code>staff</code>, <code>supplier</code>, <code>delivery</code>, and <code>admin</code>.</li>
        <li><b>Supplier Portal:</b> Purchase orders, stock replenishment, and order dispatch tracking.</li>
        <li><b>Logistics & Delivery:</b> Delivery status dispatching, timeline updates, and proof-of-delivery flows.</li>
        <li><b>Administrative Suite:</b> Dynamic coupon generation, platform analytics, inventory thresholds, and return management.</li>
      </ul>
    </td>
  </tr>
</table>

---

## 🧩 Architecture & Roles

```mermaid
graph TD
    subgraph Client["Frontend Client (React + Vite + TailwindCSS)"]
        UI_Store["Customer Storefront\n(Catalog, Cart, Checkout, Profile)"]
        UI_Admin["Admin & Management Suite\n(Analytics, Inventory, Coupons)"]
        UI_Supplier["Supplier Portal\n(PO, Stock Replenishment)"]
        UI_Delivery["Delivery Operations\n(Route Dispatch, Order Status)"]
    end

    subgraph API_Gateway["Express API & Security Gateway"]
        Auth_MW["JWT & RBAC Protect Middleware"]
        Val_MW["Zod / Express-Validator Pipelines"]
        Rate_MW["Rate Limiting & Security Headers"]
    end

    subgraph Backend_Services["Backend Controller Services"]
        SVC_Orders["Orders & Invoice Engine"]
        SVC_Wallet["Wallet & Points Ledger"]
        SVC_Catalog["Catalog & Inventory Service"]
        SVC_Upload["GridFS File Bucket Streamer"]
    end

    subgraph Database["MongoDB Atlas / Local DB"]
        MDB_Collections[("Collections\nUsers, Orders, Products, Invoices")]
        MDB_GridFS[("GridFS Bucket\nImages, Proofs, Slip Uploads")]
    end

    Client -->|REST & Cookie Auth| API_Gateway
    API_Gateway --> Backend_Services
    Backend_Services --> MDB_Collections
    Backend_Services --> MDB_GridFS
```

---

## 🛠️ Tech Stack

### Frontend
![React](https://img.shields.io/badge/React_18.3-20232A?style=flat-square&logo=react&logoColor=61DAFB)
![Vite](https://img.shields.io/badge/Vite_5.2-646CFF?style=flat-square&logo=vite&logoColor=white)
![TailwindCSS](https://img.shields.io/badge/TailwindCSS_3.4-38B2AC?style=flat-square&logo=tailwind-css&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript_5.2-3178C6?style=flat-square&logo=typescript&logoColor=white)
![React Router](https://img.shields.io/badge/React_Router_6.23-CA4245?style=flat-square&logo=react-router&logoColor=white)
![Recharts](https://img.shields.io/badge/Recharts_3.10-22c55e?style=flat-square&logo=chartdotjs&logoColor=white)
![Lucide](https://img.shields.io/badge/Lucide_Icons-F56565?style=flat-square&logo=feather&logoColor=white)

### Backend & Storage
![Node.js](https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white)
![Express](https://img.shields.io/badge/Express_4.19-000000?style=flat-square&logo=express&logoColor=white)
![TypeScript](https://img.shields.io/badge/TypeScript_5.4-3178C6?style=flat-square&logo=typescript&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB_Mongoose_8.3-47A248?style=flat-square&logo=mongodb&logoColor=white)
![GridFS](https://img.shields.io/badge/GridFS-Binary_Stream_Storage-00684A?style=flat-square&logo=mongodb&logoColor=white)
![JWT](https://img.shields.io/badge/JWT-Secure_Tokens-black?style=flat-square&logo=JSON%20web%20tokens)
![Zod](https://img.shields.io/badge/Zod-Schema_Validation-3E67B1?style=flat-square&logo=zod&logoColor=white)

---

## 📂 Directory Structure

```text
Larvo/
├── 📁 client/                       # Frontend SPA (React + Vite + TailwindCSS)
│   ├── 📁 src/
│   │   ├── 📁 api/                  # Axios service integrations & API hooks
│   │   ├── 📁 components/           # Reusable UI primitives, Modals, Navbar, Footer
│   │   ├── 📁 context/              # Auth, Cart, & Global App State Providers
│   │   ├── 📁 pages/                # Route targets
│   │   │   ├── 📁 admin/            # Analytics, Product, Coupon, & Settings pages
│   │   │   ├── 📁 delivery/         # Logistics dashboard & order routing
│   │   │   ├── 📁 supplier/         # Purchase order & catalog supply portals
│   │   │   └── ...                  # Cart, Checkout, Wallet, Invoice, Orders
│   │   └── index.css                # Custom theme tokens & Tailwind baseline
│   └── package.json
│
├── 📁 server/                       # Backend RESTful API (Express + Mongoose + TS)
│   ├── 📁 src/
│   │   ├── 📁 config/               # Database, GridFS buckets, & environment constants
│   │   ├── 📁 controllers/          # Business logic handlers
│   │   ├── 📁 middleware/           # Auth (JWT), RBAC, Rate-limit, & Upload middleware
│   │   ├── 📁 models/               # Mongoose schemas (User, Product, Order, Wallet...)
│   │   ├── 📁 routes/               # Modular Express API endpoints
│   │   ├── 📁 services/             # Specialized helpers (PDFKit invoice generators)
│   │   ├── 📁 validators/           # Zod & Express-Validator validation rules
│   │   └── server.ts                # Express application entry & connection lifecycle
│   └── package.json
│
├── 📄 start-dev.bat                 # One-click Windows development launcher
├── 📄 VERCEL_ATLAS_GUIDE.md         # Production serverless & MongoDB Atlas manual
├── 📄 DEPLOYMENT_TROUBLESHOOTING.md  # Comprehensive deployment diagnosis guide
└── 📄 package.json                  # Root npm workspace configuration
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
Create `.env` files in both the `server` and `client` directories.

#### In `server/.env`:
```env
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://localhost:27017/larvo-shop
JWT_SECRET=your_super_secret_jwt_key
JWT_EXPIRES_IN=7d
CLIENT_URL=http://localhost:5173
```

#### In `client/.env`:
```env
VITE_API_URL=http://localhost:5000/api
```

### 3. Start Development Mode

#### Option A: One-Click Windows Runner
Double-click `start-dev.bat` or run:
```cmd
.\start-dev.bat
```

#### Option B: Manual Terminal Execution
```bash
# Terminal 1 - Backend Server (Auto-Reloading via ts-node-dev)
cd server
npm run dev

# Terminal 2 - Frontend Client (Vite HMR)
cd client
npm run dev
```

Visit **Frontend**: [http://localhost:5173](http://localhost:5173) | **Backend**: [http://localhost:5000](http://localhost:5000)

---

## 📦 Core Modules & Features

| Module | Features & Capabilities |
| :--- | :--- |
| **🔐 Authentication** | Role-based authentication (`customer`, `staff`, `admin`, `supplier`, `delivery`), HTTP-only cookie tokens, and optional Google OAuth integration. |
| **🛍️ Catalog & Inventory** | Department & nested category hierarchy, stock decrement transactions, product variants, and dynamic tags. |
| **💳 Checkout & Orders** | Multi-step checkout pipeline, coupon validation, delivery address selection, and automated PDF invoice generation. |
| **👛 Wallet & Points** | Customer store credits ledger, automated refunds into wallet, and checkout points earn & burn mechanism. |
| **🚚 Delivery Tracking** | Assigned delivery agent dashboard, stage progression (`Placed` ➔ `Shipped` ➔ `Delivered`), and timestamp audit logs. |
| **🏢 Supplier Management** | Supplier directory, inbound purchase orders, and stock acquisition tracking. |
| **🖼️ MongoDB GridFS** | Complete zero-disk image lifecycle. All images and slip attachments are streamed directly into MongoDB chunks. |

---

## 🛡️ Security & Validation

* **Strict Input Validation**: Every mutating endpoint is secured with schema validations (`zod` or `express-validator`) preventing payload pollution.
* **Granular Role Protection**: Endpoints enforce JWT verification via `protect` along with `authorize('admin', ...)` middleware guards.
* **Rate Limiting**: Built-in `express-rate-limit` guards protect authentication and transaction routes from brute-force attempts.
* **Clean Data Responses**: Standardized JSON envelope:
  ```json
  {
    "success": true,
    "data": { ... },
    "message": "Operation completed successfully"
  }
  ```

---

## 📜 Scripts & Verification

| Command | Location | Description |
| :--- | :--- | :--- |
| `npm run dev` | `server/` | Boots the development server with live reload via `ts-node-dev` |
| `npm run dev` | `client/` | Starts Vite HMR local dev server |
| `npm run build` | `root` | Concurrently compiles both backend TypeScript and client assets |
| `npm run seed` | `server/` | Populates database with departments, categories, and initial products |
| `npm run test:all` | `server/` | Runs comprehensive verification check scripts across core modules |

---

<p align="center">
  <sub>Built with ❤️ for high-performance, multi-role modern fashion retail.</sub>
</p>
