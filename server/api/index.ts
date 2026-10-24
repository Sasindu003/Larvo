import 'dotenv/config';
import { env } from '../src/config/env';
import type { Request, Response } from 'express';
import { connectDB } from '../src/config/db';
import app from '../src/app';

// Validate environment configuration eagerly upon module load
if (!env) {
  throw new Error('Environment configuration failed to initialize');
}

export default async function handler(req: Request, res: Response) {
  try {
    await connectDB();
    return app(req, res);
  } catch (error) {
    console.error('Database connection failed in serverless handler:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to connect to database',
      error: (error as Error).message,
    });
  }
}
