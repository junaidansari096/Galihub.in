import { Router } from 'express';
import { signup, login, getProfile } from './authController';
import { authenticateToken } from '../middleware/authMiddleware';

const router = Router();

router.post('/signup', signup as any);
router.post('/login', login as any);
router.get('/profile', authenticateToken as any, getProfile as any);

export default router;
