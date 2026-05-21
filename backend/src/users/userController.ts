import { Response } from 'express';
import { prisma } from '../utils/db';
import { AuthRequest } from '../middleware/authMiddleware';
import { PostStatus, RoleName, mapRoleToLegacy } from '../utils/constants';
import { getReputationLabel } from '../auth/authController';

export const getUserProfile = async (req: AuthRequest, res: Response) => {
  try {
    const { username } = req.params;
    const callerId = req.user?.id;
    const callerRole = req.user?.role;

    const user = await prisma.user.findUnique({
      where: { username: username.toLowerCase().trim() },
      include: {
        role: true,
        profile: true,
        slangEntries: {
          include: {
            tags: {
              include: {
                tag: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Determine visibility of uploaded slangs
    // The user themselves and admins/mods can see all. Others only see APPROVED.
    const canSeeAll = callerId === user.id || 
                     callerRole === RoleName.MODERATOR || 
                     callerRole === RoleName.ADMIN || 
                     callerRole === RoleName.SUPERADMIN;

    const visibleEntries = canSeeAll 
      ? user.slangEntries 
      : user.slangEntries.filter(g => g.moderationStatus === PostStatus.APPROVED);

    // Compute stats
    const totalViews = user.slangEntries
      .filter(g => g.moderationStatus === PostStatus.APPROVED)
      .reduce((sum, g) => sum + g.views, 0);

    const totalLikes = user.slangEntries
      .filter(g => g.moderationStatus === PostStatus.APPROVED)
      .reduce((sum, g) => sum + g.likesCount, 0);

    // Flatten tags for compatibility with the frontend structure
    const formattedGaalis = visibleEntries.map(g => ({
      ...g,
      likes: g.likesCount,
      dislikes: g.dislikesCount,
      status: g.moderationStatus,
      tags: g.tags.map(t => t.tag)
    }));

    return res.status(200).json({
      profile: {
        id: user.id,
        username: user.username,
        region: user.profile?.region || 'Unknown',
        points: user.points,
        reputation: getReputationLabel(user.reputation),
        role: mapRoleToLegacy(user.role.name),
        avatar: user.profile?.avatarUrl,
        createdAt: user.createdAt,
        stats: {
          totalUploads: visibleEntries.length,
          totalViews,
          totalLikes
        },
        gaalis: formattedGaalis
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error fetching user profile' });
  }
};

export const getLeaderboard = async (req: AuthRequest, res: Response) => {
  try {
    const users = await prisma.user.findMany({
      where: {
        isBanned: false
      },
      include: {
        role: true,
        profile: true
      },
      orderBy: {
        points: 'desc'
      },
      take: 10
    });

    const formattedLeaderboard = users.map(user => ({
      id: user.id,
      username: user.username,
      points: user.points,
      reputation: getReputationLabel(user.reputation),
      role: mapRoleToLegacy(user.role.name),
      avatar: user.profile?.avatarUrl,
      region: user.profile?.region || 'Unknown'
    }));

    return res.status(200).json({ leaderboard: formattedLeaderboard });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error fetching leaderboard' });
  }
};
