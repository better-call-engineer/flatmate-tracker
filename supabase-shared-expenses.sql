-- ============================================================
-- SHARED EXPENSE CONFIGS
-- Run this in Supabase SQL Editor (after the main migration)
-- One row per category (gas / electricity) — not per user.
-- Per-user amount = total_amount ÷ active_user_count (computed in app).
-- ============================================================

CREATE TABLE public.shared_expense_configs (
  id            UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  category      TEXT NOT NULL CHECK (category IN ('gas', 'electricity')),
  total_amount  NUMERIC(10, 2) NOT NULL DEFAULT 0,
  updated_by    UUID REFERENCES public.profiles(id),
  updated_at    TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(category)
);

ALTER TABLE public.shared_expense_configs ENABLE ROW LEVEL SECURITY;

-- Anyone can read (needed for dashboard display and balance calculations)
CREATE POLICY "shared_expense_configs_select" ON public.shared_expense_configs
  FOR SELECT USING (true);

-- Only admin can insert
CREATE POLICY "shared_expense_configs_insert" ON public.shared_expense_configs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Only admin can update
CREATE POLICY "shared_expense_configs_update" ON public.shared_expense_configs
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Only admin can delete
CREATE POLICY "shared_expense_configs_delete" ON public.shared_expense_configs
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Seed default rows so the admin page always shows both categories
INSERT INTO public.shared_expense_configs (category, total_amount)
VALUES ('gas', 0), ('electricity', 0)
ON CONFLICT (category) DO NOTHING;
