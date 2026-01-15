-- Fix profiles table: Ensure non-superadmin users can only see their own profile
-- The existing policies are actually correct, but let's make them PERMISSIVE (default) instead of RESTRICTIVE
-- and ensure proper access control

-- Drop existing policies on profiles
DROP POLICY IF EXISTS "Superadmins can view all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can view their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can insert their own profile" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Recreate with proper PERMISSIVE policies (OR logic)
CREATE POLICY "Users can view their own profile" 
ON public.profiles FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Superadmins can view all profiles" 
ON public.profiles FOR SELECT 
USING (is_superadmin(auth.uid()));

CREATE POLICY "Users with permission can view profiles"
ON public.profiles FOR SELECT
USING (has_permission(auth.uid(), 'users'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users can insert their own profile" 
ON public.profiles FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own profile" 
ON public.profiles FOR UPDATE 
USING (auth.uid() = user_id);

CREATE POLICY "Superadmins can update all profiles"
ON public.profiles FOR UPDATE
USING (is_superadmin(auth.uid()));

-- Fix drivers table: Add permission-based access instead of only superadmin
DROP POLICY IF EXISTS "Superadmins can manage drivers" ON public.drivers;

-- Superadmin full access
CREATE POLICY "Superadmins can manage drivers" 
ON public.drivers FOR ALL 
USING (is_superadmin(auth.uid()));

-- Permission-based policies for drivers
CREATE POLICY "Users with view permission can view drivers"
ON public.drivers FOR SELECT
USING (has_permission(auth.uid(), 'drivers'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with create permission can create drivers"
ON public.drivers FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'drivers'::permission_resource, 'create'::permission_action));

CREATE POLICY "Users with update permission can update drivers"
ON public.drivers FOR UPDATE
USING (has_permission(auth.uid(), 'drivers'::permission_resource, 'update'::permission_action));

CREATE POLICY "Users with delete permission can delete drivers"
ON public.drivers FOR DELETE
USING (has_permission(auth.uid(), 'drivers'::permission_resource, 'delete'::permission_action));