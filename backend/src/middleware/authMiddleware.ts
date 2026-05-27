import { Request, Response, NextFunction } from 'express';
import jsonwebtoken from 'jsonwebtoken';
import { prisma } from '../utils/db';
import { RoleName, mapRoleToLegacy } from '../utils/constants';
import { supabase } from '../utils/supabase';

export interface AuthRequest extends Request {
  user?: {
    id: string;
    username: string;
    email: string;
    role: string; // The role name (string)
    isShadowBanned: boolean;
  };
}

export const authenticateToken = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (authError || !supabaseUser) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    const userId = supabaseUser.id;

    // Fetch fresh user data from DB to check bans/suspensions and role name
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { role: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'User no longer exists' });
    }

    if (user.isBanned) {
      return res.status(403).json({ error: 'This account has been permanently banned' });
    }

    if (user.bannedUntil && new Date() < new Date(user.bannedUntil)) {
      return res.status(403).json({
        error: `This account is temporarily suspended until ${user.bannedUntil.toISOString()}`,
      });
    }

    req.user = {
      id: user.id,
      username: user.username,
      email: user.email,
      role: mapRoleToLegacy(user.role.name),
      isShadowBanned: user.isShadowBanned,
    };

    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

export const requireRole = (roles: string[]) => {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    if (!roles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Forbidden: Insufficient privileges' });
    }

    next();
  };
};

export const authenticateTokenLoose = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  if (!token) {
    return next();
  }

  try {
    const { data: { user: supabaseUser }, error: authError } = await supabase.auth.getUser(token);
    
    if (!authError && supabaseUser) {
      const userId = supabaseUser.id;
      const user = await prisma.user.findUnique({
        where: { id: userId },
        include: { role: true }
      });

      if (user && !user.isBanned) {
        req.user = {
          id: user.id,
          username: user.username,
          email: user.email,
          role: mapRoleToLegacy(user.role.name),
          isShadowBanned: user.isShadowBanned,
        };
      }
    }
  } catch (error) {
    // Ignore verification errors, proceed as anonymous
  }
  next();
};

export const uploadRateLimiter = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  // Exempt admins, superadmins, and moderators
  if (req.user.role !== RoleName.USER) {
    return next();
  }

  try {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const count = await prisma.slangEntry.count({
      where: {
        uploaderId: req.user.id,
        createdAt: {
          gte: oneHourAgo,
        },
      },
    });

    if (count >= 5) {
      return res.status(429).json({
        error: 'Upload rate limit exceeded. You can only upload up to 5 slang entries per hour.',
      });
    }

    next();
  } catch (error: any) {
    return res.status(500).json({ error: 'Error checking upload rate limit.' });
  }
};

