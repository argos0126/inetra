import { supabase } from "@/integrations/supabase/client";

export type TripAlertType = 
  | 'route_deviation'
  | 'stoppage'
  | 'idle_time'
  | 'tracking_lost'
  | 'consent_revoked'
  | 'geofence_entry'
  | 'geofence_exit'
  | 'speed_exceeded'
  | 'delay_warning';

export type AlertStatus = 'active' | 'acknowledged' | 'resolved' | 'dismissed';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';

export interface TripAlertRecord {
  id: string;
  trip_id: string;
  alert_type: TripAlertType;
  status: AlertStatus;
  severity: AlertSeverity;
  title: string;
  description: string;
  triggered_at: string;
  acknowledged_at?: string;
  acknowledged_by?: string;
  resolved_at?: string;
  resolved_by?: string;
  location_latitude?: number;
  location_longitude?: number;
  threshold_value?: number;
  actual_value?: number;
  metadata?: Record<string, any>;
  created_at: string;
  updated_at: string;
}

// Alert type configurations with thresholds and descriptions
export const alertConfig: Record<TripAlertType, {
  label: string;
  icon: string;
  defaultSeverity: AlertSeverity;
  defaultThreshold?: number;
  unit?: string;
}> = {
  route_deviation: {
    label: 'Route Deviation',
    icon: 'MapPinOff',
    defaultSeverity: 'medium',
    defaultThreshold: 500,
    unit: 'meters'
  },
  stoppage: {
    label: 'Stoppage Detected',
    icon: 'PauseCircle',
    defaultSeverity: 'medium',
    defaultThreshold: 30,
    unit: 'minutes'
  },
  idle_time: {
    label: 'Idle/Detention Alert',
    icon: 'Clock',
    defaultSeverity: 'medium',
    defaultThreshold: 60,
    unit: 'minutes'
  },
  tracking_lost: {
    label: 'Tracking Lost',
    icon: 'WifiOff',
    defaultSeverity: 'high',
    defaultThreshold: 2,
    unit: 'intervals'
  },
  consent_revoked: {
    label: 'Consent Revoked',
    icon: 'ShieldOff',
    defaultSeverity: 'critical'
  },
  geofence_entry: {
    label: 'Geofence Entry',
    icon: 'MapPin',
    defaultSeverity: 'low'
  },
  geofence_exit: {
    label: 'Geofence Exit',
    icon: 'MapPinOff',
    defaultSeverity: 'low'
  },
  speed_exceeded: {
    label: 'Speed Exceeded',
    icon: 'Gauge',
    defaultSeverity: 'medium',
    defaultThreshold: 80,
    unit: 'km/h'
  },
  delay_warning: {
    label: 'Delay Warning',
    icon: 'AlertTriangle',
    defaultSeverity: 'medium',
    defaultThreshold: 15,
    unit: '%'
  }
};

// Create a new trip alert
export async function createTripAlert(
  tripId: string,
  alertType: TripAlertType,
  title: string,
  description: string,
  options?: {
    severity?: AlertSeverity;
    locationLatitude?: number;
    locationLongitude?: number;
    thresholdValue?: number;
    actualValue?: number;
    metadata?: Record<string, any>;
  }
): Promise<{ success: boolean; alert?: TripAlertRecord; error?: string }> {
  const config = alertConfig[alertType];
  
  const { data, error } = await supabase
    .from('trip_alerts')
    .insert({
      trip_id: tripId,
      alert_type: alertType,
      status: 'active',
      severity: options?.severity || config.defaultSeverity,
      title,
      description,
      location_latitude: options?.locationLatitude,
      location_longitude: options?.locationLongitude,
      threshold_value: options?.thresholdValue,
      actual_value: options?.actualValue,
      metadata: options?.metadata || {}
    })
    .select()
    .single();

  if (error) {
    console.error('Failed to create alert:', error);
    return { success: false, error: error.message };
  }

  // Update trip alert count
  await updateTripAlertCount(tripId);

  return { success: true, alert: data as TripAlertRecord };
}

