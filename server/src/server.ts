import { env } from './config/env';
import app from './app';
import { connectDB } from './config/db';

const PORT = env.PORT;

const startServer = async () => {
  try {
    await connectDB();
  } catch (error) {
    console.error('Fatal MongoDB connection failure during server bootstrap:', error);
    process.exit(1);
  }

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT} in ${env.NODE_ENV} mode`);
  });
};

startServer();
