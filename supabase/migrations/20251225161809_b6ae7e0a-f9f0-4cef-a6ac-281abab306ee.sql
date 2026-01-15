-- Check if unique constraint exists, if not add it
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'tracking_settings_setting_key_unique'
  ) THEN
    ALTER TABLE tracking_settings ADD CONSTRAINT tracking_settings_setting_key_unique UNIQUE (setting_key);
  END IF;
END $$;

-- Insert origin geofence radius setting (500 meters = 0.5 km)
INSERT INTO tracking_settings (setting_key, setting_value, description) VALUES 
('origin_geofence_radius_km', '0.5', 'Geofence radius around origin location in kilometers (default: 0.5 = 500 meters)')
ON CONFLICT (setting_key) DO NOTHING;

-- Insert destination geofence radius setting (500 meters = 0.5 km)
INSERT INTO tracking_settings (setting_key, setting_value, description) VALUES 
('destination_geofence_radius_km', '0.5', 'Geofence radius around destination location in kilometers (default: 0.5 = 500 meters)')
ON CONFLICT (setting_key) DO NOTHING;