// Update alert status
export async function updateAlertStatus(
  alertId: string,
  newStatus: AlertStatus,
  options?: {
    userId?: string;
    notes?: string;
  }
): Promise<{ success: boolean; error?: string }> {
  const updateData: Record<string, any> = { status: newStatus };

  // Look up profile id from user_id (acknowledged_by/resolved_by reference profiles.id, not auth.users.id)
  let profileId: string | null = null;
  if (options?.userId) {
    const { data: profile } = await supabase
      .from('profiles')
      .select('id')
      .eq('user_id', options.userId)
      .single();
    profileId = profile?.id || null;
  }

  if (newStatus === 'acknowledged') {
    updateData.acknowledged_at = new Date().toISOString();
    if (profileId) {
      updateData.acknowledged_by = profileId;
    }
  } else if (newStatus === 'resolved' || newStatus === 'dismissed') {
    updateData.resolved_at = new Date().toISOString();
    if (profileId) {
      updateData.resolved_by = profileId;
    }
  }

  // Store notes in metadata
  if (options?.notes) {
    const { data: existingAlert } = await supabase
      .from('trip_alerts')
      .select('metadata')
      .eq('id', alertId)
      .single();
    
    const existingMetadata = (existingAlert?.metadata && typeof existingAlert.metadata === 'object' && !Array.isArray(existingAlert.metadata)) 
      ? existingAlert.metadata as Record<string, unknown>
      : {};
    
    updateData.metadata = {
      ...existingMetadata,
      resolution_notes: options.notes,
      action_taken_at: new Date().toISOString()
    };
  }

  const { data, error } = await supabase
    .from('trip_alerts')
    .update(updateData)
    .eq('id', alertId)
    .select('trip_id')
    .single();

  if (error) {
    console.error('Failed to update alert:', error);
    return { success: false, error: error.message };
  }

  if (data?.trip_id) {
    await updateTripAlertCount(data.trip_id);
  }

  return { success: true };
}

// Get alerts for a trip
export async function getTripAlerts(tripId: string): Promise<TripAlertRecord[]> {
  const { data, error } = await supabase
    .from('trip_alerts')
    .select('*')
    .eq('trip_id', tripId)
    .order('triggered_at', { ascending: false });

  if (error) {
    console.error('Failed to fetch alerts:', error);
    return [];
  }

  return data as TripAlertRecord[];
}

// Update trip alert count
async function updateTripAlertCount(tripId: string): Promise<void> {
  const { data } = await supabase
    .from('trip_alerts')
    .select('status')
    .eq('trip_id', tripId)
    .in('status', ['active', 'acknowledged']);

  const activeCount = data?.length || 0;

  await supabase
    .from('trips')
    .update({ active_alert_count: activeCount })
    .eq('id', tripId);
}

// =========== MONITORING FUNCTIONS ===========

// Check for route deviation
export async function checkRouteDeviation(
  tripId: string,
  currentLat: number,
  currentLng: number,
  routePolyline: Array<{ lat: number; lng: number }>,
  thresholdMeters: number = 500
): Promise<{ deviated: boolean; distanceMeters?: number }> {
  // Calculate minimum distance to route polyline
  let minDistance = Infinity;
  
  for (const point of routePolyline) {
    const distance = calculateDistanceMeters(currentLat, currentLng, point.lat, point.lng);
    if (distance < minDistance) {
      minDistance = distance;
    }
  }

  if (minDistance > thresholdMeters) {
    await createTripAlert(tripId, 'route_deviation',
      'Route Deviation Detected',
      `Vehicle has deviated ${Math.round(minDistance)}m from planned route (threshold: ${thresholdMeters}m)`,
      {
        severity: minDistance > thresholdMeters * 2 ? 'high' : 'medium',
        locationLatitude: currentLat,
        locationLongitude: currentLng,
        thresholdValue: thresholdMeters,
        actualValue: minDistance
      }
    );
    return { deviated: true, distanceMeters: minDistance };
  }

  return { deviated: false, distanceMeters: minDistance };
}

