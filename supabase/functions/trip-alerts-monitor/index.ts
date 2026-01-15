import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Default thresholds (can be overridden by tracking_settings)
const DEFAULT_TRACKING_LOST_THRESHOLD_MINUTES = 30;
const DEFAULT_DELAY_THRESHOLD_MINUTES = 60;
const DEFAULT_IDLE_THRESHOLD_MINUTES = 120;

interface AlertResult {
  tripId: string;
  tripCode: string;
  alertType: string;
  created: boolean;
  resolved?: boolean;
  message: string;
}

// Get threshold settings from database
async function getThresholdSettings(supabase: any): Promise<{
  trackingLostMinutes: number;
  delayMinutes: number;
  idleMinutes: number;
}> {
  const { data: settings } = await supabase
    .from('tracking_settings')
    .select('setting_key, setting_value')
    .in('setting_key', ['tracking_lost_threshold_minutes', 'delay_threshold_minutes', 'idle_threshold_minutes']);

  const result = {
    trackingLostMinutes: DEFAULT_TRACKING_LOST_THRESHOLD_MINUTES,
    delayMinutes: DEFAULT_DELAY_THRESHOLD_MINUTES,
    idleMinutes: DEFAULT_IDLE_THRESHOLD_MINUTES,
  };

  if (settings) {
    for (const setting of settings) {
      if (setting.setting_key === 'tracking_lost_threshold_minutes') {
        result.trackingLostMinutes = parseInt(setting.setting_value) || DEFAULT_TRACKING_LOST_THRESHOLD_MINUTES;
      } else if (setting.setting_key === 'delay_threshold_minutes') {
        result.delayMinutes = parseInt(setting.setting_value) || DEFAULT_DELAY_THRESHOLD_MINUTES;
      } else if (setting.setting_key === 'idle_threshold_minutes') {
        result.idleMinutes = parseInt(setting.setting_value) || DEFAULT_IDLE_THRESHOLD_MINUTES;
      }
    }
  }

  return result;
}

