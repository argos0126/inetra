# API Integrations

## Overview

The system integrates with multiple external APIs for tracking, mapping, and location services.

## Google Maps API

### Services Used

#### 1. Places API
**Purpose:** Location search and autocomplete

**Endpoints:**
- Place Autocomplete
- Place Details

**Usage:**
```typescript
// In LocationSearchMap component
const { data } = await supabase.functions.invoke('google-maps-places', {
  body: {
    action: 'autocomplete',
    input: searchQuery,
    sessionToken: sessionId
  }
});
```

**Response Fields:**
- formatted_address
- city, state, pincode
- latitude, longitude

#### 2. Directions API
**Purpose:** Route calculation

**Endpoints:**
- Directions with waypoints

**Usage:**
```typescript
const { data } = await supabase.functions.invoke('google-maps-route', {
  body: {
    origin: { lat, lng },
    destination: { lat, lng },
    waypoints: [{ lat, lng }],
    alternatives: false
  }
});
```

**Response Fields:**
- distance (meters)
- duration (seconds)
- polyline (encoded)
- waypoints with distances

### Required Secret
- `GOOGLE_MAPS_API_KEY`

---

## Wheelseye GPS API

### Overview
Wheelseye provides GPS tracking for vehicles with installed devices.

### Authentication
- Bearer token authentication
- Token stored in `WHEELSEYE_ACCESS_TOKEN` secret

### Endpoints

#### Get Current Location
```
GET https://api.wheelseye.com/v1/location
Headers: Authorization: Bearer {token}
Query: vehicleNumber={vehicle_number}
```

**Response:**
```json
{
  "latitude": 28.6139,
  "longitude": 77.2090,
  "speed": 45,
  "heading": 180,
  "ignition": true,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

#### Get Location History
```
GET https://api.wheelseye.com/v1/history
Query: vehicleNumber, fromDate, toDate
```

### Edge Function Wrapper
```typescript
// supabase/functions/wheelseye-tracking/index.ts
serve(async (req) => {
  const accessToken = Deno.env.get('WHEELSEYE_ACCESS_TOKEN');
  // Make API calls to Wheelseye
});
```

### Hook Usage
```typescript
const { getLocation, getLocationHistory, getBulkLocations } = useWheelseyeTracking();

// Get single vehicle location
const location = await getLocation({ 
  vehicleNumber: 'MH12AB1234',
  tripId: 'uuid'
});
```

---

## Telenity SIM Tracking API

### Overview
Telenity provides SIM-based location tracking using mobile network triangulation.

### Token Types

#### 1. Authentication Token
- **Purpose:** Import API, Location API
- **Expiry:** 6 hours
- **Source:** Smarttrail Login API
- **Secret:** `TELENITY_AUTH_TOKEN`

#### 2. Access Token
- **Purpose:** Consent Check API
- **Expiry:** 30 minutes
- **Source:** Consent Auth API
- **Secret:** `TELENITY_CONSENT_AUTH_TOKEN`

### API Endpoints

#### Smarttrail Login (Token Refresh)
```
POST https://smarttrail.telenity.com/api/login
Headers: Authorization: Basic {TELENITY_AUTH_TOKEN}
```

#### Consent Auth (Access Token)
```
POST https://consent.telenity.com/api/auth
Headers: Authorization: Basic {TELENITY_CONSENT_AUTH_TOKEN}
```

#### Import Driver (Request Consent)
```
POST https://smarttrail.telenity.com/api/import
Headers: Authorization: Bearer {auth_token}
Body: {
  "msisdn": "919876543210",
  "firstName": "John",
  "lastName": "Doe"
}
```
**Effect:** Sends SMS to driver requesting consent

#### Check Consent
```
GET https://consent.telenity.com/api/check
Headers: Authorization: Bearer {access_token}
Query: msisdn={phone_number}
```

**Response:**
```json
{
  "status": "ALLOWED",
  "expiresAt": "2024-01-08T12:00:00Z"
}
```

#### Search Entity
```
GET https://smarttrail.telenity.com/api/search
Headers: Authorization: Bearer {auth_token}
Query: msisdn={phone_number}
```

#### Get Location
```
GET https://smarttrail.telenity.com/api/location
Headers: Authorization: Bearer {auth_token}
Query: msisdn={phone_number}
```

**Response:**
```json
{
  "latitude": 28.6139,
  "longitude": 77.2090,
  "accuracy": 100,
  "timestamp": "2024-01-01T12:00:00Z"
}
```

### Edge Function Wrappers
- `telenity-token-refresh` - Token management
- `telenity-tracking` - API operations

### Hook Usage
```typescript
const { 
  importDriver, 
  checkConsent, 
  getLocation,
  getTokenStatus,
  refreshTokens 
} = useTelenityTracking();

