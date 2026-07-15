-- ============================================================
-- FLATMATE TRACKER — EXPENSE EDIT SUPPORT
-- Run this in your Supabase SQL Editor to enable expense editing.
-- ============================================================

-- 1. Add UPDATE policy for expenses
--    Allows active users to update expenses on open months.
--    Admins can update at any time.
DROP POLICY IF EXISTS "expenses_update" ON public.expenses;

CREATE POLICY "expenses_update" ON public.expenses
  FOR UPDATE USING (
    (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active')
      AND NOT EXISTS (SELECT 1 FROM public.months WHERE id = month_id AND is_closed = TRUE)
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 2. Ensure paid_by_details column exists (needed by ExpenseForm insert & update)
ALTER TABLE public.expenses
  ADD COLUMN IF NOT EXISTS paid_by_details JSONB DEFAULT '{}';

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
