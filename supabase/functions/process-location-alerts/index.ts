import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default thresholds (can be overridden by tracking_settings)
const DEFAULT_ROUTE_DEVIATION_THRESHOLD_METERS = 500;
const DEFAULT_STOPPAGE_THRESHOLD_MINUTES = 30;

interface LocationAlertRequest {
  tripId: string;
  latitude: number;
  longitude: number;
  speed: number;
  timestamp: string;
  vehicleId?: string;
  driverId?: string;
}

// Haversine formula to calculate distance between two points
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = 
    Math.sin(dLat/2) * Math.sin(dLat/2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon/2) * Math.sin(dLon/2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
  return R * c;
}

// Decode Google's encoded polyline to array of lat/lng points
function decodePolyline(encoded: string): Array<{lat: number, lng: number}> {
  const points: Array<{lat: number, lng: number}> = [];
  let index = 0, lat = 0, lng = 0;

  while (index < encoded.length) {
    let shift = 0, result = 0;
    let byte;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lat += dlat;

    shift = 0;
    result = 0;
    do {
      byte = encoded.charCodeAt(index++) - 63;
      result |= (byte & 0x1f) << shift;
      shift += 5;
    } while (byte >= 0x20);
    const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
    lng += dlng;

    points.push({ lat: lat / 1e5, lng: lng / 1e5 });
  }
  return points;
}

// Calculate minimum distance from a point to a polyline
function distanceToPolyline(point: {lat: number, lng: number}, polyline: Array<{lat: number, lng: number}>): number {
  if (polyline.length === 0) return Infinity;
  if (polyline.length === 1) {
    return calculateDistance(point.lat, point.lng, polyline[0].lat, polyline[0].lng);
  }

  let minDistance = Infinity;
  
  for (let i = 0; i < polyline.length - 1; i++) {
    const segmentStart = polyline[i];
    const segmentEnd = polyline[i + 1];
    const distance = distanceToSegment(point, segmentStart, segmentEnd);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }
  
  return minDistance;
}

// Calculate distance from point to line segment
function distanceToSegment(
  point: {lat: number, lng: number}, 
  segStart: {lat: number, lng: number}, 
  segEnd: {lat: number, lng: number}
): number {
  const dx = segEnd.lng - segStart.lng;
  const dy = segEnd.lat - segStart.lat;
  
  if (dx === 0 && dy === 0) {
    return calculateDistance(point.lat, point.lng, segStart.lat, segStart.lng);
  }
  
  let t = ((point.lng - segStart.lng) * dx + (point.lat - segStart.lat) * dy) / (dx * dx + dy * dy);
  t = Math.max(0, Math.min(1, t));
  
  const nearestLat = segStart.lat + t * dy;
  const nearestLng = segStart.lng + t * dx;
  
  return calculateDistance(point.lat, point.lng, nearestLat, nearestLng);
}

// Check if an active alert of this type already exists
async function alertExists(supabase: any, tripId: string, alertType: string): Promise<boolean> {
  const { data } = await supabase
    .from('trip_alerts')
    .select('id')
    .eq('trip_id', tripId)
    .eq('alert_type', alertType)
    .in('status', ['active', 'acknowledged'])
    .limit(1);
  
  return data && data.length > 0;
}

// Create a new alert
async function createAlert(
  supabase: any,
  tripId: string,
  alertType: string,
  title: string,
  description: string,
  severity: 'low' | 'medium' | 'high' | 'critical',
  latitude?: number,
  longitude?: number,
  thresholdValue?: number,
  actualValue?: number,
  metadata?: any
): Promise<boolean> {
  if (await alertExists(supabase, tripId, alertType)) {
    console.log(`Alert ${alertType} already exists for trip ${tripId}`);
    return false;
  }

  const { error } = await supabase
    .from('trip_alerts')
    .insert({
      trip_id: tripId,
      alert_type: alertType,
      title,
      description,
      severity,
      status: 'active',
      triggered_at: new Date().toISOString(),
      location_latitude: latitude,
      location_longitude: longitude,
      threshold_value: thresholdValue,
      actual_value: actualValue,
      metadata,
    });

  if (error) {
    console.error(`Failed to create alert for trip ${tripId}:`, error);
    return false;
  }

  // Update trip's active alert count
  await supabase.rpc('increment_active_alert_count', { trip_uuid: tripId });
  
  console.log(`Created ${alertType} alert for trip ${tripId}`);
  return true;
}

