"use client";

import { createClient } from "@supabase/supabase-js";

const supabaseUrl = "https://bmhsjutyqplvwlkuarbr.supabase.co";
//"process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = "sb_publishable_5SkqsKU8jNnwKF22Wf1W5A_rA7Ufckm";
//process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

// Single browser-side client, reused across the app.
// Safe to expose: this is the anon/publishable key, protected by RLS policies
// on the Supabase side — never put the service_role key here.
export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});
