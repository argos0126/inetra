-- Add latitude and longitude columns to transporters table
ALTER TABLE public.transporters
ADD COLUMN latitude numeric NULL,
ADD COLUMN longitude numeric NULL;

-- Add latitude and longitude columns to customers table
ALTER TABLE public.customers
ADD COLUMN latitude numeric NULL,
ADD COLUMN longitude numeric NULL;