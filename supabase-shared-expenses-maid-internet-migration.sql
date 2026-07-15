-- ============================================================
-- CORRECTED MIGRATION: Move 'maid' and 'internet' to shared_expense_configs
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Add 'internet' and 'maid' to shared expense options
ALTER TABLE public.shared_expense_configs
  DROP CONSTRAINT IF EXISTS shared_expense_configs_category_check;

ALTER TABLE public.shared_expense_configs
  ADD CONSTRAINT shared_expense_configs_category_check
  CHECK (category IN ('gas', 'electricity', 'misc', 'internet', 'maid'));

-- Step 2: Seed default rows for internet & maid in shared configs
INSERT INTO public.shared_expense_configs (category, total_amount)
VALUES ('internet', 0), ('maid', 0)
ON CONFLICT (category) DO NOTHING;

-- Step 3: CRITICAL - Delete old fixed configs of internet/maid FIRST
-- If we don't do this first, the new constraint in the next step will fail.
DELETE FROM public.fixed_overhead_configs 
WHERE category IN ('internet', 'maid');

-- Step 4: Restrict fixed overhead categories to 'rent' only
ALTER TABLE public.fixed_overhead_configs
  DROP CONSTRAINT IF EXISTS fixed_overhead_configs_category_check;

ALTER TABLE public.fixed_overhead_configs
  ADD CONSTRAINT fixed_overhead_configs_category_check
  CHECK (category IN ('rent'));
