-- Function to increment active alert count
CREATE OR REPLACE FUNCTION public.increment_active_alert_count(trip_uuid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE trips
  SET active_alert_count = COALESCE(active_alert_count, 0) + 1
  WHERE id = trip_uuid;
END;
$$;

-- Function to recalculate active alert count for a trip
CREATE OR REPLACE FUNCTION public.recalculate_active_alert_count(trip_uuid UUID)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  alert_count integer;
BEGIN
  SELECT COUNT(*) INTO alert_count
  FROM trip_alerts
  WHERE trip_id = trip_uuid AND status = 'active';
  
  UPDATE trips
  SET active_alert_count = alert_count
  WHERE id = trip_uuid;
  
  RETURN alert_count;
END;
$$;

-- Trigger to auto-update alert count when alerts change
CREATE OR REPLACE FUNCTION public.update_trip_alert_count()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Recalculate for the affected trip
  IF TG_OP = 'DELETE' THEN
    PERFORM recalculate_active_alert_count(OLD.trip_id);
    RETURN OLD;
  ELSE
    PERFORM recalculate_active_alert_count(NEW.trip_id);
    RETURN NEW;
  END IF;
END;
$$;

-- Drop existing trigger if exists and recreate
DROP TRIGGER IF EXISTS trigger_update_trip_alert_count ON trip_alerts;

CREATE TRIGGER trigger_update_trip_alert_count
AFTER INSERT OR UPDATE OR DELETE ON trip_alerts
FOR EACH ROW
EXECUTE FUNCTION update_trip_alert_count();

-- Add idle_detected to trip_alert_type enum if not exists
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_enum WHERE enumlabel = 'idle_detected' AND enumtypid = 'trip_alert_type'::regtype) THEN
    ALTER TYPE trip_alert_type ADD VALUE 'idle_detected';
  END IF;
END
$$;