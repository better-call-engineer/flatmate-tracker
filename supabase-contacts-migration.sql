-- ============================================================
-- FLATMATE TRACKER — IMPORTANT CONTACTS & SERVERS MIGRATION
-- Run this in your Supabase SQL Editor
-- Creates contacts and servers tables
-- ============================================================

-- Create Contacts Table
CREATE TABLE IF NOT EXISTS public.contacts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  tag TEXT NOT NULL, -- e.g., 'Flatmate', 'ISP', 'Maid', 'Caretaker', 'Other'
  phone_numbers TEXT[] NOT NULL DEFAULT '{}', -- multiple phone numbers for each Contact
  is_flatmate BOOLEAN NOT NULL DEFAULT FALSE, -- to distinguish flatmate details
  display_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Enable RLS for Contacts
ALTER TABLE public.contacts ENABLE ROW LEVEL SECURITY;

-- Select Policy: All authenticated users can view contacts
DROP POLICY IF EXISTS "contacts_select" ON public.contacts;
CREATE POLICY "contacts_select" ON public.contacts
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admin Policy: Only admin users can insert/update/delete contacts
DROP POLICY IF EXISTS "contacts_admin_all" ON public.contacts;
CREATE POLICY "contacts_admin_all" ON public.contacts
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Create Servers Table
CREATE TABLE IF NOT EXISTS public.servers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL, -- e.g. 'Movie Server', 'TV Server'
  url TEXT NOT NULL,
  description TEXT,
  category TEXT NOT NULL DEFAULT 'movie' CHECK (category IN ('movie', 'tv')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure category column exists in case servers table was already created
ALTER TABLE public.servers ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'movie';

-- Enable RLS for Servers
ALTER TABLE public.servers ENABLE ROW LEVEL SECURITY;

-- Select Policy: All authenticated users can view servers
DROP POLICY IF EXISTS "servers_select" ON public.servers;
CREATE POLICY "servers_select" ON public.servers
  FOR SELECT USING (auth.role() = 'authenticated');

-- Admin Policy: Only admin users can insert/update/delete servers
DROP POLICY IF EXISTS "servers_admin_all" ON public.servers;
CREATE POLICY "servers_admin_all" ON public.servers
  FOR ALL USING (
    EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Seed default servers if they don't exist
INSERT INTO public.servers (name, url, description, category) 
VALUES 
  ('Movie Server', 'http://192.168.1.100:8000', 'Local FTP / Plex movie server link', 'movie'),
  ('TV Server', 'http://192.168.1.100:9000', 'Local IP TV server link', 'tv')
ON CONFLICT DO NOTHING;

-- Update existing default servers if they already exist
UPDATE public.servers SET category = 'movie' WHERE name = 'Movie Server';
UPDATE public.servers SET category = 'tv' WHERE name = 'TV Server';

-- Ensure paid_by_details column exists on expenses table for split payment support
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS paid_by_details JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Notify PostgREST to reload the schema cache so the new columns are recognized immediately
NOTIFY pgrst, 'reload schema';
