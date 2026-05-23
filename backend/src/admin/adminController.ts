import { Response } from 'express';
import { prisma } from '../utils/db';
import { AuthRequest } from '../middleware/authMiddleware';
import { PostStatus, RoleName, mapRoleToLegacy } from '../utils/constants';
import { getReputationLabel } from '../auth/authController';

export const getModerationQueue = async (req: AuthRequest, res: Response) => {
  try {
    const queue = await prisma.slangEntry.findMany({
      where: {
        moderationStatus: {
          in: [PostStatus.PENDING, PostStatus.AI_FLAGGED]
        }
      },
      include: {
        uploader: {
          include: {
            role: true
          }
        },
        tags: {
          include: {
            tag: true
          }
        }
      },
      orderBy: {
        createdAt: 'asc' // Oldest first
      }
    });

    const formattedQueue = queue.map(g => ({
      ...g,
      likes: g.likesCount,
      dislikes: g.dislikesCount,
      status: g.moderationStatus,
      severity: g.severityLevel,
      tags: g.tags.map(t => t.tag),
      uploader: g.uploader ? {
        username: g.uploader.username,
        role: mapRoleToLegacy(g.uploader.role.name),
        reputation: getReputationLabel(g.uploader.reputation),
        warningCount: g.uploader.warningCount
      } : null
    }));

    return res.status(200).json({ queue: formattedQueue });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error fetching moderation queue' });
  }
};

