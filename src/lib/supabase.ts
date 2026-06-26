import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const supabase = createClient(supabaseUrl, supabaseKey);

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
