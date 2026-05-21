import { Router } from 'express';
import { getUserProfile, getLeaderboard } from './userController';
import { authenticateTokenLoose } from '../middleware/authMiddleware';

const router = Router();

router.get('/leaderboard', getLeaderboard as any);
router.get('/:username', authenticateTokenLoose as any, getUserProfile as any);

export default router;
