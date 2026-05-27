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

const ALIAS_MAP: Record<string, string[]> = {
  'mc': ['madarchod', 'maderchod', 'madrchod', 'maaderchod'],
  'bc': ['behenchod', 'bhenchod', 'behanchod'],
  'bsdk': ['bhosadike', 'bhosdike', 'bhosadi ke'],
  'loda': ['lauda', 'lowda', 'loda'],
  'lauda': ['loda', 'lowda', 'lauda'],
  'lowda': ['loda', 'lauda', 'lowda'],
  'gand': ['gaand', 'gandu', 'gand'],
  'gaand': ['gand', 'gandu', 'gaand'],
  'chutiya': ['chutya', 'chootiya', 'chutiya'],
  'chutya': ['chutiya', 'chootiya', 'chutya'],
  'chootiya': ['chutiya', 'chutya', 'chootiya'],
  'harami': ['herami', 'haraami', 'harami'],
  'kutta': ['kuta', 'kutta'],
  'kuta': ['kutta', 'kuta']
};

const getPhoneticSignature = (text: string): string => {
  let s = text.toLowerCase().trim();
  s = s.replace(/[^a-z]/g, '');
  if (!s) return '';
  s = s.replace(/(.)\1+/g, '$1');
  s = s.replace(/ph/g, 'f');
  s = s.replace(/sh/g, 's');
  s = s.replace(/ch/g, 'c');
  s = s.replace(/jh/g, 'j');
  s = s.replace(/bh/g, 'b');
  s = s.replace(/dh/g, 'd');
  s = s.replace(/gh/g, 'g');
  s = s.replace(/kh/g, 'k');
  s = s.replace(/y/g, 'i');
  s = s.replace(/v/g, 'w');
  s = s.replace(/([^c])h/g, '$1');
  if (s.length === 0) return '';
  const first = s[0];
  const rest = s.slice(1).replace(/[aeiou]/g, '');
  return first + rest;
};

const computeRelevance = (word: string, meaning: string, emotionalMeaning: string, query: string): number => {
  const q = query.toLowerCase().trim();
  const w = word.toLowerCase().trim();
  const m = meaning.toLowerCase().trim();
  const em = emotionalMeaning.toLowerCase().trim();

  if (w === q) return 100;

  const aliasesForQ = ALIAS_MAP[q];
  if (aliasesForQ && aliasesForQ.includes(w)) return 90;

  const aliasesForW = ALIAS_MAP[w];
  if (aliasesForW && aliasesForW.includes(q)) return 90;

  const qSig = getPhoneticSignature(q);
  const wSig = getPhoneticSignature(w);
  if (qSig && wSig && qSig === wSig) return 80;

  if (w.startsWith(q)) return 75;
  if (w.includes(q)) return 70;
  if (m.includes(q) || em.includes(q)) return 50;

  return 0;
};

