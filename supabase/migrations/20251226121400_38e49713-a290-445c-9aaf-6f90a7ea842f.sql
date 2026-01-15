-- Add is_active column to roles table
ALTER TABLE public.roles 
ADD COLUMN IF NOT EXISTS is_active boolean NOT NULL DEFAULT true;