# Customer Reviews Feature — Frontend Log History

**Date**: 2026-09-15  
**Status**: Deferred / Removed from Frontend  
**Scope**: Frontend only (Backend code untouched per instructions)

---

## 1. What Happened

1. **Original Scope (P30)**:
   - A customer reviews and rating system was originally planned under milestone P30.
   - The frontend contained a static dashed placeholder banner on `ProductDetailsPage.tsx`:
     ```tsx
     <div className="border border-dashed border-sand-300 rounded-xl p-5 text-center mt-2 bg-sand-50">
       <p className="text-xs font-semibold uppercase tracking-widest text-ink-400">
         Customer Reviews — Coming in P30
       </p>
     </div>
     ```
   - In addition, next to the star rating, it showed `({product.ratingCount} reviews)`.

2. **Decision**:
   - Because time constraints did not permit implementing the end-to-end customer review submission and listing flow, all user-facing "Customer Reviews" placeholder labels and review counters were removed from the frontend.
   - Backend models and schemas remain completely untouched.

---

## 2. Changes Made (Frontend Only)

- **File**: `client/src/pages/ProductDetailsPage.tsx`
  - Removed the dashed `Customer Reviews — Coming in P30` container block below the product description.
  - Removed the `({product.ratingCount} reviews)` label from the header rating display, keeping only the star icons and numeric `ratingAvg.toFixed(1)`.

---

## 3. Existing Backend State (Untouched)

- **Model**: `server/src/models/Product.ts`
  - `ratingAvg`: `{ type: Number, default: 0, min: 0, max: 5 }`
  - `ratingCount`: `{ type: Number, default: 0, min: 0 }`
- **Missing Backend Components**:
  - No `Review` Mongoose schema or collection currently exists.
  - No endpoints exist for submitting reviews (`POST /api/products/:id/reviews`) or listing reviews (`GET /api/products/:id/reviews`).
  - No aggregation pipeline exists to automatically update `Product.ratingAvg` and `Product.ratingCount` when reviews are submitted or deleted.

---

## 4. Implementation Blueprint (To Fix Later)

When ready to implement Customer Reviews:

### Backend
1. Create `server/src/models/Review.ts`:
   - Fields: `product` (ObjectId ref Product), `user` (ObjectId ref User), `rating` (1–5), `title` (String), `comment` (String), `verifiedPurchase` (Boolean), `createdAt`.
   - Add compound index: `{ product: 1, user: 1 }` to prevent duplicate reviews per order/product.
2. Add Mongoose static or post-save hook on `Review` model to recalculate `ratingAvg` and `ratingCount` on `Product`.
3. Add controller & service in `server/src/services/review.service.ts` and `server/src/controllers/review.controller.ts`:
   - `GET /api/products/:productId/reviews` — public paginated list with rating breakdown (5-star, 4-star, etc.).
   - `POST /api/products/:productId/reviews` — `requireAuth`, validates user purchased the product.
4. Mount routes in `server/src/app.ts` under `/api/products/:productId/reviews`.

### Frontend
1. Create `client/src/services/review.service.ts`:
   - `getReviews(productId, params)`
   - `submitReview(productId, payload)`
2. In `client/src/pages/ProductDetailsPage.tsx`:
   - Add interactive review submission form (star rating selector, title, comment).
   - Add review list with pagination, date, verified purchaser badge, and breakdown bars.

---

## 5. Feature Implemented & Restored

**Date**: 2026-09-21  
**Status**: Fully Implemented & Verified  

### Completed Scope:
1. **Backend**:
   - `server/src/models/Review.ts` with compound unique index (`{ product: 1, user: 1 }`), `calcAverageRating` static pipeline updating `Product.ratingAvg` & `Product.ratingCount`, GridFS `photos[]`, helpful voting (`helpfulVotes.up`, `helpfulVotes.down`), and `adminReply`.
   - `server/src/validators/review.validator.ts` with Zod validation.
   - `server/src/services/review.service.ts` enforcing strict delivered-order gate: `Order.findOne({ user: userId, 'items.product': productId, status: 'delivered' })`.
   - `server/src/controllers/review.controller.ts` & `server/src/routes/review.routes.ts` mounted at `/api/reviews`.
   - `server/src/routes/file.routes.ts` with `POST /upload` saving up to 5 review photos directly to MongoDB GridFS.
2. **Admin Dashboard**:
   - `client/src/pages/admin/AdminReviewsPage.tsx` registered at `/admin/reviews` with analytics cards, 5★-1★ breakdown, filters, status toggling (`published`/`hidden`/`flagged`), official store reply modal, photo lightbox, and delete moderation.
   - Added `Reviews` nav link in `client/src/config/roles.ts` and `MessageSquare` icon in `client/src/components/layout/AdminLayout.tsx`.
3. **Storefront**:
   - Restored rating count and review link in `client/src/pages/ProductDetailsPage.tsx`.
   - Added AliExpress-style photo gallery strip with star overlays and full-screen lightbox.
   - Added delivered-order eligibility gate: only users with a delivered order for the product can submit reviews. Shows helpful contextual notices for non-delivered/non-purchaser states.
   - Interactive review submission modal with 5-star rating, review title, detailed comment, and multi-photo upload to GridFS.
   - Helpful vote buttons (`👍 Helpful / 👎`) with instant feedback.
