-- Step 1: Add waypoints JSONB column to lane_route_calculations
ALTER TABLE lane_route_calculations 
ADD COLUMN IF NOT EXISTS waypoints JSONB DEFAULT '[]'::jsonb;

-- Add comment explaining the structure
COMMENT ON COLUMN lane_route_calculations.waypoints IS 
'Array of waypoint objects: [{sequence, lat, lng, name, type, location_id}]';

-- Step 2: Migrate existing lane_routes data into waypoints JSONB
UPDATE lane_route_calculations lrc
SET waypoints = (
  SELECT COALESCE(
    jsonb_agg(
      jsonb_build_object(
        'sequence', lr.sequence_order,
        'lat', lr.latitude,
        'lng', lr.longitude,
        'name', lr.waypoint_name,
        'type', lr.waypoint_type,
        'location_id', lr.location_id
      ) ORDER BY lr.sequence_order
    ),
    '[]'::jsonb
  )
  FROM lane_routes lr
  WHERE lr.lane_id = lrc.lane_id
);

-- Step 3: Drop the old lane_routes table
DROP TABLE IF EXISTS lane_routes;