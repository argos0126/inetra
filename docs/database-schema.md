# Database Schema Documentation

## Overview

The database is built on PostgreSQL via Supabase with Row-Level Security (RLS) policies protecting all tables.

## Tables

### Core Entities

#### `customers`
Stores customer/client information.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| display_name | text | Customer display name (required) |
| company_name | text | Company name |
| email | text | Contact email |
| phone | text | Contact phone |
| address | text | Street address |
| city | text | City |
| state | text | State |
| pincode | text | PIN/ZIP code |
| gst_number | text | GST registration number |
| pan_number | text | PAN number |
| integration_code | text | External system integration code |
| is_active | boolean | Active status (default: true) |
| created_at | timestamptz | Creation timestamp |
| updated_at | timestamptz | Last update timestamp |

#### `drivers`
Stores driver information and verification status.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Driver name (required) |
| mobile | text | Mobile number (required) |
| license_number | text | Driving license number |
| license_issue_date | date | License issue date |
| license_expiry_date | date | License expiry date |
| aadhaar_number | text | Aadhaar number |
| aadhaar_verified | boolean | Aadhaar verification status |
| pan_number | text | PAN number |
| pan_verified | boolean | PAN verification status |
| passport_number | text | Passport number |
| voter_id | text | Voter ID |
| police_verification_date | date | Police verification date |
| police_verification_expiry | date | Police verification expiry |
| transporter_id | uuid | FK to transporters |
| location_code | text | Location code |
| is_dedicated | boolean | Dedicated driver flag |
| consent_status | consent_status | Tracking consent status |
| is_active | boolean | Active status |

#### `vehicles`
Stores vehicle information and compliance documents.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| vehicle_number | text | Registration number (required) |
| vehicle_type_id | uuid | FK to vehicle_types |
| transporter_id | uuid | FK to transporters |
| tracking_asset_id | uuid | FK to tracking_assets |
| make | text | Vehicle manufacturer |
| model | text | Vehicle model |
| year | integer | Manufacturing year |
| rc_number | text | RC number |
| rc_issue_date | date | RC issue date |
| rc_expiry_date | date | RC expiry date |
| insurance_number | text | Insurance policy number |
| insurance_issue_date | date | Insurance issue date |
| insurance_expiry_date | date | Insurance expiry date |
| fitness_number | text | Fitness certificate number |
| fitness_issue_date | date | Fitness issue date |
| fitness_expiry_date | date | Fitness expiry date |
| puc_number | text | PUC certificate number |
| puc_issue_date | date | PUC issue date |
| puc_expiry_date | date | PUC expiry date |
| permit_number | text | Permit number |
| permit_issue_date | date | Permit issue date |
| permit_expiry_date | date | Permit expiry date |
| integration_code | text | External integration code |
| location_code | text | Location code |
| is_dedicated | boolean | Dedicated vehicle flag |
| is_active | boolean | Active status |

#### `transporters`
Stores transporter/carrier information.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| transporter_name | text | Transporter name (required) |
| code | text | Transporter code |
| company | text | Company name |
| email | text | Contact email |
| mobile | text | Contact mobile |
| address | text | Street address |
| city | text | City |
| state | text | State |
| pincode | text | PIN code |
| gstin | text | GST number |
| pan | text | PAN number |
| is_active | boolean | Active status |

#### `locations`
Stores location/facility information with geofencing.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| location_name | text | Location name (required) |
| location_type | location_type | Type (node, consignee, plant, warehouse, distribution_center) |
| customer_id | uuid | FK to customers |
| address | text | Street address |
| city | text | City |
| district | text | District |
| state | text | State |
| pincode | text | PIN code |
| zone | text | Zone |
| latitude | numeric | GPS latitude |
| longitude | numeric | GPS longitude |
| gps_radius_meters | integer | Geofence radius for GPS (default: 200) |
| sim_radius_meters | integer | Geofence radius for SIM (default: 500) |
| integration_id | text | External integration ID |
| is_active | boolean | Active status |

### Operations

