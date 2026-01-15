import "https://deno.land/x/xhr@0.1.0/mod.ts";
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Telenity API Configuration
const SMARTTRAIL_BASE_URL = 'https://smarttrail.telenity.com/trail-rest';
const TELENITY_CONSENT_BASE_URL = 'https://india-agw.telenity.com';
const TELENITY_LOCATION_ACCURACY = '1000';

interface TokenData {
  token_type: string;
  token_value: string;
  expires_at: string;
}

interface ImportResponse {
  successList: Array<{
    firstName: string;
    lastName: string;
    msisdn: string;
    isTracked: boolean;
    entityId: number;
  }>;
  failureList: Array<any>;
}

interface ConsentCheckResponse {
  Consent: {
    status: string;
  };
}

interface LocationResponse {
  latitude: number;
  longitude: number;
  accuracy: number;
  timestamp: string;
  detailedAddress?: string;
  entityId?: number;
  raw?: any;
}

/**
 * Get stored token from database, auto-refresh if expired
 */
async function getStoredToken(supabase: any, tokenType: 'authentication' | 'access'): Promise<string> {
  console.log(`Fetching ${tokenType} token from database...`);
  
  const { data, error } = await supabase
    .from('integration_tokens')
    .select('token_value, expires_at')
    .eq('token_type', tokenType)
    .single();

  if (error || !data) {
    console.error(`Token not found for type: ${tokenType}`, error);
    // Try to refresh the token instead of failing immediately
    console.log(`Attempting to create new ${tokenType} token...`);
    try {
      const refreshedToken = await autoRefreshToken(supabase, tokenType);
      return refreshedToken;
    } catch (refreshError: any) {
      console.error(`Failed to create ${tokenType} token:`, refreshError.message);
      throw new Error(`${tokenType} token not found and refresh failed. Please check Telenity configuration.`);
    }
  }

  // Check if token is expired or will expire in next 2 minutes
  const expiresAt = new Date(data.expires_at);
  const bufferTime = 2 * 60 * 1000; // 2 minutes buffer
  const now = Date.now();
  
  console.log(`Token ${tokenType}: expires at ${expiresAt.toISOString()}, current time: ${new Date(now).toISOString()}`);
  
  if (expiresAt.getTime() - bufferTime < now) {
    console.log(`${tokenType} token expired or expiring soon, attempting auto-refresh...`);
    
    try {
      const refreshedToken = await autoRefreshToken(supabase, tokenType);
      return refreshedToken;
    } catch (refreshError: any) {
      console.error(`Auto-refresh failed for ${tokenType}:`, refreshError.message);
      throw new Error(`${tokenType} token has expired and refresh failed. Please check Telenity configuration.`);
    }
  }

  console.log(`Using existing ${tokenType} token (valid)`);
  return data.token_value;
}

/**
 * Auto-refresh token when expired
 */
