-- Create integration_tokens table for storing Telenity API tokens
CREATE TABLE public.integration_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  token_type TEXT UNIQUE NOT NULL, -- 'authentication' or 'access'
  token_value TEXT NOT NULL,
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.integration_tokens ENABLE ROW LEVEL SECURITY;

-- Only superadmins can manage tokens
CREATE POLICY "Superadmins can manage integration_tokens" 
ON public.integration_tokens 
FOR ALL 
USING (is_superadmin(auth.uid()));

-- Create trigger for automatic timestamp updates
CREATE TRIGGER update_integration_tokens_updated_at
BEFORE UPDATE ON public.integration_tokens
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment for documentation
COMMENT ON TABLE public.integration_tokens IS 'Stores Telenity API tokens (authentication_token expires 6h, access_token expires 30min)';