-- Enable RLS on the locations table (it has a policy but RLS is not enabled)
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;