#### `trips`
Core trip/journey records.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| trip_code | text | Unique trip code (required) |
| status | trip_status | Trip status |
| customer_id | uuid | FK to customers |
| driver_id | uuid | FK to drivers |
| vehicle_id | uuid | FK to vehicles |
| transporter_id | uuid | FK to transporters |
| origin_location_id | uuid | FK to locations (origin) |
| destination_location_id | uuid | FK to locations (destination) |
| lane_id | uuid | FK to serviceability_lanes |
| tracking_asset_id | uuid | FK to tracking_assets |
| sim_consent_id | uuid | FK to driver_consents |
| tracking_type | tracking_type | Type of tracking (gps, sim, manual, none) |
| planned_start_time | timestamptz | Planned departure |
| planned_end_time | timestamptz | Planned arrival |
| actual_start_time | timestamptz | Actual departure |
| actual_end_time | timestamptz | Actual arrival |
| planned_eta | timestamptz | Original ETA |
| current_eta | timestamptz | Current estimated ETA |
| total_distance_km | numeric | Total distance |
| consignee_name | text | Consignee name |
| notes | text | Trip notes |
| is_trackable | boolean | Tracking enabled flag |
| last_ping_at | timestamptz | Last tracking update |
| active_alert_count | integer | Count of active alerts |
| closure_notes | text | Closure notes |
| closed_by | uuid | Closed by user |
| closed_at | timestamptz | Closure timestamp |

**Status Enum (`trip_status`):**
- `created` - Trip created
- `ongoing` - Trip in progress
- `completed` - Trip completed
- `cancelled` - Trip cancelled
- `on_hold` - Trip on hold
- `closed` - Trip closed

#### `shipments`
Individual shipment records.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| shipment_code | text | Unique shipment code (required) |
| status | shipment_status | Shipment status |
| sub_status | text | Sub-status |
| trip_id | uuid | FK to trips |
| customer_id | uuid | FK to customers |
| material_id | uuid | FK to materials |
| pickup_location_id | uuid | FK to locations |
| drop_location_id | uuid | FK to locations |
| order_id | text | Order reference |
| lr_number | text | LR number |
| waybill_number | text | Waybill number |
| consignee_code | text | Consignee code |
| shipment_type | text | Shipment type |
| quantity | integer | Quantity |
| weight_kg | numeric | Weight in kg |
| volume_cbm | numeric | Volume in CBM |
| length_cm | numeric | Length in cm |
| breadth_cm | numeric | Breadth in cm |
| height_cm | numeric | Height in cm |
| planned_pickup_time | timestamptz | Planned pickup |
| planned_delivery_time | timestamptz | Planned delivery |
| pod_collected | boolean | POD collected flag |
| pod_file_path | text | POD file storage path |
| pod_file_name | text | POD file name |
| delay_percentage | numeric | Delay percentage |
| is_delayed | boolean | Delayed flag |
| exception_count | integer | Count of exceptions |
| has_open_exception | boolean | Has open exception flag |
| notes | text | Shipment notes |

**Status Enum (`shipment_status`):**
- `created` - Shipment created
- `confirmed` - Confirmed
- `mapped` - Mapped to trip
- `in_pickup` - At pickup location
- `in_transit` - In transit
- `out_for_delivery` - Out for delivery
- `delivered` - Delivered
- `ndr` - Non-delivery report
- `returned` - Returned
- `success` - Successfully completed

#### `trip_shipment_map`
Many-to-many mapping between trips and shipments.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| trip_id | uuid | FK to trips |
| shipment_id | uuid | FK to shipments |
| sequence_order | integer | Delivery sequence |
| mapped_by | uuid | FK to profiles |
| mapped_at | timestamptz | Mapping timestamp |
| notes | text | Mapping notes |

#### `trip_waypoints`
Waypoints/stops within a trip.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| trip_id | uuid | FK to trips |
| location_id | uuid | FK to locations |
| waypoint_name | text | Waypoint name (required) |
| waypoint_type | text | Type (origin, destination, stop) |
| sequence_order | integer | Sequence in route |
| status | text | Status (upcoming, arrived, departed, skipped) |
| latitude | numeric | GPS latitude |
| longitude | numeric | GPS longitude |
| planned_arrival_time | timestamptz | Planned arrival |
| planned_departure_time | timestamptz | Planned departure |
| actual_arrival_time | timestamptz | Actual arrival |
| actual_departure_time | timestamptz | Actual departure |
| delay_minutes | integer | Delay in minutes |
| notes | text | Waypoint notes |

### Tracking & Monitoring

