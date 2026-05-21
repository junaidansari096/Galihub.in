import { Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { prisma, getRoleId } from '../utils/db';
import { AuthRequest } from '../middleware/authMiddleware';
import { RoleName, mapRoleToLegacy } from '../utils/constants';

// Helper to map reputation score (Int) to a label (String)
export const getReputationLabel = (points: number): string => {
  if (points >= 1500) return 'Slang Master';
  if (points >= 500) return 'Meme King';
  if (points >= 100) return 'Local Legend';
  return 'Beginner';
};

const signToken = (user: { id: string; username: string; email: string; role: string }) => {
  const secret = process.env.JWT_SECRET || 'fallback_secret';
  return jwt.sign(
    { id: user.id, username: user.username, email: user.email, role: mapRoleToLegacy(user.role) },
    secret,
    { expiresIn: '7d' }
  );
};

export const signup = async (req: AuthRequest, res: Response) => {
  try {
    const { username, email, password, region } = req.body;

    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }

    // Clean inputs
    const cleanUsername = username.trim().toLowerCase();
    const cleanEmail = email.trim().toLowerCase();

    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { username: cleanUsername },
          { email: cleanEmail }
        ]
      }
    });

    if (existingUser) {
      return res.status(400).json({ error: 'Username or email already in use' });
    }

    // Hash password
    const salt = await bcrypt.genSalt(10);
    const passwordHash = await bcrypt.hash(password, salt);

    // Super Admin logic (make first user super_admin)
    const userCount = await prisma.user.count();
    const roleName = userCount === 0 ? RoleName.SUPERADMIN : RoleName.USER;
    const roleId = await getRoleId(roleName) as string;

    const points = roleName === RoleName.SUPERADMIN ? 1000 : 0;
    const reputation = roleName === RoleName.SUPERADMIN ? 1500 : 0;

    // Create user along with profile
    const user = await prisma.user.create({
      data: {
        username: cleanUsername,
        email: cleanEmail,
        passwordHash,
        roleId,
        points,
        reputation,
        profile: {
          create: {
            region: region || 'Unknown',
            avatarUrl: `https://api.dicebear.com/7.x/bottts/svg?seed=${cleanUsername}`
          }
        }
      },
      include: {
        role: true,
        profile: true
      }
    });

    const token = signToken({
      id: user.id,
      username: user.username,
      email: user.email,
      role: user.role.name
    });

    return res.status(201).json({
      token,
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: mapRoleToLegacy(user.role.name),
        points: user.points,
        reputation: getReputationLabel(user.reputation),
        region: user.profile?.region || 'Unknown',
        avatar: user.profile?.avatarUrl
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error creating user' });
  }
};

export const login = async (req: AuthRequest, res: Response) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const cleanEmail = email.trim().toLowerCase();

    const user = await prisma.user.findUnique({
      where: { email: cleanEmail },
      include: {
        role: true,
        profile: true
      }
    });

    if (!user) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Check bans
    if (user.isBanned) {
      return res.status(403).json({ error: 'This account has been permanently banned' });
    }

    if (user.bannedUntil && new Date() < new Date(user.bannedUntil)) {
      return res.status(403).json({
        error: `This account is temporarily suspended until ${user.bannedUntil.toISOString()}`,
      });
    }

    // Verify password
    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid email or password' });
    }

    // Daily login reward (1 point)
    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: {
        points: { increment: 1 },
      },
      include: {
        role: true,
        profile: true
      }
    });

    const token = signToken({
      id: updatedUser.id,
      username: updatedUser.username,
      email: updatedUser.email,
      role: updatedUser.role.name
    });

    return res.status(200).json({
      token,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        email: updatedUser.email,
        role: mapRoleToLegacy(updatedUser.role.name),
        points: updatedUser.points,
        reputation: getReputationLabel(updatedUser.reputation),
        region: updatedUser.profile?.region || 'Unknown',
        avatar: updatedUser.profile?.avatarUrl
      },
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error logging in' });
  }
};

export const getProfile = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      include: {
        role: true,
        profile: true
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.status(200).json({
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        role: mapRoleToLegacy(user.role.name),
        points: user.points,
        reputation: getReputationLabel(user.reputation),
        region: user.profile?.region || 'Unknown',
        avatar: user.profile?.avatarUrl,
        isBanned: user.isBanned,
        isShadowBanned: user.isShadowBanned,
        createdAt: user.createdAt,
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error fetching profile' });
  }
};
