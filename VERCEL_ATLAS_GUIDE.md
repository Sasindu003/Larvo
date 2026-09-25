# Vercel & MongoDB Atlas Deployment Guide

This guide details how to deploy the application to Vercel connected to a MongoDB Atlas cluster, supporting both **Single-Project** and **Dual-Project** topologies while preserving your existing local development workflow.

---

## 1. MongoDB Atlas Setup

### Step 1.1: Create a Cluster
1. Sign in to [MongoDB Atlas](https://www.mongodb.com/cloud/atlas).
2. Create a new cluster (the free M0 tier works great for testing/staging).
3. Choose your preferred cloud provider and region (choose a region close to your Vercel deployment region, e.g., `us-east-1` or `iad1`).

### Step 1.2: Create a Database User
1. In the Atlas dashboard, navigate to **Security** > **Database Access**.
2. Click **Add New Database User**.
3. Choose **Password Authentication**.
4. Enter a username (e.g. `shop_admin`) and a secure password.
5. Set database user privileges to **Read and write to any database** (or assign specific database permissions).
6. Save the credentials securely.

### Step 1.3: Configure Network Access (IP Whitelist)
Because Vercel serverless functions run on dynamic cloud infrastructure with ever-changing IP addresses:
1. In the Atlas dashboard, go to **Security** > **Network Access**.
2. Click **Add IP Address**.
3. Click **Allow Access from Anywhere** (`0.0.0.0/0`).
4. Save the entry.

### Step 1.4: Copy Connection String
1. Go to **Database** > **Deployment** > **Connect**.
2. Select **Drivers** (Node.js).
3. Copy the SRV connection string. It will look like:
   ```
   mongodb+srv://<username>:<password>@cluster0.abcde.mongodb.net/shop?retryWrites=true&w=majority
   ```
4. Replace `<username>` and `<password>` with your database user credentials. Specify your database name (e.g. `/shop`).

---

## 2. Deployment Options on Vercel

### Option A: Single-Project Deployment (Recommended)

In this approach, a single Vercel project hosts both the Vite React SPA and the Express serverless API under the same domain.

#### Setup Steps:
1. Push your code to your GitHub repository.
2. In the [Vercel Dashboard](https://vercel.com/dashboard), click **Add New** > **Project** and import your GitHub repository.
3. Configure Project Settings:
   - **Framework Preset**: Other (or Vite)
   - **Root Directory**: Leave as `./` (repository root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `client/dist` (managed via root `vercel.json`)
4. Configure **Environment Variables**:
   - `MONGO_URI`: Your MongoDB Atlas connection string (`mongodb+srv://...`)
   - `JWT_SECRET`: A secure random secret string
   - `JWT_EXPIRES_IN`: `7d`
   - `NODE_ENV`: `production`
   - *(Optional)* `CLIENT_ORIGIN`: Leave default or set to your primary Vercel domain. Note: preview URLs (`*.vercel.app`) are permitted dynamically.
   - *Note*: Leave `VITE_API_URL` unset so the frontend automatically makes relative API requests to `/api/*`.
5. Click **Deploy**.

---

### Option B: Dual-Project Deployment

In this approach, the backend server and frontend client are deployed as two independent Vercel projects.

#### Project 1: Backend API
1. In Vercel, click **Add New** > **Project** and import the GitHub repository.
2. Configure Project Settings:
   - **Root Directory**: `server`
   - **Framework Preset**: Other
3. Add Environment Variables:
   - `MONGO_URI`: Your MongoDB Atlas connection string (`mongodb+srv://...`)
   - `JWT_SECRET`: A secure random secret string
   - `JWT_EXPIRES_IN`: `7d`
   - `NODE_ENV`: `production`
   - `CLIENT_ORIGIN`: Comma-separated list including your frontend URL, e.g. `https://your-frontend.vercel.app`
4. Click **Deploy**. Note the assigned backend URL (e.g. `https://your-backend.vercel.app`).

#### Project 2: Frontend Client
1. In Vercel, click **Add New** > **Project** and import the same GitHub repository.
2. Configure Project Settings:
   - **Root Directory**: `client`
   - **Framework Preset**: Vite
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
3. Add Environment Variables:
   - `VITE_API_URL`: `https://your-backend.vercel.app/api`
4. Click **Deploy**. Note the frontend URL and add it to the backend's `CLIENT_ORIGIN` environment variable if needed.

---

## 3. Verification Checklist

1. **Live Health Check**:
   - Visit `https://<your-domain>/api/health`
   - Verify it returns HTTP 200 with:
     ```json
     {
       "success": true,
       "data": {
         "status": "ok",
         "uptime": 12.34,
         "db": "connected"
       }
     }
     ```
2. **SPA Deep Route Refresh**:
   - Navigate to a deep route like `/admin/purchase-orders` and press browser refresh.
   - The route must load smoothly without a 404 error (handled by `vercel.json` rewrite).
3. **CORS & Preview Branches**:
   - Any PR or preview branch deployed to `https://<hash>.vercel.app` can access `/api/*` endpoints without CORS blockage.

---

## 4. Local Development Workflow (Unchanged)

Your local development workflow is 100% unaffected:
1. **Server**:
   ```bash
   cd server
   npm run dev
   ```
   Runs with local `.env` (`MONGO_URI=mongodb://localhost:27017/shop`, port 5000).
2. **Client**:
   ```bash
   cd client
   npm run dev
   ```
   Runs with local `.env` (`VITE_API_URL=http://localhost:5000/api`, port 5173).
