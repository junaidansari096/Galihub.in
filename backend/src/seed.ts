import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

// Helper to generate slug
const slugify = (text: string) => {
  return text
    .toString()
    .toLowerCase()
    .trim()
    .replace(/\s+/g, '-')
    .replace(/[^\w\-]+/g, '')
    .replace(/\-\-+/g, '-')
    .replace(/^-+/, '')
    .replace(/-+$/, '');
};

async function main() {
  console.log('Seeding redesigned database...');

  // Clean old data in dependency order
  console.log('Cleaning existing data...');
  await prisma.moderationQueue.deleteMany({});
  await prisma.adminLog.deleteMany({});
  await prisma.rewardTransaction.deleteMany({});
  await prisma.reaction.deleteMany({});
  await prisma.comment.deleteMany({});
  await prisma.entryTag.deleteMany({});
  await prisma.tag.deleteMany({});
  await prisma.slangEntry.deleteMany({});
  await prisma.userProfile.deleteMany({});
  await prisma.user.deleteMany({});
  await prisma.role.deleteMany({});

  // 1. Create Default Roles
  console.log('Creating roles...');
  const roles = [
    { name: 'user', description: 'Standard community member' },
    { name: 'moderator', description: 'Slang content moderator' },
    { name: 'admin', description: 'Platform administrator' },
    { name: 'super_admin', description: 'System owner with full access' }
  ];

  const roleMap: Record<string, string> = {};
  for (const r of roles) {
    const createdRole = await prisma.role.create({
      data: r
    });
    roleMap[r.name] = createdRole.id;
  }

  // 2. Create Users & Profiles
  console.log('Creating users...');
  const salt = await bcrypt.genSalt(10);
  const passwordHash = await bcrypt.hash('password123', salt);

  const superadmin = await prisma.user.create({
    data: {
      username: 'superadmin',
      email: 'superadmin@gaalihub.com',
      passwordHash,
      roleId: roleMap['super_admin'],
      points: 1500,
      reputation: 1500,
      profile: {
        create: {
          region: 'Delhi',
          avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=superadmin'
        }
      }
    }
  });

  const moderator = await prisma.user.create({
    data: {
      username: 'mod_ramesh',
      email: 'ramesh@gaalihub.com',
      passwordHash,
      roleId: roleMap['moderator'],
      points: 200,
      reputation: 200,
      profile: {
        create: {
          region: 'UP',
          avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=mod_ramesh'
        }
      }
    }
  });

  const user1 = await prisma.user.create({
    data: {
      username: 'amit_pune',
      email: 'amit@gmail.com',
      passwordHash,
      roleId: roleMap['user'],
      points: 80,
      reputation: 80,
      profile: {
        create: {
          region: 'Maharashtra',
          avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=amit_pune'
        }
      }
    }
  });

  const user2 = await prisma.user.create({
    data: {
      username: 'priya_kolkata',
      email: 'priya@gmail.com',
      passwordHash,
      roleId: roleMap['user'],
      points: 120,
      reputation: 120,
      profile: {
        create: {
          region: 'West Bengal',
          avatarUrl: 'https://api.dicebear.com/7.x/bottts/svg?seed=priya_kolkata'
        }
      }
    }
  });

  console.log('Users seeded successfully!');

  // 3. Create Tags
  console.log('Creating tags...');
  const tagsList = ['funny', 'angry', 'meme', 'friendly', 'cultural'];
  const tagMap: Record<string, string> = {};

  for (const tName of tagsList) {
    const createdTag = await prisma.tag.create({
      data: {
        name: tName,
        slug: tName
      }
    });
    tagMap[tName] = createdTag.id;
  }

  console.log('Tags seeded successfully!');

  // 4. Create approved slang entries
  console.log('Creating slang entries...');
  const slangs = [
    {
      word: 'Chutiya',
      meaning: 'An idiot, fool, or simpleton.',
      emotionalMeaning: 'Usually used to call someone out for being dumb, foolish, or acting brainless. Can be highly offensive or friendly depending on tone.',
      exampleSentence: 'Kya chutiya harkat kar raha hai bhai, phone side me rakh.',
      originRegion: 'Delhi',
      language: 'Hindi',
      severityLevel: 'medium',
      views: 350,
      likesCount: 24,
      dislikesCount: 2,
      moderationStatus: 'approved',
      uploaderId: user1.id,
      tags: ['funny', 'angry'],
    },
    {
      word: 'Bawa',
      meaning: 'Brother, friend, or peer.',
      emotionalMeaning: 'A highly friendly Mumbai/Pune slang term used to refer to a close friend or brother, similar to "bro" or "dude".',
      exampleSentence: 'Aur bawa! Kahaan chalna hai aaj shaam ko?',
      originRegion: 'Maharashtra',
      language: 'Hindi / Marathi Slang',
      severityLevel: 'mild',
      views: 520,
      likesCount: 85,
      dislikesCount: 0,
      moderationStatus: 'approved',
      uploaderId: user1.id,
      tags: ['friendly', 'cultural'],
    },
    {
      word: 'Bokachoda',
      meaning: 'A stupid person or foolish blockhead.',
      emotionalMeaning: 'A widely used Bengali abuse term used to express extreme frustration at someone\'s stupidity. Translates literally to "stupid fucker".',
      exampleSentence: 'Ekta kaaj shobhabe korte parish na, bokachoda niki?',
      originRegion: 'West Bengal',
      language: 'Bengali',
      severityLevel: 'extreme',
      views: 450,
      likesCount: 56,
      dislikesCount: 4,
      moderationStatus: 'approved',
      uploaderId: user2.id,
      tags: ['angry', 'meme'],
    },
    {
      word: 'Kela',
      meaning: 'Boring, useless, or ruined.',
      emotionalMeaning: 'Assamese/Northeast slang indicating a state of annoyance, boredom, or a task getting ruined. Sometimes used as a filler exclamation.',
      exampleSentence: 'Pura kela scene hoi gol aji toh!',
      originRegion: 'Assam',
      language: 'Assamese',
      severityLevel: 'medium',
      views: 180,
      likesCount: 31,
      dislikesCount: 1,
      moderationStatus: 'approved',
      uploaderId: user2.id,
      tags: ['cultural', 'funny'],
    },
    {
      word: 'Bhains Ki Aankh',
      meaning: 'Buffalo\'s eye (literal). Used as an exclamation of shock or surprise.',
      emotionalMeaning: 'A mild North-Indian expression used to express surprise, shock, or disbelief, similar to "Holy cow!" or "What the hell!".',
      exampleSentence: 'Bhains ki aankh! Itni mehengi gaadi kharid li tu ne?',
      originRegion: 'UP',
      language: 'Hinglish',
      severityLevel: 'mild',
      views: 290,
      likesCount: 42,
      dislikesCount: 3,
      moderationStatus: 'approved',
      uploaderId: superadmin.id,
      tags: ['funny', 'meme'],
    },
  ];

  for (const s of slangs) {
    const slug = slugify(s.word);
    const entry = await prisma.slangEntry.create({
      data: {
        word: s.word,
        slug,
        meaning: s.meaning,
        emotionalMeaning: s.emotionalMeaning,
        exampleSentence: s.exampleSentence,
        originRegion: s.originRegion,
        language: s.language,
        severityLevel: s.severityLevel,
        views: s.views,
        likesCount: s.likesCount,
        dislikesCount: s.dislikesCount,
        moderationStatus: s.moderationStatus,
        uploaderId: s.uploaderId,
      },
    });

    // Create EntryTag associations
    for (const tagName of s.tags) {
      const tagId = tagMap[tagName];
      await prisma.entryTag.create({
        data: {
          entryId: entry.id,
          tagId
        }
      });
    }

    // Create approved moderation queue entry
    await prisma.moderationQueue.create({
      data: {
        entryId: entry.id,
        submittedBy: s.uploaderId,
        moderationType: 'ai',
        aiFlagged: false,
        aiReason: 'Seeded approved entry',
        aiConfidence: 15,
        status: 'approved',
        reviewedBy: superadmin.id,
        reviewedAt: new Date(),
        reviewNotes: 'Seeded automatic approval'
      }
    });
  }

  // 5. Create some pending/flagged entries for moderation review queue
  const pendingEntry1 = await prisma.slangEntry.create({
    data: {
      word: 'Harami',
      slug: 'harami',
      meaning: 'Bastard or rascal.',
      emotionalMeaning: 'Used in a friendly bantering way or offensive depending on context. AI flagged moderate toxicity.',
      exampleSentence: 'Bada harami dost hai tu mera!',
      originRegion: 'UP',
      language: 'Hindi',
      severityLevel: 'medium',
      moderationStatus: 'pending',
      uploaderId: user1.id,
      aiRiskScore: 45,
    }
  });

  await prisma.entryTag.create({
    data: {
      entryId: pendingEntry1.id,
      tagId: tagMap['friendly']
    }
  });

  await prisma.moderationQueue.create({
    data: {
      entryId: pendingEntry1.id,
      submittedBy: user1.id,
      moderationType: 'ai',
      aiFlagged: false,
      aiReason: 'AI Scan: Medium toxicity (45). Queued for moderator review.',
      aiConfidence: 45,
      status: 'pending'
    }
  });

  const pendingEntry2 = await prisma.slangEntry.create({
    data: {
      word: 'Bsdk',
      slug: 'bsdk',
      meaning: 'Son of a whore / Born from a ruined womb (highly offensive).',
      emotionalMeaning: 'Extremely common internet and street slang used in anger or intense friendly banter. Extremely vulgar.',
      exampleSentence: 'Idhar aa bsdk, tera hi intezar tha.',
      originRegion: 'Delhi',
      language: 'Hinglish',
      severityLevel: 'extreme',
      moderationStatus: 'ai_flagged',
      uploaderId: user2.id,
      aiRiskScore: 75,
    }
  });

  await prisma.entryTag.create({
    data: {
      entryId: pendingEntry2.id,
      tagId: tagMap['angry']
    }
  });

  await prisma.moderationQueue.create({
    data: {
      entryId: pendingEntry2.id,
      submittedBy: user2.id,
      moderationType: 'ai',
      aiFlagged: true,
      aiReason: 'AI Flagged: High toxicity score (75). Requires administrator escalation.',
      aiConfidence: 75,
      status: 'escalated'
    }
  });

  console.log('Slang entries seeded successfully!');
  console.log('Database seeding complete!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