export const reviewUpload = async (req: AuthRequest, res: Response) => {
  try {
    const { gaaliId, action, reason = '' } = req.body;
    const adminId = req.user?.id;

    if (!gaaliId || !action) {
      return res.status(400).json({ error: 'Gaali ID and action are required' });
    }

    if (!adminId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const slang = await prisma.slangEntry.findUnique({ where: { id: gaaliId } });
    if (!slang) {
      return res.status(404).json({ error: 'Slang entry not found' });
    }

    let finalStatus = 'pending';
    let visibility = 'public';
    let pointsReward = 0;

    if (action === 'APPROVE') {
      finalStatus = 'approved';
      visibility = 'public';
      pointsReward = 10;
    } else if (action === 'REJECT') {
      finalStatus = 'rejected';
      visibility = 'hidden';
    } else if (action === 'HIDE') {
      finalStatus = 'hidden';
      visibility = 'hidden';
    } else {
      return res.status(400).json({ error: 'Invalid review action. Use APPROVE, REJECT, or HIDE' });
    }

    // Update slang status
    const updatedSlang = await prisma.slangEntry.update({
      where: { id: gaaliId },
      data: {
        moderationStatus: finalStatus,
        visibilityStatus: visibility
      }
    });

    // Update the moderation queue records
    await prisma.moderationQueue.updateMany({
      where: { entryId: gaaliId, status: 'pending' },
      data: {
        status: finalStatus,
        reviewedBy: adminId,
        reviewNotes: reason || `Manual review: set status to ${finalStatus}`,
        reviewedAt: new Date()
      }
    });

    // Create Admin/Audit Log
    await prisma.adminLog.create({
      data: {
        adminId,
        actionType: `REVIEW_${action}`,
        targetEntryId: gaaliId,
        details: { reason: reason || `Manual review: set status to ${finalStatus}` }
      }
    });

    // Award points if approved
    if (action === 'APPROVE' && slang.uploaderId) {
      await prisma.user.update({
        where: { id: slang.uploaderId },
        data: {
          points: { increment: pointsReward },
          reputation: { increment: pointsReward } // Increment reputation as well
        }
      });

      await prisma.rewardTransaction.create({
        data: {
          userId: slang.uploaderId,
          actionType: 'upload_approved',
          points: pointsReward,
          referenceId: gaaliId,
          description: `Received 10 points for manual approval of slang: ${slang.word}`
        }
      });
    }

    return res.status(200).json({
      message: `Slang entry status updated to ${finalStatus}`,
      gaali: {
        ...updatedSlang,
        likes: updatedSlang.likesCount,
        dislikes: updatedSlang.dislikesCount,
        status: updatedSlang.moderationStatus,
        severity: updatedSlang.severityLevel
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error processing review' });
  }
};

export const updateUserStatus = async (req: AuthRequest, res: Response) => {
  try {
    const { targetUserId, banType, reason = '', durationDays = 1 } = req.body;
    const adminId = req.user?.id;

    if (!targetUserId || !banType) {
      return res.status(400).json({ error: 'Target user ID and ban type are required' });
    }

    if (!adminId) {
      return res.status(401).json({ error: 'Unauthorized' });
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: targetUserId },
      include: { role: true }
    });
    if (!targetUser) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    // Prevent banning super admins
    if (mapRoleToLegacy(targetUser.role.name) === RoleName.SUPERADMIN) {
      return res.status(403).json({ error: 'Cannot penalize a Super Administrator' });
    }

    let updateData: any = {};

    if (banType === 'PERMANENT_BAN') {
      updateData = { isBanned: true };
    } else if (banType === 'SHADOW_BAN') {
      updateData = { isShadowBanned: true };
    } else if (banType === 'TEMPORARY_SUSPEND') {
      const bannedUntil = new Date();
      bannedUntil.setDate(bannedUntil.getDate() + Number(durationDays));
      updateData = { bannedUntil };
    } else if (banType === 'UNBAN') {
      updateData = {
        isBanned: false,
        isShadowBanned: false,
        bannedUntil: null
      };
    } else {
      return res.status(400).json({ error: 'Invalid ban type.' });
    }

    const updatedUser = await prisma.user.update({
      where: { id: targetUserId },
      data: updateData
    });

    // Create Admin Log
    await prisma.adminLog.create({
      data: {
        adminId,
        actionType: `USER_${banType}`,
        targetUserId,
        details: { reason: reason || `Updated user status: ${banType}` }
      }
    });

    return res.status(200).json({
      message: `User status successfully updated to ${banType}`,
      user: {
        id: updatedUser.id,
        username: updatedUser.username,
        isBanned: updatedUser.isBanned,
        isShadowBanned: updatedUser.isShadowBanned,
        suspensionEnd: updatedUser.bannedUntil // Keep name suspensionEnd in API for frontend
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error updating user status' });
  }
};

export const getAuditLogs = async (req: AuthRequest, res: Response) => {
  try {
    const logs = await prisma.adminLog.findMany({
      include: {
        admin: {
          include: {
            role: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    const formattedLogs = logs.map(l => ({
      id: l.id,
      adminId: l.adminId,
      actionType: l.actionType,
      targetPost: l.targetEntryId,
      targetUser: l.targetUserId,
      reason: (l.details as any)?.reason || '',
      createdAt: l.createdAt,
      admin: {
        username: l.admin.username,
        role: mapRoleToLegacy(l.admin.role.name)
      }
    }));

    return res.status(200).json({ logs: formattedLogs });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error fetching audit logs' });
  }
};

export const getSystemStats = async (req: AuthRequest, res: Response) => {
  try {
    const totalUsers = await prisma.user.count();
    const totalSlangs = await prisma.slangEntry.count({ where: { moderationStatus: PostStatus.APPROVED } });
    const pendingReviews = await prisma.slangEntry.count({
      where: {
        moderationStatus: { in: [PostStatus.PENDING, PostStatus.AI_FLAGGED] }
      }
    });
    
    // Get trending search words
    const popularSlangs = await prisma.slangEntry.findMany({
      where: { moderationStatus: PostStatus.APPROVED },
      orderBy: { views: 'desc' },
      take: 5,
      select: { word: true, views: true }
    });

    return res.status(200).json({
      stats: {
        totalUsers,
        totalSlangs,
        pendingReviews,
        popularSlangs
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error fetching system stats' });
  }
};

export const updateSlangFlags = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { isNsfw, isVerified, isFeatured, status } = req.body;

    const slang = await prisma.slangEntry.findUnique({
      where: { id }
    });

    if (!slang) {
      return res.status(404).json({ error: 'Slang not found' });
    }

    // Check authorization: Admin, SuperAdmin, or the uploader only
    const isAuthorized = req.user && (
      req.user.role === RoleName.ADMIN ||
      req.user.role === RoleName.SUPERADMIN ||
      slang.uploaderId === req.user.id
    );

    if (!isAuthorized) {
      return res.status(403).json({ error: 'Forbidden: You do not have permission to modify flags for this entry' });
    }

    const updateData: any = {};
    if (typeof isNsfw === 'boolean') updateData.isNsfw = isNsfw;
    if (typeof isVerified === 'boolean') updateData.isVerified = isVerified;
    if (typeof isFeatured === 'boolean') updateData.isFeatured = isFeatured;
    if (status) updateData.moderationStatus = status;

    const updated = await prisma.slangEntry.update({
      where: { id },
      data: updateData
    });

    // Log the action
    await prisma.adminLog.create({
      data: {
        adminId: req.user?.id || '',
        actionType: 'UPDATE_SLANG_FLAGS',
        targetEntryId: id,
        details: { updateData, triggeredBy: req.user?.username }
      }
    });

    return res.status(200).json({
      message: 'Slang flags updated successfully',
      slang: updated
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error updating slang flags' });
  }
};

export const getUploadLogs = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !['ADMIN', 'SUPERADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }

    // 1. Fetch all bulk import logs
    const bulkLogs = await prisma.adminLog.findMany({
      where: { actionType: 'BULK_CSV_UPLOAD' },
      include: {
        admin: {
          include: {
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 2. Fetch all individual user slang uploads
    const individualEntries = await prisma.slangEntry.findMany({
      include: {
        uploader: {
          include: {
            role: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // 3. Format bulk uploads (SYSTEM)
    const formattedBulkLogs = bulkLogs.map(l => {
      const details = (l.details as any) || {};
      return {
        id: l.id,
        createdAt: l.createdAt,
        fileName: details.fileName || 'unknown_dataset.csv',
        uploaderUsername: l.admin.username,
        uploaderRole: mapRoleToLegacy(l.admin.role.name),
        uploadType: 'SYSTEM',
        uploadedCount: details.uploadedCount || 0,
        repeatedCount: details.repeatedCount || 0,
        summary: `Imported ${details.uploadedCount || 0} slang entries. ${details.repeatedCount || 0} duplicates skipped.`
      };
    });

    // 4. Format user uploads (USER)
    const formattedUserLogs = individualEntries
      .map(entry => {
        const uploaderName = entry.uploader?.username || 'Anonymous';
        
        // Skip system uploader entries because they are already accounted for in formattedBulkLogs
        if (uploaderName.toLowerCase() === 'system') {
          return null;
        }

        return {
          id: entry.id,
          createdAt: entry.createdAt,
          fileName: 'N/A (Single Slang)',
          uploaderUsername: uploaderName,
          uploaderRole: entry.uploader ? mapRoleToLegacy(entry.uploader.role.name) : 'ANONYMOUS',
          uploadType: 'USER',
          uploadedCount: 1,
          repeatedCount: 0,
          summary: `Single slang entry uploaded: "${entry.word}" (${entry.originRegion}, ${entry.language})`
        };
      })
      .filter((item): item is NonNullable<typeof item> => item !== null);

    // 5. Combine and sort
    const allLogs = [...formattedBulkLogs, ...formattedUserLogs].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return res.status(200).json({ logs: allLogs });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error retrieving upload logs' });
  }
};
