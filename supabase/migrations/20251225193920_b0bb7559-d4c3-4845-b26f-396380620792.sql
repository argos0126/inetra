-- Create permission action enum
CREATE TYPE permission_action AS ENUM ('view', 'create', 'update', 'delete', 'manage');

-- Create permission resource enum  
CREATE TYPE permission_resource AS ENUM (
  'shipments', 'trips', 'customers', 'drivers', 'vehicles', 
  'transporters', 'locations', 'materials', 'lanes', 
  'tracking_assets', 'alerts', 'exceptions', 'reports', 
  'users', 'roles', 'settings'
);

-- Custom roles table
CREATE TABLE public.roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  description TEXT,
  is_system BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Role permissions table (what each role can do)
CREATE TABLE public.role_permissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  role_id UUID REFERENCES public.roles(id) ON DELETE CASCADE NOT NULL,
  resource permission_resource NOT NULL,
  action permission_action NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(role_id, resource, action)
);

-- Add custom_role_id and customer_id to user_roles for custom roles and company scoping
ALTER TABLE public.user_roles ADD COLUMN custom_role_id UUID REFERENCES public.roles(id) ON DELETE SET NULL;
ALTER TABLE public.user_roles ADD COLUMN customer_id UUID REFERENCES public.customers(id) ON DELETE SET NULL;

-- Enable RLS on new tables
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- RLS policies for roles table
CREATE POLICY "Superadmins can manage roles" 
ON public.roles 
FOR ALL 
USING (is_superadmin(auth.uid()));

CREATE POLICY "Authenticated users can view roles"
ON public.roles
FOR SELECT
TO authenticated
USING (true);

-- RLS policies for role_permissions table
CREATE POLICY "Superadmins can manage role_permissions" 
ON public.role_permissions 
FOR ALL 
USING (is_superadmin(auth.uid()));

CREATE POLICY "Authenticated users can view role_permissions"
ON public.role_permissions
FOR SELECT
TO authenticated
USING (true);

-- Create security definer function to check if user has permission
CREATE OR REPLACE FUNCTION public.has_permission(
  _user_id UUID, 
  _resource permission_resource, 
  _action permission_action
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT 
    is_superadmin(_user_id) 
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN role_permissions rp ON rp.role_id = ur.custom_role_id
      WHERE ur.user_id = _user_id 
        AND rp.resource = _resource 
        AND rp.action = _action
    )
$$;

-- Create security definer function to check scoped permission (for company-specific access)
CREATE OR REPLACE FUNCTION public.has_scoped_permission(
  _user_id UUID, 
  _resource permission_resource, 
  _action permission_action,
  _customer_id UUID
) RETURNS BOOLEAN
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT 
    is_superadmin(_user_id) 
    OR EXISTS (
      SELECT 1 FROM user_roles ur
      JOIN role_permissions rp ON rp.role_id = ur.custom_role_id
      WHERE ur.user_id = _user_id 
        AND rp.resource = _resource 
        AND rp.action = _action
        AND (ur.customer_id IS NULL OR ur.customer_id = _customer_id)
    )
$$;

-- Create function to get all permissions for a user
CREATE OR REPLACE FUNCTION public.get_user_permissions(_user_id UUID)
RETURNS TABLE(resource permission_resource, action permission_action, customer_id UUID)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT DISTINCT rp.resource, rp.action, ur.customer_id
  FROM user_roles ur
  JOIN role_permissions rp ON rp.role_id = ur.custom_role_id
  WHERE ur.user_id = _user_id
$$;

-- Insert initial system roles
INSERT INTO public.roles (name, description, is_system) VALUES
  ('Super Admin', 'Full access to all features and settings', true),
  ('Admin', 'Full access except user and role management', true),
  ('Operations Manager', 'Manage trips, shipments, alerts, and exceptions', true),
  ('Dispatcher', 'View trips, create and update shipments', true),
  ('Viewer', 'Read-only access to all data', true);

