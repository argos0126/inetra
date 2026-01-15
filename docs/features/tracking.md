# Real-Time Tracking System

## Overview

The tracking system provides real-time visibility into vehicle and driver locations through multiple data sources, enabling proactive monitoring and exception management.

## Tracking Sources

### 1. GPS Tracking (Wheelseye)

**How it works:**
- GPS device installed in vehicle
- Device sends location to Wheelseye servers
- Our system polls Wheelseye API for updates

**Configuration:**
- Tracking asset created with type "gps"
- Vehicle linked to tracking asset
- Wheelseye API token configured

**API Integration:**
```
GET /functions/v1/wheelseye-tracking/location
  ?vehicleNumber=MH12AB1234
  &tripId=uuid
```

**Data Retrieved:**
- Latitude/Longitude
- Speed (km/h)
- Heading/Direction
- Timestamp
- Ignition status

### 2. SIM Tracking (Telenity)

**How it works:**
- Uses driver's mobile SIM for location
- Requires driver consent (SMS-based)
- Location derived from cell tower triangulation

**Consent Flow:**
1. Driver selected for trip
2. Check existing consent status
3. If no valid consent, request via SMS
4. Driver responds to consent SMS
5. Once ALLOWED, tracking enabled

**API Integration:**
```
POST /functions/v1/telenity-tracking/import
  { msisdn, firstName, lastName, driverId, tripId }

GET /functions/v1/telenity-tracking/check-consent
  ?msisdn=919876543210&consentId=uuid

GET /functions/v1/telenity-tracking/location
  ?msisdn=919876543210&tripId=uuid
```

**Consent Status:**
- `pending` - SMS sent, awaiting response
- `allowed` - Driver consented
- `not_allowed` - Driver declined
- `expired` - Consent expired (re-request needed)

### 3. Manual Tracking

**When used:**
- GPS device not available
- SIM consent not obtained
- Fallback for connectivity issues

**How it works:**
- Manual location entry by operations team
- Based on driver communication
- Stored in location_history with source="manual"

## Tracking Priority

System determines tracking type in order:
1. **GPS** - If vehicle has linked tracking asset
2. **SIM** - If driver consent is ALLOWED
3. **Manual** - Fallback option

## Data Storage

### location_history Table
Individual location points:
```sql
- trip_id, vehicle_id, driver_id
- tracking_asset_id
- source (telenity/wheelseye/manual)
- latitude, longitude
- speed_kmph, heading
- accuracy_meters
- event_time
- raw_response (original API data)
```

### tracking_logs Table
Aggregated log per trip:
```sql
- trip_id (unique)
- tracking_asset_id
- source
- location_history (JSONB array)
- raw_responses (JSONB array)
- last_sequence_number
- last_updated_at
```

## Geofencing

### Configuration
Each location has geofence radius:
- `gps_radius_meters` - For GPS tracking (default: 200m)
- `sim_radius_meters` - For SIM tracking (default: 500m)

### Geofence Events
- **Entry** - Vehicle enters location radius
- **Exit** - Vehicle leaves location radius

### Calculation
```typescript
function isWithinGeofence(
  vehicleLat: number, 
  vehicleLng: number,
  locationLat: number,
  locationLng: number,
  radiusMeters: number
): boolean {
  const distance = haversineDistance(
    vehicleLat, vehicleLng,
    locationLat, locationLng
  );
  return distance <= radiusMeters;
}
```

## Route Deviation Detection

### Planned Route
- Stored as encoded polyline in `lane_route_calculations`
- Decoded into coordinate array for comparison

### Deviation Calculation
1. Get current vehicle position
2. Find nearest point on planned route
3. Calculate perpendicular distance
4. If > threshold, trigger alert

### Configuration
Deviation threshold configurable in `tracking_settings`.

## ETA Calculation

### Factors
- Remaining distance to destination
- Current speed
- Historical travel times
- Traffic patterns (via Google Maps)

### Update Frequency
- Real-time with each location update
- Stored in `trips.current_eta`

### Display
- Shown in TripETACard component
- Compared against `planned_eta`
- Delay warning if significantly behind

## Map Visualization

### Components
- `LiveMapView` - Single trip map
- `FleetMapView` - Multiple vehicle map
- `LocationTracker` - Location marker

### Libraries
- **Leaflet** - Map rendering
- **Mapbox GL** - Alternative renderer
- **polyline-encoded** - Route decoding

### Features
- Real-time marker updates
- Route polyline display
- Geofence circles
- Waypoint markers
- Info popups

## Alerts

### Tracking-Related Alerts
| Alert | Trigger |
|-------|---------|
| Tracking Lost | No update for X minutes |
| Consent Revoked | Driver revokes SIM consent |
| Route Deviation | Off planned route |
| Speed Exceeded | Above speed limit |
| Stoppage | Unplanned stop |
| Idle Time | Extended idle |

### Alert Generation
```typescript
// Check tracking status
if (lastPingAge > TRACKING_LOST_THRESHOLD) {
  createAlert({
    trip_id,
    alert_type: 'tracking_lost',
    severity: 'high',
    description: `No location update for ${lastPingAge} minutes`
  });
}
```

## Token Management

### Telenity Tokens
Two token types with different expiry:
1. **Authentication Token** (6 hours)
   - Used for Import/Location API
   - Refreshed via cron job every 5 hours

2. **Access Token** (30 minutes)
   - Used for Consent Check API
   - Refreshed every 25 minutes

### Token Storage
Stored in `integration_tokens` table:
```sql
token_type: 'authentication' | 'access'
token_value: encrypted token
expires_at: expiry timestamp
```

### Auto-Refresh
Edge function checks token validity before API calls:
```typescript
const token = await getStoredToken(supabase, 'authentication');
if (!token || new Date(token.expires_at) < new Date()) {
  await autoRefreshToken(supabase, 'authentication');
}
```

## Components

### Hooks
- `useTelenityTracking` - Telenity API wrapper
- `useWheelseyeTracking` - Wheelseye API wrapper

### Components
- `LiveMapView` - Trip map with live tracking
- `FleetMapView` - Fleet overview map
- `LocationTracker` - Location display
- `TrackingStatusCard` - Status indicator
- `ConsentRequestButton` - Consent request UI
- `ConsentStatusBadge` - Consent status display
- `GeofenceMonitor` - Geofence visualization

### Utilities
- `src/utils/geoUtils.ts` - Geo calculations
- `src/utils/geofenceUtils.ts` - Geofence logic
