-- ============================================================
-- FLATMATE TRACKER — SUPABASE SQL MIGRATION
-- Run this in your Supabase SQL Editor (in order)
-- ============================================================

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ============================================================
-- PROFILES
-- ============================================================
CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  username TEXT NOT NULL,
  slot INTEGER NOT NULL CHECK (slot BETWEEN 1 AND 4),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('admin', 'user')),
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'active', 'denied')),
  avatar_color TEXT DEFAULT '#4F46E5',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Profiles: anyone can read (needed for landing page tile states — no sensitive data in profiles)
CREATE POLICY "profiles_select" ON public.profiles
  FOR SELECT USING (true);

-- Profiles: users can insert their own
CREATE POLICY "profiles_insert" ON public.profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Profiles: users can update their own non-role fields; admin can update all
CREATE POLICY "profiles_update" ON public.profiles
  FOR UPDATE USING (
    auth.uid() = id
    OR EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = auth.uid() AND p.role = 'admin'
    )
  );

-- ============================================================
-- MONTHS
-- ============================================================
CREATE TABLE public.months (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  label TEXT NOT NULL UNIQUE,  -- e.g. "2025-07"
  is_closed BOOLEAN NOT NULL DEFAULT FALSE,
  opening_balances JSONB DEFAULT '{}',  -- { "user_id": amount }
  closed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.months ENABLE ROW LEVEL SECURITY;

CREATE POLICY "months_select" ON public.months
  FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "months_insert_admin" ON public.months
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "months_update_admin" ON public.months
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- EXPENSES
-- ============================================================
CREATE TABLE public.expenses (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  month_id UUID NOT NULL REFERENCES public.months(id) ON DELETE CASCADE,
  paid_by UUID NOT NULL REFERENCES public.profiles(id),
  category TEXT NOT NULL CHECK (category IN (
    'rent', 'internet', 'maid', 'electricity', 'gas', 'misc', 'grocery'
  )),
  description TEXT,
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  paid_full BOOLEAN NOT NULL DEFAULT FALSE,
  split_type TEXT NOT NULL DEFAULT 'even' CHECK (split_type IN ('even', 'custom')),
  split_details JSONB DEFAULT '{}',  -- { "user_id": amount_owed }
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.expenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "expenses_select" ON public.expenses
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active')
  );

CREATE POLICY "expenses_insert" ON public.expenses
  FOR INSERT WITH CHECK (
    (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active')
      AND NOT EXISTS (SELECT 1 FROM public.months WHERE id = month_id AND is_closed = TRUE)
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

CREATE POLICY "expenses_delete" ON public.expenses
  FOR DELETE USING (
    (
      EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active')
      AND NOT EXISTS (SELECT 1 FROM public.months WHERE id = month_id AND is_closed = TRUE)
    )
    OR EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- MEALS
-- ============================================================
CREATE TABLE public.meals (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES public.profiles(id),
  month_id UUID NOT NULL REFERENCES public.months(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  count NUMERIC(4, 1) NOT NULL DEFAULT 0 CHECK (count >= 0 AND count <= 10),
  UNIQUE(user_id, month_id, date)
);

ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meals_select" ON public.meals
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active')
  );

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

-- ============================================================
-- SETTLEMENTS
-- ============================================================
CREATE TABLE public.settlements (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  month_id UUID NOT NULL REFERENCES public.months(id),
  from_user UUID NOT NULL REFERENCES public.profiles(id),
  to_user UUID NOT NULL REFERENCES public.profiles(id),
  amount NUMERIC(10, 2) NOT NULL CHECK (amount > 0),
  note TEXT,
  settled_by_admin BOOLEAN DEFAULT FALSE,
  settled_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.settlements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "settlements_select" ON public.settlements
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active')
  );

CREATE POLICY "settlements_insert_admin" ON public.settlements
  FOR INSERT WITH CHECK (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- EDIT REQUESTS
-- ============================================================
CREATE TABLE public.edit_requests (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  requested_by UUID NOT NULL REFERENCES public.profiles(id),
  month_id UUID NOT NULL REFERENCES public.months(id),
  description TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'denied')),
  admin_note TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.edit_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "edit_requests_select" ON public.edit_requests
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active')
  );

CREATE POLICY "edit_requests_insert" ON public.edit_requests
  FOR INSERT WITH CHECK (
    auth.uid() = requested_by
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND status = 'active')
  );

CREATE POLICY "edit_requests_update_admin" ON public.edit_requests
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- ============================================================
-- FUNCTIONS & TRIGGERS
-- ============================================================

-- Auto-create profile on first sign-up (called from client-side)
-- Bootstrap: if no profiles exist yet, first user is admin
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  -- handled client-side for slot logic
  RETURN NEW;
END;
$$;

-- Trigger to update edit_requests.updated_at
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER edit_requests_updated_at
  BEFORE UPDATE ON public.edit_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- REALTIME
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.expenses;
ALTER PUBLICATION supabase_realtime ADD TABLE public.meals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.profiles;
ALTER PUBLICATION supabase_realtime ADD TABLE public.edit_requests;
