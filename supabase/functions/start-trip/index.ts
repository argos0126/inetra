import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Telenity API Configuration
const SMARTTRAIL_BASE_URL = 'https://smarttrail.telenity.com/trail-rest';

interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: string;
  detailedAddress: string | null;
}

interface TelenityLocationResponse {
  terminalLocation: Array<{
    address: string;
    locationRetrievalStatus: string;
    currentLocation: {
      latitude: number;
      longitude: number;
      timestamp: string;
      detailedAddress: string;
    };
    locationResultStatusText: string;
    locationResultStatus: number;
    entityId: number;
    tracked: boolean;
  }>;
  errorMessageList: any[];
}

/**
 * Calculate distance between two points using Haversine formula
 * @returns Distance in meters
 */
function calculateHaversineDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000; // Earth's radius in meters
  const dLat = toRadians(lat2 - lat1);
  const dLon = toRadians(lon2 - lon1);
  
  const a = 
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) * Math.cos(toRadians(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  
  return R * c;
}

function toRadians(degrees: number): number {
  return degrees * (Math.PI / 180);
}

/**
 * Get stored token from database, auto-refresh if expired
 */
async function getStoredToken(supabase: any, tokenType: 'authentication' | 'access'): Promise<string> {
  const { data, error } = await supabase
    .from('integration_tokens')
    .select('token_value, expires_at')
    .eq('token_type', tokenType)
    .single();

  if (error || !data) {
    console.error(`Token not found for type: ${tokenType}`, error);
    throw new Error(`${tokenType} token not found. Please run token refresh first.`);
  }

  // Check if token is expired or will expire in next 2 minutes
  const expiresAt = new Date(data.expires_at);
  const bufferTime = 2 * 60 * 1000; // 2 minutes buffer
  
  if (expiresAt.getTime() - bufferTime < Date.now()) {
    console.log(`${tokenType} token expired or expiring soon, attempting auto-refresh...`);
    const refreshedToken = await autoRefreshToken(supabase, tokenType);
    return refreshedToken;
  }

  return data.token_value;
}

/**
 * Auto-refresh token when expired
 */
async function autoRefreshToken(supabase: any, tokenType: 'authentication' | 'access'): Promise<string> {
  if (tokenType === 'authentication') {
    const authorizationToken = Deno.env.get('TELENITY_AUTH_TOKEN');
    if (!authorizationToken) {
      throw new Error('TELENITY_AUTH_TOKEN not configured');
    }
    
    console.log('Auto-refreshing authentication token...');
    const response = await fetch('https://smarttrail.telenity.com/trail-rest/login', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authorizationToken}`,
      },
    });

    if (!response.ok) {
      throw new Error(`Auth token refresh failed: ${response.status}`);
    }

    const tokenData = await response.json();
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

    await supabase
      .from('integration_tokens')
      .upsert({
        token_type: 'authentication',
        token_value: tokenData.token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, { onConflict: 'token_type' });

    console.log('Authentication token auto-refreshed successfully');
    return tokenData.token;
  } else {
    const consentAuthToken = Deno.env.get('TELENITY_CONSENT_AUTH_TOKEN');
    if (!consentAuthToken) {
      throw new Error('TELENITY_CONSENT_AUTH_TOKEN not configured');
    }
    
    console.log('Auto-refreshing access token...');
    const response = await fetch('https://india-agw.telenity.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': '*/*',
        'Authorization': `Basic ${consentAuthToken}`,
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Access token refresh failed: ${response.status}`);
    }

    const tokenData = await response.json();
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    await supabase
      .from('integration_tokens')
      .upsert({
        token_type: 'access',
        token_value: tokenData.access_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, { onConflict: 'token_type' });

    console.log('Access token auto-refreshed successfully');
    return tokenData.access_token;
  }
}

/**
 * Get current location from Telenity API
 */
