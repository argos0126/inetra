import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface SnapPoint {
  latitude: number;
  longitude: number;
}

interface SnappedPoint {
  location: {
    latitude: number;
    longitude: number;
  };
  originalIndex?: number;
  placeId: string;
}

interface RoadsApiResponse {
  snappedPoints?: SnappedPoint[];
  warningMessage?: string;
  error?: {
    message: string;
    code: number;
  };
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
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    // Validate authentication
    const { user, error: authError } = await validateAuth(req);
    if (authError) return authError;

    console.log('Authenticated user:', user.id);

    const { points } = await req.json() as { points: SnapPoint[] };

    if (!points || !Array.isArray(points) || points.length === 0) {
      return new Response(
        JSON.stringify({ error: "Points array is required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const apiKey = Deno.env.get("GOOGLE_MAPS_API_KEY");
    if (!apiKey) {
      console.error("GOOGLE_MAPS_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "API key not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Google Roads API has a limit of 100 points per request
    const MAX_POINTS_PER_REQUEST = 100;
    const allSnappedPoints: SnappedPoint[] = [];
    
    // Process in batches
    for (let i = 0; i < points.length; i += MAX_POINTS_PER_REQUEST) {
      const batch = points.slice(i, i + MAX_POINTS_PER_REQUEST);
      const pathParam = batch.map(p => `${p.latitude},${p.longitude}`).join("|");
      
      const url = `https://roads.googleapis.com/v1/snapToRoads?path=${encodeURIComponent(pathParam)}&interpolate=true&key=${apiKey}`;
      
      console.log(`Snapping batch ${Math.floor(i / MAX_POINTS_PER_REQUEST) + 1} with ${batch.length} points`);
      
      const response = await fetch(url);
      const data: RoadsApiResponse = await response.json();
      
      if (data.error) {
        console.error("Roads API error:", data.error);
        // Continue with remaining batches, don't fail completely
        continue;
      }
      
      if (data.snappedPoints) {
        // Adjust original indices for batched processing
        const adjustedPoints = data.snappedPoints.map(sp => ({
          ...sp,
          originalIndex: sp.originalIndex !== undefined ? sp.originalIndex + i : undefined
        }));
        allSnappedPoints.push(...adjustedPoints);
      }
      
      if (data.warningMessage) {
        console.warn("Roads API warning:", data.warningMessage);
      }
    }

    if (allSnappedPoints.length === 0) {
      console.log("No snapped points returned, returning original points");
      // Return in same flat format as success case for consistency
      return new Response(
        JSON.stringify({
          snappedPoints: points.map((p, i) => ({
            latitude: p.latitude,
            longitude: p.longitude,
            originalIndex: i,
            placeId: ""
          })),
          encodedPolyline: null,
          success: false,
          message: "Could not snap points to roads, returning original points"
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Encode the snapped points as a polyline for efficient transfer
    const encodedPolyline = encodePolyline(
      allSnappedPoints.map(sp => [sp.location.latitude, sp.location.longitude])
    );

    console.log(`Successfully snapped ${points.length} points to ${allSnappedPoints.length} road points`);

    return new Response(
      JSON.stringify({
        snappedPoints: allSnappedPoints.map(sp => ({
          latitude: sp.location.latitude,
          longitude: sp.location.longitude,
          originalIndex: sp.originalIndex,
          placeId: sp.placeId
        })),
        encodedPolyline,
        success: true,
        originalCount: points.length,
        snappedCount: allSnappedPoints.length
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
    
  } catch (error) {
    console.error("Error in google-maps-snap-to-roads:", error);
    return new Response(
      JSON.stringify({ error: error.message || "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});

// Polyline encoding algorithm (Google's format)
function encodePolyline(coordinates: [number, number][]): string {
  let encoded = "";
  let prevLat = 0;
  let prevLng = 0;

  for (const [lat, lng] of coordinates) {
    const latInt = Math.round(lat * 1e5);
    const lngInt = Math.round(lng * 1e5);

    encoded += encodeSignedNumber(latInt - prevLat);
    encoded += encodeSignedNumber(lngInt - prevLng);

    prevLat = latInt;
    prevLng = lngInt;
  }

  return encoded;
}

function encodeSignedNumber(num: number): string {
  let sgn_num = num << 1;
  if (num < 0) {
    sgn_num = ~sgn_num;
  }
  return encodeNumber(sgn_num);
}

function encodeNumber(num: number): string {
  let encoded = "";
  while (num >= 0x20) {
    encoded += String.fromCharCode((0x20 | (num & 0x1f)) + 63);
    num >>= 5;
  }
  encoded += String.fromCharCode(num + 63);
  return encoded;
}