async function autoRefreshToken(supabase: any, tokenType: 'authentication' | 'access'): Promise<string> {
  console.log(`Starting auto-refresh for ${tokenType} token...`);
  
  if (tokenType === 'authentication') {
    const authorizationToken = Deno.env.get('TELENITY_AUTH_TOKEN');
    if (!authorizationToken) {
      console.error('TELENITY_AUTH_TOKEN environment variable not set');
      throw new Error('TELENITY_AUTH_TOKEN not configured. Please set up the Telenity integration.');
    }
    
    console.log('Refreshing authentication token from Telenity Smarttrail API...');
    const response = await fetch('https://smarttrail.telenity.com/trail-rest/login', {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Basic ${authorizationToken}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Auth token refresh failed:', response.status, errorText);
      throw new Error(`Auth token refresh failed: ${response.status}. Please verify TELENITY_AUTH_TOKEN is correct.`);
    }

    const tokenData = await response.json();
    if (!tokenData.token) {
      console.error('No token in response:', tokenData);
      throw new Error('Invalid response from Telenity API - no token returned');
    }
    
    const expiresAt = new Date(Date.now() + 6 * 60 * 60 * 1000).toISOString();

    const { error: upsertError } = await supabase
      .from('integration_tokens')
      .upsert({
        token_type: 'authentication',
        token_value: tokenData.token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, { onConflict: 'token_type' });

    if (upsertError) {
      console.error('Error storing authentication token:', upsertError);
      // Still return the token even if storage fails
    }

    console.log('Authentication token auto-refreshed successfully, expires at:', expiresAt);
    return tokenData.token;
    
  } else {
    const consentAuthToken = Deno.env.get('TELENITY_CONSENT_AUTH_TOKEN');
    if (!consentAuthToken) {
      console.error('TELENITY_CONSENT_AUTH_TOKEN environment variable not set');
      throw new Error('TELENITY_CONSENT_AUTH_TOKEN not configured. Please set up the Telenity consent integration.');
    }
    
    console.log('Refreshing access token from Telenity OAuth API...');
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
      const errorText = await response.text();
      console.error('Access token refresh failed:', response.status, errorText);
      throw new Error(`Access token refresh failed: ${response.status}. Please verify TELENITY_CONSENT_AUTH_TOKEN is correct.`);
    }

    const tokenData = await response.json();
    if (!tokenData.access_token) {
      console.error('No access_token in response:', tokenData);
      throw new Error('Invalid response from Telenity OAuth API - no access_token returned');
    }
    
    const expiresAt = new Date(Date.now() + 30 * 60 * 1000).toISOString();

    const { error: upsertError } = await supabase
      .from('integration_tokens')
      .upsert({
        token_type: 'access',
        token_value: tokenData.access_token,
        expires_at: expiresAt,
        updated_at: new Date().toISOString()
      }, { onConflict: 'token_type' });

    if (upsertError) {
      console.error('Error storing access token:', upsertError);
      // Still return the token even if storage fails
    }

    console.log('Access token auto-refreshed successfully, expires at:', expiresAt);
    return tokenData.access_token;
  }
}

/**
 * Import driver via Smarttrail API (sends consent SMS)
 * Uses authentication_token from DB
 */
async function importDriver(
  authToken: string, 
  msisdn: string, 
  firstName: string, 
  lastName: string
): Promise<ImportResponse> {
  console.log('Importing driver:', { msisdn, firstName, lastName });
  
  const response = await fetch(`${SMARTTRAIL_BASE_URL}/entities/import`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${authToken}`,
    },
    body: JSON.stringify({
      entityImportList: [
        {
          firstName,
          lastName,
          msisdn
        }
      ]
    }),
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Import driver error:', error);
    throw new Error(`Failed to import driver: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log('Import response:', data);
  return data;
}

/**
 * Check consent status via Consent API
 * Uses access_token from DB
 */
async function checkConsentStatus(accessToken: string, msisdn: string): Promise<ConsentCheckResponse> {
  console.log('Checking consent for MSISDN:', msisdn);
  
  // Format: 91{mobile_number}
  const formattedMsisdn = msisdn.startsWith('91') ? msisdn : `91${msisdn}`;
  
  const response = await fetch(
    `${TELENITY_CONSENT_BASE_URL}/apigw/NOFBconsent/v1/NOFBconsent?Address=${formattedMsisdn}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
        'Accept': '*/*',
        'Authorization': `Bearer ${accessToken}`,
      },
    }
  );

  if (!response.ok) {
    const error = await response.text();
    console.error('Consent check error:', error);
    throw new Error(`Failed to check consent: ${response.status} - ${error}`);
  }

  const data = await response.json();
  console.log('Consent check response:', data);
  return data;
}

/**
 * Search entity by MSISDN
 */
async function searchEntity(authToken: string, msisdn: string): Promise<any> {
  const response = await fetch(`${SMARTTRAIL_BASE_URL}/entities/search?msisdn=${encodeURIComponent(msisdn)}`, {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${authToken}`,
      'Content-Type': 'application/json',
    },
  });

  if (!response.ok) {
    const error = await response.text();
    console.error('Search entity error:', error);
    throw new Error(`Failed to search entity: ${response.status}`);
  }

  return await response.json();
}

