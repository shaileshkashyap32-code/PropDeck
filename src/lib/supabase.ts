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

export type Project = {
  id: string;
  name: string;
  developer: string;
  location: string;
  area: string;
  price_min: number;
  price_max: number;
  bhk_types: string[];
  carpet_area_min: number;
  carpet_area_max: number;
  possession_date: string;
  status: string;
  rera_number: string;
  usps: string[];
  landmarks: Array<{ name: string; distance: string; type: string }>;
  pitch_script: string;
  image_url: string;
  google_maps_url: string;
  tags: string[];
};

export type Salesperson = {
  id: string;
  name: string;
  mobile_number: string;
  role: string;
};

export const formatPrice = (price: number): string => {
  if (price >= 10000000) return `Rs.${(price / 10000000).toFixed(1)}Cr`;
  if (price >= 100000) return `Rs.${(price / 100000).toFixed(0)}L`;
  return `Rs.${price}`;
};
