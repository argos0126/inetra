-- Add RLS policies for role_permissions to allow admin users to manage them
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Admins can manage role_permissions" ON public.role_permissions;

-- Create policy for admins to manage role_permissions
CREATE POLICY "Admins can manage role_permissions" 
ON public.role_permissions 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));

-- Add RLS policies for roles table to allow admin users to manage them
DROP POLICY IF EXISTS "Admins can manage roles" ON public.roles;

-- Create policy for admins to manage roles
CREATE POLICY "Admins can manage roles" 
ON public.roles 
FOR ALL 
TO authenticated
USING (has_role(auth.uid(), 'admin'))
WITH CHECK (has_role(auth.uid(), 'admin'));