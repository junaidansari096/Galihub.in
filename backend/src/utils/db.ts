import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const roleCache: Record<string, string> = {};

/**
 * Resolves a role name to its UUID, creating it in the database if it doesn't exist.
 */
export const getRoleId = async (name: string): Promise<String> => {
  const normalized = name.toLowerCase().trim();
  if (roleCache[normalized]) {
    return roleCache[normalized];
  }

  let role = await prisma.role.findUnique({
    where: { name: normalized }
  });

  if (!role) {
    role = await prisma.role.create({
      data: {
        name: normalized,
        description: `System role for ${normalized}`
      }
    });
  }

  roleCache[normalized] = role.id;
  return role.id;
};

export default prisma;
export { prisma };
