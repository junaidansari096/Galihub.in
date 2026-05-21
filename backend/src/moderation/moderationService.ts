import { prisma } from '../utils/db';
import { Severity, PostStatus } from '../utils/constants';

export interface ModerationResult {
  score: number;
  status: PostStatus;
  reason: string;
  severity: Severity;
  synonyms: string[];
}

// Simple profanity / hate speech / spam detection rules for Indian context
const HATE_SPEECH_KEYWORDS = [
  'religion', 'hindu', 'muslim', 'sikh', 'christian', 'caste', 'chamar', 'bhangi', 'dalit', 'katua', 'bhakt', 'librandu',
  'terrorist', 'aatankwadi', 'pakistani', 'china', 'mulle'
];

const VIOLENCE_KEYWORDS = [
  'kill', 'maar dunga', 'murder', 'jaan se', 'rape', 'threat', 'bomb', 'attack', 'khoon'
];

export const scanGaali = async (word: string, meaning: string, description: string): Promise<ModerationResult> => {
  const cleanWord = word.toLowerCase().trim();
  const cleanText = `${cleanWord} ${meaning.toLowerCase()} ${description.toLowerCase()}`;
  
  let score = 0;
  let reason = 'Approved by AI scan. Clear for manual review.';
  let severity: Severity = Severity.MILD;
  let status: PostStatus = PostStatus.PENDING; // Initially pending for human moderator review

  // 1. Duplicate check
  const existing = await prisma.slangEntry.findFirst({
    where: {
      word: {
        equals: cleanWord,
        mode: 'insensitive'
      }
    }
  });

  if (existing) {
    return {
      score: 100,
      status: PostStatus.REJECTED,
      reason: 'Auto-moderated: Word already exists in archives.',
      severity: Severity.MILD,
      synonyms: []
    };
  }

  // 2. Hate speech check (communal, religion, caste)
  const hasHateSpeech = HATE_SPEECH_KEYWORDS.some(keyword => cleanText.includes(keyword));
  if (hasHateSpeech) {
    score = 90;
    status = PostStatus.REJECTED;
    reason = 'Auto-rejected: Contains hate speech related to religion, caste, or ethnicity.';
    severity = Severity.EXTREME;
  }

  // 3. Violence check
  const hasViolence = VIOLENCE_KEYWORDS.some(keyword => cleanText.includes(keyword));
  if (hasViolence && status !== PostStatus.REJECTED) {
    score = 85;
    status = PostStatus.REJECTED;
    reason = 'Auto-rejected: Contains violent threats or threats of physical harm.';
    severity = Severity.EXTREME;
  }

  // 4. Toxicity score calculation for other words
  if (status !== PostStatus.REJECTED) {
    // Basic severity categorization
    const extremeSlangs = ['madarchod', 'behenchod', 'bhenchod', 'bsdk', 'randi', 'gaand', 'chutiya'];
    const mediumSlangs = ['saala', 'kamina', 'harami', 'kutta', 'gadha', 'loda', 'lauda'];

    const hasExtreme = extremeSlangs.some(s => cleanWord.includes(s) || cleanText.includes(s));
    const hasMedium = mediumSlangs.some(s => cleanWord.includes(s) || cleanText.includes(s));

    if (hasExtreme) {
      score = 75;
      severity = Severity.EXTREME;
      status = PostStatus.AI_FLAGGED; // Flags for high toxicity human review
      reason = 'AI Flagged: High toxicity score (75). Requires administrator escalation.';
    } else if (hasMedium) {
      score = 45;
      severity = Severity.MEDIUM;
      status = PostStatus.PENDING; // Normal review
      reason = 'AI Scan: Medium toxicity (45). Queued for moderator review.';
    } else {
      score = 15;
      severity = Severity.MILD;
      status = PostStatus.PENDING;
      reason = 'AI Scan: Low toxicity (15). Safe for cataloging.';
    }
  }

  // Mock Synonym Generation (ready for future updates)
  const synonyms: string[] = [];
  if (cleanWord.includes('saala') || cleanWord.includes('kamina')) {
    synonyms.push('harami', 'shaitan');
  } else if (cleanWord.includes('chutiya') || cleanWord.includes('gadha')) {
    synonyms.push('bewakoof', 'murkh');
  } else {
    synonyms.push(cleanWord + ' style');
  }

  return {
    score,
    status,
    reason,
    severity,
    synonyms
  };
};
