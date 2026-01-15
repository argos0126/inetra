-- Add missing location types to the location_type enum
ALTER TYPE location_type ADD VALUE IF NOT EXISTS 'hub';
ALTER TYPE location_type ADD VALUE IF NOT EXISTS 'branch';
ALTER TYPE location_type ADD VALUE IF NOT EXISTS 'headquarters';
ALTER TYPE location_type ADD VALUE IF NOT EXISTS 'regional_office';