import fs from 'fs';
import path from 'path';
import csv from 'csv-parser';
import { prisma } from '../utils/db';
import { Severity, PostStatus } from '../utils/constants';

const slugify = (text: string) => {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const importCsv = async () => {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('❌ Error: Please provide the path to the CSV file.');
    console.log('Usage: npm run import-csv <path-to-csv>');
    process.exit(1);
  }

  const csvFilePath = path.resolve(args[0]);
  if (!fs.existsSync(csvFilePath)) {
    console.error(`❌ Error: File not found at ${csvFilePath}`);
    process.exit(1);
  }

  console.log(`🚀 Starting CSV Import from: ${csvFilePath}`);

  const results: any[] = [];

  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on('data', (data) => results.push(data))
    .on('end', async () => {
      console.log(`📦 Parsed ${results.length} rows from CSV. Processing database imports...`);
      let successCount = 0;
      let skipCount = 0;

      for (const row of results) {
        const {
          word,
          meaning,
          emotionalMeaning,
          exampleSentence,
          originRegion,
          language,
          severity,
          status,
          tags
        } = row;

        if (!word || !meaning || !originRegion || !language) {
          console.warn(`⚠️ Warning: Skipping incomplete row: ${JSON.stringify(row)}`);
          skipCount++;
          continue;
        }

        try {
          const cleanWord = word.trim();
          let slug = slugify(cleanWord);

          // Check unique slug constraint
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

          // Parse tags
          const tagList = tags
            ? tags.split(',').map((t: string) => t.trim().toLowerCase()).filter(Boolean)
            : [];

          // Validate Severity
          let cleanSeverity = Severity.MILD;
          if (severity) {
            const rawSev = severity.toUpperCase().trim();
            if (rawSev === 'MILD') cleanSeverity = Severity.MILD;
            else if (rawSev === 'MEDIUM') cleanSeverity = Severity.MEDIUM;
            else if (rawSev === 'EXTREME') cleanSeverity = Severity.EXTREME;
          }

          // Validate Status
          let cleanStatus = PostStatus.APPROVED;
          if (status) {
            const rawStatus = status.toUpperCase().trim();
            if (rawStatus === 'PENDING') cleanStatus = PostStatus.PENDING;
            else if (rawStatus === 'APPROVED') cleanStatus = PostStatus.APPROVED;
            else if (rawStatus === 'HIDDEN') cleanStatus = PostStatus.HIDDEN;
            else if (rawStatus === 'REJECTED') cleanStatus = PostStatus.REJECTED;
            else if (rawStatus === 'AI_FLAGGED') cleanStatus = PostStatus.AI_FLAGGED;
          }

          const slang = await prisma.slangEntry.create({
            data: {
              word: cleanWord,
              slug,
              meaning: meaning.trim(),
              emotionalMeaning: (emotionalMeaning || meaning).trim(),
              exampleSentence: (exampleSentence || '').trim(),
              originRegion: originRegion.trim(),
              language: language.trim(),
              severityLevel: cleanSeverity,
              moderationStatus: cleanStatus
            }
          });

          // Create tag mappings
          for (const tagName of tagList) {
            const cleanSlug = slugify(tagName);
            const tagRecord = await prisma.tag.upsert({
              where: { name: tagName },
              update: {},
              create: { name: tagName, slug: cleanSlug }
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

          successCount++;
        } catch (error: any) {
          console.error(`❌ Error importing word "${word}":`, error.message);
          skipCount++;
        }
      }

      console.log(`\n🎉 CSV Import Completed!`);
      console.log(`✅ Success: ${successCount} entries`);
      console.log(`⚠️ Skipped/Failed: ${skipCount} entries`);
      process.exit(0);
    });
};

importCsv().catch((err) => {
  console.error('💥 Script crashed:', err);
  process.exit(1);
});
