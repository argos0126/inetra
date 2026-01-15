# Edge Functions Documentation

## Overview

Edge functions are serverless functions deployed on Supabase that handle external API integrations, background processing, and secure server-side operations.

## Available Functions

### telenity-token-refresh

Manages authentication tokens for Telenity SIM-based tracking APIs.

**Base URL:** `/functions/v1/telenity-token-refresh`

#### Endpoints

##### POST `/refresh-authentication`
Refreshes the Telenity authentication token (used for Import API, Location API).

**Response:**
```json
{
  "success": true,
  "token_type": "authentication",
  "expires_at": "2024-01-01T12:00:00Z"
}
```

##### POST `/refresh-access`
Refreshes the Telenity access token (used for Consent Check API).

**Response:**
```json
{
  "success": true,
  "token_type": "access",
  "expires_at": "2024-01-01T12:30:00Z"
}
```

##### POST `/refresh-all`
Refreshes both authentication and access tokens.

**Response:**
```json
{
  "success": true,
  "authentication": { "expires_at": "..." },
  "access": { "expires_at": "..." }
}
```

##### GET `/status`
Returns current token status and validity.

**Response:**
```json
{
  "tokens": [
    {
      "token_type": "authentication",
      "expires_at": "2024-01-01T12:00:00Z",
      "is_valid": true
    },
    {
      "token_type": "access",
      "expires_at": "2024-01-01T12:30:00Z",
      "is_valid": true
    }
  ]
}
```

#### Required Secrets
- `TELENITY_AUTH_TOKEN` - Base64 authorization token for Smarttrail
- `TELENITY_CONSENT_AUTH_TOKEN` - Base64 consent auth token

---

### telenity-tracking

Handles Telenity SIM-based tracking operations including driver import, consent management, and location retrieval.

**Base URL:** `/functions/v1/telenity-tracking`

#### Endpoints

##### POST `/import`
Imports a driver into Telenity and triggers consent SMS.

**Request Body:**
```json
{
  "msisdn": "919876543210",
  "firstName": "John",
  "lastName": "Doe",
  "driverId": "uuid",
  "tripId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "entity_id": "telenity-entity-id",
    "consent_id": "database-consent-id"
  }
}
```

##### GET `/check-consent`
Checks the consent status for a driver.

**Query Parameters:**
- `msisdn` (required) - Driver mobile number
- `consentId` (optional) - Database consent record ID
- `entityId` (optional) - Telenity entity ID

**Response:**
```json
{
  "success": true,
  "data": {
    "consent_status": "ALLOWED",
    "expires_at": "2024-01-01T12:00:00Z"
  }
}
```

##### GET `/search`
Searches for an entity by MSISDN.

**Query Parameters:**
- `msisdn` (required) - Mobile number to search

**Response:**
```json
{
  "success": true,
  "data": {
    "entity_id": "telenity-entity-id",
    "consent_status": "ALLOWED"
  }
}
```

##### GET `/location`
Gets the current location for a driver/trip.

**Query Parameters:**
- `msisdn` (required) - Driver mobile number
- `tripId` (optional) - Trip ID for logging
- `driverId` (optional) - Driver ID

**Response:**
```json
{
  "success": true,
  "data": {
    "latitude": 28.6139,
    "longitude": 77.2090,
    "timestamp": "2024-01-01T12:00:00Z",
    "accuracy": 50
  }
}
```

##### GET `/token-status`
Returns current Telenity token status.

#### Required Secrets
- `TELENITY_AUTH_TOKEN`
- `TELENITY_CONSENT_AUTH_TOKEN`
- `TELENITY_BASIC_TOKEN`

---

### wheelseye-tracking

Handles Wheelseye GPS tracking integration for vehicle location data.

**Base URL:** `/functions/v1/wheelseye-tracking`

#### Endpoints

##### GET `/location`
Gets current location for a vehicle.

**Query Parameters:**
- `vehicleNumber` (required) - Vehicle registration number
- `tripId` (optional) - Trip ID for logging

