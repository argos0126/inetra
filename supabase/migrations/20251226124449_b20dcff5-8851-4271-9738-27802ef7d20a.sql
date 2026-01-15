-- Add RLS policies for transporters table
CREATE POLICY "Users with transporters view can view transporters"
ON public.transporters
FOR SELECT
USING (has_permission(auth.uid(), 'transporters'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with transporters create can create transporters"
ON public.transporters
FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'transporters'::permission_resource, 'create'::permission_action));

CREATE POLICY "Users with transporters update can update transporters"
ON public.transporters
FOR UPDATE
USING (has_permission(auth.uid(), 'transporters'::permission_resource, 'update'::permission_action));

CREATE POLICY "Users with transporters delete can delete transporters"
ON public.transporters
FOR DELETE
USING (has_permission(auth.uid(), 'transporters'::permission_resource, 'delete'::permission_action));

-- Add RLS policies for customers table
CREATE POLICY "Users with customers view can view customers"
ON public.customers
FOR SELECT
USING (has_permission(auth.uid(), 'customers'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with customers create can create customers"
ON public.customers
FOR INSERT
WITH CHECK (has_permission(auth.uid(), 'customers'::permission_resource, 'create'::permission_action));

CREATE POLICY "Users with customers update can update customers"
ON public.customers
FOR UPDATE
USING (has_permission(auth.uid(), 'customers'::permission_resource, 'update'::permission_action));

CREATE POLICY "Users with customers delete can delete customers"
ON public.customers
FOR DELETE
USING (has_permission(auth.uid(), 'customers'::permission_resource, 'delete'::permission_action));