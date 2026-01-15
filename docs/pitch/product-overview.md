# Logistics TMS - Product Overview

## Executive Summary

**Logistics TMS** is a comprehensive Transportation Management System designed to revolutionize logistics operations through real-time tracking, intelligent alerts, and seamless workflow management. Built on modern cloud-native architecture, it provides end-to-end visibility from shipment creation to proof of delivery.

### Key Value Propositions

| Value | Impact |
|-------|--------|
| **Real-Time Visibility** | 100% tracking coverage with GPS and SIM-based tracking |
| **Proactive Alerts** | 40% reduction in delivery delays through intelligent monitoring |
| **Operational Efficiency** | 60% faster trip creation with lane-based automation |
| **Cost Optimization** | 25% reduction in tracking costs through smart API management |
| **Security First** | Enterprise-grade security with Row-Level Security (RLS) |

### Target Users

- **Logistics Companies** managing fleet operations
- **E-commerce Businesses** requiring last-mile delivery visibility
- **3PL Providers** serving multiple clients
- **Manufacturing Companies** with supply chain requirements
- **Enterprise Organizations** needing custom solutions

---

## Product Vision

### The Problem

The logistics industry faces critical challenges:

1. **Lack of Real-Time Visibility** - Shipments become "black boxes" once dispatched
2. **Fragmented Systems** - Multiple tools for tracking, alerts, and management
3. **Manual Processes** - Paper-based POD and manual status updates
4. **Delayed Response** - Issues discovered too late for corrective action
5. **Compliance Gaps** - Difficulty tracking driver documents and consent

### Our Solution

Logistics TMS provides a unified platform that:

- **Tracks Everything** - GPS, SIM, or manual tracking with automatic fallback
- **Alerts Proactively** - Detects delays, route deviations, and geofence violations
- **Automates Workflows** - Lane-based trip creation with pre-calculated routes
- **Ensures Compliance** - Document management and consent tracking
- **Scales Seamlessly** - From 10 to 10,000+ shipments per day

### Competitive Advantages

| Feature | Traditional TMS | Logistics TMS |
|---------|-----------------|---------------|
| Tracking | GPS only | GPS + SIM + Manual |
| Consent | Not managed | Full workflow |
| Alerts | Basic | 9 types with ML |
| Dashboards | Generic | 12+ role-specific |
| API Limits | Uncontrolled | Smart rate limiting |
| Security | Basic auth | RLS + RBAC |

---

## Feature Breakdown

### Module 1: Trip Management

**The Complete Trip Lifecycle**

Trips are the core operational unit, representing a vehicle's journey from origin to destination with one or more shipments.

#### Lifecycle States

```
Created → Ongoing → Completed → Closed
           ↓           ↓
        On Hold    Cancelled
```

#### Key Capabilities

| Feature | Description | Business Value |
|---------|-------------|----------------|
| **Trip Creation** | Multi-step form with validation | Reduce errors by 80% |
| **Lane Integration** | Pre-configured routes with TAT | 60% faster planning |
| **Vehicle Assignment** | Smart matching with type | Optimize capacity |
| **Driver Assignment** | Compliance-checked assignment | Ensure valid licenses |
| **Tracking Setup** | Auto-detect GPS or request SIM consent | 100% tracking coverage |
| **Trip Closure** | Structured closure with notes | Complete audit trail |

#### Automation Features

- **Auto-generate Trip Code** - Unique identifier with date prefix
- **Lane Route Calculation** - Google Maps integration for distance/duration
- **ETA Calculation** - Dynamic updates based on location history
- **Alert Monitoring** - Continuous check for 9 alert types

#### User Stories

> "As a dispatcher, I can create a trip in under 2 minutes using lane templates, reducing my daily planning time by 3 hours."

> "As an operations manager, I get real-time alerts when trips deviate from expected routes, allowing immediate intervention."

---

### Module 2: Shipment Management

**End-to-End Shipment Lifecycle**

Shipments represent individual consignments that are mapped to trips for transportation.

#### Status Workflow

```
Created → Confirmed → Mapped → In Pickup → In Transit → Out for Delivery → Delivered → Success
                                    ↓                          ↓
                                  NDR ←----------------------- Returned
```

#### Key Capabilities

