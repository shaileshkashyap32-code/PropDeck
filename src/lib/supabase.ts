import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

// ─── PropDeck login session ──────────────────────────────────────────────
// After a successful login the database hands back a random session token.
// We keep it in localStorage and send it with admin actions / to restore the
// session on refresh. The raw token is never stored in the database — only its
// hash is — so this value alone can't be reversed into anything sensitive.
const SESSION_KEY = 'pd_session_token';
export const saveSession = (token: string) => localStorage.setItem(SESSION_KEY, token);
export const getSession = (): string | null => localStorage.getItem(SESSION_KEY);
export const clearSession = () => localStorage.removeItem(SESSION_KEY);
