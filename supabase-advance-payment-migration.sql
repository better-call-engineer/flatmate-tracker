-- Advance Payment Migration
-- Adds is_advance and advance_for_month columns to the expenses table.
-- Run this in the Supabase SQL editor.

ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS is_advance BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS advance_for_month TEXT NULL;

-- Index for fast lookup of advance payments by target month
CREATE INDEX IF NOT EXISTS idx_expenses_advance
  ON expenses (is_advance, advance_for_month)
  WHERE is_advance = true;

COMMENT ON COLUMN expenses.is_advance IS
  'True when this payment is made in advance for a future month (capped at 1 month ahead).';

COMMENT ON COLUMN expenses.advance_for_month IS
  'The YYYY-MM label of the month this advance payment covers. Only set when is_advance = true.';
