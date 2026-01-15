import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface LocationResult {
  tripId: string;
  tripCode: string;
  success: boolean;
  error?: string;
  location?: {
    latitude: number;
    longitude: number;
    speed?: number;
    heading?: number;
    accuracy?: number;
  };
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
  
  // Allow service role key for cron jobs
  if (token === serviceRoleKey) {
    console.log('Authenticated via service role key (cron job)');
    return { authorized: true };
  }

  // For user-based calls, verify JWT and check superadmin
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

  const { data: roleCheck } = await supabaseClient.rpc('is_superadmin', { _user_id: user.id });
  
  // Also check for trips:update permission
  const { data: hasPermission } = await supabaseClient.rpc('has_permission', { 
    _user_id: user.id,
    _resource: 'trips',
    _action: 'update'
  });

  if (!roleCheck && !hasPermission) {
    return {
      authorized: false,
      error: new Response(
        JSON.stringify({ error: 'Insufficient permissions - trips:update required' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  console.log('Authenticated user:', user.id, roleCheck ? '(superadmin)' : '(with permission)');
  return { authorized: true };
}

// Fetch location from Wheelseye GPS API
async function fetchGPSLocation(vehicleNumber: string, accessToken: string): Promise<any> {
  const response = await fetch(
    `https://api.wheelseye.com/currentLoc?token=${accessToken}&vehNum=${encodeURIComponent(vehicleNumber)}`,
    { method: 'GET' }
  );

  if (!response.ok) {
    throw new Error(`Wheelseye API error: ${response.status}`);
  }

  const data = await response.json();
  if (!data || data.error) {
    throw new Error(data?.error || 'No location data returned');
  }

  return {
    latitude: data.lat || data.latitude,
    longitude: data.lng || data.longitude,
    speed: data.speed,
    heading: data.heading,
    accuracy: data.accuracy,
    timestamp: data.timestamp || new Date().toISOString(),
  };
}

// Fetch location from Telenity SIM API
async function fetchSIMLocation(msisdn: string, accessToken: string): Promise<any> {
  const response = await fetch(
    `https://india-agw.telenity.com/apigw/terminallocationservice/v4/location?msisdn=${msisdn}&accuracy=1000`,
    {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
    }
  );

  if (!response.ok) {
    throw new Error(`Telenity API error: ${response.status}`);
  }

  const data = await response.json();
  if (!data?.LocationResponse?.latitude) {
    throw new Error('No location data returned from Telenity');
  }

  const loc = data.LocationResponse;
  return {
    latitude: loc.latitude,
    longitude: loc.longitude,
    accuracy: loc.accuracy,
    timestamp: loc.timestamp || new Date().toISOString(),
  };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const { authorized, error: authError } = await validateAuth(req);
    if (!authorized) return authError!;

    console.log('Starting bulk location update...');

    // Create service role client for database operations
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    );

    // Get all ongoing trips with their tracking info
    const { data: trips, error: tripsError } = await supabase
      .from('trips')
      .select(`
        id,
        trip_code,
        tracking_type,
        vehicle_id,
        driver_id,
        tracking_asset_id,
        vehicles!trips_vehicle_id_fkey(vehicle_number),
        drivers!trips_driver_id_fkey(mobile)
      `)
      .in('status', ['ongoing'])
      .eq('is_trackable', true);

    if (tripsError) {
      console.error('Error fetching trips:', tripsError);
      throw new Error(`Failed to fetch trips: ${tripsError.message}`);
    }

    if (!trips || trips.length === 0) {
      console.log('No ongoing trackable trips found');
      return new Response(
        JSON.stringify({ message: 'No ongoing trackable trips', results: [] }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    console.log(`Found ${trips.length} ongoing trips to update`);

    // Get API tokens
    const wheelseyeToken = Deno.env.get('WHEELSEYE_ACCESS_TOKEN');
    
    // Get Telenity access token from database
    const { data: telenityToken } = await supabase
      .from('integration_tokens')
      .select('token_value, expires_at')
      .eq('token_type', 'access')
      .single();

    const results: LocationResult[] = [];

    // Process each trip
    for (const trip of trips) {
      const result: LocationResult = {
        tripId: trip.id,
        tripCode: trip.trip_code,
        success: false,
      };

      try {
        let locationData;
        let source: 'gps' | 'sim' | 'manual' = 'manual';

        if (trip.tracking_type === 'gps' && trip.vehicles?.vehicle_number && wheelseyeToken) {
          // GPS tracking via Wheelseye
          locationData = await fetchGPSLocation(trip.vehicles.vehicle_number, wheelseyeToken);
          source = 'gps';
          console.log(`GPS location fetched for trip ${trip.trip_code}`);
        } else if (trip.tracking_type === 'sim' && trip.drivers?.mobile && telenityToken?.token_value) {
          // SIM tracking via Telenity
          const msisdn = trip.drivers.mobile.replace(/^\+?91/, '');
          locationData = await fetchSIMLocation(msisdn, telenityToken.token_value);
          source = 'sim';
          console.log(`SIM location fetched for trip ${trip.trip_code}`);
        } else {
          result.error = 'No valid tracking configuration';
          results.push(result);
          continue;
        }

        // Store location in location_history
        const { error: insertError } = await supabase
          .from('location_history')
          .insert({
            trip_id: trip.id,
            vehicle_id: trip.vehicle_id,
            driver_id: trip.driver_id,
            tracking_asset_id: trip.tracking_asset_id,
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            speed_kmph: locationData.speed,
            heading: locationData.heading,
            accuracy_meters: locationData.accuracy,
            event_time: locationData.timestamp || new Date().toISOString(),
            source: source,
          });

        if (insertError) {
          console.error(`Error storing location for trip ${trip.trip_code}:`, insertError);
          result.error = `Failed to store location: ${insertError.message}`;
        } else {
          // Update trip's last_ping_at
          await supabase
            .from('trips')
            .update({ last_ping_at: new Date().toISOString() })
            .eq('id', trip.id);

          result.success = true;
          result.location = {
            latitude: locationData.latitude,
            longitude: locationData.longitude,
            speed: locationData.speed,
            heading: locationData.heading,
            accuracy: locationData.accuracy,
          };
        }
      } catch (err: any) {
        console.error(`Error processing trip ${trip.trip_code}:`, err.message);
        result.error = err.message;
      }

      results.push(result);
    }

    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;

    console.log(`Bulk location update complete: ${successCount} succeeded, ${failCount} failed`);

    return new Response(
      JSON.stringify({
        message: 'Bulk location update complete',
        total: trips.length,
        success: successCount,
        failed: failCount,
        results,
      }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (err: any) {
    console.error('Bulk location update error:', err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
