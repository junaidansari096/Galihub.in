import express, { Request, Response, NextFunction } from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './auth/authRoutes';
import gaaliRoutes from './gaalis/gaaliRoutes';
import userRoutes from './users/userRoutes';
import adminRoutes from './admin/adminRoutes';
import logger from './utils/logger';

// Load Env variables
dotenv.config();

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    // Allow local development and mobile request origins dynamically
    callback(null, true);
  },
  credentials: true
}));
app.use(express.json());

// Request logging middleware
app.use((req: Request, res: Response, next: NextFunction) => {
  logger.info(`${req.method} ${req.originalUrl}`);
  next();
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/gaalis', gaaliRoutes);
app.use('/api/users', userRoutes);
app.use('/api/admin', adminRoutes);

// Health check endpoint
app.get('/health', (req: Request, res: Response) => {
  res.status(200).json({ status: 'OK', uptime: process.uptime() });
});

// Centralized error handling
app.use((err: any, req: Request, res: Response, next: NextFunction) => {
  logger.error(err.stack || err.message || 'Global error handler caught an issue');
  res.status(500).json({ error: err.message || 'Internal Server Error' });
});

// Start Server only if not running on Vercel
if (process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    logger.info(`🚀 GaaliHub Backend running on port ${PORT} in ${process.env.NODE_ENV || 'development'} mode.`);
  });
}

// Export the Express API for Vercel Serverless Functions
export default app;
