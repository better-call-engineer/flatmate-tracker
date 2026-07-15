-- ============================================================
-- FLATMATE TRACKER — PASSWORD RESETS MIGRATION
-- Run this in your Supabase SQL Editor
-- ============================================================

CREATE TABLE IF NOT EXISTS public.password_resets (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied', 'completed')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.password_resets ENABLE ROW LEVEL SECURITY;

-- Select policy: admin can see all; users can see their own
CREATE POLICY "password_resets_select" ON public.password_resets
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
    OR auth.uid() = user_id
  );

-- Update policy: admin can update status
CREATE POLICY "password_resets_update" ON public.password_resets
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Insert policy: admin can insert (service role bypasses RLS for normal user requests)
CREATE POLICY "password_resets_insert" ON public.password_resets
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );
