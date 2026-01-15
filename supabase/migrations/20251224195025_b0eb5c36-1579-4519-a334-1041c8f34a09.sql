-- Create tracking_settings table for configurable tracking frequency
CREATE TABLE public.tracking_settings (
    id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    setting_key text NOT NULL UNIQUE,
    setting_value text NOT NULL,
    description text,
    created_at timestamp with time zone NOT NULL DEFAULT now(),
    updated_at timestamp with time zone NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tracking_settings ENABLE ROW LEVEL SECURITY;

-- Create policy for superadmins
CREATE POLICY "Superadmins can manage tracking_settings" 
ON public.tracking_settings 
FOR ALL 
USING (is_superadmin(auth.uid()));

-- Insert default tracking frequency (15 minutes = 900 seconds)
INSERT INTO public.tracking_settings (setting_key, setting_value, description)
VALUES ('tracking_frequency_seconds', '900', 'Location tracking interval in seconds (default: 900 = 15 minutes)');

-- Add sequence_number column to tracking_logs for ordered location data
ALTER TABLE public.tracking_logs ADD COLUMN IF NOT EXISTS sequence_number integer;

-- Add detailed_address column for storing the address from Telenity response
ALTER TABLE public.tracking_logs ADD COLUMN IF NOT EXISTS detailed_address text;

-- Create trigger to update updated_at on tracking_settings
CREATE TRIGGER update_tracking_settings_updated_at
BEFORE UPDATE ON public.tracking_settings
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();