-- Insert permissions for Super Admin (all permissions)
INSERT INTO public.role_permissions (role_id, resource, action)
SELECT r.id, res.resource, act.action
FROM public.roles r
CROSS JOIN (VALUES 
  ('shipments'::permission_resource), ('trips'), ('customers'), ('drivers'), ('vehicles'),
  ('transporters'), ('locations'), ('materials'), ('lanes'), ('tracking_assets'),
  ('alerts'), ('exceptions'), ('reports'), ('users'), ('roles'), ('settings')
) AS res(resource)
CROSS JOIN (VALUES 
  ('view'::permission_action), ('create'), ('update'), ('delete'), ('manage')
) AS act(action)
WHERE r.name = 'Super Admin';

-- Insert permissions for Admin (all except users and roles management)
INSERT INTO public.role_permissions (role_id, resource, action)
SELECT r.id, res.resource, act.action
FROM public.roles r
CROSS JOIN (VALUES 
  ('shipments'::permission_resource), ('trips'), ('customers'), ('drivers'), ('vehicles'),
  ('transporters'), ('locations'), ('materials'), ('lanes'), ('tracking_assets'),
  ('alerts'), ('exceptions'), ('reports'), ('settings')
) AS res(resource)
CROSS JOIN (VALUES 
  ('view'::permission_action), ('create'), ('update'), ('delete'), ('manage')
) AS act(action)
WHERE r.name = 'Admin';

-- Insert permissions for Operations Manager
INSERT INTO public.role_permissions (role_id, resource, action)
SELECT r.id, res.resource, act.action
FROM public.roles r
CROSS JOIN (VALUES 
  ('trips'::permission_resource), ('shipments'), ('alerts'), ('exceptions')
) AS res(resource)
CROSS JOIN (VALUES 
  ('view'::permission_action), ('create'), ('update'), ('delete')
) AS act(action)
WHERE r.name = 'Operations Manager';

-- Add view permissions for Operations Manager on related entities
INSERT INTO public.role_permissions (role_id, resource, action)
SELECT r.id, res.resource, 'view'::permission_action
FROM public.roles r
CROSS JOIN (VALUES 
  ('customers'::permission_resource), ('drivers'), ('vehicles'), ('transporters'), 
  ('locations'), ('materials'), ('lanes'), ('tracking_assets')
) AS res(resource)
WHERE r.name = 'Operations Manager';

-- Insert permissions for Dispatcher
INSERT INTO public.role_permissions (role_id, resource, action)
SELECT r.id, 'trips'::permission_resource, 'view'::permission_action
FROM public.roles r WHERE r.name = 'Dispatcher';

INSERT INTO public.role_permissions (role_id, resource, action)
SELECT r.id, res.resource, act.action
FROM public.roles r
CROSS JOIN (VALUES ('shipments'::permission_resource)) AS res(resource)
CROSS JOIN (VALUES ('view'::permission_action), ('create'), ('update')) AS act(action)
WHERE r.name = 'Dispatcher';

-- Add view permissions for Dispatcher on related entities
INSERT INTO public.role_permissions (role_id, resource, action)
SELECT r.id, res.resource, 'view'::permission_action
FROM public.roles r
CROSS JOIN (VALUES 
  ('customers'::permission_resource), ('drivers'), ('vehicles'), ('locations')
) AS res(resource)
WHERE r.name = 'Dispatcher';

-- Insert permissions for Viewer (view-only on all resources)
INSERT INTO public.role_permissions (role_id, resource, action)
SELECT r.id, res.resource, 'view'::permission_action
FROM public.roles r
CROSS JOIN (VALUES 
  ('shipments'::permission_resource), ('trips'), ('customers'), ('drivers'), ('vehicles'),
  ('transporters'), ('locations'), ('materials'), ('lanes'), ('tracking_assets'),
  ('alerts'), ('exceptions'), ('reports')
) AS res(resource)
WHERE r.name = 'Viewer';

-- Add updated_at trigger for roles table
CREATE TRIGGER update_roles_updated_at
BEFORE UPDATE ON public.roles
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();