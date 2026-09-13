import 'dotenv/config';
import type { IncomingMessage, ServerResponse } from 'http';
import { connectDB } from '../server/src/config/db';
import app from '../server/src/app';

function setCorsHeaders(req: IncomingMessage, res: ServerResponse) {
  const origin = req.headers.origin;
  const allowedOrigins = (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
  const vercelPreviewRegex = /^https:\/\/[a-zA-Z0-9-_.]+\.vercel\.app$/;

  if (origin && (allowedOrigins.includes(origin) || vercelPreviewRegex.test(origin))) {
    res.setHeader('Access-Control-Allow-Origin', origin);
  } else if (!origin) {
    res.setHeader('Access-Control-Allow-Origin', '*');
  }
  res.setHeader('Access-Control-Allow-Credentials', 'true');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,Authorization');
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.end();
    return;
  }

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
