import { createClient } from '@supabase/supabase-js';
import jsonwebtoken from 'jsonwebtoken';
import dotenv from 'dotenv';
import path from 'path';

// Load backend env
dotenv.config({ path: path.join(__dirname, '../../.env') });

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ufhzhflqmusdxtakannq.supabase.co';
// Using the anon key directly
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaHpoZmxxbXVzZHh0YWthbm5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNTgzNTksImV4cCI6MjA5NDgzNDM1OX0.QKziA2Oi6Sa226f2afG9fOhq1754HhQvtqSKPTARYGc';

const supabase = createClient(supabaseUrl, supabaseAnonKey);

async function main() {
  const email = 'admin@gmail.com';
  const password = '000000';
  const jwtSecret = process.env.JWT_SECRET;

  console.log('JWT Secret from .env:', jwtSecret);

  console.log(`Logging in via Supabase Auth with ${email}...`);
  const { data, error } = await supabase.auth.signInWithPassword({ email, password });

  if (error) {
    console.error('❌ Supabase Auth Login failed:', error.message);
    return;
  }

  const token = data.session?.access_token;
  if (!token) {
    console.error('❌ No access token returned');
    return;
  }

  console.log('✅ Supabase login succeeded! Token retrieved.');

  try {
    const decoded = jsonwebtoken.verify(token, jwtSecret as string);
    console.log('✅ Token verified successfully by jsonwebtoken!');
    console.log('Decoded Payload:', JSON.stringify(decoded, null, 2));
  } catch (err: any) {
    console.error('❌ jsonwebtoken verification failed:', err.message);
  }
}

main();
