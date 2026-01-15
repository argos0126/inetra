-- Fix RLS policies for driver-documents storage bucket
-- Add policies for users with drivers permission (not just superadmins)

-- Drop existing restrictive policies
DROP POLICY IF EXISTS "Superadmins can view driver documents" ON storage.objects;
DROP POLICY IF EXISTS "Superadmins can upload driver documents" ON storage.objects;
DROP POLICY IF EXISTS "Superadmins can update driver documents" ON storage.objects;
DROP POLICY IF EXISTS "Superadmins can delete driver documents" ON storage.objects;

-- Create new policies that allow users with drivers permission
CREATE POLICY "Users with drivers permission can view driver documents"
ON storage.objects FOR SELECT
USING (
  bucket_id = 'driver-documents' 
  AND (
    is_superadmin(auth.uid()) 
    OR has_permission(auth.uid(), 'drivers'::permission_resource, 'view'::permission_action)
  )
);

CREATE POLICY "Users with drivers permission can upload driver documents"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'driver-documents' 
  AND (
    is_superadmin(auth.uid()) 
    OR has_permission(auth.uid(), 'drivers'::permission_resource, 'create'::permission_action)
  )
);

CREATE POLICY "Users with drivers permission can update driver documents"
ON storage.objects FOR UPDATE
USING (
  bucket_id = 'driver-documents' 
  AND (
    is_superadmin(auth.uid()) 
    OR has_permission(auth.uid(), 'drivers'::permission_resource, 'update'::permission_action)
  )
);

CREATE POLICY "Users with drivers permission can delete driver documents"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'driver-documents' 
  AND (
    is_superadmin(auth.uid()) 
    OR has_permission(auth.uid(), 'drivers'::permission_resource, 'delete'::permission_action)
  )
);