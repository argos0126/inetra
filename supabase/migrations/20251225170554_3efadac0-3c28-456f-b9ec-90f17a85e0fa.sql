-- Insert default alert threshold settings into tracking_settings table
INSERT INTO public.tracking_settings (setting_key, setting_value, description)
VALUES 
  ('route_deviation_threshold_meters', '500', 'Distance in meters from planned route to trigger route deviation alert'),
  ('stoppage_threshold_minutes', '30', 'Minutes of vehicle stoppage to trigger stoppage alert'),
  ('tracking_lost_threshold_minutes', '30', 'Minutes without location update to trigger tracking lost alert'),
  ('delay_threshold_minutes', '60', 'Minutes past planned ETA/end time to trigger delay warning alert'),
  ('idle_threshold_minutes', '120', 'Minutes after trip start with no location data to trigger idle alert')
ON CONFLICT (setting_key) DO NOTHING;