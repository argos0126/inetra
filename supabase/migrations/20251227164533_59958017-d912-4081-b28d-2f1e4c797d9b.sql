-- Fix 1: Drop permissive policy on drivers table that exposes PII
DROP POLICY IF EXISTS "Authenticated users can view shared drivers" ON public.drivers;

-- Fix 2: Drop any permissive policy on customers table
-- Looking at the RLS policies, customers table only has permission-based policies
-- which is correct, but we need to verify there's no "Authenticated users" policy

-- Fix 3: Drop permissive policy on tracking_assets that exposes API credentials
DROP POLICY IF EXISTS "Authenticated users can view tracking_assets" ON public.tracking_assets;