// Validate auth - allows service role for cron jobs
async function validateAuth(req: Request): Promise<{ authorized: boolean; error?: Response }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return {
      authorized: false,
      error: new Response(
        JSON.stringify({ error: 'Missing authorization header' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const token = authHeader.replace('Bearer ', '');
  
  if (token === serviceRoleKey) {
    console.log('Authenticated via service role key (cron job)');
    return { authorized: true };
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error } = await supabaseClient.auth.getUser();
  if (error || !user) {
    return {
      authorized: false,
      error: new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  console.log('Authenticated user:', user.id);
  return { authorized: true };
}

// Check if an active alert of this type already exists for the trip
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
  thresholdValue?: number,
  actualValue?: number,
  metadata?: any
): Promise<boolean> {
  // Check if alert already exists
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

// Auto-resolve alerts when conditions are no longer met
async function autoResolveAlerts(supabase: any, tripId: string, alertType: string): Promise<boolean> {
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

// Check for tracking lost condition
async function checkTrackingLost(
  supabase: any, 
  trip: any, 
  now: Date,
  thresholdMinutes: number
): Promise<AlertResult | null> {
  if (!trip.is_trackable || trip.tracking_type === 'none') {
    return null;
  }

  // Get the most recent location for this trip
  const { data: locations } = await supabase
    .from('location_history')
    .select('event_time')
    .eq('trip_id', trip.id)
    .order('event_time', { ascending: false })
    .limit(1);

  let lastLocationTime: Date | null = null;
  
  if (locations && locations.length > 0) {
    lastLocationTime = new Date(locations[0].event_time);
  } else if (trip.last_ping_at) {
    lastLocationTime = new Date(trip.last_ping_at);
  } else if (trip.actual_start_time) {
    // If no location ever received, use start time
    lastLocationTime = new Date(trip.actual_start_time);
  }

  if (!lastLocationTime) {
    return null;
  }

  const minutesSinceLastLocation = (now.getTime() - lastLocationTime.getTime()) / (1000 * 60);

  if (minutesSinceLastLocation > thresholdMinutes) {
    const hoursAgo = Math.round(minutesSinceLastLocation / 60 * 10) / 10;
    const created = await createAlert(
      supabase,
      trip.id,
      'tracking_lost',
      'Tracking Signal Lost',
      `No location update received for ${hoursAgo} hours. Last known location was at ${lastLocationTime.toISOString()}.`,
      minutesSinceLastLocation > 120 ? 'critical' : 'high',
      thresholdMinutes,
      Math.round(minutesSinceLastLocation),
      { 
        lastLocationTime: lastLocationTime.toISOString(), 
        minutesSinceLastLocation: Math.round(minutesSinceLastLocation),
        trackingType: trip.tracking_type 
      }
    );

    return {
      tripId: trip.id,
      tripCode: trip.trip_code,
      alertType: 'tracking_lost',
      created,
      message: created ? `Alert created: ${hoursAgo}h since last location` : 'Alert already exists'
    };
  } else {
    // If tracking is working, auto-resolve any existing tracking_lost alerts
    const resolved = await autoResolveAlerts(supabase, trip.id, 'tracking_lost');
    if (resolved) {
      return {
        tripId: trip.id,
        tripCode: trip.trip_code,
        alertType: 'tracking_lost',
        created: false,
        resolved: true,
        message: 'Alert auto-resolved: tracking resumed'
      };
    }
  }

  return null;
}

// Check for delay condition (Delay Warning)
async function checkDelay(
  supabase: any, 
  trip: any, 
  now: Date,
  thresholdMinutes: number
): Promise<AlertResult | null> {
  let delayDetected = false;
  let delayMinutes = 0;
  let delayMessage = '';

  // Check if trip has exceeded planned ETA
  if (trip.planned_eta) {
    const plannedEta = new Date(trip.planned_eta);
    delayMinutes = (now.getTime() - plannedEta.getTime()) / (1000 * 60);

    if (delayMinutes > thresholdMinutes) {
      delayDetected = true;
      const delayHours = Math.round(delayMinutes / 60 * 10) / 10;
      delayMessage = `Trip is ${delayHours} hours behind planned ETA. Planned arrival was ${plannedEta.toISOString()}.`;
    }
  }

  // Check if trip has been running too long without completion
  if (!delayDetected && trip.actual_start_time && trip.planned_end_time) {
    const plannedEnd = new Date(trip.planned_end_time);
    delayMinutes = (now.getTime() - plannedEnd.getTime()) / (1000 * 60);

    if (delayMinutes > thresholdMinutes) {
      delayDetected = true;
      const delayHours = Math.round(delayMinutes / 60 * 10) / 10;
      delayMessage = `Trip is ${delayHours} hours past planned end time.`;
    }
  }

  if (delayDetected) {
    const delayHours = Math.round(delayMinutes / 60 * 10) / 10;
    const created = await createAlert(
      supabase,
      trip.id,
      'delay_warning',
      'Trip Delay Warning',
      delayMessage,
      delayMinutes > 240 ? 'critical' : delayMinutes > 120 ? 'high' : 'medium',
      thresholdMinutes,
      Math.round(delayMinutes),
      { 
        plannedEta: trip.planned_eta, 
        plannedEndTime: trip.planned_end_time,
        delayMinutes: Math.round(delayMinutes),
        currentEta: trip.current_eta
      }
    );

    return {
      tripId: trip.id,
      tripCode: trip.trip_code,
      alertType: 'delay_warning',
      created,
      message: created ? `Alert created: ${delayHours}h delay` : 'Alert already exists'
    };
  }

  return null;
}

// Check for long idle time (started but no progress)
async function checkIdleTrip(
  supabase: any, 
  trip: any, 
  now: Date,
  thresholdMinutes: number
): Promise<AlertResult | null> {
  if (!trip.actual_start_time) return null;

  const startTime = new Date(trip.actual_start_time);
  const runningMinutes = (now.getTime() - startTime.getTime()) / (1000 * 60);

  // Only check for idle if trip has been running for a while
  if (runningMinutes < thresholdMinutes) return null;

  // Check if there's been any location update
  const { data: locations } = await supabase
    .from('location_history')
    .select('id')
    .eq('trip_id', trip.id)
    .limit(1);

  // If no locations at all after threshold time, create idle alert
  if (!locations || locations.length === 0) {
    const hoursRunning = Math.round(runningMinutes / 60 * 10) / 10;
    const created = await createAlert(
      supabase,
      trip.id,
      'idle_detected',
      'Trip Idle - No Activity',
      `Trip started ${hoursRunning} hours ago but no location data has been received.`,
      'high',
      thresholdMinutes,
      Math.round(runningMinutes),
      { 
        startTime: startTime.toISOString(), 
        runningMinutes: Math.round(runningMinutes),
        trackingType: trip.tracking_type
      }
    );

    return {
      tripId: trip.id,
      tripCode: trip.trip_code,
      alertType: 'idle_detected',
      created,
      message: created ? `Alert created: No location data after ${hoursRunning}h` : 'Alert already exists'
    };
  } else {
    // Location data exists, auto-resolve idle alerts
    const resolved = await autoResolveAlerts(supabase, trip.id, 'idle_detected');
    if (resolved) {
      return {
        tripId: trip.id,
        tripCode: trip.trip_code,
        alertType: 'idle_detected',
        created: false,
        resolved: true,
        message: 'Alert auto-resolved: location data received'
      };
    }
  }

  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { authorized, error: authError } = await validateAuth(req);
    if (!authorized) return authError!;

    console.log('Starting trip alerts monitoring...');

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get threshold settings from database
    const thresholds = await getThresholdSettings(supabase);
    console.log('Using thresholds:', thresholds);

    // Get all ongoing/in-transit trips
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select('*')
      .in('status', ['ongoing', 'in_transit', 'started']);

    if (tripsError) {
      throw new Error(`Failed to fetch trips: ${tripsError.message}`);
    }

    if (!trips || trips.length === 0) {
      console.log('No ongoing trips to monitor');
      return new Response(
        JSON.stringify({ message: 'No ongoing trips', results: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Monitoring ${trips.length} ongoing trips...`);

    const now = new Date();
    const results: AlertResult[] = [];

    for (const trip of trips) {
      // Check for tracking lost
      const trackingLostResult = await checkTrackingLost(supabase, trip, now, thresholds.trackingLostMinutes);
      if (trackingLostResult) results.push(trackingLostResult);

      // Check for delays (Delay Warning)
      const delayResult = await checkDelay(supabase, trip, now, thresholds.delayMinutes);
      if (delayResult) results.push(delayResult);

      // Check for idle trips
      const idleResult = await checkIdleTrip(supabase, trip, now, thresholds.idleMinutes);
      if (idleResult) results.push(idleResult);
    }

    // Update active alert counts for all monitored trips
    for (const trip of trips) {
      await supabase.rpc('recalculate_active_alert_count', { trip_uuid: trip.id });
    }

    const alertsCreated = results.filter(r => r.created).length;
    const alertsResolved = results.filter(r => r.resolved).length;
    console.log(`Alert monitoring complete: ${alertsCreated} new alerts created, ${alertsResolved} alerts resolved`);

    return new Response(
      JSON.stringify({
        message: 'Alert monitoring complete',
        tripsMonitored: trips.length,
        alertsCreated,
        alertsResolved,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('Trip alerts monitoring error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
