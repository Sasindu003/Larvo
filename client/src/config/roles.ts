export type UserRole = 'customer' | 'staff' | 'admin' | 'owner' | 'delivery_manager';

export const ROLES = {
  /** All roles — any authenticated user */
  ANY: ['customer', 'staff', 'admin', 'owner', 'delivery_manager'] as const,

  /** Staff, Admin, and Owner */
  STAFF_AND_ABOVE: ['staff', 'admin', 'owner'] as const,

  /** Admin and Owner only */
  ADMIN_AND_ABOVE: ['admin', 'owner'] as const,

  /** Owner only */
  OWNER_ONLY: ['owner'] as const,

  /** Delivery operations */
  DELIVERY: ['delivery_manager', 'admin', 'owner'] as const,
} as const;

export interface AdminNavItem {
  title: string;
  slug: string;
  href: string;
  iconName: string;
  description: string;
  allowedRoles: readonly UserRole[];
}

export const ADMIN_NAV_ITEMS: AdminNavItem[] = [
  {
    title: 'Departments',
    slug: 'departments',
    href: '/admin/departments',
    iconName: 'Layers',
    description: 'Manage top-level store departments',
    allowedRoles: ROLES.STAFF_AND_ABOVE,
  },
  {
    title: 'Categories',
    slug: 'categories',
    href: '/admin/categories',
    iconName: 'FolderTree',
    description: 'Manage department subcategories',
    allowedRoles: ROLES.STAFF_AND_ABOVE,
  },
  {
    title: 'Products',
    slug: 'products',
    href: '/admin/products',
    iconName: 'Package',
    description: 'Manage apparel catalog and variants',
    allowedRoles: ROLES.STAFF_AND_ABOVE,
  },
  {
    title: 'Inventory',
    slug: 'inventory',
    href: '/admin/inventory',
    iconName: 'Boxes',
    description: 'Stock tracking and variant inventory',
    allowedRoles: ROLES.STAFF_AND_ABOVE,
  },
  {
    title: 'Coupons',
    slug: 'coupons',
    href: '/admin/coupons',
    iconName: 'Ticket',
    description: 'Promotional discounts and vouchers',
    allowedRoles: ROLES.STAFF_AND_ABOVE,
  },
  {
    title: 'Reward Wallets',
    slug: 'wallets',
    href: '/admin/wallets',
    iconName: 'Wallet',
    description: 'Customer point balances and adjustments',
    allowedRoles: ROLES.ADMIN_AND_ABOVE,
  },
  {
    title: 'Orders',
    slug: 'orders',
    href: '/admin/orders',
    iconName: 'ShoppingCart',
    description: 'Customer orders and payment verification',
    allowedRoles: ROLES.STAFF_AND_ABOVE,
  },
  {
    title: 'Returns',
    slug: 'returns',
    href: '/admin/returns',
    iconName: 'RotateCcw',
    description: 'Return requests and refund tracking',
    allowedRoles: ROLES.STAFF_AND_ABOVE,
  },
  {
    title: 'Staff',
    slug: 'staff',
    href: '/admin/staff',
    iconName: 'Users',
    description: 'Team member roles and permissions',
    allowedRoles: ROLES.ADMIN_AND_ABOVE,
  },
  {
    title: 'Analytics',
    slug: 'analytics',
    href: '/admin/analytics',
    iconName: 'BarChart3',
    description: 'Sales performance and revenue reports',
    allowedRoles: ROLES.ADMIN_AND_ABOVE,
  },
  {
    title: 'Suppliers',
    slug: 'suppliers',
    href: '/admin/suppliers',
    iconName: 'Truck',
    description: 'Vendor directory and supplier contacts',
    allowedRoles: ROLES.STAFF_AND_ABOVE,
  },
  {
    title: 'Purchase Orders',
    slug: 'purchase-orders',
    href: '/admin/purchase-orders',
    iconName: 'ClipboardList',
    description: 'Stock replenishment and purchase orders',
    allowedRoles: ROLES.ADMIN_AND_ABOVE,
  },
];
