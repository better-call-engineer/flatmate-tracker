-- ============================================================
-- MIGRATION: Make fixed overheads and shared expenses monthly
-- Run this in Supabase SQL Editor
-- ============================================================

-- Step 1: Add month_id columns
ALTER TABLE public.fixed_overhead_configs ADD COLUMN month_id UUID REFERENCES public.months(id) ON DELETE CASCADE;
ALTER TABLE public.shared_expense_configs ADD COLUMN month_id UUID REFERENCES public.months(id) ON DELETE CASCADE;

-- Step 2: Seed month_id for existing configurations
-- We link existing configs to the oldest month so they are preserved
UPDATE public.fixed_overhead_configs SET month_id = (SELECT id FROM public.months ORDER BY label ASC LIMIT 1) WHERE month_id IS NULL;
UPDATE public.shared_expense_configs SET month_id = (SELECT id FROM public.months ORDER BY label ASC LIMIT 1) WHERE month_id IS NULL;

-- Step 3: Make month_id NOT NULL after seeding
ALTER TABLE public.fixed_overhead_configs ALTER COLUMN month_id SET NOT NULL;
ALTER TABLE public.shared_expense_configs ALTER COLUMN month_id SET NOT NULL;

-- Step 4: Drop old unique constraints and add new ones containing month_id
ALTER TABLE public.fixed_overhead_configs DROP CONSTRAINT IF EXISTS fixed_overhead_configs_user_id_category_key;
ALTER TABLE public.fixed_overhead_configs ADD CONSTRAINT fixed_overhead_configs_user_id_category_month_unique UNIQUE(user_id, category, month_id);

ALTER TABLE public.shared_expense_configs DROP CONSTRAINT IF EXISTS shared_expense_configs_category_key;
ALTER TABLE public.shared_expense_configs ADD CONSTRAINT shared_expense_configs_category_month_unique UNIQUE(category, month_id);
