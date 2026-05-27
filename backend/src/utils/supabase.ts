import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ufhzhflqmusdxtakannq.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVmaHpoZmxxbXVzZHh0YWthbm5xIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzkyNTgzNTksImV4cCI6MjA5NDgzNDM1OX0.QKziA2Oi6Sa226f2afG9fOhq1754HhQvtqSKPTARYGc';

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