#### `tracking_assets`
GPS devices and tracking sources.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| display_name | text | Asset name (required) |
| asset_type | tracking_asset_type | Type (gps, sim, whatsapp, driver_app) |
| asset_id | text | External asset ID |
| transporter_id | uuid | FK to transporters |
| api_url | text | API endpoint URL |
| api_token | text | API authentication token |
| response_json_mapping | jsonb | Response field mapping |
| last_validated_at | timestamptz | Last validation timestamp |
| is_active | boolean | Active status |

#### `location_history`
Historical location data points.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| trip_id | uuid | FK to trips |
| vehicle_id | uuid | FK to vehicles |
| driver_id | uuid | FK to drivers |
| tracking_asset_id | uuid | FK to tracking_assets |
| source | tracking_source | Source (telenity, wheelseye, manual) |
| latitude | numeric | GPS latitude (required) |
| longitude | numeric | GPS longitude (required) |
| event_time | timestamptz | Event timestamp (required) |
| speed_kmph | numeric | Speed in km/h |
| heading | numeric | Heading/bearing |
| altitude_meters | numeric | Altitude |
| accuracy_meters | numeric | GPS accuracy |
| raw_response | jsonb | Raw API response |

#### `tracking_logs`
Aggregated tracking logs per trip.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| trip_id | uuid | FK to trips (unique) |
| tracking_asset_id | uuid | FK to tracking_assets |
| source | text | Tracking source |
| location_history | jsonb | Array of location points |
| raw_responses | jsonb | Array of raw responses |
| last_sequence_number | integer | Last sequence number |
| last_updated_at | timestamptz | Last update timestamp |

#### `driver_consents`
SIM-based tracking consent records.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| driver_id | uuid | FK to drivers |
| trip_id | uuid | FK to trips |
| msisdn | text | Mobile number (required) |
| entity_id | text | Telenity entity ID |
| consent_status | driver_consent_status | Status (pending, allowed, not_allowed, expired) |
| consent_requested_at | timestamptz | Request timestamp |
| consent_received_at | timestamptz | Consent received timestamp |
| consent_expires_at | timestamptz | Expiry timestamp |
| telenity_response | jsonb | Raw Telenity response |

#### `integration_tokens`
Cached API tokens for integrations.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| token_type | text | Token type (authentication, access) |
| token_value | text | Token value |
| expires_at | timestamptz | Expiry timestamp |

### Alerts & Exceptions

#### `trip_alerts`
Real-time trip alerts.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| trip_id | uuid | FK to trips |
| alert_type | trip_alert_type | Alert type |
| status | alert_status | Status (active, acknowledged, resolved, dismissed) |
| severity | text | Severity (low, medium, high, critical) |
| title | text | Alert title |
| description | text | Alert description |
| triggered_at | timestamptz | Trigger timestamp |
| location_latitude | numeric | Location latitude |
| location_longitude | numeric | Location longitude |
| threshold_value | numeric | Threshold that was breached |
| actual_value | numeric | Actual value recorded |
| acknowledged_by | uuid | FK to profiles |
| acknowledged_at | timestamptz | Acknowledgment timestamp |
| resolved_by | uuid | FK to profiles |
| resolved_at | timestamptz | Resolution timestamp |
| metadata | jsonb | Additional metadata |

**Alert Type Enum (`trip_alert_type`):**
- `route_deviation` - Route deviation detected
- `stoppage` - Unplanned stoppage
- `idle_time` - Extended idle time
- `tracking_lost` - Tracking signal lost
- `consent_revoked` - Driver consent revoked
- `geofence_entry` - Entered geofence
- `geofence_exit` - Exited geofence
- `speed_exceeded` - Speed limit exceeded
- `delay_warning` - Delay warning

#### `shipment_exceptions`
Shipment-level exceptions.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| shipment_id | uuid | FK to shipments |
| exception_type | shipment_exception_type | Exception type |
| status | exception_status | Status (open, acknowledged, resolved, escalated) |
| severity | text | Severity level |
| description | text | Exception description |
| detected_at | timestamptz | Detection timestamp |
| resolution_path | text | Resolution path |
| resolution_notes | text | Resolution notes |
| acknowledged_by | uuid | FK to profiles |
| acknowledged_at | timestamptz | Acknowledgment timestamp |
| resolved_by | uuid | FK to profiles |
| resolved_at | timestamptz | Resolution timestamp |
| escalated_to | text | Escalation target |
| escalated_at | timestamptz | Escalation timestamp |
| metadata | jsonb | Additional metadata |

