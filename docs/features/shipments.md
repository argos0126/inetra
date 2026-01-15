# Shipment Management

## Overview

Shipments represent individual consignments being transported. Multiple shipments can be mapped to a single trip, enabling consolidated delivery operations.

## Shipment Lifecycle

```
Created → Confirmed → Mapped → In Pickup → In Transit → Out for Delivery → Delivered → Success
                                    ↓                          ↓
                                   NDR ←───────────────────────┘
                                    ↓
                                Returned
```

### Status Definitions

| Status | Description |
|--------|-------------|
| **Created** | Shipment entry created |
| **Confirmed** | Shipment details confirmed, ready for mapping |
| **Mapped** | Assigned to a trip |
| **In Pickup** | Vehicle at pickup location |
| **In Transit** | Being transported |
| **Out for Delivery** | Reached delivery area |
| **Delivered** | Physically delivered |
| **NDR** | Non-Delivery Report (failed attempt) |
| **Returned** | Returned to origin |
| **Success** | Fully completed with POD |

### Sub-Statuses

Each main status can have sub-statuses for granular tracking:

**In Pickup:**
- Waiting for loading
- Loading in progress
- Loading complete

**In Transit:**
- On route
- At checkpoint
- Delayed

**Out for Delivery:**
- Approaching destination
- At destination
- Unloading

**NDR:**
- Consignee unavailable
- Address not found
- Refused delivery
- Reschedule requested

## Creating a Shipment

### Required Fields
- **Shipment Code** - Unique identifier
- **Customer** - Associated customer
- **Pickup Location** - Origin point
- **Drop Location** - Destination point

### Optional Fields
- Order ID (external reference)
- LR Number
- Waybill Number
- Consignee Code
- Material selection
- Dimensions (L × W × H)
- Weight
- Volume
- Quantity
- Planned pickup/delivery times
- Notes

## Shipment-Trip Mapping

### Mapping Process
1. Trip must be in "Created" or "Ongoing" status
2. Shipment must be in "Confirmed" status
3. Select shipments matching trip route
4. Set delivery sequence
5. Confirm mapping

### Validation
- Pickup location matches trip origin or waypoint
- Drop location matches trip destination or waypoint
- Capacity not exceeded (weight + volume)
- No duplicate mapping

### Mapping Record
Stored in `trip_shipment_map` table:
- Trip ID
- Shipment ID
- Sequence order
- Mapped by user
- Mapping timestamp
- Notes

## Status Workflow

### Automatic Status Updates
Status can update automatically based on:
- Trip status changes
- Geofence triggers
- Manual intervention

### Manual Status Updates
Users can manually update status with:
- New status selection
- Sub-status (optional)
- Notes/reason

### Status History
All changes logged in `shipment_status_history`:
- Previous status
- New status
- Previous sub-status
- New sub-status
- Changed by
- Change source (manual/system/api)
- Notes
- Metadata

## POD (Proof of Delivery)

### POD Collection
1. Navigate to shipment details
2. Click "Upload POD"
3. Select file (image/PDF)
4. Upload to storage bucket
5. Mark as collected

### POD Fields
- `pod_collected` - Boolean flag
- `pod_collected_at` - Collection timestamp
- `pod_file_path` - Storage path
- `pod_file_name` - Original filename
- `pod_cleaned_at` - Verification timestamp

### Storage
POD documents stored in `pod-documents` bucket with path:
```
{shipment_id}/{filename}
```

## Exception Handling

### Exception Types

| Type | Description |
|------|-------------|
| Duplicate Mapping | Shipment mapped to multiple trips |
| Capacity Exceeded | Weight/volume exceeds vehicle capacity |
| Vehicle Not Arrived | Vehicle not at pickup location |
| Loading Discrepancy | Quantity mismatch during loading |
| Tracking Unavailable | Cannot track shipment location |
| NDR Consignee Unavailable | Delivery failed - consignee absent |
| POD Rejected | POD document rejected |
| Invoice Dispute | Billing discrepancy |
| Delay Exceeded | Delivery significantly delayed |
| Weight Mismatch | Actual vs declared weight difference |

### Exception Workflow
1. Exception detected → Status: Open
2. User acknowledges → Status: Acknowledged
3. Resolution action taken → Status: Resolved
4. Or escalated → Status: Escalated

### Exception Fields
- Type
- Severity (low/medium/high/critical)
- Description
- Resolution path
- Resolution notes
- Acknowledgment details
- Resolution details
- Escalation details

## Delay Tracking

### Delay Calculation
```
Delay % = ((Actual Time - Planned Time) / Planned Time) × 100
```

### Delay Indicators
- `delay_percentage` - Calculated delay
- `is_delayed` - Boolean flag (true if > threshold)

### Thresholds
Configurable via `tracking_settings` table.

## Bulk Operations

### Bulk Import
1. Download CSV template
2. Fill shipment data
3. Upload CSV file
4. Preview and validate
5. Confirm import

### Import Fields
- shipment_code (required)
- customer_code
- pickup_location_code
- drop_location_code
- order_id
- lr_number
- weight_kg
- quantity

### Validation
- Required fields check
- Customer/location existence
- Duplicate code detection
- Data format validation

## Components

### Pages
- `src/pages/Shipments.tsx` - Shipment list
- `src/pages/shipments/ShipmentAdd.tsx` - Create shipment
- `src/pages/shipments/ShipmentEdit.tsx` - Edit shipment
- `src/pages/shipments/ShipmentView.tsx` - View details

### Components
- `ShipmentMapper` - Trip mapping interface
- `ShipmentStatusTimeline` - Status history
- `ShipmentStatusWorkflow` - Status update controls
- `ShipmentSubStatusSelector` - Sub-status selection
- `ShipmentPodUpload` - POD upload interface
- `ShipmentExceptionsPanel` - Exception management
- `ShipmentBulkImport` - CSV import
- `ShipmentAuditLogs` - History viewer

### Utilities
- `src/utils/shipmentValidations.ts` - Validation logic
- `src/utils/shipmentExceptions.ts` - Exception handling
- `src/utils/shipmentStatusLogger.ts` - Status logging
