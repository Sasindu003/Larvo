import { createBrowserRouter } from 'react-router-dom';
import { RootLayout } from '../components/layout/RootLayout';
import { AdminLayout } from '../components/layout/AdminLayout';
import { DeliveryLayout } from '../components/layout/DeliveryLayout';
import { Home } from '../pages/Home';
import { ProductsPage } from '../pages/ProductsPage';
import { ProductDetailsPage } from '../pages/ProductDetailsPage';
import { DepartmentPage } from '../pages/DepartmentPage';
import { CategoryPage } from '../pages/CategoryPage';
import { LoginPage } from '../pages/LoginPage';
import { RegisterPage } from '../pages/RegisterPage';
import { CartPage } from '../pages/CartPage';
import { WishlistPage } from '../pages/WishlistPage';
import { ProfilePage } from '../pages/ProfilePage';
import { WalletPage } from '../pages/WalletPage';
import { CheckoutPage } from '../pages/CheckoutPage';
import { AdminPlaceholderPage } from '../pages/AdminPlaceholderPage';
import { AdminDepartmentsPage } from '../pages/admin/AdminDepartmentsPage';
import { AdminCategoriesPage } from '../pages/admin/AdminCategoriesPage';
import { AdminInventoryPage } from '../pages/admin/AdminInventoryPage';
import { AdminProductsPage } from '../pages/admin/AdminProductsPage';
import { AdminCouponsPage } from '../pages/admin/AdminCouponsPage';
import { AdminWalletsPage } from '../pages/admin/AdminWalletsPage';
import { AdminOrdersPage } from '../pages/admin/AdminOrdersPage';
import { AdminReturnsPage } from '../pages/admin/AdminReturnsPage';
import { AdminReviewsPage } from '../pages/admin/AdminReviewsPage';
import { AdminStaffPage } from '../pages/admin/AdminStaffPage';
import { AdminAnalyticsPage } from '../pages/admin/AdminAnalyticsPage';
import { AdminSuppliersPage } from '../pages/admin/AdminSuppliersPage';
import { AdminPurchaseOrdersPage } from '../pages/admin/AdminPurchaseOrdersPage';
import { DeliveryOrdersPage } from '../pages/delivery/DeliveryOrdersPage';
import { DeliveryReturnsPage } from '../pages/delivery/DeliveryReturnsPage';
import { SupplierLayout } from '../components/layout/SupplierLayout';
import { SupplierProfilePage } from '../pages/supplier/SupplierProfilePage';
import { SupplierPurchaseOrdersPage } from '../pages/supplier/SupplierPurchaseOrdersPage';
import { SupplierProductsPage } from '../pages/supplier/SupplierProductsPage';
import { OrdersPage } from '../pages/OrdersPage';
import { InvoicePage } from '../pages/InvoicePage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { ComponentPreviewPage } from '../pages/dev/ComponentPreviewPage';
import { ProtectedRoute, RoleRoute } from '../components/auth/ProtectedRoute';
import { ROLES } from '../config/roles';

export const router = createBrowserRouter([
  {
    path: '/',
    element: <RootLayout />,
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <Home /> },
      { path: 'products', element: <ProductsPage /> },
      { path: 'products/:slug', element: <ProductDetailsPage /> },
      { path: 'departments/:slug', element: <DepartmentPage /> },
      { path: 'departments/:deptSlug/categories/:catSlug', element: <CategoryPage /> },
      { path: 'login', element: <LoginPage /> },
      { path: 'register', element: <RegisterPage /> },
      { path: 'cart', element: <CartPage /> },
      {
        path: 'checkout',
        element: (
          <ProtectedRoute>
            <CheckoutPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'wishlist',
        element: (
          <ProtectedRoute>
            <WishlistPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'profile',
        element: (
          <ProtectedRoute>
            <ProfilePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'wallet',
        element: (
          <ProtectedRoute>
            <WalletPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'orders',
        element: (
          <ProtectedRoute>
            <OrdersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'orders/:orderId',
        element: (
          <ProtectedRoute>
            <OrdersPage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'orders/:id/invoice',
        element: (
          <ProtectedRoute>
            <InvoicePage />
          </ProtectedRoute>
        ),
      },
      {
        path: 'orders/:orderId/invoice',
        element: (
          <ProtectedRoute>
            <InvoicePage />
          </ProtectedRoute>
        ),
      },
      { path: 'dev/components', element: <ComponentPreviewPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/admin',
    element: (
      <ProtectedRoute>
        <RoleRoute roles={ROLES.STAFF_AND_ABOVE}>
          <AdminLayout />
        </RoleRoute>
      </ProtectedRoute>
    ),
    errorElement: <NotFoundPage />,
    children: [
      { path: 'departments', element: <AdminDepartmentsPage /> },
      { path: 'categories', element: <AdminCategoriesPage /> },
      { path: 'products', element: <AdminProductsPage /> },
      { path: 'inventory', element: <AdminInventoryPage /> },
      { path: 'coupons', element: <AdminCouponsPage /> },
      {
        path: 'wallets',
        element: (
          <RoleRoute roles={ROLES.ADMIN_AND_ABOVE}>
            <AdminWalletsPage />
          </RoleRoute>
        ),
      },
      { path: 'orders', element: <AdminOrdersPage /> },
      { path: 'returns', element: <AdminReturnsPage /> },
      { path: 'reviews', element: <AdminReviewsPage /> },
      {
        path: 'staff',
        element: (
          <RoleRoute roles={ROLES.ADMIN_AND_ABOVE}>
            <AdminStaffPage />
          </RoleRoute>
        ),
      },
      {
        path: 'analytics',
        element: (
          <RoleRoute roles={ROLES.ADMIN_AND_ABOVE}>
            <AdminAnalyticsPage />
          </RoleRoute>
        ),
      },
      { path: 'suppliers', element: <AdminSuppliersPage /> },
      {
        path: 'purchase-orders',
        element: (
          <RoleRoute roles={ROLES.ADMIN_AND_ABOVE}>
            <AdminPurchaseOrdersPage />
          </RoleRoute>
        ),
      },
      { path: '*', element: <AdminPlaceholderPage /> },
    ],
  },
  {
    path: '/delivery',
    element: (
      <ProtectedRoute>
        <RoleRoute roles={ROLES.DELIVERY}>
          <DeliveryLayout />
        </RoleRoute>
      </ProtectedRoute>
    ),
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <DeliveryOrdersPage /> },
      { path: 'orders', element: <DeliveryOrdersPage /> },
      { path: 'returns', element: <DeliveryReturnsPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
  {
    path: '/supplier',
    element: (
      <ProtectedRoute>
        <RoleRoute roles={ROLES.SUPPLIER}>
          <SupplierLayout />
        </RoleRoute>
      </ProtectedRoute>
    ),
    errorElement: <NotFoundPage />,
    children: [
      { index: true, element: <SupplierProductsPage /> },
      { path: 'purchase-orders', element: <SupplierPurchaseOrdersPage /> },
      { path: 'products', element: <SupplierProductsPage /> },
      { path: 'profile', element: <SupplierProfilePage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
]);
