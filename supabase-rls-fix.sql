-- ============================================================
-- FLATMATE TRACKER — SUPABASE EXPENSES & MEALS RLS POLICY FIX
-- Run this in your Supabase SQL Editor
-- ============================================================

-- 1. Drop existing expenses insert and delete policies
DROP POLICY IF EXISTS "expenses_insert" ON public.expenses;
DROP POLICY IF EXISTS "expenses_delete" ON public.expenses;
DROP POLICY IF EXISTS "meals_insert_update" ON public.meals;
DROP POLICY IF EXISTS "meals_update_own" ON public.meals;

-- 2. Create updated insert policy for expenses:
-- Allow any active profile to insert expenses for open months.
-- Allow admins to insert expenses at any time (even closed months).
CREATE POLICY "expenses_insert" ON public.expenses
  FOR INSERT WITH CHECK (
    (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active')
      AND NOT EXISTS (SELECT 1 FROM public.months WHERE id = month_id AND is_closed = TRUE)
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 3. Create updated delete policy for expenses:
-- Allow any active profile to delete expenses for open months, or admins at any time
CREATE POLICY "expenses_delete" ON public.expenses
  FOR DELETE USING (
    (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active')
      AND NOT EXISTS (SELECT 1 FROM public.months WHERE id = month_id AND is_closed = TRUE)
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- 4. Create updated insert/update policy for meals:
-- Allow active users to log/edit their own meals for open months.
-- Allow admins to log/edit meals for any user at any time.
CREATE POLICY "meals_insert_update" ON public.meals
  FOR INSERT WITH CHECK (
    (
      auth.uid() = user_id
      AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active')
      AND NOT EXISTS (SELECT 1 FROM public.months WHERE id = month_id AND is_closed = TRUE)
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "meals_update_own" ON public.meals
  FOR UPDATE USING (
    (
      auth.uid() = user_id
      AND NOT EXISTS (SELECT 1 FROM public.months WHERE id = month_id AND is_closed = TRUE)
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Notify PostgREST to reload the schema cache
NOTIFY pgrst, 'reload schema';
