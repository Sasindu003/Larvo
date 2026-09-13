import 'dotenv/config';
import type { Request, Response } from 'express';
import { connectDB } from '../src/config/db';
import app from '../src/app';

export default async function handler(req: Request, res: Response) {
  try {
    await connectDB();
    return (app as any)(req, res);
  } catch (error) {
    console.error('Database connection failed in serverless handler:', error);
    return res.status(500).json({
      success: false,
      message: 'Failed to connect to database',
      error: (error as Error).message,
    });
  }
}
