-- ============================================================
-- FIXED OVERHEAD CONFIGS
-- Run this in Supabase SQL Editor (after the main migration)
-- ============================================================

CREATE TABLE public.fixed_overhead_configs (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  category TEXT NOT NULL CHECK (category IN ('rent', 'internet', 'maid')),
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  updated_by UUID REFERENCES public.profiles(id),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id, category)
);

ALTER TABLE public.fixed_overhead_configs ENABLE ROW LEVEL SECURITY;

-- Anyone can read (needed for balance calculations and dashboard display)
CREATE POLICY "overhead_configs_select" ON public.fixed_overhead_configs
  FOR SELECT USING (true);

-- Only admin can insert/update
CREATE POLICY "overhead_configs_insert" ON public.fixed_overhead_configs
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "overhead_configs_update" ON public.fixed_overhead_configs
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "overhead_configs_delete" ON public.fixed_overhead_configs
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );
