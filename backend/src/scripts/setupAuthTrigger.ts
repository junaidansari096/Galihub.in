import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Setting up Supabase auth synchronization trigger in database...');

  const createFunctionSql = `
    CREATE OR REPLACE FUNCTION public.handle_new_user()
    RETURNS trigger AS $$
    DECLARE
      default_role_id uuid;
    BEGIN
      -- Check if username already exists in public.User
      IF EXISTS (SELECT 1 FROM public."User" WHERE LOWER(username) = LOWER(COALESCE(new.raw_user_meta_data->>'username', ''))) THEN
        RAISE EXCEPTION 'Username is already taken';
      END IF;

      -- Check if email already exists in public.User
      IF EXISTS (SELECT 1 FROM public."User" WHERE LOWER(email) = LOWER(new.email)) THEN
        RAISE EXCEPTION 'Email is already registered';
      END IF;

      -- Get the UUID of the 'user' role
      SELECT id INTO default_role_id FROM public."Role" WHERE name = 'user' LIMIT 1;
      
      -- If 'user' role doesn't exist, get any role
      IF default_role_id IS NULL THEN
        SELECT id INTO default_role_id FROM public."Role" LIMIT 1;
      END IF;

      -- Insert user into public.User
      INSERT INTO public."User" (
        id,
        username,
        email,
        "passwordHash",
        "authProvider",
        "roleId",
        "isVerified",
        points,
        reputation,
        "createdAt",
        "updatedAt"
      ) VALUES (
        new.id,
        COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
        new.email,
        'supabase_authenticated',
        'supabase',
        default_role_id,
        true,
        0,
        0,
        now(),
        now()
      );

      -- Insert profile into public.UserProfile
      INSERT INTO public."UserProfile" (
        id,
        "userId",
        "displayName",
        "avatarUrl",
        region,
        "createdAt",
        "updatedAt"
      ) VALUES (
        gen_random_uuid(),
        new.id,
        COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
        'https://api.dicebear.com/7.x/bottts/svg?seed=' || COALESCE(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
        COALESCE(new.raw_user_meta_data->>'region', 'Unknown'),
        now(),
        now()
      );

      RETURN new;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  const createDeleteFunctionSql = `
    CREATE OR REPLACE FUNCTION public.handle_delete_user()
    RETURNS trigger AS $$
    BEGIN
      DELETE FROM public."User" WHERE id = old.id::text;
      RETURN old;
    END;
    $$ LANGUAGE plpgsql SECURITY DEFINER;
  `;

  const dropTriggerSql = `DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;`;
  
  const createTriggerSql = `
    CREATE TRIGGER on_auth_user_created
      AFTER INSERT ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
  `;

  const dropDeleteTriggerSql = `DROP TRIGGER IF EXISTS on_auth_user_deleted ON auth.users;`;

  const createDeleteTriggerSql = `
    CREATE TRIGGER on_auth_user_deleted
      AFTER DELETE ON auth.users
      FOR EACH ROW EXECUTE FUNCTION public.handle_delete_user();
  `;

  try {
    console.log('1. Creating handle_new_user() function...');
    await prisma.$executeRawUnsafe(createFunctionSql);
    
    console.log('2. Creating handle_delete_user() function...');
    await prisma.$executeRawUnsafe(createDeleteFunctionSql);
    
    console.log('3. Dropping existing triggers...');
    await prisma.$executeRawUnsafe(dropTriggerSql);
    await prisma.$executeRawUnsafe(dropDeleteTriggerSql);
    
    console.log('4. Creating triggers on_auth_user_created and on_auth_user_deleted...');
    await prisma.$executeRawUnsafe(createTriggerSql);
    await prisma.$executeRawUnsafe(createDeleteTriggerSql);

    console.log('✅ Supabase auth triggers setup successfully!');
  } catch (error) {
    console.error('❌ Error setting up trigger:', error);
  } finally {
    await prisma.$disconnect();
  }
}

main();
