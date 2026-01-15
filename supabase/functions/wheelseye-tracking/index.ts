import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Wheelseye API Configuration
const WHEELSEYE_BASE_URL = 'https://api.wheelseye.com/';

interface LocationResponse {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number;
  timestamp: string;
  vehicleNumber: string;
  raw?: any;
}

// Auth validation helper with permission check
async function validateAuth(req: Request, requiredResource: string, requiredAction: string): Promise<{ user: any; supabaseClient: any; error: Response | null }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return {
      user: null,
      supabaseClient: null,
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
      supabaseClient: null,
      error: new Response(
        JSON.stringify({ error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  // Check if superadmin
  const { data: isSuperadmin } = await supabaseClient.rpc('is_superadmin', { _user_id: user.id });

  // Check for permission if not superadmin
  if (!isSuperadmin) {
    const { data: hasPermission } = await supabaseClient.rpc('has_permission', {
      _user_id: user.id,
      _resource: requiredResource,
      _action: requiredAction
    });

    if (!hasPermission) {
      return {
        user: null,
        supabaseClient: null,
        error: new Response(
          JSON.stringify({ error: `You don't have permission to ${requiredAction} ${requiredResource}` }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      };
    }
  }

  return { user, supabaseClient, error: null };
}

// Get current location by vehicle number
async function getCurrentLocation(accessToken: string, vehicleNumber: string): Promise<LocationResponse> {
  const response = await fetch(
    `${WHEELSEYE_BASE_URL}currentLoc?accessToken=${accessToken}&vehicleNo=${encodeURIComponent(vehicleNumber)}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Wheelseye location error:', error);
    throw new Error(`Failed to get location: ${response.status} - ${error}`);
  }

  const data = await response.json();

  // Handle Wheelseye response format
  if (data.status === 'error' || data.error) {
    throw new Error(data.message || data.error || 'Wheelseye API error');
  }

  const locationData = data.data || data;

  return {
    latitude: parseFloat(locationData.latitude || locationData.lat),
    longitude: parseFloat(locationData.longitude || locationData.lng || locationData.lon),
    speed: parseFloat(locationData.speed || 0),
    heading: parseFloat(locationData.heading || locationData.angle || 0),
    timestamp: locationData.timestamp || locationData.gpsTime || new Date().toISOString(),
    vehicleNumber: vehicleNumber,
    raw: data
  };
}

// Get location history
async function getLocationHistory(accessToken: string, vehicleNumber: string, fromDate: string, toDate: string): Promise<any> {
  const response = await fetch(
    `${WHEELSEYE_BASE_URL}locationHistory?accessToken=${accessToken}&vehicleNo=${encodeURIComponent(vehicleNumber)}&fromDate=${fromDate}&toDate=${toDate}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Wheelseye history error:', error);
    throw new Error(`Failed to get history: ${response.status}`);
  }

  return await response.json();
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    // Determine required permission based on endpoint
    const requiredAction = path === 'bulk-location' ? 'update' : 'view';
    
    // Validate authentication with permission check
    const { user, error: authError } = await validateAuth(req, 'trips', requiredAction);
    if (authError) return authError;

    console.log('Authenticated user:', user.id);

    const accessToken = Deno.env.get('WHEELSEYE_ACCESS_TOKEN');

    if (!accessToken) {
      throw new Error('WHEELSEYE_ACCESS_TOKEN not configured');
    }

    // Initialize Supabase client with service role for DB operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if WheelsEye tracking is enabled
    const { data: enableSetting } = await supabase
      .from('tracking_settings')
      .select('setting_value')
      .eq('setting_key', 'enable_wheelseye_tracking')
      .single();
    
    if (enableSetting?.setting_value === 'false') {
      return new Response(
        JSON.stringify({ error: 'WheelsEye tracking is disabled. Enable it in Settings > Integrations.' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    let result: any;

    switch (path) {
      case 'location': {
        // Get current location
        const vehicleNumber = url.searchParams.get('vehicleNumber');
        const tripId = url.searchParams.get('tripId');
        const vehicleId = url.searchParams.get('vehicleId');
        const trackingAssetId = url.searchParams.get('trackingAssetId');

        if (!vehicleNumber) {
          throw new Error('vehicleNumber is required');
        }

        const locationResult = await getCurrentLocation(accessToken, vehicleNumber);

        // Store location in database if tripId provided
        if (tripId) {
          await supabase
            .from('location_history')
            .insert({
              trip_id: tripId,
              vehicle_id: vehicleId || null,
              tracking_asset_id: trackingAssetId || null,
              latitude: locationResult.latitude,
              longitude: locationResult.longitude,
              speed_kmph: locationResult.speed,
              heading: locationResult.heading,
              source: 'wheelseye',
              event_time: locationResult.timestamp,
              raw_response: locationResult.raw
            });

          // Trigger location-based alert processing
          try {
            const alertResponse = await fetch(
              `${supabaseUrl}/functions/v1/process-location-alerts`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  tripId,
                  latitude: locationResult.latitude,
                  longitude: locationResult.longitude,
                  speed: locationResult.speed,
                  timestamp: locationResult.timestamp,
                  vehicleId: vehicleId || null,
                }),
              }
            );
            const alertResult = await alertResponse.json();
            console.log('Alert processing result:', alertResult);
          } catch (alertError) {
            console.error('Failed to process location alerts:', alertError);
            // Don't fail the main request if alert processing fails
          }
        }

        result = locationResult;
        break;
      }

      case 'history': {
        // Get location history
        const vehicleNumber = url.searchParams.get('vehicleNumber');
        const fromDate = url.searchParams.get('fromDate');
        const toDate = url.searchParams.get('toDate');

        if (!vehicleNumber || !fromDate || !toDate) {
          throw new Error('vehicleNumber, fromDate, and toDate are required');
        }

        result = await getLocationHistory(accessToken, vehicleNumber, fromDate, toDate);
        break;
      }

      case 'bulk-location': {
        // Get locations for multiple vehicles
        const body = await req.json();
        const { vehicleNumbers, tripId } = body;

        if (!vehicleNumbers || !Array.isArray(vehicleNumbers)) {
          throw new Error('vehicleNumbers array is required');
        }

        const locations = await Promise.all(
          vehicleNumbers.map(async (vehicleNumber: string) => {
            try {
              return await getCurrentLocation(accessToken, vehicleNumber);
            } catch (error) {
              return { vehicleNumber, error: error.message };
            }
          })
        );

        // Store valid locations in database
        const validLocations = locations.filter(loc => loc.latitude && loc.longitude);
        if (tripId && validLocations.length > 0) {
          await supabase
            .from('location_history')
            .insert(
              validLocations.map(loc => ({
                trip_id: tripId,
                latitude: loc.latitude,
                longitude: loc.longitude,
                speed_kmph: loc.speed,
                heading: loc.heading,
                source: 'wheelseye',
                event_time: loc.timestamp,
                raw_response: loc.raw
              }))
            );

          // Process alerts for the most recent location
          const latestLocation = validLocations[validLocations.length - 1];
          try {
            await fetch(
              `${supabaseUrl}/functions/v1/process-location-alerts`,
              {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Bearer ${supabaseKey}`,
                },
                body: JSON.stringify({
                  tripId,
                  latitude: latestLocation.latitude,
                  longitude: latestLocation.longitude,
                  speed: latestLocation.speed,
                  timestamp: latestLocation.timestamp,
                }),
              }
            );
          } catch (alertError) {
            console.error('Failed to process bulk location alerts:', alertError);
          }
        }

        result = locations;
        break;
      }

      default:
        throw new Error(`Unknown endpoint: ${path}`);
    }

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });

  } catch (error) {
    console.error('Wheelseye tracking error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
