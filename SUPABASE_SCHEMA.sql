-- GemPredict — Supabase SQL Schema
-- Run this in your Supabase project:
-- Dashboard > SQL Editor > New Query > paste and run

-- ─────────────────────────────────────────────────────────────────────────────
-- waitlist_emails table
-- Stores email addresses submitted via the photo grading waitlist.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS waitlist_emails (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email      TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Enforce uniqueness at the database level.
  -- Duplicate inserts return Postgres error code 23505,
  -- which the API handles gracefully as a silent success.
  CONSTRAINT waitlist_emails_email_unique UNIQUE (email)
);

-- Index for fast lookups by email
CREATE INDEX IF NOT EXISTS waitlist_emails_email_idx ON waitlist_emails (email);

-- Row Level Security — only the service role key can read/write this table.
ALTER TABLE waitlist_emails ENABLE ROW LEVEL SECURITY;

-- Optional queries:
-- SELECT * FROM waitlist_emails ORDER BY created_at DESC;
-- SELECT COUNT(*) FROM waitlist_emails;


-- ─────────────────────────────────────────────────────────────────────────────
-- prediction_logs table
-- Lightweight request log written by /api/predict on every call.
-- Useful for monitoring usage, debugging failures, and spotting abuse patterns.
-- Logging is always non-fatal — a DB failure never blocks the prediction API.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS prediction_logs (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ip            TEXT,
  card_name     TEXT,
  card_type     TEXT,
  card_set      TEXT,

  -- status values: success | failed | rate_limited | invalid_input
  status        TEXT        NOT NULL DEFAULT 'unknown',

  -- Populated on failure — safe internal label, never a raw stack trace
  error_message TEXT
);

-- Index for querying by status (e.g. find all failures)
CREATE INDEX IF NOT EXISTS prediction_logs_status_idx ON prediction_logs (status);

-- Index for querying by time (most recent first)
CREATE INDEX IF NOT EXISTS prediction_logs_created_idx ON prediction_logs (created_at DESC);

-- Row Level Security — server-side only, same pattern as waitlist_emails.
ALTER TABLE prediction_logs ENABLE ROW LEVEL SECURITY;

-- Optional queries:
-- All requests in the last 24 hours:
-- SELECT * FROM prediction_logs WHERE created_at > NOW() - INTERVAL '24 hours' ORDER BY created_at DESC;

-- Failure rate today:
-- SELECT status, COUNT(*) FROM prediction_logs WHERE created_at > NOW() - INTERVAL '24 hours' GROUP BY status;

-- Most searched card types:
-- SELECT card_type, COUNT(*) FROM prediction_logs WHERE status = 'success' GROUP BY card_type ORDER BY COUNT(*) DESC;

-- Top searched card names:
-- SELECT card_name, COUNT(*) FROM prediction_logs WHERE status = 'success' GROUP BY card_name ORDER BY COUNT(*) DESC LIMIT 20;