| Feature | Description | Business Value |
|---------|-------------|----------------|
| **Shipment Creation** | Customer, material, location mapping | Data accuracy |
| **Trip Mapping** | Many-to-one shipment-trip relationship | Consolidation |
| **Status Tracking** | 10+ statuses with timestamps | Full visibility |
| **POD Management** | Digital upload and verification | Faster billing |
| **Exception Handling** | 11 exception types with resolution | Proactive management |
| **Bulk Import** | CSV/Excel import with validation | Scale operations |

#### Exception Types

| Exception | Description | Resolution Path |
|-----------|-------------|-----------------|
| DELAY | Shipment running late | Re-route or notify customer |
| DAMAGE | Goods damaged in transit | Insurance claim |
| SHORTAGE | Quantity mismatch | Investigation |
| WRONG_DELIVERY | Delivered to wrong address | Recovery |
| CUSTOMER_REFUSED | Customer rejected delivery | Return process |
| ADDRESS_ISSUE | Invalid/incomplete address | Address correction |
| DOCUMENTATION | Missing/wrong documents | Document update |
| WEATHER | Weather-related delay | Reschedule |
| VEHICLE_BREAKDOWN | Vehicle mechanical issue | Vehicle swap |
| ACCIDENT | Road accident | Emergency protocol |
| OTHER | Miscellaneous | Custom handling |

#### Metrics Tracked

- **Delivery Success Rate** - % of successful first-attempt deliveries
- **Average Delay** - Mean delay in hours across shipments
- **Exception Rate** - % of shipments with exceptions
- **POD Collection Time** - Hours from delivery to POD upload

---

### Module 3: Real-Time Tracking

**Dual-Mode Tracking with Automatic Fallback**

Our unique approach ensures 100% tracking coverage regardless of vehicle equipment.

#### Tracking Modes

| Mode | Source | Use Case | Accuracy |
|------|--------|----------|----------|
| **GPS** | WheelsEye API | Vehicles with GPS devices | ±5 meters |
| **SIM** | Telenity API | Driver mobile phone | ±50 meters |
| **Manual** | User input | Fallback when offline | User-defined |

#### GPS Tracking (WheelsEye)

- **Real-time Location** - Position updates every 30 seconds
- **Speed Monitoring** - Current and average speed tracking
- **Heading Detection** - Direction of travel
- **Historical Path** - Complete route visualization
- **Geofence Triggers** - Entry/exit notifications

#### SIM Tracking (Telenity)

- **Consent-Based** - GDPR-compliant driver consent
- **Cell Tower Triangulation** - Location from mobile network
- **No Hardware Required** - Works with any mobile phone
- **Automatic Expiry** - Consent valid for trip duration

#### Tracking Data Points

```typescript
interface LocationPoint {
  latitude: number;
  longitude: number;
  accuracy_meters: number;
  altitude_meters: number;
  speed_kmph: number;
  heading: number;
  event_time: timestamp;
  source: 'gps' | 'sim' | 'manual';
}
```

#### Map Features

- **Live Map View** - Real-time vehicle positions
- **Fleet Map** - All active vehicles on single map
- **Route Replay** - Historical route playback
- **Geofence Visualization** - Origin/destination zones
- **ETA Overlay** - Estimated arrival times

---

### Module 4: Alerts & Exception Management

**Proactive Issue Detection and Resolution**

Our intelligent alert system monitors trips continuously and notifies stakeholders before issues escalate.

#### Alert Types

| Alert Type | Description | Trigger | Severity |
|------------|-------------|---------|----------|
| **ROUTE_DEVIATION** | Vehicle off planned route | >2km deviation | Medium |
| **SPEED_VIOLATION** | Exceeding speed limit | >80 km/h threshold | High |
| **GEOFENCE_VIOLATION** | Unexpected zone entry/exit | Geofence breach | High |
| **LONG_STOPPAGE** | Extended unplanned stop | >30 min stationary | Medium |
| **DELAY** | Running behind schedule | ETA > planned | Medium |
| **NO_TRACKING** | Lost tracking signal | >15 min no data | Critical |
| **NIGHT_DRIVING** | Driving during restricted hours | 11 PM - 5 AM | Low |
| **FATIGUE** | Extended driving without break | >4 hours continuous | High |
| **SOS** | Emergency button pressed | Driver action | Critical |

