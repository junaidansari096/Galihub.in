import { Router } from 'express';
import {
  getModerationQueue,
  reviewUpload,
  updateUserStatus,
  getAuditLogs,
  getSystemStats,
  updateSlangFlags
} from './adminController';
import { authenticateToken, requireRole } from '../middleware/authMiddleware';
import { RoleName } from '../utils/constants';

const router = Router();

// Mod, Admin, and SuperAdmin can see queue, run reviews, and view stats
router.get(
  '/queue',
  authenticateToken as any,
  requireRole([RoleName.MODERATOR, RoleName.ADMIN, RoleName.SUPERADMIN]) as any,
  getModerationQueue as any
);

router.post(
  '/review',
  authenticateToken as any,
  requireRole([RoleName.MODERATOR, RoleName.ADMIN, RoleName.SUPERADMIN]) as any,
  reviewUpload as any
);

router.get(
  '/stats',
  authenticateToken as any,
  requireRole([RoleName.MODERATOR, RoleName.ADMIN, RoleName.SUPERADMIN]) as any,
  getSystemStats as any
);

// Toggle NSFW, verified, featured tags (Admin, SuperAdmin, or Uploader verified inside controller)
router.put(
  '/slang/:id/flags',
  authenticateToken as any,
  updateSlangFlags as any
);

// Only Admins and SuperAdmins can manage users and read audit logs
router.post(
  '/users/ban',
  authenticateToken as any,
  requireRole([RoleName.ADMIN, RoleName.SUPERADMIN]) as any,
  updateUserStatus as any
);

router.get(
  '/logs',
  authenticateToken as any,
  requireRole([RoleName.ADMIN, RoleName.SUPERADMIN]) as any,
  getAuditLogs as any
);

export default router;
