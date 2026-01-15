-- Add INSERT policy for location_history to allow users with trips update permission
CREATE POLICY "Users with trips update can create location_history"
ON public.location_history
FOR INSERT
WITH CHECK (
  is_superadmin(auth.uid()) OR 
  has_permission(auth.uid(), 'trips'::permission_resource, 'update'::permission_action)
);