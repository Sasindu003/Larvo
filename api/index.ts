import 'dotenv/config';
import type { IncomingMessage, ServerResponse } from 'http';
import { connectDB } from '../server/src/config/db';
import app from '../server/src/app';

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  try {
    await connectDB();
    return (app as any)(req, res);
  } catch (error) {
    console.error('Database connection failed in serverless handler:', error);
    res.statusCode = 500;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: false,
        message: 'Failed to connect to database',
        error: (error as Error).message,
      })
    );
  }
}