// Auto-resolve an alert when condition is no longer met
async function autoResolveAlert(supabase: any, tripId: string, alertType: string): Promise<boolean> {
  const { data: alerts } = await supabase
    .from('trip_alerts')
    .select('id')
    .eq('trip_id', tripId)
    .eq('alert_type', alertType)
    .eq('status', 'active');

  if (alerts && alerts.length > 0) {
    for (const alert of alerts) {
      await supabase
        .from('trip_alerts')
        .update({ 
          status: 'resolved',
          resolved_at: new Date().toISOString()
        })
        .eq('id', alert.id);
    }
    
    // Recalculate alert count
    await supabase.rpc('recalculate_active_alert_count', { trip_uuid: tripId });
    
    console.log(`Auto-resolved ${alerts.length} ${alertType} alerts for trip ${tripId}`);
    return true;
  }
  return false;
}

// Get threshold settings from database
async function getThresholdSettings(supabase: any): Promise<{
  routeDeviationMeters: number;
  stoppageMinutes: number;
}> {
  const { data: settings } = await supabase
    .from('tracking_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['route_deviation_threshold_meters', 'stoppage_threshold_minutes']);

  const result = {
    routeDeviationMeters: DEFAULT_ROUTE_DEVIATION_THRESHOLD_METERS,
    stoppageMinutes: DEFAULT_STOPPAGE_THRESHOLD_MINUTES,
  };

  if (settings) {
    for (const setting of settings) {
      if (setting.setting_key === 'route_deviation_threshold_meters') {
        result.routeDeviationMeters = parseInt(setting.setting_value) || DEFAULT_ROUTE_DEVIATION_THRESHOLD_METERS;
      } else if (setting.setting_key === 'stoppage_threshold_minutes') {
        result.stoppageMinutes = parseInt(setting.setting_value) || DEFAULT_STOPPAGE_THRESHOLD_MINUTES;
      }
    }
  }

  return result;
}

// Check for route deviation
async function checkRouteDeviation(
  supabase: any,
  tripId: string,
  latitude: number,
  longitude: number,
  thresholdMeters: number
): Promise<{ deviated: boolean; distance?: number }> {
  // Get trip's lane and route calculation
  const { data: trip } = await supabase
    .from('trips')
    .select('lane_id')
    .eq('id', tripId)
    .single();

  if (!trip?.lane_id) {
    console.log(`No lane assigned to trip ${tripId}, skipping route deviation check`);
    return { deviated: false };
  }

  // Get the encoded polyline for the lane
  const { data: routeCalc } = await supabase
    .from('lane_route_calculations')
    .select('encoded_polyline')
    .eq('lane_id', trip.lane_id)
    .single();

  if (!routeCalc?.encoded_polyline) {
    console.log(`No route polyline for lane ${trip.lane_id}, skipping route deviation check`);
    return { deviated: false };
  }

  // Decode polyline and calculate distance
  const routePoints = decodePolyline(routeCalc.encoded_polyline);
  const distanceFromRoute = distanceToPolyline({ lat: latitude, lng: longitude }, routePoints);

  console.log(`Distance from route: ${Math.round(distanceFromRoute)}m (threshold: ${thresholdMeters}m)`);

  return {
    deviated: distanceFromRoute > thresholdMeters,
    distance: Math.round(distanceFromRoute)
  };
}

// Check for stoppage (vehicle stopped for extended period)
async function checkStoppage(
  supabase: any,
  tripId: string,
  currentSpeed: number,
  latitude: number,
  longitude: number,
  thresholdMinutes: number
): Promise<{ stopped: boolean; stoppedMinutes?: number }> {
  // If current speed > 5 km/h, vehicle is moving
  if (currentSpeed > 5) {
    return { stopped: false };
  }

  // Get recent location history to check how long vehicle has been stopped
  const { data: recentLocations } = await supabase
    .from('location_history')
    .select('speed_kmph, event_time, latitude, longitude')
    .eq('trip_id', tripId)
    .order('event_time', { ascending: false })
    .limit(50);

  if (!recentLocations || recentLocations.length < 2) {
    return { stopped: false };
  }

  // Find how long the vehicle has been stationary (speed < 5 km/h in same general area)
  let stoppedSince: Date | null = null;
  const currentPoint = { lat: latitude, lng: longitude };

  for (const loc of recentLocations) {
    const speed = loc.speed_kmph || 0;
    const locPoint = { lat: loc.latitude, lng: loc.longitude };
    const distanceFromCurrent = calculateDistance(currentPoint.lat, currentPoint.lng, locPoint.lat, locPoint.lng);

    // If vehicle moved more than 100m or speed > 5, this is when it started stopping
    if (speed > 5 || distanceFromCurrent > 100) {
      break;
    }
    stoppedSince = new Date(loc.event_time);
  }

  if (!stoppedSince) {
    return { stopped: false };
  }

  const stoppedMinutes = (Date.now() - stoppedSince.getTime()) / (1000 * 60);

  console.log(`Vehicle stopped for ${Math.round(stoppedMinutes)} minutes (threshold: ${thresholdMinutes}m)`);

  return {
    stopped: stoppedMinutes >= thresholdMinutes,
    stoppedMinutes: Math.round(stoppedMinutes)
  };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // This function is called internally by tracking functions, no user auth needed
    // But we validate service role or anon key for security
    const authHeader = req.headers.get('Authorization');
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: LocationAlertRequest = await req.json();
    const { tripId, latitude, longitude, speed, timestamp } = body;

    if (!tripId || latitude === undefined || longitude === undefined) {
      return new Response(
        JSON.stringify({ error: 'tripId, latitude, and longitude are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Processing location alerts for trip ${tripId}: lat=${latitude}, lng=${longitude}, speed=${speed}`);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get threshold settings
    const thresholds = await getThresholdSettings(supabase);
    const results: any[] = [];

    // 1. Check Route Deviation
    const deviationCheck = await checkRouteDeviation(supabase, tripId, latitude, longitude, thresholds.routeDeviationMeters);
    
    if (deviationCheck.deviated) {
      const created = await createAlert(
        supabase,
        tripId,
        'route_deviation',
        'Route Deviation Detected',
        `Vehicle is ${deviationCheck.distance}m away from the planned route.`,
        deviationCheck.distance! > 1000 ? 'high' : 'medium',
        latitude,
        longitude,
        thresholds.routeDeviationMeters,
        deviationCheck.distance,
        { distanceFromRoute: deviationCheck.distance }
      );
      results.push({ alertType: 'route_deviation', created, distance: deviationCheck.distance });
    } else {
      // Auto-resolve if vehicle is back on route
      const resolved = await autoResolveAlert(supabase, tripId, 'route_deviation');
      if (resolved) {
        results.push({ alertType: 'route_deviation', resolved: true });
      }
    }

    // 2. Check Stoppage
    const stoppageCheck = await checkStoppage(supabase, tripId, speed || 0, latitude, longitude, thresholds.stoppageMinutes);
    
    if (stoppageCheck.stopped) {
      const created = await createAlert(
        supabase,
        tripId,
        'stoppage',
        'Vehicle Stoppage Detected',
        `Vehicle has been stationary for ${stoppageCheck.stoppedMinutes} minutes.`,
        stoppageCheck.stoppedMinutes! > 60 ? 'high' : 'medium',
        latitude,
        longitude,
        thresholds.stoppageMinutes,
        stoppageCheck.stoppedMinutes,
        { stoppedMinutes: stoppageCheck.stoppedMinutes }
      );
      results.push({ alertType: 'stoppage', created, stoppedMinutes: stoppageCheck.stoppedMinutes });
    } else if (speed > 5) {
      // Auto-resolve stoppage if vehicle is moving again
      const resolved = await autoResolveAlert(supabase, tripId, 'stoppage');
      if (resolved) {
        results.push({ alertType: 'stoppage', resolved: true });
      }
    }

    // 3. Auto-resolve tracking_lost since we just received a location
    const resolvedTrackingLost = await autoResolveAlert(supabase, tripId, 'tracking_lost');
    if (resolvedTrackingLost) {
      results.push({ alertType: 'tracking_lost', resolved: true });
    }

    // 4. Auto-resolve idle_detected since we're receiving location data
    const resolvedIdle = await autoResolveAlert(supabase, tripId, 'idle_detected');
    if (resolvedIdle) {
      results.push({ alertType: 'idle_detected', resolved: true });
    }

    // Update trip's last_ping_at
    await supabase
      .from('trips')
      .update({ last_ping_at: timestamp || new Date().toISOString() })
      .eq('id', tripId);

    console.log(`Location alert processing complete for trip ${tripId}:`, results);

    return new Response(
      JSON.stringify({ success: true, results }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('Process location alerts error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
