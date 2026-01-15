-- Add INSERT policy for trip_audit_logs to allow users with trips update permission
CREATE POLICY "Users with trips update can create trip_audit_logs"
ON public.trip_audit_logs
FOR INSERT
WITH CHECK (
  is_superadmin(auth.uid()) OR 
  has_permission(auth.uid(), 'trips'::permission_resource, 'update'::permission_action)
);