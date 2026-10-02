# Larvo Vercel Deployment: Connection & White Screen Errors Post-Mortem

This document explains the root causes of the **Client-Server Network Error** and the subsequent **White Screen Error** on Vercel (`https://larvo-client.vercel.app/`), the exact code fixes applied, and a troubleshooting guide if the issues recur.

---

## 1. What Were the Errors?

### Error 1: "Network Error" on Client Pages
- **Symptom**: The client UI shell loaded (navbar, footer, hero banner), but all dynamic sections ("Shop by Category", "New Arrivals", "Trending Products") displayed red alert boxes with **`Network Error`**.
- **User Experience**: Categories and products were not rendering; login and authenticated actions failed.
- **Root Cause**:
  1. **Decentralized Axios Instances**: 4 client services (`auth.service.ts`, `user.service.ts`, `wallet.service.ts`, `wishlist.service.ts`) and inline helpers in `AdminOrdersPage.tsx` and `invoice.service.ts` created their own Axios instances or inline base URLs with hardcoded `http://localhost:5000/api` fallbacks.
  2. **Vite Optional Chaining Bug**: In `client/src/services/api.ts`, the environment check used optional chaining: `import.meta?.env?.PROD`. Vite's AST static replacement plugin matches literal expressions like `import.meta.env.PROD` during build time. Because `?.` was used, Vite skipped static compilation, leaving the evaluation to runtime in the browser where it failed to detect production and defaulted to `http://localhost:5000/api`.
  3. **Browser Requests to Localhost**: The browser running on `https://larvo-client.vercel.app` was actively making XHR/fetch requests to `http://localhost:5000/api/...`, causing browser-level connection failures (`ERR_CONNECTION_REFUSED`).

---

### Error 2: "White Screen" Crash
- **Symptom**: Loading `https://larvo-client.vercel.app/` rendered a completely blank, white screen with `<body></body>`.
- **Console Log**:
  ```text
  Error: [Larvo] VITE_API_URL is not defined. Check client/.env or your Vercel project environment variables.
      at assets/index-M747ga1A.js:737:5989
  ```
- **Root Cause**:
  - In an initial attempt to enforce `VITE_API_URL`, the following code was placed at the top level of `client/src/services/api.ts`:
    ```ts
    const baseURL = import.meta?.env?.VITE_API_URL as string;
    if (!baseURL) {
      throw new Error('[Larvo] VITE_API_URL is not defined...');
    }
    ```
  - When Vercel built the frontend bundle, `VITE_API_URL` was not supplied during the build phase.
  - Because `api.ts` is imported at the top level of almost every service and component, throwing an uncaught `Error` during module evaluation crashed the entire JavaScript bundle before `ReactDOM.createRoot().render()` could execute.

---

## 2. What Were the Fixes?

### Fix 1: Runtime Hostname Detection for Base URL
Instead of relying strictly on build-time environment variables or build-time mode checks, we implemented runtime browser hostname detection.

In `client/src/services/api.ts`:
```ts
const isLocal =
  typeof window !== 'undefined' &&
  (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1');

const baseURL: string =
  import.meta.env.VITE_API_URL ||
  (!isLocal
    ? 'https://larvo-server.vercel.app/api'
    : 'http://localhost:5000/api');

const api = axios.create({
  baseURL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});
```
- **When running on Vercel** (`hostname !== 'localhost'`): Always targets `https://larvo-server.vercel.app/api`.
- **When running locally** (`hostname === 'localhost'`): Always targets `http://localhost:5000/api`.
- **If `VITE_API_URL` is set**: Honors the custom environment variable first.
- **No uncaught throws**: The app never crashes before mounting.

### Fix 2: Centralized All API Services
All service files were migrated from custom Axios instances to import the shared `api` instance from `client/src/services/api.ts`:
- `client/src/services/auth.service.ts`
- `client/src/services/user.service.ts`
- `client/src/services/wallet.service.ts`
- `client/src/services/wishlist.service.ts`

Updated inline helpers to use the same hostname detection logic:
- `client/src/services/invoice.service.ts` (`getInvoicePdfUrl`)
- `client/src/pages/admin/AdminOrdersPage.tsx` (`resolveSlipUrl`)

### Fix 3: Dual-Project CORS & Cookie Compatibility
In the backend (`server/src/app.ts` & `server/src/controllers/auth.controller.ts`):
1. **Dynamic CORS Matching**:
   ```ts
   const vercelPreviewRegex = /^https:\/\/[a-zA-Z0-9-_.]+\.vercel\.app$/;
   // Allows localhost, configured CLIENT_ORIGIN, and any *.vercel.app deployment
   ```
2. **Cross-Origin Cookie Support**:
   In production (`NODE_ENV === 'production'`), auth cookies use:
   ```ts
   sameSite: 'none',
   secure: true
   ```
   Allowing cookies to be sent across different domains (`larvo-client.vercel.app` → `larvo-server.vercel.app`).

---

## 3. Checklist: What to Check If It Happens Again

If you experience a white screen or network errors in the future, follow this sequence:

### Check A: White Screen Checklist
1. **Open Browser DevTools Console (`F12` > Console)**:
   - Look for top-level uncaught exceptions (e.g., missing env vars, syntax errors, failed imports).
   - If an error is logged before React renders, check the module throwing the error (never throw uncaught errors at file root level).
2. **Inspect HTML Response**:
   - Run `curl.exe -I https://<your-frontend>.vercel.app/`.
   - Verify that Vercel is returning `HTTP 200` and the expected JS bundle hash in `<script src="/assets/index-XXXX.js">`.
3. **Hard Reload & Cache Clear**:
   - Press `Ctrl + Shift + R` or `Cmd + Shift + R` to ensure the browser is not serving an old, broken bundle cached from a prior build.

### Check B: Network Error / API Connection Checklist
1. **Inspect Network Tab (`F12` > Network)**:
   - Filter by `Fetch/XHR`.
   - Check the **Request URL**: Is the browser calling `https://larvo-server.vercel.app/api/...` or `http://localhost:5000/...`?
   - If calling `localhost:5000`, verify `client/src/services/api.ts` has the correct `baseURL` logic and that no component creates an isolated Axios instance.
2. **Check Server Health Directly**:
   - Visit `https://larvo-server.vercel.app/api` in your browser or curl:
     ```bash
     curl https://larvo-server.vercel.app/api
     ```
   - Expect: `{"success":true,"message":"Larvo API is running",...}`.
   - If down, check MongoDB Atlas connectivity, `MONGO_URI` environment variable, or Vercel server deployment logs.
3. **Check CORS Preflight (`OPTIONS`)**:
   - In DevTools Network tab, look for `OPTIONS` requests failing with status `403` or `500`.
   - Ensure the frontend URL is allowed in `server/src/app.ts` under `cors()` configuration or via `CLIENT_ORIGIN`.
4. **Check Credentials / Cookies**:
   - Ensure `withCredentials: true` is set on the client Axios instance.
   - Ensure backend auth cookies use `sameSite: 'none'` and `secure: true` in production over HTTPS.