#### Alert Lifecycle

```
Triggered → Active → Acknowledged → Resolved
              ↓
           Escalated
```

#### Configurable Thresholds

Administrators can customize alert parameters:

| Setting | Default | Range | Unit |
|---------|---------|-------|------|
| Route deviation tolerance | 2 | 1-10 | km |
| Speed limit | 80 | 40-120 | km/h |
| Long stoppage duration | 30 | 15-120 | minutes |
| No tracking timeout | 15 | 5-60 | minutes |
| Fatigue driving limit | 4 | 2-8 | hours |

#### Notification Channels

- **In-App Notifications** - Real-time dashboard alerts
- **Email Alerts** - Configurable per alert type
- **SMS Alerts** - Critical alerts via SMS (future)
- **Webhook Integration** - External system notifications (future)

---

### Module 5: Master Data Management

**Comprehensive Entity Management**

Maintain accurate master data for all operational entities with full audit trails.

#### Customers

| Field | Description | Validation |
|-------|-------------|------------|
| Display Name | Customer identifier | Required |
| Company Name | Legal entity name | Optional |
| GST Number | Tax registration | Format check |
| PAN Number | Tax ID | Format check |
| Contact Details | Email, phone, address | Email format |
| Location | GPS coordinates | Map selection |
| Integration Code | External system ID | Unique |

#### Drivers

| Field | Description | Compliance |
|-------|-------------|------------|
| Name & Mobile | Basic info | Required |
| License Number | Driving license | Expiry tracking |
| Aadhaar Number | National ID | Verification status |
| PAN Number | Tax ID | Verification status |
| Transporter | Associated transporter | Optional |
| Police Verification | Background check | Expiry tracking |
| Documents | License, Aadhaar, PAN | Upload & expiry |

#### Vehicles

| Field | Description | Compliance |
|-------|-------------|------------|
| Vehicle Number | Registration number | Unique |
| Vehicle Type | Type category | Required |
| Make/Model/Year | Vehicle details | Optional |
| RC Details | Registration certificate | Expiry tracking |
| Insurance | Insurance policy | Expiry tracking |
| Fitness | Fitness certificate | Expiry tracking |
| Permit | Route permit | Expiry tracking |
| PUC | Pollution certificate | Expiry tracking |
| Tracking Asset | GPS device link | Optional |

#### Transporters

| Field | Description |
|-------|-------------|
| Transporter Name | Company name |
| Code | Unique identifier |
| GSTIN | Tax registration |
| PAN | Tax ID |
| Contact | Email, mobile |
| Address | Full address with coordinates |

#### Locations

| Field | Description |
|-------|-------------|
| Location Name | Identifier |
| Location Type | Warehouse, Customer, Hub |
| Customer | Associated customer |
| Address | Full address |
| Coordinates | Latitude, longitude |
| Geofence Radius | GPS radius (meters) |
| SIM Radius | SIM tracking radius |

#### Bulk Import

All master data supports bulk import via CSV with:
- Template download
- Validation report
- Error highlighting
- Partial import option

---

### Module 6: Serviceability Lanes

**Pre-Configured Routes for Efficiency**

Lanes define standard routes between locations with pre-calculated parameters.

#### Lane Configuration

| Field | Description |
|-------|-------------|
| Lane Code | Unique identifier |
| Origin Location | Starting point |
| Destination Location | End point |
| Distance | Calculated via Google Maps |
| Standard TAT | Expected transit time |
| Freight Type | FTL, PTL, Express |
| Vehicle Type | Recommended vehicle |
| Transporter | Preferred transporter |
| Serviceability Mode | Road, Rail, Air, Sea |

#### Route Calculation

Integrated with Google Maps API for:
- **Optimal Route** - Best path considering traffic
- **Distance** - Accurate road distance
- **Duration** - Estimated travel time
- **Encoded Polyline** - Route for map display
- **Waypoints** - Intermediate stops

#### Benefits

| Benefit | Impact |
|---------|--------|
| Faster Trip Creation | 60% time reduction |
| Consistent Pricing | Accurate cost estimation |
| TAT Compliance | Measurable performance |
| Transporter Selection | Optimal vendor matching |

---

### Module 7: Role-Based Dashboards

**Personalized Views for Every User**

