import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Telenity API Endpoints
const SMARTTRAIL_LOGIN_URL = 'https://smarttrail.telenity.com/trail-rest/login';
const CONSENT_AUTH_URL = 'https://india-agw.telenity.com/oauth/token';

interface AuthTokenResponse {
  username: string;
  userRole: string;
  token: string;
}

interface AccessTokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
}

// Auth validation helper - allows service role for cron jobs, requires permission for manual calls
async function validateAuth(req: Request, allowServiceRole: boolean = false): Promise<{ user: any; supabaseClient: any; error: Response | null }> {
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

  // Check if using service role key (for cron jobs)
  const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  const token = authHeader.replace('Bearer ', '');
  
  if (allowServiceRole && token === serviceRoleKey) {
    console.log('Authenticated via service role key (cron job)');
    return { user: { id: 'cron-job', role: 'service_role' }, supabaseClient: null, error: null };
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

  // Check for superadmin or trips:view permission for user-based calls
  const { data: isSuperadmin } = await supabaseClient.rpc('is_superadmin', { _user_id: user.id });
  
  if (!isSuperadmin) {
    // Check for trips:view permission (token management is part of tracking)
    const { data: hasPermission } = await supabaseClient.rpc('has_permission', {
      _user_id: user.id,
      _resource: 'trips',
      _action: 'view'
    });

    if (!hasPermission) {
      return {
        user: null,
        supabaseClient: null,
        error: new Response(
          JSON.stringify({ error: "You don't have permission to manage tracking tokens" }),
          { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      };
    }
  }

  return { user, supabaseClient, error: null };
}

/**
 * Refresh Authentication Token (expires in 6 hours)
 * Used for Import-API and Location-API
 */
async function refreshAuthenticationToken(authorizationToken: string): Promise<AuthTokenResponse> {
  console.log('Refreshing authentication token from Smarttrail...');
  
  const response = await fetch(SMARTTRAIL_LOGIN_URL, {
    method: 'GET',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Basic ${authorizationToken}`,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Authentication token refresh failed:', error);
    throw new Error(`Failed to refresh authentication token: ${response.status}`);
  }

  const data = await response.json();
  console.log('Authentication token refreshed successfully for user:', data.username);
  return data;
}

/**
 * Refresh Access Token (expires in 30 minutes)
 * Used for Consent-Check API
 */
async function refreshAccessToken(consentAuthToken: string): Promise<AccessTokenResponse> {
  console.log('Refreshing access token from Consent Auth API...');
  console.log('Using token (first 20 chars):', consentAuthToken.substring(0, 20) + '...');
  
  // OAuth token endpoint typically uses form-urlencoded
  const response = await fetch(`${CONSENT_AUTH_URL}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'Accept': '*/*',
      'Authorization': `Basic ${consentAuthToken}`,
    },
    body: 'grant_type=client_credentials',
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Access token refresh failed:', response.status, error);
    throw new Error(`Failed to refresh access token: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log('Access token refreshed successfully, expires in:', data.expires_in, 'seconds');
  return data;
}

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();
    
    // Allow service role for refresh endpoints (cron jobs), check permission for status
    const allowServiceRole = path !== 'status';
    const { user, error: authError } = await validateAuth(req, allowServiceRole);
    if (authError) return authError;

    console.log('Authenticated user:', user.id);

    // Get base tokens from environment
    const authorizationToken = Deno.env.get('TELENITY_AUTH_TOKEN');
    const consentAuthToken = Deno.env.get('TELENITY_CONSENT_AUTH_TOKEN');

    // Initialize Supabase client with service role for DB operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    let result: any;

    switch (path) {
      case 'refresh-authentication': {
        if (!authorizationToken) {
          throw new Error('TELENITY_AUTH_TOKEN not configured');
        }

        const tokenData = await refreshAuthenticationToken(authorizationToken);
        
        // Token expires in 6 hours
        const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

        // Upsert token in database (replaces existing)
        const { data, error } = await supabase
          .from('integration_tokens')
          .upsert({
            token_type: 'authentication',
            token_value: tokenData.token,
            expires_at: expiresAt,
            updated_at: new Date().toISOString()
          }, { onConflict: 'token_type' })
          .select()
          .single();

        if (error) {
          console.error('Failed to store authentication token:', error);
          throw error;
        }

        result = { 
          success: true, 
          token_type: 'authentication',
          expires_at: expiresAt,
          username: tokenData.username 
        };
        break;
      }

      case 'refresh-access': {
        if (!consentAuthToken) {
          throw new Error('TELENITY_CONSENT_AUTH_TOKEN not configured');
        }

        const tokenData = await refreshAccessToken(consentAuthToken);
        
        // Token expires in 30 minutes (expires_in is in seconds, typically 3600 but we use 30 min for safety)
        const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

        // Upsert token in database
        const { data, error } = await supabase
          .from('integration_tokens')
          .upsert({
            token_type: 'access',
            token_value: tokenData.access_token,
            expires_at: expiresAt,
            updated_at: new Date().toISOString()
          }, { onConflict: 'token_type' })
          .select()
          .single();

        if (error) {
          console.error('Failed to store access token:', error);
          throw error;
        }

        result = { 
          success: true, 
          token_type: 'access',
          expires_at: expiresAt 
        };
        break;
      }

      case 'refresh-all': {
        // Refresh both tokens
        const results = [];

        if (authorizationToken) {
          try {
            const authData = await refreshAuthenticationToken(authorizationToken);
            const authExpires = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();
            await supabase
              .from('integration_tokens')
              .upsert({
                token_type: 'authentication',
                token_value: authData.token,
                expires_at: authExpires,
                updated_at: new Date().toISOString()
              }, { onConflict: 'token_type' });
            results.push({ type: 'authentication', success: true, expires_at: authExpires });
          } catch (e: any) {
            results.push({ type: 'authentication', success: false, error: e.message });
          }
        }

        if (consentAuthToken) {
          try {
            const accessData = await refreshAccessToken(consentAuthToken);
            const accessExpires = new Date(Date.now() + 30 * 60 * 1000).toISOString();
            await supabase
              .from('integration_tokens')
              .upsert({
                token_type: 'access',
                token_value: accessData.access_token,
                expires_at: accessExpires,
                updated_at: new Date().toISOString()
              }, { onConflict: 'token_type' });
            results.push({ type: 'access', success: true, expires_at: accessExpires });
          } catch (e: any) {
            results.push({ type: 'access', success: false, error: e.message });
          }
        }

        result = { results };
        break;
      }

      case 'status': {
        // Get current token status
        const { data: tokens, error } = await supabase
          .from('integration_tokens')
          .select('token_type, expires_at, updated_at')
          .order('token_type');

        if (error) throw error;

        result = {
          tokens: tokens?.map(t => ({
            type: t.token_type,
            expires_at: t.expires_at,
            updated_at: t.updated_at,
            is_valid: new Date(t.expires_at) > new Date()
          })) || []
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
    console.error('Token refresh error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
