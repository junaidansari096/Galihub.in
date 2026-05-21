import { prisma, getRoleId } from '../utils/db';
import { RoleName } from '../utils/constants';

const promoteUser = async () => {
  const args = process.argv.slice(2);
  if (args.length < 2) {
    console.error('❌ Error: Missing arguments.');
    console.log('Usage: npm run promote-user <username> <USER|MODERATOR|ADMIN|SUPERADMIN>');
    process.exit(1);
  }

  const username = args[0].toLowerCase().trim();
  const rawRole = args[1].toUpperCase().trim();

  // Map input role to schema role name
  let targetRoleName = '';
  if (rawRole === 'USER') targetRoleName = RoleName.USER;
  else if (rawRole === 'MODERATOR') targetRoleName = RoleName.MODERATOR;
  else if (rawRole === 'ADMIN') targetRoleName = RoleName.ADMIN;
  else if (rawRole === 'SUPERADMIN') targetRoleName = RoleName.SUPERADMIN;
  else {
    console.error(`❌ Error: Invalid role "${rawRole}". Available roles: USER, MODERATOR, ADMIN, SUPERADMIN`);
    process.exit(1);
  }

  try {
    const user = await prisma.user.findUnique({
      where: { username },
      include: { role: true }
    });

    if (!user) {
      console.error(`❌ Error: User "${username}" not found.`);
      process.exit(1);
    }

    const roleId = await getRoleId(targetRoleName) as string;

    const updatedUser = await prisma.user.update({
      where: { id: user.id },
      data: { roleId },
      include: { role: true }
    });

    console.log(`\n🎉 Success! User "${updatedUser.username}" role updated from ${user.role.name} to ${updatedUser.role.name}.`);
    process.exit(0);
  } catch (error: any) {
    console.error('💥 Failed to promote user:', error.message);
    process.exit(1);
  }
};

promoteUser();
