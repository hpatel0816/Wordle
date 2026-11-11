import { createClient } from "@supabase/supabase-js";

// Online play is turned on by VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY
// (see .env.example). Without them the app is solo-only.
const url = import.meta.env.VITE_SUPABASE_URL;
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

export const onlineEnabled = Boolean(url && anonKey);
export const supabase = onlineEnabled ? createClient(url, anonKey) : null;
