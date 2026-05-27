import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://ufhzhflqmusdxtakannq.supabase.co';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';

// A safe client initialization helper to prevent server-side crashes when keys are placeholder
const createSafeClient = () => {
  const isMissing = !supabaseUrl || !supabaseAnonKey || supabaseAnonKey === 'YOUR_SUPABASE_ANON_KEY' || supabaseAnonKey.trim() === '';
  
  if (typeof window !== 'undefined') {
    console.log('Supabase Client Init:', {
      url: supabaseUrl,
      keyLength: supabaseAnonKey ? supabaseAnonKey.length : 0,
      isMissing,
      keyStart: supabaseAnonKey ? supabaseAnonKey.substring(0, 10) : 'none'
    });
  }
  
  if (isMissing) {
    if (typeof window !== 'undefined') {
      console.warn('⚠️ Supabase credentials not configured. Auth actions will be disabled.');
    }
    
    // Return a dummy client to prevent imports from crashing Next.js rendering
    return {
      auth: {
        signInWithPassword: async () => {
          throw new Error('Supabase Auth is not configured. Please supply NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.');
        },
        signUp: async () => {
          throw new Error('Supabase Auth is not configured. Please supply NEXT_PUBLIC_SUPABASE_ANON_KEY in your .env.local file.');
        },
        signOut: async () => {},
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      }
    } as any;
  }

  try {
    return createClient(supabaseUrl, supabaseAnonKey);
  } catch (error) {
    console.error('Failed to initialize Supabase client:', error);
    return {
      auth: {
        signInWithPassword: async () => {
          throw new Error('Supabase Client failed to initialize: ' + (error as Error).message);
        },
        signUp: async () => {
          throw new Error('Supabase Client failed to initialize: ' + (error as Error).message);
        },
        signOut: async () => {},
        onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
      }
    } as any;
  }
};

export const supabase = createSafeClient();