**Response:**
```json
{
  "success": true,
  "data": {
    "latitude": 28.6139,
    "longitude": 77.2090,
    "speed": 45,
    "heading": 180,
    "timestamp": "2024-01-01T12:00:00Z"
  }
}
```

##### GET `/history`
Gets location history for a vehicle.

**Query Parameters:**
- `vehicleNumber` (required) - Vehicle registration number
- `fromDate` (required) - Start date (ISO format)
- `toDate` (required) - End date (ISO format)

**Response:**
```json
{
  "success": true,
  "data": [
    {
      "latitude": 28.6139,
      "longitude": 77.2090,
      "speed": 45,
      "timestamp": "2024-01-01T12:00:00Z"
    }
  ]
}
```

##### POST `/bulk-location`
Gets current locations for multiple vehicles.

**Request Body:**
```json
{
  "vehicleNumbers": ["MH12AB1234", "DL01CD5678"],
  "tripId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "MH12AB1234": { "latitude": 28.6139, "longitude": 77.2090 },
    "DL01CD5678": { "latitude": 19.0760, "longitude": 72.8777 }
  }
}
```

#### Required Secrets
- `WHEELSEYE_ACCESS_TOKEN`

---

### google-maps-route

Calculates routes between locations using Google Maps Directions API.

**Base URL:** `/functions/v1/google-maps-route`

#### POST `/`

**Request Body:**
```json
{
  "origin": { "lat": 28.6139, "lng": 77.2090 },
  "destination": { "lat": 19.0760, "lng": 72.8777 },
  "waypoints": [
    { "lat": 23.0225, "lng": 72.5714 }
  ],
  "alternatives": false
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "distance": 1400000,
    "duration": 72000,
    "polyline": "encoded_polyline_string",
    "summary": "NH48",
    "waypoints": [
      {
        "location": { "lat": 28.6139, "lng": 77.2090 },
        "distance_from_start": 0,
        "duration_from_start": 0
      }
    ]
  }
}
```

#### Required Secrets
- `GOOGLE_MAPS_API_KEY`

---

### google-maps-places

Handles Google Places API for location autocomplete and details.

**Base URL:** `/functions/v1/google-maps-places`

#### POST `/` (Autocomplete)

**Request Body:**
```json
{
  "action": "autocomplete",
  "input": "Mumbai Airport",
  "sessionToken": "unique-session-token"
}
```

**Response:**
```json
{
  "success": true,
  "predictions": [
    {
      "place_id": "ChIJ...",
      "description": "Chhatrapati Shivaji Maharaj International Airport",
      "structured_formatting": {
        "main_text": "Mumbai Airport",
        "secondary_text": "Mumbai, Maharashtra, India"
      }
    }
  ]
}
```

#### POST `/` (Details)

**Request Body:**
```json
{
  "action": "details",
  "placeId": "ChIJ...",
  "sessionToken": "unique-session-token"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "formatted_address": "Mumbai, Maharashtra, India",
    "city": "Mumbai",
    "state": "Maharashtra",
    "pincode": "400099",
    "latitude": 19.0896,
    "longitude": 72.8656
  }
}
```

#### Required Secrets
- `GOOGLE_MAPS_API_KEY`

---

### start-trip

Initiates a trip and sets up tracking.

**Base URL:** `/functions/v1/start-trip`

#### POST `/`

**Request Body:**
```json
{
  "tripId": "uuid"
}
```

**Response:**
```json
{
  "success": true,
  "data": {
    "trip_id": "uuid",
    "status": "ongoing",
    "tracking_enabled": true
  }
}
```

---

## Common Patterns

### CORS Headers

All edge functions include CORS headers:

```typescript
const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};
```

### Error Handling

Standard error response format:

```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Authentication

Edge functions use Supabase service role for database operations:

```typescript
const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
);
```

## Deployment

Edge functions are automatically deployed when code is pushed. No manual deployment required.

## Logging

All edge functions include comprehensive logging for debugging:

```typescript
console.log(`[telenity-tracking] Processing request: ${endpoint}`);
console.error(`[telenity-tracking] Error: ${error.message}`);
```

View logs in Supabase Dashboard: Project → Edge Functions → Function Name → Logs
