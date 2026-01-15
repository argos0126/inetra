# Features Overview

## Core Modules

### 1. Trip Management
Complete lifecycle management for logistics trips.

**Key Features:**
- Trip creation with origin/destination selection
- Vehicle and driver assignment
- Real-time tracking integration
- Waypoint management
- ETA calculation and monitoring
- Trip closure with notes

**Statuses:** Created → Ongoing → Completed/Cancelled → Closed

[Detailed Documentation](./trips.md)

---

### 2. Shipment Management
Individual shipment tracking within trips.

**Key Features:**
- Shipment creation and mapping to trips
- Status workflow management
- POD (Proof of Delivery) upload
- Exception handling
- Delay tracking

**Statuses:** Created → Confirmed → Mapped → In Pickup → In Transit → Out for Delivery → Delivered → Success

[Detailed Documentation](./shipments.md)

---

### 3. Real-Time Tracking
Multi-source tracking integration.

**Tracking Sources:**
- **GPS (Wheelseye)** - Vehicle-mounted GPS devices
- **SIM (Telenity)** - Driver mobile SIM-based tracking
- **Manual** - Manual location updates

**Features:**
- Live map view with vehicle positions
- Location history playback
- Geofencing with entry/exit alerts
- Route deviation detection
- Speed monitoring

[Detailed Documentation](./tracking.md)

---

### 4. Alerts & Exceptions
Proactive monitoring and exception management.

**Alert Types:**
- Route deviation
- Unplanned stoppage
- Extended idle time
- Tracking signal lost
- Geofence entry/exit
- Speed exceeded
- Delay warning
- Consent revoked

**Exception Types:**
- Duplicate mapping
- Capacity exceeded
- Vehicle not arrived
- Loading discrepancy
- NDR (Non-Delivery Report)
- POD rejected
- Invoice dispute

---

### 5. Master Data Management

#### Customers
- Customer profiles with contact details
- GST/PAN verification
- Location associations
- Bulk import support

#### Drivers
- Driver profiles with license details
- Document management (Aadhaar, PAN, License)
- Consent status tracking
- Transporter association

#### Vehicles
- Vehicle registration and compliance tracking
- Document expiry monitoring (RC, Insurance, Fitness, PUC, Permit)
- GPS device association
- Vehicle type classification

#### Locations
- Location/facility management
- GPS coordinates with geofencing
- Customer association
- Integration ID mapping

#### Transporters
- Transporter profiles
- Fleet association
- Contact management

---

### 6. Serviceability Lanes
Pre-defined routes for operations.

**Features:**
- Origin-destination lane definition
- Route calculation and caching
- Standard TAT (Turnaround Time) setting
- Distance tracking
- Transporter assignment
- Vehicle type specification

**Freight Types:** FTL, PTL, Express
**Modes:** Surface, Air, Rail

---

### 7. Dashboard & Reports
Operational visibility and analytics.

**Dashboard Widgets:**
- Trip status summary
- Active trip count
- Exception overview
- Delay statistics
- Fleet utilization

**Reports:**
- Trip performance reports
- Delivery metrics
- Exception analysis
- Driver performance

---

### 8. User Management
Role-based access control.

**Roles:**
- **Superadmin** - Full system access
- **Admin** - Operational access
- **User** - Limited view access

**Features:**
- User registration
- Profile management
- Role assignment
- Authentication via Supabase Auth

---

### 9. Settings Management
Centralized configuration management.

**Settings Pages:**

| Page | Route | Description |
|------|-------|-------------|
| Trip Settings | `/settings/trips` | Trip operational parameters |
| Notifications | `/settings/notifications` | Notification preferences |
| Security | `/settings/security` | Security policies |
| System | `/settings/system` | System preferences (timezone, currency) |
| Integrations | `/settings/integrations` | API token management (Super Admin) |

**Key Capabilities:**
- Configurable tracking thresholds
- Geofence radius settings
- Token status monitoring
- Auto-refresh token management

[Detailed Documentation](../settings.md)

---

## Integration Capabilities

### External Systems
- Google Maps API (Routing, Places)
- Wheelseye GPS API
- Telenity SIM Tracking API
- Resend Email API

### Data Exchange
- Bulk import via CSV
- API integration via edge functions
- Real-time webhooks (future)

---

## Mobile Responsiveness

All features are fully responsive:
- Collapsible sidebar navigation
- Responsive data tables with horizontal scroll
- Touch-friendly controls
- Optimized form layouts for mobile
