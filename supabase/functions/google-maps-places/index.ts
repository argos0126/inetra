import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface PlaceAutocompleteRequest {
  input: string;
  sessionToken?: string;
}

interface PlaceDetailsRequest {
  placeId: string;
  sessionToken?: string;
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

    const body = await req.json();
    const url = new URL(req.url);
    const action = url.searchParams.get('action') || body.action;

    if (action === 'autocomplete') {
      // Place Autocomplete
      const { input, sessionToken } = body as PlaceAutocompleteRequest;

      if (!input || input.trim().length < 3) {
        return new Response(
          JSON.stringify({ success: true, predictions: [] }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Autocomplete request for:', input);

      let apiUrl = `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(input)}&components=country:in&key=${GOOGLE_MAPS_API_KEY}`;
      
      if (sessionToken) {
        apiUrl += `&sessiontoken=${sessionToken}`;
      }

      const response = await fetch(apiUrl);
      const data = await response.json();

      console.log('Autocomplete status:', data.status);

      if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
        console.error('Places Autocomplete error:', data.status, data.error_message);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Places API error: ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const predictions = (data.predictions || []).map((p: any) => ({
        placeId: p.place_id,
        description: p.description,
        mainText: p.structured_formatting?.main_text || '',
        secondaryText: p.structured_formatting?.secondary_text || '',
      }));

      return new Response(
        JSON.stringify({ success: true, predictions }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else if (action === 'details') {
      // Place Details
      const { placeId, sessionToken } = body as PlaceDetailsRequest;

      if (!placeId) {
        return new Response(
          JSON.stringify({ success: false, error: 'placeId is required' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      console.log('Details request for placeId:', placeId);

      let apiUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&fields=formatted_address,address_components,geometry&key=${GOOGLE_MAPS_API_KEY}`;
      
      if (sessionToken) {
        apiUrl += `&sessiontoken=${sessionToken}`;
      }

      const response = await fetch(apiUrl);
      const data = await response.json();

      console.log('Details status:', data.status);

      if (data.status !== 'OK') {
        console.error('Place Details error:', data.status, data.error_message);
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Places API error: ${data.status}${data.error_message ? ` - ${data.error_message}` : ''}` 
          }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }

      const place = data.result;
      const components = place.address_components || [];
      
      const getComponent = (types: string[]): string => {
        const component = components.find((c: any) => types.some((t: string) => c.types.includes(t)));
        return component?.long_name || '';
      };

      const placeData = {
        address: place.formatted_address || '',
        city: getComponent(['locality', 'administrative_area_level_3']),
        district: getComponent(['administrative_area_level_2']),
        state: getComponent(['administrative_area_level_1']),
        pincode: getComponent(['postal_code']),
        zone: getComponent(['sublocality_level_1', 'sublocality']),
        latitude: place.geometry?.location?.lat || 0,
        longitude: place.geometry?.location?.lng || 0,
      };

      console.log('Place data extracted:', placeData);

      return new Response(
        JSON.stringify({ success: true, place: placeData }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );

    } else {
      return new Response(
        JSON.stringify({ success: false, error: 'Invalid action. Use ?action=autocomplete or ?action=details' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

  } catch (error) {
    console.error('Error in google-maps-places function:', error);
    return new Response(
      JSON.stringify({ success: false, error: error.message || 'Internal server error' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});
