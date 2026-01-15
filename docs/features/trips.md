# Trip Management

## Overview

Trips represent the physical movement of goods from origin to destination, encompassing vehicle assignment, driver management, real-time tracking, and delivery confirmation.

## Trip Lifecycle

```
Created → Ongoing → Completed → Closed
              ↓
         Cancelled → Closed
              ↓
          On Hold → Ongoing
```

### Status Definitions

| Status | Description |
|--------|-------------|
| **Created** | Trip has been created but not yet started |
| **Ongoing** | Trip is in progress with active tracking |
| **Completed** | Trip has reached destination, pending closure |
| **Cancelled** | Trip was cancelled before completion |
| **On Hold** | Trip temporarily paused |
| **Closed** | Trip finalized with all documentation |

## Creating a Trip

### Required Information
- **Trip Code** - Unique identifier (auto-generated if blank)
- **Origin Location** - Starting point
- **Destination Location** - End point
- **Planned Start Time** - Scheduled departure

### Optional Information
- Customer association
- Transporter assignment
- Vehicle selection
- Driver assignment
- Lane selection (pre-defined route)
- Consignee details
- Notes

## Vehicle & Driver Assignment

### Vehicle Selection
1. Select transporter (optional filter)
2. Choose vehicle from available fleet
3. System checks for GPS tracking asset

### Driver Selection
1. Filter by transporter (optional)
2. Select active driver
3. System initiates consent flow if SIM tracking required

### Tracking Type Determination

```
Vehicle has GPS asset? → GPS Tracking
         ↓ No
Driver consent available? → SIM Tracking
         ↓ No
Request consent → SIM Tracking (pending)
         ↓ No
Manual tracking fallback
```

## Consent Flow (SIM Tracking)

When GPS tracking is not available, SIM-based tracking requires driver consent:

1. **Check Existing Consent** - System checks `driver_consents` table
2. **Request Consent** - Calls Telenity Import API to send SMS
3. **Monitor Status** - Poll consent status until ALLOWED
4. **Link to Trip** - Associates consent record with trip

See [Telenity Consent Flow](../telenity-consent-flow.md) for details.

## Shipment Mapping

### Mapping Shipments to Trip
1. Navigate to trip details
2. Click "Map Shipments"
3. Select available shipments
4. Set delivery sequence
5. Confirm mapping

### Validation Rules
- Shipment must be in "Confirmed" status
- Shipment pickup/drop locations should match trip route
- Capacity validation (weight/volume)

## Starting a Trip

### Pre-Start Validation
- ✓ Vehicle assigned
- ✓ Driver assigned
- ✓ Tracking available (GPS or SIM consent)
- ✓ Origin location validated

### Location Validation
System validates vehicle/driver current location against origin:
- **GPS Radius**: Within configured meters (default: 200m)
- **SIM Radius**: Within configured meters (default: 500m)

If outside radius, warning displayed with option to proceed or wait.

### Start Actions
1. Status changes to "Ongoing"
2. `actual_start_time` recorded
3. Tracking log initialized
4. First location ping recorded

## Real-Time Tracking

### Location Updates
- GPS: Automatic via Wheelseye API polling
- SIM: Via Telenity Location API
- Stored in `location_history` table

### Map Visualization
- Live vehicle position marker
- Route polyline (planned vs actual)
- Waypoint markers
- Geofence boundaries

### ETA Calculation
- Based on remaining distance
- Updated with each location ping
- Accounts for historical traffic patterns

## Waypoint Management

### Waypoint Types
- **Origin** - Starting point (sequence 0)
- **Stop** - Intermediate stops
- **Destination** - End point

### Waypoint Status
- Upcoming
- Arrived
- Departed
- Skipped

### Automatic Updates
System detects geofence entry/exit to update waypoint status and record actual times.

## Trip Alerts

### Alert Types
| Type | Trigger |
|------|---------|
| Route Deviation | Vehicle deviates from planned route |
| Stoppage | Unplanned stop detected |
| Idle Time | Extended idle period |
| Tracking Lost | No location update for threshold period |
| Geofence Entry | Vehicle enters waypoint geofence |
| Geofence Exit | Vehicle exits waypoint geofence |
| Speed Exceeded | Speed above threshold |
| Delay Warning | ETA beyond planned time |

### Alert Workflow
1. Alert triggered → Status: Active
2. User acknowledges → Status: Acknowledged
3. Issue resolved → Status: Resolved
4. Or dismissed → Status: Dismissed

## Completing a Trip

### Completion Criteria
- Vehicle within destination geofence
- All shipments delivered or accounted for
- POD collected (optional)

### Completion Actions
1. Status changes to "Completed"
2. `actual_end_time` recorded
3. Final location logged
4. Tracking stopped

## Closing a Trip

### Closure Process
1. Review trip summary
2. Verify all shipments processed
3. Add closure notes (optional)
4. Confirm closure

### Closure Actions
1. Status changes to "Closed"
2. `closed_at` and `closed_by` recorded
3. Trip becomes read-only
4. Reports available

## Trip Timeline

Visual timeline showing:
- Creation timestamp
- Status changes
- Waypoint arrivals/departures
- Alerts triggered
- Completion/closure

## Audit Trail

All trip status changes logged in `trip_audit_logs`:
- Previous status
- New status
- Changed by user
- Change reason
- Timestamp
- Metadata

## Components

### Pages
- `src/pages/Trips.tsx` - Trip list
- `src/pages/trips/TripAdd.tsx` - Create trip
- `src/pages/trips/TripEdit.tsx` - Edit trip
- `src/pages/TripDetails.tsx` - Trip details view

### Components
- `TripOverviewCard` - Basic trip info
- `TripMapSection` - Live map view
- `TripTimeline` - Status timeline
- `TripETACard` - ETA display
- `TripAlertsMonitor` - Alert management
- `TripConsentSection` - Consent status
- `TripClosureDialog` - Closure flow
- `LogisticsDetailsCard` - Vehicle/driver info
- `TrackingStatusCard` - Tracking status

### Hooks
- `useTelenityTracking` - Telenity API integration
- `useWheelseyeTracking` - Wheelseye API integration
