import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Clearing database schema...');
  
  // Execute drop and recreate commands one by one
  await prisma.$executeRawUnsafe('DROP SCHEMA public CASCADE');
  await prisma.$executeRawUnsafe('CREATE SCHEMA public');
  await prisma.$executeRawUnsafe('GRANT ALL ON SCHEMA public TO postgres');
  await prisma.$executeRawUnsafe('GRANT ALL ON SCHEMA public TO public');
  
  console.log('Database cleared successfully!');
}

main()
  .catch((err) => {
    console.error('Error clearing database:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