/**
 * Get current location using msisdnList API
 * API: GET https://smarttrail.telenity.com/trail-rest/location/msisdnList/91{mobile_no}?lastResult=true
 */
async function getLocation(authToken: string, msisdn: string): Promise<LocationResponse> {
  // Format MSISDN: ensure it starts with 91
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
  
  // Parse the msisdnList response format
  // Response: { terminalLocation: [{ currentLocation: { latitude, longitude, timestamp, detailedAddress }, entityId, ... }], errorMessageList: [] }
  if (data.terminalLocation && data.terminalLocation.length > 0) {
    const terminal = data.terminalLocation[0];
    
    // Check if location was retrieved successfully
    if (terminal.locationRetrievalStatus !== 'Retrieved' || terminal.locationResultStatus !== 0) {
      throw new Error(`Location not available: ${terminal.locationResultStatusText || terminal.locationRetrievalStatus}`);
    }
    
    const currentLoc = terminal.currentLocation;
    if (!currentLoc) {
      throw new Error('No current location data in response');
    }
    
    return {
      latitude: currentLoc.latitude,
      longitude: currentLoc.longitude,
      accuracy: 0, // Not provided in this API
      timestamp: currentLoc.timestamp || new Date().toISOString(),
      detailedAddress: currentLoc.detailedAddress,
      entityId: terminal.entityId,
      raw: data
    };
  } else if (data.errorMessageList && data.errorMessageList.length > 0) {
    throw new Error(`Location API error: ${data.errorMessageList.join(', ')}`);
  }
  
  throw new Error('Unexpected location API response format');
}

/**
 * Split full name into first and last name
 */
