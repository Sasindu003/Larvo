import request from 'supertest';
import mongoose, { Types } from 'mongoose';
import jwt from 'jsonwebtoken';
import app from '../../src/app';
import User, { IUser, UserRole } from '../../src/models/User';
import { Product, IProduct } from '../../src/models/Product';
import { Order, IOrder } from '../../src/models/Order';
import { Category } from '../../src/models/Category';
import { env } from '../../src/config/env';

export const DEFAULT_TEST_PASSWORD = 'Password123!';

/**
 * Creates and persists a user in the test database.
 */
export async function createUser(
  role: UserRole = 'customer',
  overrides: Partial<any> = {}
): Promise<IUser> {
  const rand = Math.random().toString(36).slice(2, 8);
  const email = overrides.email || `${role}-${rand}@example.com`;
  const name = overrides.name || `Test ${role.charAt(0).toUpperCase() + role.slice(1)} ${rand}`;

  const user = await User.create({
    name,
    email: email.toLowerCase().trim(),
    passwordHash: overrides.password || DEFAULT_TEST_PASSWORD,
    role,
    active: overrides.active !== undefined ? overrides.active : true,
    addresses: overrides.addresses || [
      {
        label: 'Home',
        line1: '123 Main St',
        city: 'Bangkok',
        province: 'Bangkok',
        postalCode: '10110',
        country: 'Thailand',
        isDefault: true,
      },
    ],
    ...overrides,
  });

  return user;
}

/**
 * Creates a user with the requested role and authenticates a supertest agent,
 * returning the agent with the auth cookie set, the user document, and raw JWT token.
 */
export async function loginAs(
  role: UserRole = 'customer',
  userOverrides: Partial<any> = {}
): Promise<{
  agent: ReturnType<typeof request.agent>;
  user: IUser;
  token: string;
}> {
  const user = await createUser(role, userOverrides);
  const agent = request.agent(app);

  const secret = env.JWT_SECRET;
  const token = jwt.sign(
    { sub: user._id, role: user.role },
    secret,
    { expiresIn: '7d' }
  );

  // Set auth cookie directly on agent jar
  agent.jar.setCookie(`slt=${token}; Path=/; HttpOnly`);

  // Intercept state-changing methods to include allowed Origin header for CSRF guard
  const origPost = agent.post.bind(agent);
  agent.post = (url: string) => origPost(url).set('Origin', 'http://localhost:5173');

  const origPatch = agent.patch.bind(agent);
  agent.patch = (url: string) => origPatch(url).set('Origin', 'http://localhost:5173');

  const origPut = agent.put.bind(agent);
  agent.put = (url: string) => origPut(url).set('Origin', 'http://localhost:5173');

  const origDelete = agent.delete.bind(agent);
  agent.delete = (url: string) => origDelete(url).set('Origin', 'http://localhost:5173');

  return { agent, user, token };
}

/**
 * Creates and persists a test product with valid category and variants.
 */
export async function createProduct(overrides: Partial<any> = {}): Promise<IProduct> {
  const rand = Math.random().toString(36).slice(2, 8);

  let categoryId = overrides.category;
  if (!categoryId) {
    const category = await Category.create({
      name: `Category ${rand}`,
      slug: `category-${rand}`,
      image: 'https://example.com/cat.jpg',
      department: new mongoose.Types.ObjectId(),
    });
    categoryId = category._id;
  }

  const sku = overrides.sku || `SKU-${rand.toUpperCase()}`;

  const product = await Product.create({
    name: overrides.name || `Product ${rand}`,
    slug: overrides.slug || `product-${rand}`,
    description: overrides.description || `Description for product ${rand}`,
    category: categoryId,
    images: overrides.images || ['https://example.com/test-image.jpg'],
    basePrice: overrides.basePrice !== undefined ? overrides.basePrice : 500,
    status: overrides.status || 'active',
    variants: overrides.variants || [
      {
        size: 'M',
        color: 'Navy',
        material: 'Cotton',
        sku,
        stock: overrides.stock !== undefined ? overrides.stock : 25,
      },
    ],
    ...overrides,
  });

  return product;
}

/**
 * Creates and persists a test order.
 */
export async function createOrder(
  user: IUser,
  overrides: Partial<any> = {}
): Promise<IOrder> {
  const rand = Math.random().toString(36).slice(2, 8);
  const product = overrides.product || (await createProduct());
  const variant = product.variants[0];

  const order = await Order.create({
    user: user._id,
    items: overrides.items || [
      {
        product: product._id,
        name: product.name,
        image: product.images[0] || 'https://example.com/item.jpg',
        variantSku: variant.sku,
        size: variant.size,
        color: variant.color,
        unitPrice: product.basePrice,
        quantity: 2,
        lineTotal: product.basePrice * 2,
      },
    ],
    shippingAddress: overrides.shippingAddress || {
      line1: '123 Shipping Lane',
      city: 'Bangkok',
      province: 'Bangkok',
      postalCode: '10110',
      country: 'Thailand',
    },
    subtotal: overrides.subtotal !== undefined ? overrides.subtotal : 1000,
    shippingFee: overrides.shippingFee !== undefined ? overrides.shippingFee : 50,
    discountAmount: overrides.discountAmount !== undefined ? overrides.discountAmount : 0,
    total: overrides.total !== undefined ? overrides.total : 1050,
    status: overrides.status || 'pending_payment',
    ...overrides,
  });

  return order;
}
