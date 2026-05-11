// lib/supabaseServer.js
// GemPredict — Supabase server-side client
//
// SETUP INSTRUCTIONS:
// 1. Go to https://supabase.com and create a free project.
// 2. In your Supabase project dashboard, go to Settings > API.
// 3. Copy the following two values:
//    - "Project URL"        → set as NEXT_PUBLIC_SUPABASE_URL in your .env.local
//    - "service_role" key   → set as SUPABASE_SERVICE_ROLE_KEY in your .env.local
//
// IMPORTANT: Never expose SUPABASE_SERVICE_ROLE_KEY to the browser.
// This file is only ever imported from server-side API routes (pages/api/*).
//
// For Vercel deployment:
// Add both variables in Vercel → Project Settings → Environment Variables.

import { createClient } from "@supabase/supabase-js";

const supabaseUrl     = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey     = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  // Warn clearly during development if env vars are missing.
  // In production this will cause API routes to fail gracefully with a logged error.
  console.warn(
    "[GemPredict] WARNING: Supabase environment variables are not set.\n" +
    "Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY in .env.local"
  );
}

// createClient is called once per module load. In Next.js API routes running on
// Vercel's serverless functions this is effectively per-invocation, which is fine.
const supabase = supabaseUrl && supabaseKey
  ? createClient(supabaseUrl, supabaseKey)
  : null;

export default supabase;
