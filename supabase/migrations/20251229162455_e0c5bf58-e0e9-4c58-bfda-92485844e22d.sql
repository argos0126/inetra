-- Create compliance_alerts table for tracking expiring documents
CREATE TABLE public.compliance_alerts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  entity_type TEXT NOT NULL CHECK (entity_type IN ('vehicle', 'driver')),
  entity_id UUID NOT NULL,
  document_type TEXT NOT NULL,
  expiry_date DATE NOT NULL,
  alert_level TEXT NOT NULL DEFAULT 'warning' CHECK (alert_level IN ('warning', 'critical', 'expired')),
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active', 'acknowledged', 'resolved')),
  notified_at TIMESTAMP WITH TIME ZONE,
  acknowledged_at TIMESTAMP WITH TIME ZONE,
  acknowledged_by UUID,
  resolved_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Create index for fast lookups
CREATE INDEX idx_compliance_alerts_entity ON public.compliance_alerts(entity_type, entity_id);
CREATE INDEX idx_compliance_alerts_status ON public.compliance_alerts(status);
CREATE INDEX idx_compliance_alerts_level ON public.compliance_alerts(alert_level);

-- Enable RLS
ALTER TABLE public.compliance_alerts ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Superadmins can manage compliance_alerts" 
ON public.compliance_alerts 
FOR ALL 
USING (is_superadmin(auth.uid()));

CREATE POLICY "Users with vehicles view can view compliance_alerts" 
ON public.compliance_alerts 
FOR SELECT 
USING (has_permission(auth.uid(), 'vehicles'::permission_resource, 'view'::permission_action));

CREATE POLICY "Users with vehicles update can update compliance_alerts" 
ON public.compliance_alerts 
FOR UPDATE 
USING (has_permission(auth.uid(), 'vehicles'::permission_resource, 'update'::permission_action));

-- Trigger for updated_at
CREATE TRIGGER update_compliance_alerts_updated_at
BEFORE UPDATE ON public.compliance_alerts
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Add compliance settings to tracking_settings
INSERT INTO public.tracking_settings (setting_key, setting_value, description) VALUES
  ('compliance_warning_days', '30', 'Days before expiry to show warning alert'),
  ('compliance_critical_days', '7', 'Days before expiry to show critical alert'),
  ('geofence_auto_start_enabled', 'false', 'Auto-start trips when vehicle enters origin geofence')
ON CONFLICT (setting_key) DO NOTHING;