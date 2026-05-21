import { Router } from 'express';
import {
  uploadGaali,
  searchGaalis,
  getGaaliBySlug,
  toggleLike,
  toggleDislike,
  addComment,
  getRandomGaali
} from './gaaliController';
import { authenticateToken, authenticateTokenLoose } from '../middleware/authMiddleware';

const router = Router();

router.post('/upload', authenticateToken as any, uploadGaali as any);
router.get('/', authenticateTokenLoose as any, searchGaalis as any);
router.get('/random', authenticateTokenLoose as any, getRandomGaali as any);
router.get('/:slug', authenticateTokenLoose as any, getGaaliBySlug as any);
router.post('/:id/like', authenticateToken as any, toggleLike as any);
router.post('/:id/dislike', authenticateToken as any, toggleDislike as any);
router.post('/:id/comment', authenticateToken as any, addComment as any);

export default router;