// Import driver and request consent
await importDriver({
  msisdn: '919876543210',
  firstName: 'John',
  lastName: 'Doe',
  driverId: 'uuid',
  tripId: 'uuid'
});

// Check consent status
const status = await checkConsent('919876543210');
```

### Consent Flow Diagram
```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│  Trip Form  │────▶│ Check Consent │────▶│   ALLOWED   │────▶ Create Trip
└─────────────┘     └──────────────┘     └─────────────┘
                           │
                           ▼ NOT FOUND
                    ┌──────────────┐
                    │ Import Driver │
                    │  (Send SMS)   │
                    └──────────────┘
                           │
                           ▼
                    ┌──────────────┐
                    │ Poll Status  │◀──┐
                    └──────────────┘   │
                           │           │
                    ┌──────┴──────┐    │
                    ▼             ▼    │
               ALLOWED        PENDING ─┘
                    │
                    ▼
              Create Trip
```

---

## Supabase Services

### Database
PostgreSQL database accessed via Supabase client:
```typescript
import { supabase } from '@/integrations/supabase/client';

const { data, error } = await supabase
  .from('trips')
  .select('*')
  .eq('status', 'ongoing');
```

### Storage
File storage for documents:
```typescript
const { data, error } = await supabase.storage
  .from('pod-documents')
  .upload(`${shipmentId}/${fileName}`, file);
```

### Authentication
User authentication:
```typescript
const { data, error } = await supabase.auth.signInWithPassword({
  email,
  password
});
```

### Edge Functions
Serverless functions:
```typescript
const { data, error } = await supabase.functions.invoke('function-name', {
  body: { param: 'value' }
});
```

---

## Error Handling

### Standard Error Response
All API integrations return standardized errors:
```json
{
  "success": false,
  "error": "Error message",
  "code": "ERROR_CODE"
}
```

### Common Error Codes
| Code | Description |
|------|-------------|
| `AUTH_FAILED` | Authentication failed |
| `TOKEN_EXPIRED` | API token expired |
| `NOT_FOUND` | Resource not found |
| `RATE_LIMITED` | API rate limit exceeded |
| `VALIDATION_ERROR` | Invalid request data |

### Retry Logic
Edge functions implement automatic retry for transient failures:
```typescript
async function fetchWithRetry(url, options, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const response = await fetch(url, options);
      if (response.ok) return response;
    } catch (error) {
      if (i === retries - 1) throw error;
      await new Promise(r => setTimeout(r, 1000 * (i + 1)));
    }
  }
}
```

---

## Rate Limits

| API | Limit | Window |
|-----|-------|--------|
| Google Maps | 100 requests | per second |
| Wheelseye | 1000 requests | per minute |
| Telenity | 100 requests | per minute |

---

## Monitoring

### Logging
All API calls logged with:
- Request timestamp
- Endpoint called
- Response status
- Response time
- Error details (if any)

### Viewing Logs
Supabase Dashboard → Edge Functions → Function Name → Logs

---

## Settings Management

### Integration Settings Page

**Route:** `/settings/integrations` (Super Admin only)

The Integration Settings page provides:
- Real-time token status monitoring
- Manual token refresh controls
- Integration connectivity status

### Token Status Monitor Component

Located at `src/components/admin/TokenStatusMonitor.tsx`

**Features:**
- Displays current token expiry status
- Shows time until expiry
- Color-coded status badges (Valid, Expiring, Expired)
- Individual and bulk refresh actions

### Token Refresh Actions

```typescript
// Refresh all tokens
await supabase.functions.invoke('telenity-token-refresh/refresh-all', {
  body: {}
});

// Refresh specific token type
await supabase.functions.invoke('telenity-token-refresh/refresh-access', {
  body: {}
});
```

### useSettings Hook

The `useSettings` hook in `src/hooks/useSettings.ts` provides:
- Centralized settings management
- Loading/saving states
- Default values for all settings
- Reset to defaults functionality

See [Settings Documentation](./settings.md) for complete details.