async function getLocation(authToken: string, msisdn: string): Promise<TelenityLocationResponse> {
  const formattedMsisdn = msisdn.startsWith('91') ? msisdn : `91${msisdn}`;
  
  console.log('Fetching location for MSISDN:', formattedMsisdn);
  
  const response = await fetch(
    `${SMARTTRAIL_BASE_URL}/location/msisdnList/${formattedMsisdn}?lastResult=true`, 
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Get location error:', error);
    throw new Error(`Failed to get location: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log('Location API response:', JSON.stringify(data));
  return data;
}

/**
 * Parse location from Telenity response
 */
function parseLocationResponse(response: TelenityLocationResponse): LocationData | null {
  if (response.terminalLocation && response.terminalLocation.length > 0) {
    const terminal = response.terminalLocation[0];
    if (terminal.locationRetrievalStatus === 'Retrieved' && terminal.currentLocation) {
      return {
        latitude: terminal.currentLocation.latitude,
        longitude: terminal.currentLocation.longitude,
        timestamp: terminal.currentLocation.timestamp,
        detailedAddress: terminal.currentLocation.detailedAddress || null
      };
    }
  }
  return null;
}

/**
 * Store location in location_history table
 */
async function storeLocationInHistory(
  supabase: any,
  tripId: string,
  driverId: string | null,
  vehicleId: string | null,
  trackingAssetId: string | null,
  locationData: LocationData,
  rawResponse: any
): Promise<number> {
  const now = new Date().toISOString();
  
  const { count } = await supabase
    .from('location_history')
    .select('*', { count: 'exact', head: true })
    .eq('trip_id', tripId);
  
  const sequenceNumber = (count || 0) + 1;
  
  const { error: insertError } = await supabase
    .from('location_history')
    .insert({
      trip_id: tripId,
      driver_id: driverId,
      vehicle_id: vehicleId,
      tracking_asset_id: trackingAssetId,
      latitude: locationData.latitude,
      longitude: locationData.longitude,
      event_time: locationData.timestamp,
      source: 'telenity',
      raw_response: rawResponse
    });

  if (insertError) {
    console.error('Error inserting location history:', insertError);
    throw new Error('Failed to store location in history');
  }

  const { data: existingLog } = await supabase
    .from('tracking_logs')
    .select('id')
    .eq('trip_id', tripId)
    .maybeSingle();

  if (existingLog) {
    await supabase
      .from('tracking_logs')
      .update({
        last_sequence_number: sequenceNumber,
        last_updated_at: now
      })
      .eq('id', existingLog.id);
  } else {
    await supabase
      .from('tracking_logs')
      .insert({
        trip_id: tripId,
        tracking_asset_id: trackingAssetId,
        source: 'telenity',
        raw_responses: [],
        location_history: [],
        last_sequence_number: sequenceNumber,
        last_updated_at: now
      });
  }

  console.log(`Location stored in history with sequence number: ${sequenceNumber}`);
  return sequenceNumber;
}

/**
 * Get tracking frequency from settings
 */
async function getTrackingFrequency(supabase: any): Promise<number> {
  const { data, error } = await supabase
    .from('tracking_settings')
    .select('setting_value')
    .eq('setting_key', 'tracking_frequency_seconds')
    .single();

  if (error || !data) {
    console.log('Using default tracking frequency: 900 seconds');
    return 900;
  }

  return parseInt(data.setting_value) || 900;
}

/**
 * Calculate ETA based on current location and destination
 * Uses average speed of 40 km/h for calculation (adjustable)
 */
async function calculateAndUpdateETA(supabase: any, tripId: string, currentLocation: LocationData): Promise<void> {
  try {
    // Fetch trip destination coordinates
    const { data: trip, error: tripError } = await supabase
      .from('trips')
      .select(`
        id,
        destination_location:locations!trips_destination_location_id_fkey(latitude, longitude)
      `)
      .eq('id', tripId)
      .single();

    if (tripError || !trip?.destination_location) {
      console.log('Cannot calculate ETA: destination not found');
      return;
    }

    const destLat = Number(trip.destination_location.latitude);
    const destLng = Number(trip.destination_location.longitude);

    if (!destLat || !destLng) {
      console.log('Cannot calculate ETA: destination has no coordinates');
      return;
    }

    // Calculate distance to destination
    const distanceMeters = calculateHaversineDistance(
      currentLocation.latitude,
      currentLocation.longitude,
      destLat,
      destLng
    );

    // Estimate time using average speed (40 km/h for road conditions in India)
    const avgSpeedKmph = 40;
    const distanceKm = distanceMeters / 1000;
    const estimatedHours = distanceKm / avgSpeedKmph;
    const estimatedMinutes = Math.round(estimatedHours * 60);

    // Calculate ETA
    const now = new Date();
    const etaDate = new Date(now.getTime() + estimatedMinutes * 60 * 1000);
    const currentEta = etaDate.toISOString();

    // Update trip with new ETA
    const { error: updateError } = await supabase
      .from('trips')
      .update({
        current_eta: currentEta,
        updated_at: now.toISOString()
      })
      .eq('id', tripId);

    if (updateError) {
      console.error('Error updating ETA:', updateError);
    } else {
      console.log(`ETA updated: ${currentEta} (${estimatedMinutes} min, ${distanceKm.toFixed(1)} km remaining)`);
    }
  } catch (err: any) {
    console.error('Error calculating ETA:', err.message);
  }
}

/**
 * Get trip with all related data for validation
 */
async function getTripWithDetails(supabase: any, tripId: string) {
  const { data: tripData, error: tripError } = await supabase
    .from('trips')
    .select(`
      *,
      driver:drivers(id, name, mobile),
      vehicle:vehicles(id, vehicle_number, tracking_asset_id),
      tracking_asset:tracking_assets(id, asset_type, asset_id),
      origin_location:locations!trips_origin_location_id_fkey(id, location_name, latitude, longitude, gps_radius_meters, sim_radius_meters),
      destination_location:locations!trips_destination_location_id_fkey(id, location_name, latitude, longitude, gps_radius_meters, sim_radius_meters)
    `)
    .eq('id', tripId)
    .maybeSingle();

  if (tripError) {
    console.error('Trip query error:', tripError);
    throw new Error(`Failed to fetch trip: ${tripError.message}`);
  }

  if (!tripData) {
    throw new Error('Trip not found');
  }

  // Fetch sim consent separately if sim_consent_id exists
  let simConsent = null;
  if (tripData.sim_consent_id) {
    const { data: consentData } = await supabase
      .from('driver_consents')
      .select('id, msisdn, consent_status, entity_id')
      .eq('id', tripData.sim_consent_id)
      .maybeSingle();
    simConsent = consentData;
  }

  return { ...tripData, sim_consent: simConsent };
}

/**
 * Get MSISDN and tracking info for a trip
 */
async function getTrackingInfo(supabase: any, trip: any): Promise<{ msisdn: string | null; trackingAssetId: string | null; trackingType: 'gps' | 'sim' | 'none' }> {
  let msisdn: string | null = null;
  let trackingAssetId: string | null = trip.tracking_asset?.id || trip.vehicle?.tracking_asset_id || null;
  let trackingType: 'gps' | 'sim' | 'none' = 'none';

  // Check for GPS tracking asset first
  if (trip.tracking_asset?.asset_type === 'gps' || (trip.vehicle?.tracking_asset_id && !trip.sim_consent_id)) {
    trackingType = 'gps';
    // For GPS, we would fetch from Wheelseye - not implemented in this function
    return { msisdn: null, trackingAssetId, trackingType };
  }

  // Check for SIM tracking
  if (trip.sim_consent && trip.sim_consent.consent_status === 'allowed') {
    msisdn = trip.sim_consent.msisdn;
    trackingType = 'sim';
  } else if (trip.driver) {
    const { data: consent } = await supabase
      .from('driver_consents')
      .select('msisdn, consent_status')
      .eq('driver_id', trip.driver.id)
      .eq('consent_status', 'allowed')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle();

    if (consent) {
      msisdn = consent.msisdn;
      trackingType = 'sim';
    }
  }

  return { msisdn, trackingAssetId, trackingType };
}

// Auth validation helper
async function validateAuth(req: Request): Promise<{ user: any; error: Response | null }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return {
      user: null,
      error: new Response(
        JSON.stringify({ error: 'Authorization required' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  const supabaseClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } }
  );

  const { data: { user }, error: authError } = await supabaseClient.auth.getUser();

  if (authError || !user) {
    return {
      user: null,
      error: new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  return { user, error: null };
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const { user, error: authError } = await validateAuth(req);
    if (authError) return authError;

    console.log('Authenticated user:', user.id);

    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    // Initialize Supabase client with service role for DB operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let result: any;

    switch (path) {
      case 'validate-location': {
        // Validate if vehicle/driver is within radius of target location
        const body = await req.json();
        const { tripId, action } = body;

        if (!tripId || !action) {
          throw new Error('tripId and action (start/complete) are required');
        }

        console.log(`Validating location for trip ${tripId}, action: ${action}`);

        const trip = await getTripWithDetails(supabase, tripId);
        
        // Determine target location based on action
        const targetLocation = action === 'start' ? trip.origin_location : trip.destination_location;
        
        if (!targetLocation || targetLocation.latitude === null || targetLocation.longitude === null) {
          throw new Error(`${action === 'start' ? 'Origin' : 'Destination'} location has no coordinates`);
        }

        const { msisdn, trackingAssetId, trackingType } = await getTrackingInfo(supabase, trip);

        // If no tracking available, return error
        if (trackingType === 'none' || (!msisdn && trackingType === 'sim')) {
          return new Response(JSON.stringify({
            valid: false,
            distance_meters: 0,
            radius_meters: targetLocation.sim_radius_meters || 500,
            current_location: null,
            target_location: {
              latitude: Number(targetLocation.latitude),
              longitude: Number(targetLocation.longitude),
              name: targetLocation.location_name
            },
            tracking_type: 'none',
            location_stale: false,
            error: 'No active tracking available for this trip'
          }), {
            headers: { ...corsHeaders, 'Content-Type': 'application/json' },
          });
        }

        // Get radius based on tracking type
        const radiusMeters = trackingType === 'gps' 
          ? (targetLocation.gps_radius_meters || 200)
          : (targetLocation.sim_radius_meters || 500);

        let currentLocation: LocationData | null = null;
        let locationStale = false;
        let staleMinutes = 0;
        let locationError: string | null = null;

        if (trackingType === 'sim' && msisdn) {
          try {
            const authToken = await getStoredToken(supabase, 'authentication');
            const locationResponse = await getLocation(authToken, msisdn);
            currentLocation = parseLocationResponse(locationResponse);

            if (currentLocation) {
              // Check if location is stale (more than 5 minutes old)
              const locationTime = new Date(currentLocation.timestamp).getTime();
              const ageMinutes = (Date.now() - locationTime) / 60000;
              if (ageMinutes > 5) {
                locationStale = true;
                staleMinutes = Math.round(ageMinutes);
              }
            }
          } catch (locError: any) {
            console.error('Error fetching SIM location:', locError.message);
            locationError = locError.message;
          }
        } else if (trackingType === 'gps') {
          // GPS tracking uses Wheelseye API
          try {
            // Get vehicle number from trip
            if (!trip.vehicle?.vehicle_number) {
              locationError = 'Vehicle number not available for GPS tracking';
            } else {
              const vehicleNumber = trip.vehicle.vehicle_number;
              const accessToken = Deno.env.get('WHEELSEYE_ACCESS_TOKEN');
              
              if (!accessToken) {
                locationError = 'WHEELSEYE_ACCESS_TOKEN not configured';
              } else {
                console.log('Fetching GPS location for vehicle:', vehicleNumber);
                
                const wheelseyeResponse = await fetch(
                  `https://api.wheelseye.com/currentLoc?accessToken=${accessToken}&vehicleNo=${encodeURIComponent(vehicleNumber)}`,
                  {
                    method: 'GET',
                    headers: { 'Content-Type': 'application/json' },
                  }
                );

                if (!wheelseyeResponse.ok) {
                  const errorText = await wheelseyeResponse.text();
                  console.error('Wheelseye API error:', errorText);
                  locationError = `GPS API error: ${wheelseyeResponse.status}`;
                } else {
                  const gpsData = await wheelseyeResponse.json();
                  console.log('Wheelseye response:', JSON.stringify(gpsData));
                  
                  if (gpsData.status === 'error' || gpsData.error) {
                    locationError = gpsData.message || gpsData.error || 'GPS API returned error';
                  } else {
                    const locationData = gpsData.data || gpsData;
                    const lat = parseFloat(locationData.latitude || locationData.lat);
                    const lng = parseFloat(locationData.longitude || locationData.lng || locationData.lon);
                    
                    if (!isNaN(lat) && !isNaN(lng)) {
                      const gpsTimestamp = locationData.timestamp || locationData.gpsTime || new Date().toISOString();
                      
                      currentLocation = {
                        latitude: lat,
                        longitude: lng,
                        timestamp: gpsTimestamp,
                        detailedAddress: locationData.address || locationData.location || null
                      };
                      
                      // Check if GPS location is stale (more than 5 minutes old)
                      const locationTime = new Date(gpsTimestamp).getTime();
                      const ageMinutes = (Date.now() - locationTime) / 60000;
                      if (ageMinutes > 5) {
                        locationStale = true;
                        staleMinutes = Math.round(ageMinutes);
                      }
                      
                      console.log('GPS location parsed:', currentLocation);
                    } else {
                      locationError = 'Invalid GPS coordinates received';
                    }
                  }
                }
              }
            }
          } catch (gpsError: any) {
            console.error('Error fetching GPS location:', gpsError.message);
            locationError = gpsError.message;
          }
        }

        // Calculate distance if we have current location
        let distanceMeters = 0;
        let isValid = false;

        if (currentLocation) {
          distanceMeters = calculateHaversineDistance(
            currentLocation.latitude,
            currentLocation.longitude,
            Number(targetLocation.latitude),
            Number(targetLocation.longitude)
          );
          isValid = distanceMeters <= radiusMeters;
        }

        result = {
          valid: isValid,
          distance_meters: Math.round(distanceMeters),
          radius_meters: radiusMeters,
          current_location: currentLocation ? {
            latitude: currentLocation.latitude,
            longitude: currentLocation.longitude,
            timestamp: currentLocation.timestamp,
            detailed_address: currentLocation.detailedAddress
          } : null,
          target_location: {
            latitude: Number(targetLocation.latitude),
            longitude: Number(targetLocation.longitude),
            name: targetLocation.location_name
          },
          tracking_type: trackingType,
          location_stale: locationStale,
          stale_minutes: staleMinutes,
          error: locationError
        };
        break;
      }

      case 'start': {
        // Start trip with optional location validation
        const body = await req.json();
        const { tripId, skipValidation, overrideReason } = body;

        if (!tripId) {
          throw new Error('tripId is required');
        }

        console.log('Starting trip:', tripId, skipValidation ? '(validation skipped)' : '');

        const trip = await getTripWithDetails(supabase, tripId);

        if (trip.status === 'ongoing') {
          throw new Error('Trip is already in progress');
        }

        if (trip.status === 'completed') {
          throw new Error('Trip is already completed');
        }

        const { msisdn, trackingAssetId, trackingType } = await getTrackingInfo(supabase, trip);

        let initialLocation: LocationData | null = null;
        let validationOverridden = false;

        // Fetch initial location based on tracking type
        if (msisdn && trackingType === 'sim') {
          try {
            const authToken = await getStoredToken(supabase, 'authentication');
            const locationResponse = await getLocation(authToken, msisdn);
            initialLocation = parseLocationResponse(locationResponse);

            if (initialLocation) {
              // Store first location in location_history
              await storeLocationInHistory(
                supabase,
                tripId,
                trip.driver?.id || null,
                trip.vehicle_id || null,
                trackingAssetId,
                initialLocation,
                locationResponse
              );
              console.log('Initial SIM location stored successfully');
            }
          } catch (locError: any) {
            console.error('Error fetching initial SIM location:', locError.message);
          }
        } else if (trackingType === 'gps' && trip.vehicle?.vehicle_number) {
          // Fetch initial GPS location from Wheelseye
          try {
            const vehicleNumber = trip.vehicle.vehicle_number;
            const accessToken = Deno.env.get('WHEELSEYE_ACCESS_TOKEN');
            
            if (accessToken) {
              console.log('Fetching initial GPS location for vehicle:', vehicleNumber);
              
              const wheelseyeResponse = await fetch(
                `https://api.wheelseye.com/currentLoc?accessToken=${accessToken}&vehicleNo=${encodeURIComponent(vehicleNumber)}`,
                {
                  method: 'GET',
                  headers: { 'Content-Type': 'application/json' },
                }
              );

              if (wheelseyeResponse.ok) {
                const gpsData = await wheelseyeResponse.json();
                
                if (!gpsData.status?.includes('error') && !gpsData.error) {
                  const locationData = gpsData.data || gpsData;
                  const lat = parseFloat(locationData.latitude || locationData.lat);
                  const lng = parseFloat(locationData.longitude || locationData.lng || locationData.lon);
                  
                  if (!isNaN(lat) && !isNaN(lng)) {
                    initialLocation = {
                      latitude: lat,
                      longitude: lng,
                      timestamp: locationData.timestamp || locationData.gpsTime || new Date().toISOString(),
                      detailedAddress: locationData.address || locationData.location || null
                    };
                    
                    // Store in location_history
                    await storeLocationInHistory(
                      supabase,
                      tripId,
                      trip.driver?.id || null,
                      trip.vehicle_id || null,
                      trackingAssetId,
                      initialLocation,
                      gpsData
                    );
                    console.log('Initial GPS location stored successfully');
                  }
                }
              }
            }
          } catch (gpsError: any) {
            console.error('Error fetching initial GPS location:', gpsError.message);
          }
        }

        if (skipValidation && overrideReason) {
          validationOverridden = true;
        }

        // Update trip status to ongoing
        const now = new Date().toISOString();
        const { error: updateError } = await supabase
          .from('trips')
          .update({
            status: 'ongoing',
            actual_start_time: now,
            updated_at: now
          })
          .eq('id', tripId);

        if (updateError) {
          throw new Error('Failed to update trip status');
        }

        // Log the status change with validation info
        await supabase
          .from('trip_audit_logs')
          .insert({
            trip_id: tripId,
            previous_status: trip.status,
            new_status: 'ongoing',
            change_reason: validationOverridden 
              ? `Trip started with location override: ${overrideReason}` 
              : 'Trip started',
            metadata: {
              initial_location: initialLocation,
              tracking_source: trackingType === 'sim' ? 'telenity_sim' : (trackingType === 'gps' ? 'gps' : 'none'),
              validation_overridden: validationOverridden,
              override_reason: overrideReason || null
            }
          });

        const trackingFrequency = await getTrackingFrequency(supabase);

        result = {
          success: true,
          tripId,
          status: 'ongoing',
          actualStartTime: now,
          initialLocation,
          trackingSource: trackingType,
          trackingFrequencySeconds: trackingFrequency,
          validationOverridden,
          message: initialLocation 
            ? 'Trip started with initial location tracked' 
            : 'Trip started (location tracking pending)'
        };
        break;
      }

      case 'complete': {
        // Complete trip with optional location validation and POD enforcement
        const body = await req.json();
        const { tripId, skipValidation, overrideReason, skipPodCheck } = body;

        if (!tripId) {
          throw new Error('tripId is required');
        }

        console.log('Completing trip:', tripId, skipValidation ? '(validation skipped)' : '');

        const trip = await getTripWithDetails(supabase, tripId);

        if (trip.status !== 'ongoing' && trip.status !== 'on_hold') {
          throw new Error(`Cannot complete trip with status: ${trip.status}`);
        }

        // POD Enforcement: Check if all shipments have POD collected
        if (!skipPodCheck) {
          const { data: shipments, error: shipmentsError } = await supabase
            .from('shipments')
            .select('id, shipment_code, pod_collected, status')
            .eq('trip_id', tripId);

          if (shipmentsError) {
            console.error('Error fetching shipments for POD check:', shipmentsError);
            throw new Error('Failed to validate POD status');
          }

          if (shipments && shipments.length > 0) {
            const shipmentsWithoutPod = shipments.filter((s: any) => !s.pod_collected);
            
            if (shipmentsWithoutPod.length > 0) {
              const shipmentCodes = shipmentsWithoutPod.map((s: any) => s.shipment_code).join(', ');
              console.log(`POD not collected for shipments: ${shipmentCodes}`);
              throw new Error(`POD not collected for ${shipmentsWithoutPod.length} shipment(s): ${shipmentCodes}. Please collect POD before completing the trip.`);
            }
          }
          console.log('POD validation passed: All shipments have POD collected');
        } else {
          console.log('POD check skipped');
        }

        const { msisdn, trackingAssetId, trackingType } = await getTrackingInfo(supabase, trip);

        let finalLocation: LocationData | null = null;
        let validationOverridden = false;

        // Fetch final location based on tracking type
        if (msisdn && trackingType === 'sim') {
          try {
            const authToken = await getStoredToken(supabase, 'authentication');
            const locationResponse = await getLocation(authToken, msisdn);
            finalLocation = parseLocationResponse(locationResponse);

            if (finalLocation) {
              await storeLocationInHistory(
                supabase,
                tripId,
                trip.driver?.id || null,
                trip.vehicle_id || null,
                trackingAssetId,
                finalLocation,
                locationResponse
              );
              console.log('Final SIM location stored successfully');
            }
          } catch (locError: any) {
            console.error('Error fetching final SIM location:', locError.message);
          }
        } else if (trackingType === 'gps' && trip.vehicle?.vehicle_number) {
          // Fetch final GPS location from Wheelseye
          try {
            const vehicleNumber = trip.vehicle.vehicle_number;
            const accessToken = Deno.env.get('WHEELSEYE_ACCESS_TOKEN');
            
            if (accessToken) {
              console.log('Fetching final GPS location for vehicle:', vehicleNumber);
              
              const wheelseyeResponse = await fetch(
                `https://api.wheelseye.com/currentLoc?accessToken=${accessToken}&vehicleNo=${encodeURIComponent(vehicleNumber)}`,
                {
                  method: 'GET',
                  headers: { 'Content-Type': 'application/json' },
                }
              );

              if (wheelseyeResponse.ok) {
                const gpsData = await wheelseyeResponse.json();
                
                if (!gpsData.status?.includes('error') && !gpsData.error) {
                  const locationData = gpsData.data || gpsData;
                  const lat = parseFloat(locationData.latitude || locationData.lat);
                  const lng = parseFloat(locationData.longitude || locationData.lng || locationData.lon);
                  
                  if (!isNaN(lat) && !isNaN(lng)) {
                    finalLocation = {
                      latitude: lat,
                      longitude: lng,
                      timestamp: locationData.timestamp || locationData.gpsTime || new Date().toISOString(),
                      detailedAddress: locationData.address || locationData.location || null
                    };
                    
                    // Store in location_history
                    await storeLocationInHistory(
                      supabase,
                      tripId,
                      trip.driver?.id || null,
                      trip.vehicle_id || null,
                      trackingAssetId,
                      finalLocation,
                      gpsData
                    );
                    console.log('Final GPS location stored successfully');
                  }
                }
              }
            }
          } catch (gpsError: any) {
            console.error('Error fetching final GPS location:', gpsError.message);
          }
        }

        if (skipValidation && overrideReason) {
          validationOverridden = true;
        }

        // Update trip status to completed
        const now = new Date().toISOString();
        const { error: updateError } = await supabase
          .from('trips')
          .update({
            status: 'completed',
            actual_end_time: now,
            updated_at: now
          })
          .eq('id', tripId);

        if (updateError) {
          throw new Error('Failed to update trip status');
        }

        // Log the status change
        await supabase
          .from('trip_audit_logs')
          .insert({
            trip_id: tripId,
            previous_status: trip.status,
            new_status: 'completed',
            change_reason: validationOverridden 
              ? `Trip completed with location override: ${overrideReason}` 
              : 'Trip completed',
            metadata: {
              final_location: finalLocation,
              tracking_source: trackingType,
              validation_overridden: validationOverridden,
              override_reason: overrideReason || null
            }
          });

        result = {
          success: true,
          tripId,
          status: 'completed',
          actualEndTime: now,
          finalLocation,
          validationOverridden,
          message: 'Trip completed successfully'
        };
        break;
      }

      case 'fetch-location': {
        const tripId = url.searchParams.get('tripId');

        if (!tripId) {
          throw new Error('tripId is required');
        }

        const trip = await getTripWithDetails(supabase, tripId);

        if (trip.status !== 'ongoing') {
          throw new Error('Trip is not in ongoing status');
        }

        const { msisdn, trackingAssetId, trackingType } = await getTrackingInfo(supabase, trip);

        if (!msisdn) {
          throw new Error('No active SIM consent found for this trip');
        }

        const authToken = await getStoredToken(supabase, 'authentication');
        const locationResponse = await getLocation(authToken, msisdn);
        const locationData = parseLocationResponse(locationResponse);

        if (!locationData) {
          throw new Error('Could not retrieve location from API');
        }

        const sequenceNumber = await storeLocationInHistory(
          supabase,
          tripId,
          trip.driver?.id || null,
          trip.vehicle_id || null,
          trackingAssetId,
          locationData,
          locationResponse
        );

        // Calculate and update ETA
        await calculateAndUpdateETA(supabase, tripId, locationData);

        result = {
          success: true,
          tripId,
          sequenceNumber,
          location: locationData,
          fetchedAt: new Date().toISOString()
        };
        break;
      }

      case 'get-settings': {
        const { data: settings, error } = await supabase
          .from('tracking_settings')
          .select('*');

        if (error) throw error;

        result = { settings };
        break;
      }

      case 'update-settings': {
        const body = await req.json();
        const { settingKey, settingValue } = body;

        if (!settingKey || settingValue === undefined) {
          throw new Error('settingKey and settingValue are required');
        }

        const { data, error } = await supabase
          .from('tracking_settings')
          .update({ 
            setting_value: settingValue.toString(),
            updated_at: new Date().toISOString()
          })
          .eq('setting_key', settingKey)
          .select()
          .single();

        if (error) throw error;

        result = { 
          success: true, 
          setting: data,
          message: `Setting ${settingKey} updated to ${settingValue}`
        };
        break;
      }

      case 'tracking-history': {
        const tripId = url.searchParams.get('tripId');

        if (!tripId) {
          throw new Error('tripId is required');
        }

        const { data: log, error } = await supabase
          .from('tracking_logs')
          .select('id, trip_id, location_history, raw_responses, last_sequence_number, last_updated_at, source, tracking_asset_id')
          .eq('trip_id', tripId)
          .maybeSingle();

        if (error) throw error;

        const locationHistory = log?.location_history || [];

        result = { 
          tripId,
          totalPoints: Array.isArray(locationHistory) ? locationHistory.length : 0,
          trackingLog: log,
          locationHistory: locationHistory
        };
        break;
      }

      case 'fetch-all-locations': {
        console.log('Starting batch location fetch for all ongoing trips...');

        const { data: ongoingTrips, error: tripsError } = await supabase
          .from('trips')
          .select(`
            id,
            trip_code,
            driver_id,
            vehicle_id,
            tracking_asset_id,
            sim_consent:driver_consents!trips_sim_consent_id_fkey(id, msisdn, consent_status, entity_id)
          `)
          .eq('status', 'ongoing');

        if (tripsError) {
          throw new Error('Failed to fetch ongoing trips: ' + tripsError.message);
        }

        if (!ongoingTrips || ongoingTrips.length === 0) {
          result = {
            success: true,
            message: 'No ongoing trips to track',
            tripsProcessed: 0
          };
          break;
        }

        console.log(`Found ${ongoingTrips.length} ongoing trips to process`);

        const authToken = await getStoredToken(supabase, 'authentication');

        const results: Array<{
          tripId: string;
          tripCode: string;
          success: boolean;
          sequenceNumber?: number;
          error?: string;
        }> = [];

        for (const trip of ongoingTrips) {
          try {
            let msisdn: string | null = null;

            if (trip.sim_consent && trip.sim_consent.consent_status === 'allowed') {
              msisdn = trip.sim_consent.msisdn;
            } else if (trip.driver_id) {
              const { data: consent } = await supabase
                .from('driver_consents')
                .select('msisdn, consent_status')
                .eq('driver_id', trip.driver_id)
                .eq('consent_status', 'allowed')
                .order('created_at', { ascending: false })
                .limit(1)
                .single();

              if (consent) {
                msisdn = consent.msisdn;
              }
            }

            if (!msisdn) {
              console.log(`Trip ${trip.trip_code}: No active SIM consent, skipping`);
              results.push({
                tripId: trip.id,
                tripCode: trip.trip_code,
                success: false,
                error: 'No active SIM consent'
              });
              continue;
            }

            console.log(`Fetching location for trip ${trip.trip_code} (MSISDN: ${msisdn})`);
            const locationResponse = await getLocation(authToken, msisdn);
            const locationData = parseLocationResponse(locationResponse);

            if (!locationData) {
              console.log(`Trip ${trip.trip_code}: Could not retrieve location`);
              results.push({
                tripId: trip.id,
                tripCode: trip.trip_code,
                success: false,
                error: 'Location not retrieved'
              });
              continue;
            }

            const sequenceNumber = await storeLocationInHistory(
              supabase,
              trip.id,
              trip.driver_id || null,
              trip.vehicle_id || null,
              trip.tracking_asset_id,
              locationData,
              locationResponse
            );

            // Calculate and update ETA
            await calculateAndUpdateETA(supabase, trip.id, locationData);

            console.log(`Trip ${trip.trip_code}: Location stored with sequence ${sequenceNumber}`);
            results.push({
              tripId: trip.id,
              tripCode: trip.trip_code,
              success: true,
              sequenceNumber
            });

          } catch (tripError: any) {
            console.error(`Error processing trip ${trip.trip_code}:`, tripError.message);
            results.push({
              tripId: trip.id,
              tripCode: trip.trip_code,
              success: false,
              error: tripError.message
            });
          }
        }

        const successCount = results.filter(r => r.success).length;
        console.log(`Batch location fetch complete: ${successCount}/${ongoingTrips.length} successful`);

        result = {
          success: true,
          message: `Processed ${ongoingTrips.length} trips, ${successCount} successful`,
          tripsProcessed: ongoingTrips.length,
          successfulFetches: successCount,
          failedFetches: ongoingTrips.length - successCount,
          results,
          fetchedAt: new Date().toISOString()
        };
        break;
      }

      case 'check-geofence': {
        // Check vehicle locations against pickup/drop geofences and auto-update shipment statuses
        console.log('Starting geofence check for all ongoing trips...');

        const { data: ongoingTrips, error: tripsError } = await supabase
          .from('trips')
          .select(`
            id,
            trip_code,
            origin_location:locations!trips_origin_location_id_fkey(id, location_name, latitude, longitude, gps_radius_meters, sim_radius_meters),
            destination_location:locations!trips_destination_location_id_fkey(id, location_name, latitude, longitude, gps_radius_meters, sim_radius_meters)
          `)
          .eq('status', 'ongoing');

        if (tripsError) {
          throw new Error('Failed to fetch ongoing trips: ' + tripsError.message);
        }

        if (!ongoingTrips || ongoingTrips.length === 0) {
          result = {
            success: true,
            message: 'No ongoing trips to check',
            tripsChecked: 0,
            geofenceEvents: []
          };
          break;
        }

        console.log(`Found ${ongoingTrips.length} ongoing trips to check for geofence`);

        const geofenceEvents: Array<{
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
        }> = [];

        for (const trip of ongoingTrips) {
          try {
            // Get latest location for this trip
            const { data: latestLocation, error: locError } = await supabase
              .from('location_history')
              .select('latitude, longitude, event_time')
              .eq('trip_id', trip.id)
              .order('event_time', { ascending: false })
              .limit(1)
              .maybeSingle();

            if (locError || !latestLocation) {
              console.log(`Trip ${trip.trip_code}: No location data available`);
              continue;
            }

            // Check if location is stale (more than 30 minutes old)
            const locationAge = (Date.now() - new Date(latestLocation.event_time).getTime()) / 60000;
            if (locationAge > 30) {
              console.log(`Trip ${trip.trip_code}: Location is stale (${Math.round(locationAge)} minutes old)`);
              continue;
            }

            // Get shipments mapped to this trip
            const { data: shipments, error: shipError } = await supabase
              .from('shipments')
              .select(`
                id,
                shipment_code,
                status,
                sub_status,
                pickup_location:locations!shipments_pickup_location_id_fkey(id, location_name, latitude, longitude, gps_radius_meters, sim_radius_meters),
                drop_location:locations!shipments_drop_location_id_fkey(id, location_name, latitude, longitude, gps_radius_meters, sim_radius_meters)
              `)
              .eq('trip_id', trip.id)
              .in('status', ['mapped', 'in_pickup', 'in_transit', 'out_for_delivery']);

            if (shipError || !shipments || shipments.length === 0) {
              console.log(`Trip ${trip.trip_code}: No eligible shipments found`);
              continue;
            }

            const currentLat = Number(latestLocation.latitude);
            const currentLng = Number(latestLocation.longitude);

            for (const shipment of shipments) {
              try {
                // Check pickup geofence for mapped/in_pickup status
                if ((shipment.status === 'mapped' || shipment.status === 'in_pickup') && shipment.pickup_location) {
                  const pickupLat = Number(shipment.pickup_location.latitude);
                  const pickupLng = Number(shipment.pickup_location.longitude);
                  const pickupRadius = shipment.pickup_location.sim_radius_meters || 500;

                  if (pickupLat && pickupLng) {
                    const distanceToPickup = calculateHaversineDistance(currentLat, currentLng, pickupLat, pickupLng);
                    const isAtPickup = distanceToPickup <= pickupRadius;

                    // Entering pickup zone - update to in_pickup with vehicle_placed sub-status
                    if (isAtPickup && shipment.status === 'mapped') {
                      console.log(`Geofence: Shipment ${shipment.shipment_code} entered pickup zone ${shipment.pickup_location.location_name}`);
                      
                      const { error: updateError } = await supabase
                        .from('shipments')
                        .update({
                          status: 'in_pickup',
                          sub_status: 'vehicle_placed',
                          in_pickup_at: new Date().toISOString()
                        })
                        .eq('id', shipment.id);

                      if (!updateError) {
                        // Log the geofence-triggered status change
                        await supabase.from('shipment_status_history').insert({
                          shipment_id: shipment.id,
                          previous_status: 'mapped',
                          new_status: 'in_pickup',
                          new_sub_status: 'vehicle_placed',
                          change_source: 'geofence',
                          notes: `Vehicle entered pickup zone: ${shipment.pickup_location.location_name}`,
                          metadata: {
                            distance_meters: Math.round(distanceToPickup),
                            radius_meters: pickupRadius,
                            location_name: shipment.pickup_location.location_name
                          }
                        });

                        geofenceEvents.push({
                          tripId: trip.id,
                          tripCode: trip.trip_code,
                          shipmentId: shipment.id,
                          shipmentCode: shipment.shipment_code,
                          eventType: 'pickup_entry',
                          locationName: shipment.pickup_location.location_name,
                          newStatus: 'in_pickup',
                          newSubStatus: 'vehicle_placed',
                          distance: Math.round(distanceToPickup),
                          radius: pickupRadius
                        });
                      }
                    }

                    // Exiting pickup zone with completed loading - update to in_transit
                    if (!isAtPickup && shipment.status === 'in_pickup' && 
                        (shipment.sub_status === 'loading_completed' || shipment.sub_status === 'ready_for_dispatch')) {
                      console.log(`Geofence: Shipment ${shipment.shipment_code} exited pickup zone, moving to in_transit`);
                      
                      const { error: updateError } = await supabase
                        .from('shipments')
                        .update({
                          status: 'in_transit',
                          sub_status: 'on_time',
                          in_transit_at: new Date().toISOString()
                        })
                        .eq('id', shipment.id);

                      if (!updateError) {
                        await supabase.from('shipment_status_history').insert({
                          shipment_id: shipment.id,
                          previous_status: 'in_pickup',
                          new_status: 'in_transit',
                          previous_sub_status: shipment.sub_status,
                          new_sub_status: 'on_time',
                          change_source: 'geofence',
                          notes: `Vehicle exited pickup zone: ${shipment.pickup_location.location_name}`,
                          metadata: {
                            distance_meters: Math.round(distanceToPickup),
                            radius_meters: pickupRadius
                          }
                        });

                        geofenceEvents.push({
                          tripId: trip.id,
                          tripCode: trip.trip_code,
                          shipmentId: shipment.id,
                          shipmentCode: shipment.shipment_code,
                          eventType: 'pickup_exit',
                          locationName: shipment.pickup_location.location_name,
                          newStatus: 'in_transit',
                          newSubStatus: 'on_time',
                          distance: Math.round(distanceToPickup),
                          radius: pickupRadius
                        });
                      }
                    }
                  }
                }

                // Check drop/delivery geofence for in_transit status
                if (shipment.status === 'in_transit' && shipment.drop_location) {
                  const dropLat = Number(shipment.drop_location.latitude);
                  const dropLng = Number(shipment.drop_location.longitude);
                  const dropRadius = shipment.drop_location.sim_radius_meters || 500;

                  if (dropLat && dropLng) {
                    const distanceToDrop = calculateHaversineDistance(currentLat, currentLng, dropLat, dropLng);
                    const isAtDrop = distanceToDrop <= dropRadius;

                    // Entering delivery zone - update to out_for_delivery
                    if (isAtDrop) {
                      console.log(`Geofence: Shipment ${shipment.shipment_code} entered delivery zone ${shipment.drop_location.location_name}`);
                      
                      const { error: updateError } = await supabase
                        .from('shipments')
                        .update({
                          status: 'out_for_delivery',
                          out_for_delivery_at: new Date().toISOString()
                        })
                        .eq('id', shipment.id);

                      if (!updateError) {
                        await supabase.from('shipment_status_history').insert({
                          shipment_id: shipment.id,
                          previous_status: 'in_transit',
                          new_status: 'out_for_delivery',
                          previous_sub_status: shipment.sub_status,
                          change_source: 'geofence',
                          notes: `Vehicle entered delivery zone: ${shipment.drop_location.location_name}`,
                          metadata: {
                            distance_meters: Math.round(distanceToDrop),
                            radius_meters: dropRadius,
                            location_name: shipment.drop_location.location_name
                          }
                        });

                        geofenceEvents.push({
                          tripId: trip.id,
                          tripCode: trip.trip_code,
                          shipmentId: shipment.id,
                          shipmentCode: shipment.shipment_code,
                          eventType: 'delivery_entry',
                          locationName: shipment.drop_location.location_name,
                          newStatus: 'out_for_delivery',
                          distance: Math.round(distanceToDrop),
                          radius: dropRadius
                        });
                      }
                    }
                  }
                }
              } catch (shipmentError: any) {
                console.error(`Error processing shipment ${shipment.shipment_code}:`, shipmentError.message);
              }
            }
          } catch (tripError: any) {
            console.error(`Error processing trip ${trip.trip_code}:`, tripError.message);
          }
        }

        console.log(`Geofence check complete: ${geofenceEvents.length} events triggered`);

        result = {
          success: true,
          message: `Checked ${ongoingTrips.length} trips, ${geofenceEvents.length} geofence events triggered`,
          tripsChecked: ongoingTrips.length,
          geofenceEvents,
          checkedAt: new Date().toISOString()
        };
        break;
      }

      case 'check-delays': {
        // Check all ongoing trips for delays based on ETA comparison
        console.log('Starting delay check for all ongoing trips...');

        const { data: ongoingTrips, error: tripsError } = await supabase
          .from('trips')
          .select(`
            id,
            trip_code,
            planned_eta,
            current_eta,
            planned_end_time
          `)
          .eq('status', 'ongoing');

        if (tripsError) {
          throw new Error('Failed to fetch ongoing trips: ' + tripsError.message);
        }

        if (!ongoingTrips || ongoingTrips.length === 0) {
          result = {
            success: true,
            message: 'No ongoing trips to check',
            tripsChecked: 0,
            delayAlerts: []
          };
          break;
        }

        console.log(`Found ${ongoingTrips.length} ongoing trips to check for delays`);

        // Get delay threshold from settings
        const { data: delaySetting } = await supabase
          .from('tracking_settings')
          .select('setting_value')
          .eq('setting_key', 'delay_threshold_percent')
          .maybeSingle();

        const delayThresholdPercent = delaySetting ? parseInt(delaySetting.setting_value) : 15;

        const delayAlerts: Array<{
          tripId: string;
          tripCode: string;
          delayed: boolean;
          delayPercent?: number;
          delayMinutes?: number;
          alertCreated?: boolean;
        }> = [];

        const now = new Date();

        for (const trip of ongoingTrips) {
          try {
            const plannedEta = trip.planned_eta ? new Date(trip.planned_eta) : null;
            const currentEta = trip.current_eta ? new Date(trip.current_eta) : null;
            const plannedEndTime = trip.planned_end_time ? new Date(trip.planned_end_time) : null;
            
            const baselineEta = plannedEta || plannedEndTime;
            
            if (!baselineEta || !currentEta) {
              continue;
            }

            const baselineRemaining = baselineEta.getTime() - now.getTime();
            const currentRemaining = currentEta.getTime() - now.getTime();
            
            let delayed = false;
            let delayPercent = 0;
            let delayMinutes = 0;
            let alertCreated = false;

            // Past due
            if (baselineRemaining <= 0 && currentRemaining > 0) {
              delayed = true;
              delayMinutes = Math.round(currentRemaining / 60000);
              delayPercent = 100;
            } 
            // Behind schedule
            else if (baselineRemaining > 0 && currentRemaining > baselineRemaining) {
              const delayMs = currentRemaining - baselineRemaining;
              delayPercent = (delayMs / baselineRemaining) * 100;
              delayMinutes = Math.round(delayMs / 60000);
              delayed = delayPercent >= delayThresholdPercent;
            }

            if (delayed) {
              // Check if alert already exists
              const { data: existingAlerts } = await supabase
                .from('trip_alerts')
                .select('id')
                .eq('trip_id', trip.id)
                .eq('alert_type', 'delay_warning')
                .eq('status', 'active');

              if (!existingAlerts || existingAlerts.length === 0) {
                const severity = delayPercent > 50 ? 'high' : delayPercent > 30 ? 'medium' : 'low';
                const isPastDue = baselineRemaining <= 0;
                
                const { error: alertError } = await supabase
                  .from('trip_alerts')
                  .insert({
                    trip_id: trip.id,
                    alert_type: 'delay_warning',
                    status: 'active',
                    severity,
                    title: isPastDue ? 'Trip Delayed - Past Due' : 'Delay Warning',
                    description: isPastDue 
                      ? `Trip is ${delayMinutes} minutes past the planned ETA`
                      : `Trip is running ${delayMinutes} minutes behind schedule (${Math.round(delayPercent)}% delay)`,
                    threshold_value: delayThresholdPercent,
                    actual_value: delayPercent,
                    metadata: {
                      planned_eta: baselineEta.toISOString(),
                      current_eta: currentEta.toISOString(),
                      delay_percent: delayPercent,
                      delay_minutes: delayMinutes
                    }
                  });

                if (!alertError) {
                  alertCreated = true;
                  console.log(`Trip ${trip.trip_code}: Delay alert created (${Math.round(delayPercent)}% delay)`);
                  
                  // Update trip alert count
                  const { data: alertCount } = await supabase
                    .from('trip_alerts')
                    .select('status')
                    .eq('trip_id', trip.id)
                    .in('status', ['active', 'acknowledged']);
                  
                  await supabase
                    .from('trips')
                    .update({ active_alert_count: alertCount?.length || 0 })
                    .eq('id', trip.id);
                }
              }
            } else {
              // Auto-resolve delay alerts if back on schedule
              const { data: activeDelayAlerts } = await supabase
                .from('trip_alerts')
                .select('id')
                .eq('trip_id', trip.id)
                .eq('alert_type', 'delay_warning')
                .eq('status', 'active');

              if (activeDelayAlerts && activeDelayAlerts.length > 0) {
                for (const alert of activeDelayAlerts) {
                  await supabase
                    .from('trip_alerts')
                    .update({ 
                      status: 'resolved', 
                      resolved_at: now.toISOString()
                    })
                    .eq('id', alert.id);
                }
                console.log(`Trip ${trip.trip_code}: Delay alert auto-resolved (back on schedule)`);
              }
            }

            delayAlerts.push({
              tripId: trip.id,
              tripCode: trip.trip_code,
              delayed,
              delayPercent: Math.round(delayPercent),
              delayMinutes,
              alertCreated
            });

          } catch (tripError: any) {
            console.error(`Error processing trip ${trip.trip_code}:`, tripError.message);
          }
        }

        const delayedCount = delayAlerts.filter(a => a.delayed).length;
        const alertsCreatedCount = delayAlerts.filter(a => a.alertCreated).length;
        console.log(`Delay check complete: ${delayedCount} delayed trips, ${alertsCreatedCount} new alerts created`);

        result = {
          success: true,
          message: `Checked ${ongoingTrips.length} trips, ${delayedCount} delayed, ${alertsCreatedCount} alerts created`,
          tripsChecked: ongoingTrips.length,
          delayedTrips: delayedCount,
          alertsCreated: alertsCreatedCount,
          delayAlerts,
          checkedAt: now.toISOString()
        };
        break;
      }

      case 'check-geofence-auto-start': {
        // Check if any "created" trips should auto-start based on vehicle entering origin geofence
        console.log('Checking geofence auto-start for created trips...');
        
        // First, check if auto-start is enabled
        const { data: autoStartSetting } = await supabase
          .from('tracking_settings')
          .select('setting_value')
          .eq('setting_key', 'geofence_auto_start_enabled')
          .maybeSingle();
        
        const autoStartEnabled = autoStartSetting?.setting_value === 'true';
        
        if (!autoStartEnabled) {
          result = {
            success: true,
            message: 'Geofence auto-start is disabled',
            tripsChecked: 0,
            tripsAutoStarted: 0
          };
          break;
        }
        
        // Fetch trips in "created" status with tracking enabled
        const { data: createdTrips, error: tripsError } = await supabase
          .from('trips')
          .select(`
            id,
            trip_code,
            driver_id,
            vehicle_id,
            tracking_type,
            tracking_asset_id,
            origin_location:locations!trips_origin_location_id_fkey(id, location_name, latitude, longitude, gps_radius_meters, sim_radius_meters),
            vehicle:vehicles(id, vehicle_number, tracking_asset_id),
            driver:drivers(id, name, mobile),
            sim_consent:driver_consents!trips_sim_consent_id_fkey(id, msisdn, consent_status, entity_id)
          `)
          .eq('status', 'created')
          .not('tracking_type', 'eq', 'none')
          .not('tracking_type', 'is', null);
        
        if (tripsError) {
          throw new Error('Failed to fetch created trips: ' + tripsError.message);
        }
        
        if (!createdTrips || createdTrips.length === 0) {
          result = {
            success: true,
            message: 'No eligible trips for geofence auto-start',
            tripsChecked: 0,
            tripsAutoStarted: 0
          };
          break;
        }
        
        console.log(`Found ${createdTrips.length} created trips with tracking to check`);
        
        const autoStartResults: Array<{
          tripId: string;
          tripCode: string;
          autoStarted: boolean;
          reason: string;
        }> = [];
        
        for (const trip of createdTrips) {
          try {
            const originLocation = trip.origin_location as any;
            
            if (!originLocation?.latitude || !originLocation?.longitude) {
              autoStartResults.push({
                tripId: trip.id,
                tripCode: trip.trip_code,
                autoStarted: false,
                reason: 'Origin location has no coordinates'
              });
              continue;
            }
            
            const trackingType = trip.tracking_type;
            let currentLocation: LocationData | null = null;
            
            // Get current location based on tracking type
            if (trackingType === 'sim') {
              let msisdn: string | null = null;
              
              if (trip.sim_consent && (trip.sim_consent as any).consent_status === 'allowed') {
                msisdn = (trip.sim_consent as any).msisdn;
              } else if (trip.driver_id) {
                const { data: consent } = await supabase
                  .from('driver_consents')
                  .select('msisdn, consent_status')
                  .eq('driver_id', trip.driver_id)
                  .eq('consent_status', 'allowed')
                  .order('created_at', { ascending: false })
                  .limit(1)
                  .maybeSingle();
                
                if (consent) {
                  msisdn = consent.msisdn;
                }
              }
              
              if (!msisdn) {
                autoStartResults.push({
                  tripId: trip.id,
                  tripCode: trip.trip_code,
                  autoStarted: false,
                  reason: 'No active SIM consent'
                });
                continue;
              }
              
              try {
                const authToken = await getStoredToken(supabase, 'authentication');
                const locationResponse = await getLocation(authToken, msisdn);
                currentLocation = parseLocationResponse(locationResponse);
              } catch (locErr: any) {
                console.error(`Error fetching SIM location for trip ${trip.trip_code}:`, locErr.message);
              }
            } else if (trackingType === 'gps' && (trip.vehicle as any)?.vehicle_number) {
              const vehicleNumber = (trip.vehicle as any).vehicle_number;
              const accessToken = Deno.env.get('WHEELSEYE_ACCESS_TOKEN');
              
              if (accessToken) {
                try {
                  const wheelseyeResponse = await fetch(
                    `https://api.wheelseye.com/currentLoc?accessToken=${accessToken}&vehicleNo=${encodeURIComponent(vehicleNumber)}`,
                    { method: 'GET', headers: { 'Content-Type': 'application/json' } }
                  );
                  
                  if (wheelseyeResponse.ok) {
                    const gpsData = await wheelseyeResponse.json();
                    
                    if (!gpsData.status?.includes('error') && !gpsData.error) {
                      const locationData = gpsData.data || gpsData;
                      const lat = parseFloat(locationData.latitude || locationData.lat);
                      const lng = parseFloat(locationData.longitude || locationData.lng || locationData.lon);
                      
                      if (!isNaN(lat) && !isNaN(lng)) {
                        currentLocation = {
                          latitude: lat,
                          longitude: lng,
                          timestamp: locationData.timestamp || locationData.gpsTime || new Date().toISOString(),
                          detailedAddress: locationData.address || locationData.location || null
                        };
                      }
                    }
                  }
                } catch (gpsErr: any) {
                  console.error(`Error fetching GPS location for trip ${trip.trip_code}:`, gpsErr.message);
                }
              }
            }
            
            if (!currentLocation) {
              autoStartResults.push({
                tripId: trip.id,
                tripCode: trip.trip_code,
                autoStarted: false,
                reason: 'Could not fetch current location'
              });
              continue;
            }
            
            // Calculate distance from origin
            const radiusMeters = trackingType === 'gps'
              ? (originLocation.gps_radius_meters || 200)
              : (originLocation.sim_radius_meters || 500);
            
            const distanceMeters = calculateHaversineDistance(
              currentLocation.latitude,
              currentLocation.longitude,
              Number(originLocation.latitude),
              Number(originLocation.longitude)
            );
            
            const isWithinGeofence = distanceMeters <= radiusMeters;
            
            if (!isWithinGeofence) {
              autoStartResults.push({
                tripId: trip.id,
                tripCode: trip.trip_code,
                autoStarted: false,
                reason: `Vehicle is ${Math.round(distanceMeters)}m from origin (radius: ${radiusMeters}m)`
              });
              continue;
            }
            
            // Auto-start the trip
            console.log(`Auto-starting trip ${trip.trip_code} - vehicle is within ${Math.round(distanceMeters)}m of origin`);
            
            const now = new Date().toISOString();
            
            // Update trip status
            const { error: updateError } = await supabase
              .from('trips')
              .update({
                status: 'ongoing',
                actual_start_time: now,
                updated_at: now
              })
              .eq('id', trip.id);
            
            if (updateError) {
              autoStartResults.push({
                tripId: trip.id,
                tripCode: trip.trip_code,
                autoStarted: false,
                reason: `Failed to update trip: ${updateError.message}`
              });
              continue;
            }
            
            // Store initial location
            await storeLocationInHistory(
              supabase,
              trip.id,
              trip.driver_id || null,
              trip.vehicle_id || null,
              trip.tracking_asset_id || null,
              currentLocation,
              { source: 'geofence_auto_start' }
            );
            
            // Create audit log
            await supabase
              .from('trip_audit_logs')
              .insert({
                trip_id: trip.id,
                previous_status: 'created',
                new_status: 'ongoing',
                change_reason: 'Trip auto-started via geofence detection',
                metadata: {
                  trigger: 'geofence_auto_start',
                  distance_from_origin_meters: Math.round(distanceMeters),
                  origin_radius_meters: radiusMeters,
                  initial_location: currentLocation
                }
              });
            
            autoStartResults.push({
              tripId: trip.id,
              tripCode: trip.trip_code,
              autoStarted: true,
              reason: `Vehicle entered origin geofence (${Math.round(distanceMeters)}m from origin)`
            });
            
          } catch (tripError: any) {
            console.error(`Error processing trip ${trip.trip_code}:`, tripError.message);
            autoStartResults.push({
              tripId: trip.id,
              tripCode: trip.trip_code,
              autoStarted: false,
              reason: `Error: ${tripError.message}`
            });
          }
        }
        
        const autoStartedCount = autoStartResults.filter(r => r.autoStarted).length;
        console.log(`Geofence auto-start check complete: ${autoStartedCount}/${createdTrips.length} trips auto-started`);
        
        result = {
          success: true,
          message: `Checked ${createdTrips.length} trips, ${autoStartedCount} auto-started`,
          tripsChecked: createdTrips.length,
          tripsAutoStarted: autoStartedCount,
          results: autoStartResults,
          checkedAt: new Date().toISOString()
        };
        break;
      }

      default:
        throw new Error(`Unknown endpoint: ${path}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error: any) {
    console.error('Start trip error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
