import { Response } from 'express';
import { prisma } from '../utils/db';
import { AuthRequest } from '../middleware/authMiddleware';
import { scanGaali } from '../moderation/moderationService';
import { PostStatus, Severity, RoleName, mapRoleToLegacy } from '../utils/constants';
import { getReputationLabel } from '../auth/authController';

// Generate slug
const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-') // Replace spaces with -
    .replace(/[^\w\-]+/g, '') // Remove all non-word chars
    .replace(/\-\-+/g, '-') // Replace multiple - with single -
    .replace(/^-+/, '') // Trim - from start
    .replace(/-+$/, ''); // Trim - from end
};

export const uploadGaali = async (req: AuthRequest, res: Response) => {
  try {
    const {
      word,
      meaning,
      emotionalMeaning,
      exampleSentence,
      originRegion,
      language,
      tags = [],
      severity
    } = req.body;

    if (!word || !meaning || !emotionalMeaning || !exampleSentence || !originRegion || !language) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const uploaderId = req.user?.id;
    const uploaderRole = req.user?.role;

    // AI Moderation check
    const modResult = await scanGaali(word, meaning, emotionalMeaning + " " + exampleSentence);

    // If auto-rejected, return error
    if (modResult.status === PostStatus.REJECTED) {
      return res.status(400).json({
        error: modResult.reason,
        aiToxicityScore: modResult.score
      });
    }

    // Auto-approve if uploaded by admin/superadmin
    let finalStatus = modResult.status;
    if (uploaderRole === RoleName.ADMIN || uploaderRole === RoleName.SUPERADMIN) {
      finalStatus = PostStatus.APPROVED;
    }

    // Generate unique slug
    let slug = slugify(word);
    const count = await prisma.slangEntry.count({ where: { slug } });
    if (count > 0) {
      slug = `${slug}-${Math.floor(Math.random() * 10000)}`;
    }

    // Create the slang entry
    const slang = await prisma.slangEntry.create({
      data: {
        word: word.trim(),
        slug,
        meaning: meaning.trim(),
        emotionalMeaning: emotionalMeaning.trim(),
        exampleSentence: exampleSentence.trim(),
        originRegion: originRegion.trim(),
        language: language.trim(),
        severityLevel: (severity as string) || modResult.severity,
        moderationStatus: finalStatus,
        uploaderId,
        aiRiskScore: modResult.score,
        aiAnalysis: {
          create: {
            toxicityScore: modResult.score,
            generatedSynonyms: modResult.synonyms
          }
        }
      }
    });

    // Create Tag relationships
    const createdTags = [];
    for (const tagName of tags) {
      const cleanTagName = tagName.toLowerCase().trim();
      const cleanSlug = slugify(cleanTagName);
      
      const tag = await prisma.tag.upsert({
        where: { name: cleanTagName },
        update: {},
        create: { name: cleanTagName, slug: cleanSlug }
      });

      await prisma.entryTag.upsert({
        where: {
          entryId_tagId: {
            entryId: slang.id,
            tagId: tag.id
          }
        },
        update: {},
        create: {
          entryId: slang.id,
          tagId: tag.id
        }
      });
      createdTags.push(tag);
    }

    // Create Audit Log / Moderation Queue entry if flagged or pending
    if (finalStatus === PostStatus.AI_FLAGGED) {
      await prisma.adminLog.create({
        data: {
          adminId: uploaderId || '', // Admin action triggered by system/moderator
          actionType: 'AI_FLAG_UPLOAD',
          targetEntryId: slang.id,
          details: { reason: `Post flagged by AI auto-scan with toxicity score: ${modResult.score}` },
        }
      });
    }

    // Always create a moderation queue record
    await prisma.moderationQueue.create({
      data: {
        entryId: slang.id,
        submittedBy: uploaderId,
        moderationType: 'ai',
        aiFlagged: finalStatus === PostStatus.AI_FLAGGED,
        aiReason: modResult.reason,
        aiConfidence: modResult.score,
        status: finalStatus === PostStatus.APPROVED ? 'approved' : finalStatus === PostStatus.AI_FLAGGED ? 'escalated' : 'pending'
      }
    });

    // Award rewards points for upload (but only if approved directly, otherwise upon approval)
    if (finalStatus === PostStatus.APPROVED && uploaderId) {
      await prisma.user.update({
        where: { id: uploaderId },
        data: {
          points: { increment: 10 }
        }
      });

      await prisma.rewardTransaction.create({
        data: {
          userId: uploaderId,
          actionType: 'upload_approved',
          points: 10,
          referenceId: slang.id,
          description: `Received 10 points for uploading: ${slang.word}`
        }
      });
    }

    // Fetch full created entry for response
    const fullSlang = await prisma.slangEntry.findUnique({
      where: { id: slang.id },
      include: {
        uploader: {
          include: {
            role: true
          }
        }
      }
    });

    const formattedGaali = {
      ...fullSlang,
      likes: fullSlang?.likesCount || 0,
      dislikes: fullSlang?.dislikesCount || 0,
      severity: fullSlang?.severityLevel,
      status: fullSlang?.moderationStatus,
      tags: createdTags,
      aiToxicityScore: fullSlang?.aiRiskScore || 0,
      uploader: fullSlang?.uploader ? {
        username: fullSlang.uploader.username,
        role: mapRoleToLegacy(fullSlang.uploader.role.name),
        reputation: getReputationLabel(fullSlang.uploader.reputation)
      } : null
    };

    return res.status(201).json({
      message: finalStatus === PostStatus.APPROVED 
        ? 'Slang uploaded and published successfully!' 
        : 'Slang submitted successfully! It is currently in the queue under moderation review.',
      gaali: formattedGaali,
      modResult
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error uploading slang' });
  }
};

export const searchGaalis = async (req: AuthRequest, res: Response) => {
  try {
    const { q, region, tag, language } = req.query;

    const whereClause: any = {
      moderationStatus: PostStatus.APPROVED // Only search approved words
    };

    // If query parameter is set
    if (q) {
      const searchStr = String(q).trim();
      whereClause.OR = [
        { word: { contains: searchStr, mode: 'insensitive' } },
        { meaning: { contains: searchStr, mode: 'insensitive' } },
        { emotionalMeaning: { contains: searchStr, mode: 'insensitive' } }
      ];
    }

    if (region) {
      whereClause.originRegion = { equals: String(region), mode: 'insensitive' };
    }

    if (language) {
      whereClause.language = { equals: String(language), mode: 'insensitive' };
    }

    if (tag) {
      whereClause.tags = {
        some: {
          tag: {
            name: { equals: String(tag).toLowerCase().trim() }
          }
        }
      };
    }

    const slangEntries = await prisma.slangEntry.findMany({
      where: whereClause,
      include: {
        tags: {
          include: {
            tag: true
          }
        },
        uploader: {
          include: {
            role: true
          }
        }
      },
      orderBy: {
        views: 'desc' // Most popular first
      }
    });

    const formattedGaalis = slangEntries.map(g => ({
      ...g,
      likes: g.likesCount,
      dislikes: g.dislikesCount,
      severity: g.severityLevel,
      status: g.moderationStatus,
      tags: g.tags.map(t => t.tag),
      aiToxicityScore: g.aiRiskScore || 0,
      uploader: g.uploader ? {
        username: g.uploader.username,
        role: mapRoleToLegacy(g.uploader.role.name),
        reputation: getReputationLabel(g.uploader.reputation)
      } : null
    }));

    return res.status(200).json({ gaalis: formattedGaalis });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error searching slangs' });
  }
};

export const getGaaliBySlug = async (req: AuthRequest, res: Response) => {
  try {
    const { slug } = req.params;

    const slang = await prisma.slangEntry.findUnique({
      where: { slug },
      include: {
        tags: {
          include: {
            tag: true
          }
        },
        aiAnalysis: true,
        uploader: {
          include: {
            role: true
          }
        },
        comments: {
          include: {
            user: {
              include: {
                role: true
              }
            }
          },
          orderBy: {
            createdAt: 'desc'
          }
        }
      }
    });

    if (!slang) {
      return res.status(404).json({ error: 'Slang not found' });
    }

    // Allow uploader, moderators and admins to view pending/hidden ones
    if (slang.moderationStatus !== PostStatus.APPROVED) {
      const isAuthorized = req.user && (
        req.user.id === slang.uploaderId ||
        req.user.role === RoleName.MODERATOR ||
        req.user.role === RoleName.ADMIN ||
        req.user.role === RoleName.SUPERADMIN
      );

      if (!isAuthorized) {
        return res.status(404).json({ error: 'Slang not found' });
      }
    }

    // Increment view count asynchronously
    await prisma.slangEntry.update({
      where: { id: slang.id },
      data: { views: { increment: 1 } }
    });

    // Simple view-based reward increment (+5 points for 100 views)
    if (slang.uploaderId && (slang.views + 1) % 100 === 0) {
      await prisma.user.update({
        where: { id: slang.uploaderId },
        data: { points: { increment: 5 } }
      });
      
      await prisma.rewardTransaction.create({
        data: {
          userId: slang.uploaderId,
          actionType: 'views_milestone',
          points: 5,
          referenceId: slang.id,
          description: `Received 5 points for 100 views milestone on: ${slang.word}`
        }
      });
    }

    const formattedGaali = {
      ...slang,
      likes: slang.likesCount,
      dislikes: slang.dislikesCount,
      severity: slang.severityLevel,
      status: slang.moderationStatus,
      tags: slang.tags.map(t => t.tag),
      aiToxicityScore: slang.aiRiskScore || 0,
      synonyms: (slang.aiAnalysis?.generatedSynonyms as string[]) || [],
      uploader: slang.uploader ? {
        id: slang.uploader.id,
        username: slang.uploader.username,
        role: mapRoleToLegacy(slang.uploader.role.name),
        reputation: getReputationLabel(slang.uploader.reputation),
        points: slang.uploader.points
      } : null,
      comments: slang.comments.map(c => ({
        ...c,
        user: {
          username: c.user.username,
          role: mapRoleToLegacy(c.user.role.name),
          reputation: getReputationLabel(c.user.reputation)
        }
      }))
    };

    return res.status(200).json({ gaali: formattedGaali });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error fetching details' });
  }
};

export const toggleLike = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const slang = await prisma.slangEntry.findUnique({
      where: { id }
    });

    if (!slang) {
      return res.status(404).json({ error: 'Slang not found' });
    }

    // Check existing reaction
    const existingReaction = await prisma.reaction.findUnique({
      where: {
        userId_entryId: {
          userId,
          entryId: id
        }
      }
    });

    let userLiked = false;
    
    if (existingReaction) {
      if (existingReaction.reactionType === 'like') {
        // Remove reaction (Unlike)
        await prisma.reaction.delete({
          where: { id: existingReaction.id }
        });
        await prisma.slangEntry.update({
          where: { id },
          data: { likesCount: { decrement: 1 } }
        });
      } else {
        // Change from Dislike to Like
        await prisma.reaction.update({
          where: { id: existingReaction.id },
          data: { reactionType: 'like' }
        });
        await prisma.slangEntry.update({
          where: { id },
          data: {
            likesCount: { increment: 1 },
            dislikesCount: { decrement: 1 }
          }
        });
        userLiked = true;
      }
    } else {
      // Create new Like reaction
      await prisma.reaction.create({
        data: {
          userId,
          entryId: id,
          reactionType: 'like'
        }
      });
      await prisma.slangEntry.update({
        where: { id },
        data: { likesCount: { increment: 1 } }
      });
      userLiked = true;

      // Award reward points for receiving likes (+5 points for uploader upon likes increments of 10)
      if (slang.uploaderId && (slang.likesCount + 1) % 10 === 0) {
        await prisma.user.update({
          where: { id: slang.uploaderId },
          data: { points: { increment: 5 } }
        });
        
        await prisma.rewardTransaction.create({
          data: {
            userId: slang.uploaderId,
            actionType: 'likes_milestone',
            points: 5,
            referenceId: slang.id,
            description: `Received 5 points for 10 likes milestone on: ${slang.word}`
          }
        });
      }
    }

    const updated = await prisma.slangEntry.findUnique({
      where: { id },
      select: { likesCount: true, dislikesCount: true }
    });

    return res.status(200).json({
      likes: updated?.likesCount || 0,
      dislikes: updated?.dislikesCount || 0,
      userLiked,
      userDisliked: false
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error upvoting' });
  }
};

export const toggleDislike = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const slang = await prisma.slangEntry.findUnique({
      where: { id }
    });

    if (!slang) {
      return res.status(404).json({ error: 'Slang not found' });
    }

    // Check existing reaction
    const existingReaction = await prisma.reaction.findUnique({
      where: {
        userId_entryId: {
          userId,
          entryId: id
        }
      }
    });

    let userDisliked = false;

    if (existingReaction) {
      if (existingReaction.reactionType === 'dislike') {
        // Remove reaction (Undislike)
        await prisma.reaction.delete({
          where: { id: existingReaction.id }
        });
        await prisma.slangEntry.update({
          where: { id },
          data: { dislikesCount: { decrement: 1 } }
        });
      } else {
        // Change from Like to Dislike
        await prisma.reaction.update({
          where: { id: existingReaction.id },
          data: { reactionType: 'dislike' }
        });
        await prisma.slangEntry.update({
          where: { id },
          data: {
            likesCount: { decrement: 1 },
            dislikesCount: { increment: 1 }
          }
        });
        userDisliked = true;
      }
    } else {
      // Create new Dislike reaction
      await prisma.reaction.create({
        data: {
          userId,
          entryId: id,
          reactionType: 'dislike'
        }
      });
      await prisma.slangEntry.update({
        where: { id },
        data: { dislikesCount: { increment: 1 } }
      });
      userDisliked = true;
    }

    const updated = await prisma.slangEntry.findUnique({
      where: { id },
      select: { likesCount: true, dislikesCount: true }
    });

    return res.status(200).json({
      likes: updated?.likesCount || 0,
      dislikes: updated?.dislikesCount || 0,
      userLiked: false,
      userDisliked
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error downvoting' });
  }
};

export const addComment = async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user?.id;

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    if (!content || content.trim() === '') {
      return res.status(400).json({ error: 'Comment content cannot be empty' });
    }

    const slang = await prisma.slangEntry.findUnique({ where: { id } });
    if (!slang) {
      return res.status(404).json({ error: 'Slang not found' });
    }

    const comment = await prisma.comment.create({
      data: {
        content: content.trim(),
        userId,
        entryId: id
      },
      include: {
        user: {
          include: {
            role: true
          }
        }
      }
    });

    // Reward commenter for engaging (+2 points)
    await prisma.user.update({
      where: { id: userId },
      data: { points: { increment: 2 } }
    });

    await prisma.rewardTransaction.create({
      data: {
        userId,
        actionType: 'comment_reward',
        points: 2,
        referenceId: comment.id,
        description: `Earned 2 points for commenting on: ${slang.word}`
      }
    });

    return res.status(201).json({
      comment: {
        ...comment,
        user: {
          username: comment.user.username,
          role: comment.user.role.name,
          reputation: getReputationLabel(comment.user.reputation)
        }
      }
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error commenting' });
  }
};

export const getRandomGaali = async (req: AuthRequest, res: Response) => {
  try {
    const approvedCount = await prisma.slangEntry.count({
      where: { moderationStatus: PostStatus.APPROVED }
    });

    if (approvedCount === 0) {
      return res.status(404).json({ error: 'No slangs cataloged yet.' });
    }

    const randomIndex = Math.floor(Math.random() * approvedCount);
    const randomSlangs = await prisma.slangEntry.findMany({
      where: { moderationStatus: PostStatus.APPROVED },
      take: 1,
      skip: randomIndex,
      include: {
        tags: {
          include: {
            tag: true
          }
        },
        uploader: {
          include: {
            role: true
          }
        }
      }
    });

    const randomGaali = randomSlangs[0];

    const formattedGaali = {
      ...randomGaali,
      likes: randomGaali.likesCount,
      dislikes: randomGaali.dislikesCount,
      severity: randomGaali.severityLevel,
      status: randomGaali.moderationStatus,
      tags: randomGaali.tags.map(t => t.tag),
      aiToxicityScore: randomGaali.aiRiskScore || 0,
      uploader: randomGaali.uploader ? {
        username: randomGaali.uploader.username,
        role: mapRoleToLegacy(randomGaali.uploader.role.name)
      } : null
    };

    return res.status(200).json({ gaali: formattedGaali });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error fetching random slang' });
  }
};
