-- Insert 10 new system roles
INSERT INTO public.roles (name, description, is_system) VALUES
  ('Shipper Admin', 'Customer company admin who can manage their own shipments, view assigned trips, and manage their users', true),
  ('Shipper User', 'Basic customer user who can create shipments and track their orders', true),
  ('Transporter Admin', 'Transporter company admin who can manage their vehicles, drivers, and view assigned trips', true),
  ('Fleet Manager', 'Manages vehicles, tracking assets, and driver assignments', true),
  ('Driver Coordinator', 'Manages drivers, consents, and driver documents', true),
  ('Billing Manager', 'Access to shipment billing, POD management, and financial reports', true),
  ('Route Planner', 'Manages lanes, routes, and serviceability lanes', true),
  ('Control Tower', 'Real-time tracking, alerts, exceptions monitoring', true),
  ('Customer Support', 'View access to most data, update shipment statuses, handle exceptions', true),
  ('Data Entry Operator', 'Bulk import access, create locations, materials, basic data entry', true);

-- Shipper Admin permissions
INSERT INTO public.role_permissions (role_id, resource, action)
SELECT r.id, rp.resource, rp.action
FROM public.roles r
CROSS JOIN (VALUES 
  ('shipments'::permission_resource, 'view'::permission_action),
  ('shipments', 'create'),
  ('shipments', 'update'),
  ('shipments', 'delete'),
  ('trips', 'view'),
  ('customers', 'view'),
  ('locations', 'view'),
  ('alerts', 'view'),
  ('reports', 'view')
) AS rp(resource, action)
WHERE r.name = 'Shipper Admin';

-- Shipper User permissions
INSERT INTO public.role_permissions (role_id, resource, action)
SELECT r.id, rp.resource, rp.action
FROM public.roles r
CROSS JOIN (VALUES 
  ('shipments'::permission_resource, 'view'::permission_action),
  ('shipments', 'create'),
  ('trips', 'view'),
  ('locations', 'view'),
  ('alerts', 'view')
) AS rp(resource, action)
WHERE r.name = 'Shipper User';

-- Transporter Admin permissions
INSERT INTO public.role_permissions (role_id, resource, action)
SELECT r.id, rp.resource, rp.action
FROM public.roles r
CROSS JOIN (VALUES 
  ('shipments'::permission_resource, 'view'::permission_action),
  ('trips', 'view'),
  ('drivers', 'view'),
  ('drivers', 'create'),
  ('drivers', 'update'),
  ('drivers', 'delete'),
  ('vehicles', 'view'),
  ('vehicles', 'create'),
  ('vehicles', 'update'),
  ('vehicles', 'delete'),
  ('transporters', 'view'),
  ('tracking_assets', 'view'),
  ('tracking_assets', 'create'),
  ('tracking_assets', 'update'),
  ('locations', 'view'),
  ('alerts', 'view'),
  ('reports', 'view')
) AS rp(resource, action)
WHERE r.name = 'Transporter Admin';

-- Fleet Manager permissions
INSERT INTO public.role_permissions (role_id, resource, action)
SELECT r.id, rp.resource, rp.action
FROM public.roles r
CROSS JOIN (VALUES 
  ('shipments'::permission_resource, 'view'::permission_action),
  ('trips', 'view'),
  ('drivers', 'view'),
  ('vehicles', 'view'),
  ('vehicles', 'create'),
  ('vehicles', 'update'),
  ('vehicles', 'delete'),
  ('tracking_assets', 'view'),
  ('tracking_assets', 'create'),
  ('tracking_assets', 'update'),
  ('tracking_assets', 'delete'),
  ('locations', 'view'),
  ('alerts', 'view'),
  ('reports', 'view')
) AS rp(resource, action)
WHERE r.name = 'Fleet Manager';

-- Driver Coordinator permissions
INSERT INTO public.role_permissions (role_id, resource, action)
SELECT r.id, rp.resource, rp.action
FROM public.roles r
CROSS JOIN (VALUES 
  ('shipments'::permission_resource, 'view'::permission_action),
  ('trips', 'view'),
  ('drivers', 'view'),
  ('drivers', 'create'),
  ('drivers', 'update'),
  ('drivers', 'delete'),
  ('vehicles', 'view'),
  ('locations', 'view'),
  ('alerts', 'view')
) AS rp(resource, action)
WHERE r.name = 'Driver Coordinator';

-- Billing Manager permissions
INSERT INTO public.role_permissions (role_id, resource, action)
SELECT r.id, rp.resource, rp.action
FROM public.roles r
CROSS JOIN (VALUES 
  ('shipments'::permission_resource, 'view'::permission_action),
  ('shipments', 'update'),
  ('trips', 'view'),
  ('customers', 'view'),
  ('reports', 'view'),
  ('reports', 'create')
) AS rp(resource, action)
WHERE r.name = 'Billing Manager';

-- Route Planner permissions
INSERT INTO public.role_permissions (role_id, resource, action)
SELECT r.id, rp.resource, rp.action
FROM public.roles r
CROSS JOIN (VALUES 
  ('shipments'::permission_resource, 'view'::permission_action),
  ('trips', 'view'),
  ('locations', 'view'),
  ('locations', 'create'),
  ('locations', 'update'),
  ('locations', 'delete'),
  ('lanes', 'view'),
  ('lanes', 'create'),
  ('lanes', 'update'),
  ('lanes', 'delete')
) AS rp(resource, action)
WHERE r.name = 'Route Planner';

-- Control Tower permissions
INSERT INTO public.role_permissions (role_id, resource, action)
SELECT r.id, rp.resource, rp.action
FROM public.roles r
CROSS JOIN (VALUES 
  ('shipments'::permission_resource, 'view'::permission_action),
  ('trips', 'view'),
  ('drivers', 'view'),
  ('vehicles', 'view'),
  ('locations', 'view'),
  ('tracking_assets', 'view'),
  ('alerts', 'view'),
  ('alerts', 'create'),
  ('alerts', 'update'),
  ('alerts', 'delete'),
  ('exceptions', 'view'),
  ('exceptions', 'create'),
  ('exceptions', 'update'),
  ('reports', 'view')
) AS rp(resource, action)
WHERE r.name = 'Control Tower';

-- Customer Support permissions
INSERT INTO public.role_permissions (role_id, resource, action)
SELECT r.id, rp.resource, rp.action
FROM public.roles r
CROSS JOIN (VALUES 
  ('shipments'::permission_resource, 'view'::permission_action),
  ('shipments', 'update'),
  ('trips', 'view'),
  ('drivers', 'view'),
  ('vehicles', 'view'),
  ('customers', 'view'),
  ('locations', 'view'),
  ('alerts', 'view'),
  ('alerts', 'update'),
  ('exceptions', 'view'),
  ('exceptions', 'create'),
  ('exceptions', 'update'),
  ('reports', 'view')
) AS rp(resource, action)
WHERE r.name = 'Customer Support';

-- Data Entry Operator permissions
INSERT INTO public.role_permissions (role_id, resource, action)
SELECT r.id, rp.resource, rp.action
FROM public.roles r
CROSS JOIN (VALUES 
  ('shipments'::permission_resource, 'create'::permission_action),
  ('trips', 'create'),
  ('drivers', 'create'),
  ('vehicles', 'create'),
  ('customers', 'create'),
  ('locations', 'view'),
  ('locations', 'create'),
  ('locations', 'update'),
  ('locations', 'delete'),
  ('materials', 'view'),
  ('materials', 'create'),
  ('materials', 'update'),
  ('materials', 'delete')
) AS rp(resource, action)
WHERE r.name = 'Data Entry Operator';