// Check for stoppage/idle time
export async function checkStoppage(
  tripId: string,
  lastPingTime: Date,
  speed: number,
  currentLat: number,
  currentLng: number,
  stoppageThresholdMinutes: number = 30
): Promise<{ stopped: boolean; durationMinutes?: number }> {
  if (speed > 0) {
    return { stopped: false };
  }

  // Get recent location history to check how long vehicle has been stationary
  const { data } = await supabase
    .from('location_history')
    .select('speed_kmph, event_time')
    .eq('trip_id', tripId)
    .order('event_time', { ascending: false })
    .limit(50);

  if (!data || data.length === 0) {
    return { stopped: false };
  }

  // Find how long speed has been 0
  let stoppedSince = new Date();
  for (const point of data) {
    if ((point.speed_kmph || 0) > 0) {
      break;
    }
    stoppedSince = new Date(point.event_time);
  }

  const durationMinutes = (new Date().getTime() - stoppedSince.getTime()) / (1000 * 60);

  if (durationMinutes >= stoppageThresholdMinutes) {
    // Check if alert already exists for this stoppage
    const { data: existingAlerts } = await supabase
      .from('trip_alerts')
      .select('id')
      .eq('trip_id', tripId)
      .eq('alert_type', 'stoppage')
      .eq('status', 'active')
      .gte('triggered_at', stoppedSince.toISOString());

    if (!existingAlerts || existingAlerts.length === 0) {
      await createTripAlert(tripId, 'stoppage',
        'Vehicle Stoppage Detected',
        `Vehicle has been stationary for ${Math.round(durationMinutes)} minutes`,
        {
          severity: durationMinutes > 60 ? 'high' : 'medium',
          locationLatitude: currentLat,
          locationLongitude: currentLng,
          thresholdValue: stoppageThresholdMinutes,
          actualValue: durationMinutes,
          metadata: { stopped_since: stoppedSince.toISOString() }
        }
      );
    }
    return { stopped: true, durationMinutes };
  }

  return { stopped: false, durationMinutes };
}

// Check for tracking lost (no ping)
export async function checkTrackingLost(
  tripId: string,
  lastPingAt: Date | null,
  pingIntervalMinutes: number = 5,
  missedIntervalsThreshold: number = 2
): Promise<{ lost: boolean; missedIntervals?: number }> {
  if (!lastPingAt) {
    // No ping ever received
    await createTripAlert(tripId, 'tracking_lost',
      'Tracking Lost - No Data',
      'No location data has been received for this trip',
      { severity: 'high' }
    );
    
    // Mark trip as untrackable
    await supabase.from('trips').update({ is_trackable: false }).eq('id', tripId);
    
    return { lost: true };
  }

  const timeSinceLastPing = (new Date().getTime() - lastPingAt.getTime()) / (1000 * 60);
  const missedIntervals = Math.floor(timeSinceLastPing / pingIntervalMinutes);

  if (missedIntervals >= missedIntervalsThreshold) {
    // Check if alert already exists
    const { data: existingAlerts } = await supabase
      .from('trip_alerts')
      .select('id')
      .eq('trip_id', tripId)
      .eq('alert_type', 'tracking_lost')
      .eq('status', 'active');

    if (!existingAlerts || existingAlerts.length === 0) {
      await createTripAlert(tripId, 'tracking_lost',
        'Tracking Lost',
        `No location data received for ${Math.round(timeSinceLastPing)} minutes (${missedIntervals} missed intervals)`,
        {
          severity: missedIntervals > 4 ? 'critical' : 'high',
          thresholdValue: missedIntervalsThreshold,
          actualValue: missedIntervals,
          metadata: { last_ping_at: lastPingAt.toISOString(), minutes_since_ping: timeSinceLastPing }
        }
      );

      // Mark trip as untrackable
      await supabase.from('trips').update({ is_trackable: false }).eq('id', tripId);
    }
    return { lost: true, missedIntervals };
  }

  return { lost: false, missedIntervals };
}

// Handle consent revoked
export async function handleConsentRevoked(
  tripId: string,
  driverName: string,
  driverMobile: string
): Promise<void> {
  await createTripAlert(tripId, 'consent_revoked',
    'Driver Consent Revoked',
    `Driver ${driverName} (${driverMobile}) has revoked SIM tracking consent. Trip is now untrackable.`,
    {
      severity: 'critical',
      metadata: { driver_name: driverName, driver_mobile: driverMobile }
    }
  );

  // Mark trip as untrackable
  await supabase.from('trips').update({ is_trackable: false }).eq('id', tripId);
}