Each role gets a tailored dashboard with relevant metrics and quick actions.

#### Dashboard Types

| Role | Dashboard Focus | Key Widgets |
|------|-----------------|-------------|
| **SuperAdmin** | System overview | All metrics, user management |
| **Admin** | Operations overview | Trips, shipments, alerts |
| **Operations** | Day-to-day operations | Active trips, exceptions |
| **Dispatcher** | Trip assignment | Pending trips, vehicle availability |
| **Driver Coordinator** | Driver management | Driver status, consents |
| **Route Planner** | Route optimization | Lane performance, TAT |
| **Fleet Manager** | Vehicle management | Fleet status, maintenance |
| **Control Tower** | Real-time monitoring | Live map, alerts |
| **Data Entry** | Data management | Pending entries, validations |
| **Billing** | Financial operations | POD status, invoicing |
| **Support** | Issue resolution | Exceptions, escalations |
| **Viewer** | Read-only access | Summary statistics |

#### Widget Types

| Widget | Purpose |
|--------|---------|
| **StatWidget** | Key metrics with trend |
| **QuickActionCard** | One-click operations |
| **TripExceptionsWidget** | Alert summary |
| **FleetMapView** | Vehicle positions |
| **LiveMapView** | Single trip tracking |

---

### Module 8: User Management & Security

**Enterprise-Grade Access Control**

Comprehensive user management with Role-Based Access Control (RBAC).

#### Role Hierarchy

```
SuperAdmin
    ├── Admin
    │     ├── Operations
    │     ├── Dispatcher
    │     ├── Driver Coordinator
    │     ├── Route Planner
    │     ├── Fleet Manager
    │     ├── Control Tower
    │     ├── Data Entry
    │     ├── Billing
    │     └── Support
    └── Shipper Admin
          └── Shipper User
    └── Transporter
    └── Viewer
```

#### Permission Matrix

| Resource | View | Create | Edit | Delete |
|----------|------|--------|------|--------|
| Trips | ✓ | Role-based | Role-based | Admin only |
| Shipments | ✓ | Role-based | Role-based | Admin only |
| Customers | ✓ | Admin | Admin | SuperAdmin |
| Drivers | ✓ | Admin | Admin | SuperAdmin |
| Vehicles | ✓ | Admin | Admin | SuperAdmin |
| Users | Admin | SuperAdmin | SuperAdmin | SuperAdmin |
| Roles | Admin | SuperAdmin | SuperAdmin | SuperAdmin |
| Settings | Admin | SuperAdmin | SuperAdmin | - |

#### Security Features

| Feature | Description |
|---------|-------------|
| **Row-Level Security** | Database-level access control |
| **JWT Authentication** | Secure token-based auth |
| **Password Policy** | Min 8 chars, complexity required |
| **Session Management** | Automatic timeout |
| **Audit Logging** | All actions logged |
| **API Rate Limiting** | Prevent abuse |

---

### Module 9: Settings & Configuration

**Flexible System Configuration**

Administrators can customize system behavior through comprehensive settings.

#### Trip Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Default Trip Status | Initial status for new trips | Created |
| Auto-generate Trip Code | Automatic code generation | Enabled |
| Require Driver for Start | Driver must be assigned | Enabled |
| Require Vehicle for Start | Vehicle must be assigned | Enabled |
| Allow Trip Without Shipments | Start empty trips | Disabled |
| Route Deviation Threshold | Alert tolerance (km) | 2 |
| Speed Limit Threshold | Alert threshold (km/h) | 80 |
| Long Stoppage Threshold | Alert threshold (min) | 30 |

#### Notification Settings

| Setting | Description | Default |
|---------|-------------|---------|
| Email Notifications | Enable email alerts | Enabled |
| Trip Started Alert | Notify on trip start | Enabled |
| Trip Completed Alert | Notify on completion | Enabled |
| Delay Alert | Notify on delays | Enabled |
| Exception Alert | Notify on exceptions | Enabled |

#### Integration Settings

| Integration | Settings |
|-------------|----------|
| **Telenity** | Enable/disable, update interval |
| **WheelsEye** | Enable/disable, update interval |
| **Google Maps** | Rate limit per minute |
| **Resend** | Daily email limit |

---

### Module 10: API Integration Hub

