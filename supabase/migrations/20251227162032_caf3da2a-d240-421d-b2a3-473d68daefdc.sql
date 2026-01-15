-- Insert new integration settings
INSERT INTO tracking_settings (setting_key, setting_value, description) VALUES
  ('telenity_update_interval_seconds', '900', 'Telenity SIM tracking poll interval in seconds (default: 15 minutes)'),
  ('wheelseye_update_interval_seconds', '300', 'WheelsEye GPS tracking poll interval in seconds (default: 5 minutes)'),
  ('google_maps_rate_limit_per_minute', '50', 'Maximum Google Maps API requests per minute'),
  ('resend_daily_email_limit', '100', 'Maximum emails to send per day via Resend'),
  ('fleet_map_refresh_interval_seconds', '60', 'Fleet map UI refresh interval in seconds'),
  ('enable_telenity_tracking', 'true', 'Enable or disable Telenity SIM-based tracking'),
  ('enable_wheelseye_tracking', 'true', 'Enable or disable WheelsEye GPS tracking'),
  ('enable_google_maps_routing', 'true', 'Enable or disable Google Maps route calculations'),
  ('enable_resend_emails', 'true', 'Enable or disable email notifications via Resend')
ON CONFLICT (setting_key) DO NOTHING;