function splitName(fullName: string): { firstName: string; lastName: string } {
  const parts = fullName.trim().split(/\s+/);
  if (parts.length === 1) {
    return { firstName: parts[0], lastName: '' };
  }
  return {
    firstName: parts[0],
    lastName: parts.slice(1).join(' ')
  };
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

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const path = url.pathname.split('/').pop();

    // Determine required permission based on endpoint
    // import, check-consent, search require update permission (modify consent status)
    // location, token-status require view permission (read-only)
    const requiredAction = ['import', 'check-consent', 'search'].includes(path || '') ? 'update' : 'view';
    
    // Validate authentication with permission check
    const { user, error: authError } = await validateAuth(req, 'trips', requiredAction);
    if (authError) return authError;

    console.log('Authenticated user:', user.id);

    // Initialize Supabase client with service role for DB operations
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check if Telenity tracking is enabled (skip for token-status endpoint)
    if (path !== 'token-status') {
      const { data: enableSetting } = await supabase
        .from('tracking_settings')
        .select('setting_value')
        .eq('setting_key', 'enable_telenity_tracking')
        .single();
      
      if (enableSetting?.setting_value === 'false') {
        return new Response(
          JSON.stringify({ error: 'Telenity tracking is disabled. Enable it in Settings > Integrations.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        );
      }
    }

    let result: any;

    switch (path) {
      case 'import': {
        // Import driver and trigger consent SMS (or check existing consent)
        const body = await req.json();
        const { msisdn, driverName, driverId, tripId } = body;

        if (!msisdn || !driverName) {
          throw new Error('msisdn and driverName are required');
        }

        // Get tokens from DB
        const authToken = await getStoredToken(supabase, 'authentication');
        
        // Split driver name
        const { firstName, lastName } = splitName(driverName);
        
        // Format MSISDN (add 91 if not present)
        const formattedMsisdn = msisdn.startsWith('91') ? msisdn : `91${msisdn}`;

        const importResult = await importDriver(authToken, formattedMsisdn, firstName, lastName);

        let entityId: number | null = null;
        let alreadyExists = false;

        // Check success list first
        if (importResult.successList?.length > 0) {
          entityId = importResult.successList[0].entityId;
        } 
        // Check failure list - driver might already exist (this is OK)
        else if (importResult.failureList?.length > 0) {
          const failure = importResult.failureList[0];
          // If driver already exists, use their entityId
          if (failure.errorDesc?.includes('already exists') && failure.entityId) {
            entityId = failure.entityId;
            alreadyExists = true;
            console.log('Driver already exists in Telenity, using existing entityId:', entityId);
          } else {
            throw new Error(`Import failed: ${failure.errorDesc || 'Unknown error'}`);
          }
        } else {
          throw new Error('Import did not return any result');
        }

        // If driver already exists, check their current consent status
        let currentConsentStatus = 'pending';
        let consentCheckResult = null;
        
        if (alreadyExists) {
          try {
            const accessToken = await getStoredToken(supabase, 'access');
            consentCheckResult = await checkConsentStatus(accessToken, formattedMsisdn);
            const rawStatus = consentCheckResult.Consent?.status || 'UNKNOWN';
            currentConsentStatus = rawStatus === 'ALLOWED' ? 'allowed' : 
                                   rawStatus === 'NOT_ALLOWED' ? 'not_allowed' : 
                                   rawStatus === 'EXPIRED' ? 'expired' : 'pending';
            console.log('Existing driver consent status:', currentConsentStatus);
          } catch (consentError) {
            console.error('Error checking existing consent:', consentError);
            // Continue with pending status if check fails
          }
        }

        // Check for existing consent record for this driver in our DB
        const { data: existingConsent } = await supabase
          .from('driver_consents')
          .select('*')
          .eq('driver_id', driverId)
          .order('created_at', { ascending: false })
          .limit(1)
          .single();

        let consentData;

        if (existingConsent) {
          // Update existing consent record with current status
          const updateData: any = {
            consent_status: currentConsentStatus,
            entity_id: entityId.toString(),
            trip_id: tripId || existingConsent.trip_id,
            telenity_response: consentCheckResult || importResult,
            updated_at: new Date().toISOString()
          };

          // If consent is allowed, set received time
          if (currentConsentStatus === 'allowed') {
            updateData.consent_received_at = existingConsent.consent_received_at || new Date().toISOString();
            updateData.consent_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          } else if (!alreadyExists) {
            // New import - set requested time
            updateData.consent_requested_at = new Date().toISOString();
          }

          const { data: updated, error: updateError } = await supabase
            .from('driver_consents')
            .update(updateData)
            .eq('id', existingConsent.id)
            .select()
            .single();

          if (updateError) {
            console.error('Error updating consent:', updateError);
            throw new Error('Failed to update consent record');
          }
          consentData = updated;
        } else {
          // Create new consent record
          const insertData: any = {
            driver_id: driverId,
            trip_id: tripId || null,
            msisdn: formattedMsisdn,
            consent_status: currentConsentStatus,
            entity_id: entityId.toString(),
            telenity_response: consentCheckResult || importResult
          };

          // Set appropriate timestamps based on status
          if (currentConsentStatus === 'allowed') {
            insertData.consent_received_at = new Date().toISOString();
            insertData.consent_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          } else {
            insertData.consent_requested_at = new Date().toISOString();
          }

          const { data: inserted, error: insertError } = await supabase
            .from('driver_consents')
            .insert(insertData)
            .select()
            .single();

          if (insertError) {
            console.error('Error storing consent:', insertError);
            throw new Error('Failed to store consent record');
          }
          consentData = inserted;
        }

        // Log to consent_logs table
        const consentLogStatus = currentConsentStatus === 'allowed' ? 'granted' : 
                                 currentConsentStatus === 'not_allowed' ? 'revoked' : 'requested';
        
        await supabase
          .from('consent_logs')
          .insert({
            driver_id: driverId,
            trip_id: tripId || null,
            status: consentLogStatus,
            requested_at: new Date().toISOString(),
            granted_at: currentConsentStatus === 'allowed' ? new Date().toISOString() : null,
            expires_at: currentConsentStatus === 'allowed' 
              ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() 
              : null
          });
        
        console.log('Consent logged to consent_logs table');

        result = { 
          entityId,
          status: currentConsentStatus,
          alreadyExists,
          consentRecord: consentData,
          message: alreadyExists 
            ? (currentConsentStatus === 'allowed' 
                ? 'Driver already has active consent' 
                : 'Driver exists, consent SMS was sent previously')
            : 'Consent SMS sent to driver'
        };
        break;
      }

      case 'check-consent': {
        // Check consent status using access token
        const entityId = url.searchParams.get('entityId');
        const consentId = url.searchParams.get('consentId');
        const msisdn = url.searchParams.get('msisdn');

        if (!msisdn) {
          throw new Error('msisdn is required for consent check');
        }

        // Get access token from DB (used for consent check API)
        const accessToken = await getStoredToken(supabase, 'access');
        
        const consentResult = await checkConsentStatus(accessToken, msisdn);
        const status = consentResult.Consent?.status || 'UNKNOWN';

        // Map status to our enum
        const mappedStatus = status === 'ALLOWED' ? 'allowed' : 
                            status === 'NOT_ALLOWED' ? 'not_allowed' : 
                            status === 'EXPIRED' ? 'expired' : 'pending';

        // Update consent record in database if consentId provided
        if (consentId) {
          // Get existing consent to find driver_id
          const { data: existingConsent } = await supabase
            .from('driver_consents')
            .select('driver_id, trip_id')
            .eq('id', consentId)
            .single();

          const updateData: any = {
            consent_status: mappedStatus,
            telenity_response: consentResult,
            updated_at: new Date().toISOString()
          };

          if (mappedStatus === 'allowed') {
            updateData.consent_received_at = new Date().toISOString();
            // Set expiry to 24 hours from now
            updateData.consent_expires_at = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
          }
          
          await supabase
            .from('driver_consents')
            .update(updateData)
            .eq('id', consentId);

          // Log consent status change to consent_logs
          if (existingConsent) {
            const logStatus = mappedStatus === 'allowed' ? 'granted' : 
                              mappedStatus === 'not_allowed' ? 'revoked' : 
                              mappedStatus === 'expired' ? 'expired' : 'requested';
            
            await supabase
              .from('consent_logs')
              .insert({
                driver_id: existingConsent.driver_id,
                trip_id: existingConsent.trip_id,
                status: logStatus,
                requested_at: new Date().toISOString(),
                granted_at: mappedStatus === 'allowed' ? new Date().toISOString() : null,
                expires_at: mappedStatus === 'allowed' 
                  ? new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString() 
                  : null
              });
            
            console.log('Consent status change logged to consent_logs');
          }
        }

        result = { 
          status: mappedStatus,
          rawStatus: status,
          raw: consentResult 
        };
        break;
      }

      case 'search': {
        // Search entity by MSISDN
        const msisdn = url.searchParams.get('msisdn');

        if (!msisdn) {
          throw new Error('msisdn is required');
        }

        const authToken = await getStoredToken(supabase, 'authentication');
        result = await searchEntity(authToken, msisdn);
        break;
      }

      case 'location': {
        // Get current location
        const msisdn = url.searchParams.get('msisdn');
        const tripId = url.searchParams.get('tripId');
        const driverId = url.searchParams.get('driverId');

        if (!msisdn) {
          throw new Error('msisdn is required');
        }

        const authToken = await getStoredToken(supabase, 'authentication');
        const locationResult = await getLocation(authToken, msisdn);

        // Store location in database if tripId provided
        if (tripId) {
          await supabase
            .from('location_history')
            .insert({
              trip_id: tripId,
              driver_id: driverId || null,
              latitude: locationResult.latitude,
              longitude: locationResult.longitude,
              accuracy_meters: locationResult.accuracy,
              source: 'telenity',
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
                  speed: 0, // SIM tracking doesn't provide speed
                  timestamp: locationResult.timestamp,
                  driverId: driverId || null,
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

      case 'token-status': {
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
    console.error('Telenity tracking error:', error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
