import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface RouteRequest {
  origin: { lat: number; lng: number; name?: string };
  destination: { lat: number; lng: number; name?: string };
  waypoints?: Array<{ lat: number; lng: number; name?: string }>;
  alternatives?: boolean;
}

interface RouteData {
  encodedPolyline: string;
  totalDistanceMeters: number;
  totalDurationSeconds: number;
  routeSummary: string;
  routeIndex: number;
  legs: Array<{
    startAddress: string;
    endAddress: string;
    distanceMeters: number;
    durationSeconds: number;
    steps: Array<{
      instruction: string;
      distanceMeters: number;
      durationSeconds: number;
      startLocation: { lat: number; lng: number };
      endLocation: { lat: number; lng: number };
    }>;
  }>;
  waypointCoordinates: Array<{ lat: number; lng: number; name: string }>;
}

interface RouteResponse {
  success: boolean;
  data?: RouteData;
  routes?: RouteData[];
  error?: string;
}

// Auth validation helper
async function validateAuth(req: Request): Promise<{ user: any; error: Response | null }> {
  const authHeader = req.headers.get('Authorization');
  if (!authHeader) {
    return {
      user: null,
      error: new Response(
        JSON.stringify({ success: false, error: 'Authorization required' }),
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
        JSON.stringify({ success: false, error: 'Invalid or expired token' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    };
  }

  return { user, error: null };
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const { user, error: authError } = await validateAuth(req);
    if (authError) return authError;

    console.log('Authenticated user:', user.id);

    const GOOGLE_MAPS_API_KEY = Deno.env.get('GOOGLE_MAPS_API_KEY');
    if (!GOOGLE_MAPS_API_KEY) {
      console.error('GOOGLE_MAPS_API_KEY not configured');
      return new Response(
        JSON.stringify({ success: false, error: 'Google Maps API key not configured' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    const body: RouteRequest = await req.json();
    console.log('Route request received:', JSON.stringify(body));

    const { origin, destination, waypoints = [], alternatives = false } = body;

    if (!origin?.lat || !origin?.lng || !destination?.lat || !destination?.lng) {
      console.error('Invalid origin or destination coordinates');
      return new Response(
        JSON.stringify({ success: false, error: 'Origin and destination coordinates are required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Build the Directions API URL
    const originStr = `${origin.lat},${origin.lng}`;
    const destStr = `${destination.lat},${destination.lng}`;
    
    let url = `https://maps.googleapis.com/maps/api/directions/json?origin=${originStr}&destination=${destStr}&mode=driving&key=${GOOGLE_MAPS_API_KEY}`;

    // Add waypoints if provided
    if (waypoints.length > 0) {
      const waypointsStr = waypoints.map(wp => `${wp.lat},${wp.lng}`).join('|');
      url += `&waypoints=${encodeURIComponent(waypointsStr)}`;
    }

    // Request alternative routes if specified
    if (alternatives) {
      url += '&alternatives=true';
    }

    console.log('Calling Google Maps Directions API with alternatives:', alternatives);
    const response = await fetch(url);
    const data = await response.json();

    console.log('Google Maps API response status:', data.status, 'Routes found:', data.routes?.length || 0);

    if (data.status !== 'OK') {
      console.error('Google Maps API error:', data.status, data.error_message);
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: `Google Maps API error: ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}` 
        }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    if (!data.routes || data.routes.length === 0) {
      console.error('No route found in response');
      return new Response(
        JSON.stringify({ success: false, error: 'No route found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Process all routes
    const processedRoutes: RouteData[] = data.routes.map((route: any, index: number) => {
      let totalDistanceMeters = 0;
      let totalDurationSeconds = 0;
      const waypointCoords: Array<{ lat: number; lng: number; name: string }> = [];
      
      const legs = route.legs.map((leg: any, legIndex: number) => {
        totalDistanceMeters += leg.distance?.value || 0;
        totalDurationSeconds += leg.duration?.value || 0;
        
        // Extract step-by-step waypoints for this route
        const steps = (leg.steps || []).map((step: any) => {
          // Add intermediate waypoints from steps
          if (step.start_location) {
            waypointCoords.push({
              lat: step.start_location.lat,
              lng: step.start_location.lng,
              name: step.html_instructions?.replace(/<[^>]*>/g, '') || `Step ${waypointCoords.length + 1}`
            });
          }
          
          return {
            instruction: step.html_instructions?.replace(/<[^>]*>/g, '') || '',
            distanceMeters: step.distance?.value || 0,
            durationSeconds: step.duration?.value || 0,
            startLocation: {
              lat: step.start_location?.lat || 0,
              lng: step.start_location?.lng || 0
            },
            endLocation: {
              lat: step.end_location?.lat || 0,
              lng: step.end_location?.lng || 0
            }
          };
        });

        return {
          startAddress: leg.start_address || '',
          endAddress: leg.end_address || '',
          distanceMeters: leg.distance?.value || 0,
          durationSeconds: leg.duration?.value || 0,
          steps
        };
      });

      // Deduplicate waypoints based on proximity (within 100m)
      const uniqueWaypoints = waypointCoords.filter((wp, i, arr) => {
        if (i === 0) return true;
        const prev = arr[i - 1];
        const distance = Math.sqrt(
          Math.pow((wp.lat - prev.lat) * 111000, 2) + 
          Math.pow((wp.lng - prev.lng) * 111000 * Math.cos(wp.lat * Math.PI / 180), 2)
        );
        return distance > 500; // Keep waypoints more than 500m apart
      });

      return {
        encodedPolyline: route.overview_polyline?.points || '',
        totalDistanceMeters,
        totalDurationSeconds,
        routeSummary: route.summary || `Route ${index + 1}`,
        routeIndex: index,
        legs,
        waypointCoordinates: uniqueWaypoints.slice(0, 50) // Limit to 50 waypoints
      };
    });

    console.log('Processed routes:', processedRoutes.length, processedRoutes.map(r => ({
      index: r.routeIndex,
      summary: r.routeSummary,
      distance: r.totalDistanceMeters,
      waypoints: r.waypointCoordinates.length
    })));

    // Return multiple routes if requested, otherwise single route for backward compatibility
    const result: RouteResponse = alternatives 
      ? {
          success: true,
          routes: processedRoutes
        }
      : {
          success: true,
          data: processedRoutes[0]
        };

    return new Response(
      JSON.stringify(result),
      { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );

  } catch (error) {
    console.error('Error in google-maps-route function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
