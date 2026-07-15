-- ============================================================
-- MIGRATION: Add 'misc' to shared_expense_configs
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Drop the existing category CHECK constraint
ALTER TABLE public.shared_expense_configs
  DROP CONSTRAINT IF EXISTS shared_expense_configs_category_check;

-- Step 2: Add the new constraint that includes 'misc'
ALTER TABLE public.shared_expense_configs
  ADD CONSTRAINT shared_expense_configs_category_check
  CHECK (category IN ('gas', 'electricity', 'misc'));

-- Step 3: Seed the new 'misc' row (gas and electricity already exist)
INSERT INTO public.shared_expense_configs (category, total_amount)
VALUES ('misc', 0)
ON CONFLICT (category) DO NOTHING;

-- Verify: should show 3 rows
SELECT * FROM public.shared_expense_configs ORDER BY category;