**Seamless Third-Party Connectivity**

Centralized management of all external API integrations.

#### Telenity (SIM Tracking)

| Endpoint | Purpose |
|----------|---------|
| `/import` | Register driver and send consent SMS |
| `/check-consent` | Verify consent status |
| `/location` | Get current location |
| `/search` | Search by MSISDN |

**Token Management:**
- Authentication token (6-hour expiry, auto-refresh every 5 hours)
- Access token (30-minute expiry, auto-refresh every 25 minutes)

#### WheelsEye (GPS Tracking)

| Endpoint | Purpose |
|----------|---------|
| `/vehicle-location` | Get vehicle position |
| `/vehicle-history` | Get historical path |

**Token Management:**
- API key based authentication
- Token stored securely in database

#### Google Maps

| Endpoint | Purpose |
|----------|---------|
| `/directions` | Route calculation |
| `/distance-matrix` | Multi-point distances |
| `/places` | Location search |
| `/geocode` | Address to coordinates |
| `/static-maps` | Map images |
| `/snap-to-roads` | Path correction |

**Rate Limiting:**
- Configurable requests per minute
- Queue management for burst traffic

#### Resend (Email)

| Endpoint | Purpose |
|----------|---------|
| `/send` | Send transactional email |

**Limits:**
- Configurable daily email limit
- Template-based emails

---

## Technical Architecture

### Frontend Stack

| Technology | Purpose |
|------------|---------|
| **React 18** | UI framework |
| **TypeScript** | Type safety |
| **Vite** | Build tool |
| **Tailwind CSS** | Styling |
| **TanStack Query** | Data fetching |
| **React Router** | Navigation |
| **Leaflet/Mapbox** | Map visualization |
| **Recharts** | Charts and graphs |
| **Shadcn/UI** | Component library |

### Backend Stack

| Technology | Purpose |
|------------|---------|
| **Supabase** | Backend-as-a-Service |
| **PostgreSQL** | Database |
| **Edge Functions** | Serverless API |
| **Row-Level Security** | Access control |
| **Realtime** | Live updates |
| **Storage** | File management |

### Database Design

- **20+ Tables** with foreign key relationships
- **RLS Policies** on all tables
- **Audit Triggers** for change tracking
- **Indexes** for query optimization
- **Views** for complex queries

---

## Scalability & Performance

### Horizontal Scaling

| Component | Strategy |
|-----------|----------|
| Frontend | CDN distribution |
| Edge Functions | Auto-scaling serverless |
| Database | Connection pooling |
| File Storage | Distributed storage |

### Performance Optimizations

| Optimization | Impact |
|--------------|--------|
| Query caching | 50% faster reads |
| Lazy loading | Faster initial load |
| Pagination | Handle 1M+ records |
| Rate limiting | Controlled API costs |
| Connection pooling | 10x more concurrent users |

### Monitoring

- **Error Tracking** - Automatic error capture
- **Performance Metrics** - Response time monitoring
- **API Usage** - Integration call tracking
- **User Analytics** - Usage patterns

---

## Pricing Model Suggestions

### Tier-Based Pricing

| Tier | Trips/Month | Price | Features |
|------|-------------|-------|----------|
| **Starter** | Up to 100 | $99/mo | Core features |
| **Professional** | Up to 500 | $299/mo | + Alerts, API |
| **Business** | Up to 2,000 | $799/mo | + Multi-user, SSO |
| **Enterprise** | Unlimited | Custom | + On-premise, SLA |

### Usage-Based Components

| Component | Unit | Price |
|-----------|------|-------|
| Additional Trips | Per 100 | $49 |
| API Calls | Per 10,000 | $10 |
| Storage | Per 10GB | $5 |
| Email Notifications | Per 1,000 | $2 |

### Add-Ons

| Add-On | Price |
|--------|-------|
| White-labeling | $199/mo |
| Custom Integrations | $499 setup |
| Priority Support | $149/mo |
| SLA Guarantee | $299/mo |

---

## Conclusion

Logistics TMS provides a comprehensive, modern solution for transportation management challenges. With its dual-mode tracking, intelligent alerts, and role-based dashboards, it delivers unmatched visibility and operational efficiency.

**Ready to transform your logistics operations?**

Contact us for a personalized demo.
