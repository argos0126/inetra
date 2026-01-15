-- Fix: Add server-side validation to driver-documents storage bucket
-- This ensures file type and size restrictions are enforced at the server level

UPDATE storage.buckets
SET 
  file_size_limit = 5242880, -- 5MB (matches client-side limit)
  allowed_mime_types = ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
WHERE id = 'driver-documents';