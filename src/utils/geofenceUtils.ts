import { supabase } from "@/integrations/supabase/client";

export interface GeofenceEvent {
  tripId: string;
  tripCode: string;
  shipmentId: string;
  shipmentCode: string;
  eventType: 'pickup_entry' | 'pickup_exit' | 'delivery_entry' | 'delivery_exit';
  locationName: string;
  newStatus?: string;
  newSubStatus?: string;
  distance: number;
  radius: number;
}

export interface GeofenceCheckResult {
  success: boolean;
  message: string;
  tripsChecked: number;
  geofenceEvents: GeofenceEvent[];
  checkedAt: string;
}

/**
 * Trigger geofence check for all ongoing trips
 * This calls the edge function to check vehicle locations against pickup/drop zones
 */
export async function triggerGeofenceCheck(): Promise<GeofenceCheckResult> {
  try {
    const { data, error } = await supabase.functions.invoke('start-trip/check-geofence', {
      method: 'GET',
    });

    if (error) {
      console.error('Geofence check error:', error);
      return {
        success: false,
        message: error.message || 'Failed to check geofences',
        tripsChecked: 0,
        geofenceEvents: [],
        checkedAt: new Date().toISOString(),
      };
    }

    return data as GeofenceCheckResult;
  } catch (err: any) {
    console.error('Geofence check exception:', err);
    return {
      success: false,
      message: err.message || 'Exception during geofence check',
      tripsChecked: 0,
      geofenceEvents: [],
      checkedAt: new Date().toISOString(),
    };
  }
}

/**
 * Check if a point is within a geofence radius
 */
export function isWithinGeofence(
  currentLat: number,
  currentLng: number,
  targetLat: number,
  targetLng: number,
  radiusMeters: number
): { isWithin: boolean; distance: number } {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(targetLat - currentLat);
  const dLon = toRadians(targetLng - currentLng);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(currentLat)) * Math.cos(toRadians(targetLat)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);

  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  const distance = R * c;

  return {
    isWithin: distance <= radiusMeters,
    distance: Math.round(distance),
  };
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get event type description for display
 */
export function getGeofenceEventDescription(eventType: GeofenceEvent['eventType']): string {
  const descriptions: Record<string, string> = {
    pickup_entry: 'Entered pickup zone',
    pickup_exit: 'Left pickup zone',
    delivery_entry: 'Entered delivery zone',
    delivery_exit: 'Left delivery zone',
  };
  return descriptions[eventType] || eventType;
}

/**
 * Get event type badge color
 */
export function getGeofenceEventColor(eventType: GeofenceEvent['eventType']): string {
  const colors: Record<string, string> = {
    pickup_entry: 'bg-orange-100 text-orange-700',
    pickup_exit: 'bg-indigo-100 text-indigo-700',
    delivery_entry: 'bg-cyan-100 text-cyan-700',
    delivery_exit: 'bg-green-100 text-green-700',
  };
  return colors[eventType] || 'bg-gray-100 text-gray-700';
}
