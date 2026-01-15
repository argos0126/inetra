import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const GOOGLE_MAPS_API_KEY = Deno.env.get("GOOGLE_MAPS_API_KEY");
    
    if (!GOOGLE_MAPS_API_KEY) {
      console.error("GOOGLE_MAPS_API_KEY not configured");
      return new Response(
        JSON.stringify({ error: "Maps API not configured" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Validate JWT token
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(
        JSON.stringify({ error: "Authorization required" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await supabaseClient.auth.getUser();
    
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Invalid or expired token" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { latitude, longitude, zoom = 15, width = 400, height = 200, radius } = await req.json();

    if (!latitude || !longitude) {
      return new Response(
        JSON.stringify({ error: "Latitude and longitude are required" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Build static map URL
    const params = new URLSearchParams({
      center: `${latitude},${longitude}`,
      zoom: String(zoom),
      size: `${width}x${height}`,
      maptype: "roadmap",
      markers: `color:red|${latitude},${longitude}`,
      key: GOOGLE_MAPS_API_KEY,
    });

    // Add circle path if radius is provided (approximate with polygon)
    if (radius && radius > 0) {
      // Create a simple circle representation using path
      const circlePoints = [];
      const numPoints = 36;
      const earthRadius = 6371000; // meters
      
      for (let i = 0; i <= numPoints; i++) {
        const angle = (i * 360) / numPoints;
        const radAngle = (angle * Math.PI) / 180;
        
        // Calculate offset in degrees
        const latOffset = (radius / earthRadius) * (180 / Math.PI);
        const lngOffset = (radius / (earthRadius * Math.cos((latitude * Math.PI) / 180))) * (180 / Math.PI);
        
        const pointLat = latitude + latOffset * Math.sin(radAngle);
        const pointLng = longitude + lngOffset * Math.cos(radAngle);
        
        circlePoints.push(`${pointLat.toFixed(6)},${pointLng.toFixed(6)}`);
      }
      
      params.append("path", `color:0x3b82f680|fillcolor:0x3b82f626|weight:2|${circlePoints.join("|")}`);
    }

    const staticMapUrl = `https://maps.googleapis.com/maps/api/staticmap?${params.toString()}`;

    // Fetch the static map image
    const mapResponse = await fetch(staticMapUrl);
    
    if (!mapResponse.ok) {
      const errorText = await mapResponse.text();
      console.error("Static Maps API error:", errorText);
      return new Response(
        JSON.stringify({ error: "Failed to generate map" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Return the image directly
    const imageBuffer = await mapResponse.arrayBuffer();
    
    return new Response(imageBuffer, {
      headers: {
        ...corsHeaders,
        "Content-Type": "image/png",
        "Cache-Control": "public, max-age=3600",
      },
    });
  } catch (error) {
    console.error("Static map error:", error);
    return new Response(
      JSON.stringify({ error: "Internal server error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