// Calculate distance between two coordinates in meters
function calculateDistanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * 
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// Check for delay warning based on ETA comparison
export async function checkDelayWarning(
  tripId: string,
  plannedEta: Date | null,
  currentEta: Date | null,
  plannedEndTime: Date | null,
  delayThresholdPercent: number = 15
): Promise<{ delayed: boolean; delayPercent?: number; delayMinutes?: number }> {
  // Use planned_eta or planned_end_time as baseline
  const baselineEta = plannedEta || plannedEndTime;
  
  if (!baselineEta || !currentEta) {
    return { delayed: false };
  }

  const now = new Date();
  const baselineRemaining = baselineEta.getTime() - now.getTime();
  const currentRemaining = currentEta.getTime() - now.getTime();
  
  // If baseline is in the past but current ETA is in the future, trip is delayed
  if (baselineRemaining <= 0 && currentRemaining > 0) {
    const delayMinutes = Math.round(currentRemaining / 60000);
    
    // Check if alert already exists
    const { data: existingAlerts } = await supabase
      .from('trip_alerts')
      .select('id')
      .eq('trip_id', tripId)
      .eq('alert_type', 'delay_warning')
      .eq('status', 'active');

    if (!existingAlerts || existingAlerts.length === 0) {
      await createTripAlert(tripId, 'delay_warning',
        'Trip Delayed - Past Due',
        `Trip is ${delayMinutes} minutes past the planned ETA`,
        {
          severity: delayMinutes > 60 ? 'high' : 'medium',
          thresholdValue: 0,
          actualValue: delayMinutes,
          metadata: { 
            planned_eta: baselineEta.toISOString(), 
            current_eta: currentEta.toISOString(),
            delay_minutes: delayMinutes
          }
        }
      );
    }
    return { delayed: true, delayPercent: 100, delayMinutes };
  }

  // Calculate delay percentage if both are in the future
  if (baselineRemaining > 0 && currentRemaining > baselineRemaining) {
    const delayMs = currentRemaining - baselineRemaining;
    const delayPercent = (delayMs / baselineRemaining) * 100;
    const delayMinutes = Math.round(delayMs / 60000);

    if (delayPercent >= delayThresholdPercent) {
      // Check if alert already exists
      const { data: existingAlerts } = await supabase
        .from('trip_alerts')
        .select('id')
        .eq('trip_id', tripId)
        .eq('alert_type', 'delay_warning')
        .eq('status', 'active');

      if (!existingAlerts || existingAlerts.length === 0) {
        const severity = delayPercent > 50 ? 'high' : delayPercent > 30 ? 'medium' : 'low';
        
        await createTripAlert(tripId, 'delay_warning',
          'Delay Warning',
          `Trip is running ${delayMinutes} minutes behind schedule (${Math.round(delayPercent)}% delay)`,
          {
            severity,
            thresholdValue: delayThresholdPercent,
            actualValue: delayPercent,
            metadata: { 
              planned_eta: baselineEta.toISOString(), 
              current_eta: currentEta.toISOString(),
              delay_percent: delayPercent,
              delay_minutes: delayMinutes
            }
          }
        );
      }
      return { delayed: true, delayPercent, delayMinutes };
    }
  }

  // Auto-resolve delay alerts if no longer delayed
  if (baselineRemaining > 0 && currentRemaining <= baselineRemaining) {
    const { data: activeDelayAlerts } = await supabase
      .from('trip_alerts')
      .select('id')
      .eq('trip_id', tripId)
      .eq('alert_type', 'delay_warning')
      .eq('status', 'active');

    if (activeDelayAlerts && activeDelayAlerts.length > 0) {
      for (const alert of activeDelayAlerts) {
        await supabase
          .from('trip_alerts')
          .update({ 
            status: 'resolved', 
            resolved_at: new Date().toISOString(),
            metadata: { auto_resolved: true, reason: 'Back on schedule' }
          })
          .eq('id', alert.id);
      }
    }
  }

  return { delayed: false };
}
