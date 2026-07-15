-- ============================================================
-- FLATMATE TRACKER — GUEST MEALS MIGRATION
-- Run this in your Supabase SQL Editor
-- Adds guest_count column to the meals table
-- ============================================================

-- Add guest_count column (defaults to 0 so existing rows are unaffected)
ALTER TABLE public.meals
  ADD COLUMN IF NOT EXISTS guest_count NUMERIC(4, 1) NOT NULL DEFAULT 0
  CHECK (guest_count >= 0 AND guest_count <= 20);