**Exception Type Enum (`shipment_exception_type`):**
- `duplicate_mapping` - Duplicate mapping detected
- `capacity_exceeded` - Capacity exceeded
- `vehicle_not_arrived` - Vehicle not arrived
- `loading_discrepancy` - Loading discrepancy
- `tracking_unavailable` - Tracking unavailable
- `ndr_consignee_unavailable` - Consignee unavailable
- `pod_rejected` - POD rejected
- `invoice_dispute` - Invoice dispute
- `delay_exceeded` - Delay threshold exceeded
- `weight_mismatch` - Weight mismatch
- `other` - Other exception

### Configuration

#### `serviceability_lanes`
Pre-defined routes/lanes.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| lane_code | text | Lane code (required) |
| origin_location_id | uuid | FK to locations |
| destination_location_id | uuid | FK to locations |
| vehicle_type_id | uuid | FK to vehicle_types |
| transporter_id | uuid | FK to transporters |
| distance_km | numeric | Distance in km |
| standard_tat_hours | integer | Standard TAT in hours |
| serviceability_mode | serviceability_mode | Mode (surface, air, rail) |
| freight_type | freight_type | Type (ftl, ptl, express) |
| is_active | boolean | Active status |

#### `lane_route_calculations`
Cached route calculations for lanes.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| lane_id | uuid | FK to serviceability_lanes (unique) |
| encoded_polyline | text | Encoded route polyline |
| waypoints | jsonb | Array of waypoints |
| total_distance_meters | integer | Total distance |
| total_duration_seconds | integer | Total duration |
| route_summary | text | Route summary |
| calculated_at | timestamptz | Calculation timestamp |

#### `vehicle_types`
Vehicle type definitions.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| type_name | text | Type name (required) |
| weight_capacity_kg | numeric | Weight capacity |
| volume_capacity_cbm | numeric | Volume capacity |
| length_cm | numeric | Length |
| breadth_cm | numeric | Breadth |
| height_cm | numeric | Height |
| is_active | boolean | Active status |

#### `materials`
Material/product definitions.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| name | text | Material name (required) |
| sku_code | text | SKU code |
| description | text | Description |
| units | text | Unit of measure |
| packaging | text | Packaging type |
| weight_kg | numeric | Unit weight |
| volume_cbm | numeric | Unit volume |
| length_cm | numeric | Length |
| breadth_cm | numeric | Breadth |
| height_cm | numeric | Height |
| is_bulk | boolean | Bulk material flag |
| is_active | boolean | Active status |

### User Management

#### `profiles`
User profiles linked to auth.users.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to auth.users |
| first_name | text | First name |
| last_name | text | Last name |
| company | text | Company name |

#### `user_roles`
User role assignments.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| user_id | uuid | FK to auth.users |
| role | app_role | Role (superadmin, admin, user) |

### Audit & History

#### `trip_audit_logs`
Trip status change history.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| trip_id | uuid | FK to trips |
| previous_status | trip_status | Previous status |
| new_status | trip_status | New status |
| changed_by | uuid | FK to profiles |
| change_reason | text | Reason for change |
| metadata | jsonb | Additional metadata |

#### `shipment_status_history`
Shipment status change history.

| Column | Type | Description |
|--------|------|-------------|
| id | uuid | Primary key |
| shipment_id | uuid | FK to shipments |
| previous_status | text | Previous status |
| new_status | text | New status |
| previous_sub_status | text | Previous sub-status |
| new_sub_status | text | New sub-status |
| changed_by | uuid | FK to profiles |
| changed_at | timestamptz | Change timestamp |
| change_source | text | Source (manual, system, api) |
| notes | text | Change notes |
| metadata | jsonb | Additional metadata |

## Security

All tables have Row-Level Security (RLS) enabled with policies restricting access to superadmin users via the `is_superadmin()` function.

```sql
CREATE POLICY "Superadmins can manage [table_name]"
ON public.[table_name]
FOR ALL
USING (is_superadmin(auth.uid()));
```

## Database Functions

### `is_superadmin(_user_id uuid)`
Checks if a user has the superadmin role.

### `has_role(_user_id uuid, _role app_role)`
Checks if a user has a specific role.

### `handle_new_user()`
Trigger function to create profile on user registration.

### `update_updated_at_column()`
Trigger function to update `updated_at` timestamp.
