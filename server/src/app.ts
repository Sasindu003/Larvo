import express, { Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import path from 'path';
import mongoose from 'mongoose';
import { env } from './config/env';
import { notFound, errorHandler } from './middleware/error.middleware';
import { requireAuth } from './middleware/auth.middleware';
import { requireRole } from './middleware/rbac.middleware';

import categoryRoutes from './routes/category.routes';
import productRoutes from './routes/product.routes';
import authRoutes from './routes/auth.routes';
import adminRoutes from './routes/admin.routes';
import wishlistRoutes from './routes/wishlist.routes';
import userRoutes from './routes/user.routes';
import departmentRoutes from './routes/department.routes';
import inventoryRoutes from './routes/inventory.routes';
import couponRoutes from './routes/coupon.routes';
import walletRoutes from './routes/wallet.routes';
import orderRoutes from './routes/order.routes';
import paymentRoutes from './routes/payment.routes';
import deliveryRoutes from './routes/delivery.routes';
import invoiceRoutes from './routes/invoice.routes';
import staffRoutes from './routes/staff.routes';
import returnRoutes from './routes/return.routes';
import fileRoutes from './routes/file.routes';
import supplierRoutes from './routes/supplier.routes';
import reviewRoutes from './routes/review.routes';

import { csrfGuard, isOriginAllowed } from './middleware/csrfGuard';

const app = express();

// Strict CORS configuration: derived from CLIENT_URL and CLIENT_ORIGIN (plus localhost in dev/test)
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || isOriginAllowed(origin)) {
        return callback(null, true);
      }
      return callback(null, false);
    },
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With'],
  })
);

// Body parsers & cookies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cookieParser());

// CSRF Guard middleware: mounted after CORS and body parsers, before routes
app.use(csrfGuard);

// Stream files (payment slips, images) directly from MongoDB GridFS & upload files
app.use(['/uploads', '/api/uploads'], fileRoutes);
app.use('/api/files', fileRoutes);

// Root & health endpoints
app.get(['/', '/api'], (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    message: 'Larvo API is running',
    timestamp: new Date().toISOString(),
  });
});

// Public health check endpoint
app.get('/api/health', (_req: Request, res: Response) => {
  const isConnected = mongoose.connection.readyState === 1;
  const dbStatus = isConnected ? 'connected' : 'disconnected';

  res.status(200).json({
    success: true,
    data: {
      status: 'ok',
      db: dbStatus,
    },
  });
});

// Detailed diagnostics (internal/admin only)
app.get(
  '/api/health/detail',
  requireAuth,
  requireRole('admin', 'owner'),
  (_req: Request, res: Response) => {
    const isConnected = mongoose.connection.readyState === 1;
    const dbStatus = isConnected ? 'connected' : 'disconnected';

    res.status(200).json({
      success: true,
      data: {
        status: 'ok',
        uptime: process.uptime(),
        db: dbStatus,
        timestamp: new Date().toISOString(),
        nodeVersion: process.version,
        memoryUsage: process.memoryUsage(),
      },
    });
  }
);

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/wishlist', wishlistRoutes);
app.use('/api/departments', departmentRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/products', productRoutes);
app.use('/api/inventory', inventoryRoutes);
app.use('/api/coupons', couponRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/orders', orderRoutes);
app.use('/api/payments', paymentRoutes);
app.use('/api/delivery', deliveryRoutes);
app.use('/api/invoices', invoiceRoutes);
app.use('/api/staff', staffRoutes);
app.use('/api/returns', returnRoutes);
app.use('/api/supplier', supplierRoutes);
app.use('/api/reviews', reviewRoutes);

// 404 & Centralized Error Handlers
app.use(notFound);
app.use(errorHandler);

export default app;