export const searchGaalis = async (req: AuthRequest, res: Response) => {
  try {
    const { q, region, tag, language } = req.query;

    const whereClause: any = {
      moderationStatus: PostStatus.APPROVED
    };

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
      }
    });

    let matchedEntries = [];

    if (q) {
      const searchStr = String(q).trim();
      
      // Calculate relevance for each entry
      const entriesWithScore = slangEntries.map(entry => {
        const score = computeRelevance(
          entry.word,
          entry.meaning,
          entry.emotionalMeaning,
          searchStr
        );
        return { entry, score };
      });

      // Filter entries with non-zero score and sort by score desc, then views desc
      const filtered = entriesWithScore.filter(item => item.score > 0);
      filtered.sort((a, b) => {
        if (b.score !== a.score) {
          return b.score - a.score;
        }
        return b.entry.views - a.entry.views;
      });

      matchedEntries = filtered.map(item => item.entry);
    } else {
      // Default sorting: most popular first
      slangEntries.sort((a, b) => b.views - a.views);
      matchedEntries = slangEntries;
    }

    // Deduplicate entries by unique word name (keeping the highest ranked one)
    const seenWords = new Set<string>();
    const uniqueSlangEntries = [];
    for (const entry of matchedEntries) {
      const normalizedWord = entry.word.toLowerCase().trim();
      if (!seenWords.has(normalizedWord)) {
        seenWords.add(normalizedWord);
        uniqueSlangEntries.push(entry);
      }
    }

    const formattedGaalis = uniqueSlangEntries.map(g => ({
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

    // Check authorization for the specific slang if it's not approved
    const isAuthorizedForTarget = slang.moderationStatus === PostStatus.APPROVED || (
      req.user && (
        req.user.id === slang.uploaderId ||
        req.user.role === RoleName.MODERATOR ||
        req.user.role === RoleName.ADMIN ||
        req.user.role === RoleName.SUPERADMIN
      )
    );

    if (!isAuthorizedForTarget) {
      return res.status(404).json({ error: 'Slang not found' });
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

    // Fetch all definitions for this word (case-insensitive)
    const showUnapproved = req.user && (
      req.user.role === RoleName.MODERATOR ||
      req.user.role === RoleName.ADMIN ||
      req.user.role === RoleName.SUPERADMIN
    );

    const definitions = await prisma.slangEntry.findMany({
      where: {
        word: { equals: slang.word, mode: 'insensitive' },
        OR: showUnapproved
          ? undefined
          : [
              { moderationStatus: PostStatus.APPROVED },
              req.user ? { id: slang.id, uploaderId: req.user.id } : undefined
            ].filter(Boolean) as any
      },
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
      },
      orderBy: [
        { isVerified: 'desc' },
        { likesCount: 'desc' },
        { createdAt: 'desc' }
      ]
    });

    const formattedDefinitions = definitions.map(s => ({
      ...s,
      likes: s.likesCount,
      dislikes: s.dislikesCount,
      severity: s.severityLevel,
      status: s.moderationStatus,
      tags: s.tags.map(t => t.tag),
      aiToxicityScore: s.aiRiskScore || 0,
      synonyms: (s.aiAnalysis?.generatedSynonyms as string[]) || [],
      uploader: s.uploader ? {
        id: s.uploader.id,
        username: s.uploader.username,
        role: mapRoleToLegacy(s.uploader.role.name),
        reputation: getReputationLabel(s.uploader.reputation),
        points: s.uploader.points
      } : null,
      comments: s.comments.map(c => ({
        ...c,
        user: {
          username: c.user.username,
          role: mapRoleToLegacy(c.user.role.name),
          reputation: getReputationLabel(c.user.reputation)
        }
      }))
    }));

    // Ensure the specifically requested slug is at the top of the list if it isn't already
    const primaryIndex = formattedDefinitions.findIndex(d => d.id === slang.id);
    let orderedDefinitions = [...formattedDefinitions];
    if (primaryIndex > 0) {
      const [primary] = orderedDefinitions.splice(primaryIndex, 1);
      orderedDefinitions.unshift(primary);
    }

    return res.status(200).json({
      gaali: orderedDefinitions[0], // Keep backward compatibility for single-object consumers
      word: slang.word,
      definitions: orderedDefinitions
    });
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

export const importCsvGaalis = async (req: AuthRequest, res: Response) => {
  try {
    if (!req.user || !['ADMIN', 'SUPERADMIN'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Access denied. Administrator privileges required.' });
    }

    const { entries, fileName } = req.body;
    if (!entries || !Array.isArray(entries)) {
      return res.status(400).json({ error: 'Invalid payload. Expecting an array of slang entries.' });
    }

    // Safety validation layer: Check formatting of all rows first.
    // If any row has bad formatting, reject the entire file.
    const validationErrors: string[] = [];
    for (let i = 0; i < entries.length; i++) {
      const item = entries[i];
      const rowNum = i + 2; // Row number in CSV file (Header is row 1, index 0 is row 2)

      const word = item.word ? String(item.word).trim() : '';
      const meaning = item.meaning ? String(item.meaning).trim() : '';

      if (!word) {
        validationErrors.push(`Row ${rowNum}: 'word' is empty or missing.`);
      }
      if (!meaning) {
        validationErrors.push(`Row ${rowNum}: 'meaning' is empty or missing.`);
      }

      if (item.severityLevel) {
        const sev = String(item.severityLevel).trim().toUpperCase();
        if (sev !== 'MILD' && sev !== 'MEDIUM' && sev !== 'EXTREME') {
          validationErrors.push(`Row ${rowNum}: 'severityLevel' must be MILD, MEDIUM, or EXTREME (found: '${item.severityLevel}').`);
        }
      }

      if (item.isNsfw !== undefined && item.isNsfw !== null && String(item.isNsfw).trim() !== '') {
        const nsfwStr = String(item.isNsfw).trim().toLowerCase();
        if (nsfwStr !== 'true' && nsfwStr !== 'false' && typeof item.isNsfw !== 'boolean') {
          validationErrors.push(`Row ${rowNum}: 'isNsfw' must be true or false (found: '${item.isNsfw}').`);
        }
      }
    }

    if (validationErrors.length > 0) {
      return res.status(400).json({
        error: 'Validation failed. The entire file has been rejected.',
        details: validationErrors
      });
    }

    // 1. Get or create the System user
    let systemUser = await prisma.user.findFirst({
      where: { username: { equals: 'system', mode: 'insensitive' } }
    });

    if (!systemUser) {
      // Find the ADMIN role
      const adminRole = await prisma.role.findFirst({
        where: { name: { equals: 'ADMIN', mode: 'insensitive' } }
      });
      
      if (!adminRole) {
        return res.status(500).json({ error: 'System Admin role not found. Run database seeding first.' });
      }

      systemUser = await prisma.user.create({
        data: {
          username: 'system',
          email: 'system@galihub.in',
          passwordHash: 'SYSTEM_MANAGED_ACCOUNT_NO_LOGIN',
          roleId: adminRole.id,
          isVerified: true
        }
      });
    }

    let uploadedCount = 0;
    let repeatedCount = 0;
    const createdSlangIds: string[] = [];

    for (const item of entries) {
      const word = item.word ? String(item.word).trim() : '';
      const meaning = item.meaning ? String(item.meaning).trim() : '';
      const emotionalMeaning = item.emotionalMeaning ? String(item.emotionalMeaning).trim() : meaning;
      const exampleSentence = item.exampleSentence ? String(item.exampleSentence).trim() : '';
      const originRegion = item.originRegion ? String(item.originRegion).trim() : 'General';
      const language = item.language ? String(item.language).trim() : 'Hindi';
      const severityLevel = item.severityLevel ? String(item.severityLevel).trim() : 'mild';
      const isNsfw = item.isNsfw === true || item.isNsfw === 'true';

      if (!word || !meaning) {
        repeatedCount++; // Mark incomplete entries as skipped
        continue;
      }

      // Check case-insensitive duplication
      const existing = await prisma.slangEntry.findFirst({
        where: { word: { equals: word, mode: 'insensitive' } }
      });

      if (existing) {
        repeatedCount++;
        continue;
      }

      // 2. Generate slug
      let slug = slugify(word);
      let slugExists = await prisma.slangEntry.findUnique({ where: { slug } });
      let counter = 1;
      while (slugExists) {
        const newSlug = `${slug}-${counter}`;
        slugExists = await prisma.slangEntry.findUnique({ where: { slug: newSlug } });
        if (!slugExists) {
          slug = newSlug;
          break;
        }
        counter++;
      }

      // 3. Normalize severity
      let cleanSeverity = Severity.MILD;
      const rawSev = severityLevel.toUpperCase();
      if (rawSev === 'MILD') cleanSeverity = Severity.MILD;
      else if (rawSev === 'MEDIUM') cleanSeverity = Severity.MEDIUM;
      else if (rawSev === 'EXTREME') cleanSeverity = Severity.EXTREME;

      // 4. Create database entry
      const slang = await prisma.slangEntry.create({
        data: {
          word,
          slug,
          meaning,
          emotionalMeaning,
          exampleSentence,
          originRegion,
          language,
          severityLevel: cleanSeverity,
          isNsfw,
          uploaderId: systemUser.id,
          moderationStatus: PostStatus.APPROVED // Direct approval for Admin uploads
        }
      });
      createdSlangIds.push(slang.id);

      // 5. Parse and map tags
      const rawTags = item.tags || '';
      const tagList = Array.isArray(rawTags)
        ? rawTags.map(t => String(t).trim().toLowerCase()).filter(Boolean)
        : typeof rawTags === 'string'
          ? rawTags.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean)
          : [];

      for (const tagName of tagList) {
        const cleanTagSlug = slugify(tagName);
        const tagRecord = await prisma.tag.upsert({
          where: { name: tagName },
          update: {},
          create: { name: tagName, slug: cleanTagSlug }
        });

        await prisma.entryTag.upsert({
          where: {
            entryId_tagId: {
              entryId: slang.id,
              tagId: tagRecord.id
            }
          },
          update: {},
          create: {
            entryId: slang.id,
            tagId: tagRecord.id
          }
        });
      }

      uploadedCount++;
    }

    // Create Admin Log for tracking this CSV import
    await prisma.adminLog.create({
      data: {
        adminId: req.user.id,
        actionType: 'BULK_CSV_UPLOAD',
        details: {
          fileName: fileName || 'galis_dataset.csv',
          uploadedCount,
          repeatedCount,
          totalProcessed: entries.length,
          uploaderType: 'SYSTEM',
          createdSlangIds
        }
      }
    });

    return res.status(200).json({
      message: 'CSV bulk upload completed successfully',
      uploadedCount,
      repeatedCount,
      totalProcessed: entries.length
    });
  } catch (error: any) {
    return res.status(500).json({ error: error.message || 'Error processing CSV bulk upload' });
  }
};
