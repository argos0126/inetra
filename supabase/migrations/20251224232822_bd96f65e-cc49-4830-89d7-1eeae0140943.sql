-- Add POD file storage column to shipments
ALTER TABLE public.shipments
ADD COLUMN IF NOT EXISTS pod_file_path TEXT,
ADD COLUMN IF NOT EXISTS pod_file_name TEXT;

-- Create storage bucket for POD documents
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'pod-documents',
  'pod-documents',
  false,
  10485760, -- 10MB limit
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- RLS policies for POD documents bucket
CREATE POLICY "Authenticated users can upload POD documents"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'pod-documents');

CREATE POLICY "Authenticated users can view POD documents"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'pod-documents');

CREATE POLICY "Authenticated users can update POD documents"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'pod-documents');

CREATE POLICY "Authenticated users can delete POD documents"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'pod-documents');