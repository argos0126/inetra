-- Fix POD documents storage policies: restrict to superadmin and permission-based access
-- Drop overly permissive policies
DROP POLICY IF EXISTS "Authenticated users can upload POD documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can view POD documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can update POD documents" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete POD documents" ON storage.objects;

-- Create superadmin and permission-based policies
CREATE POLICY "Superadmins and users with shipments permission can upload POD documents"
ON storage.objects FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'pod-documents' AND
  (is_superadmin(auth.uid()) OR has_permission(auth.uid(), 'shipments'::permission_resource, 'create'::permission_action))
);

CREATE POLICY "Superadmins and users with shipments permission can view POD documents"
ON storage.objects FOR SELECT TO authenticated
USING (
  bucket_id = 'pod-documents' AND
  (is_superadmin(auth.uid()) OR has_permission(auth.uid(), 'shipments'::permission_resource, 'view'::permission_action))
);

CREATE POLICY "Superadmins and users with shipments permission can update POD documents"
ON storage.objects FOR UPDATE TO authenticated
USING (
  bucket_id = 'pod-documents' AND
  (is_superadmin(auth.uid()) OR has_permission(auth.uid(), 'shipments'::permission_resource, 'update'::permission_action))
);

CREATE POLICY "Superadmins and users with shipments permission can delete POD documents"
ON storage.objects FOR DELETE TO authenticated
USING (
  bucket_id = 'pod-documents' AND
  (is_superadmin(auth.uid()) OR has_permission(auth.uid(), 'shipments'::permission_resource, 'delete'::permission_action))
);