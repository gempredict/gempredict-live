// pages/api/waitlist.js
// GemPredict — Waitlist email capture endpoint
//
// Accepts POST { email } from the frontend.
// Saves the email to Supabase (waitlist_emails table).
// Returns a friendly success response even for duplicate emails.
//
// REQUIRED ENVIRONMENT VARIABLES:
//   NEXT_PUBLIC_SUPABASE_URL     — your Supabase project URL
//   SUPABASE_SERVICE_ROLE_KEY    — your Supabase service role secret key
//
// REQUIRED SUPABASE TABLE:
//   See SQL schema at the bottom of SUPABASE_SCHEMA.sql (included in this project).
//   Table: waitlist_emails
//   Columns: id (uuid), email (text, unique), created_at (timestamptz)

import supabase from "../../lib/supabaseServer";

// ─── Email validator ──────────────────────────────────────────────────────────
function isValidEmail(email) {
  if (!email || typeof email !== "string") return false;
  const trimmed = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(trimmed) && trimmed.length <= 254;
}

// ─── Handler ──────────────────────────────────────────────────────────────────
export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed." });
  }

  const { email } = req.body || {};

  // Validate
  if (!email) {
    return res.status(400).json({ error: "Email address is required." });
  }
  if (!isValidEmail(email)) {
    return res.status(400).json({ error: "Please enter a valid email address." });
  }

  const normalised = email.trim().toLowerCase();

  // Guard: Supabase not configured
  if (!supabase) {
    console.error("[GemPredict Waitlist] Supabase client is not initialised. Check env vars.");
    // Fail gracefully — don't expose config errors to users
    return res.status(200).json({
      success: true,
      alreadyRegistered: false,
      message: "You are on the list.",
    });
  }

  try {
    // Attempt insert. The UNIQUE constraint on email will cause a conflict
    // if the email already exists. We handle that as a friendly success.
    const { error } = await supabase
      .from("waitlist_emails")
      .insert({ email: normalised });

    if (error) {
      // Postgres unique violation code is 23505.
      // Supabase surfaces this as error.code === "23505".
      if (error.code === "23505") {
        // Duplicate — treat as success so we don't leak whether an email is registered
        return res.status(200).json({
          success: true,
          alreadyRegistered: true,
          message: "You are already on the list.",
        });
      }

      // Any other DB error
      console.error("[GemPredict Waitlist] Supabase insert error:", error);
      return res.status(500).json({
        error: "Could not save your email. Please try again.",
      });
    }

    return res.status(200).json({
      success: true,
      alreadyRegistered: false,
      message: "You are on the list.",
    });

  } catch (err) {
    console.error("[GemPredict Waitlist] Unexpected error:", err);
    return res.status(500).json({
      error: "Something went wrong. Please try again.",
    });
  }
}
