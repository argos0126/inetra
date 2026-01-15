# Feature Cards - Quick Reference

One-page summaries for each core module, perfect for sales presentations and stakeholder briefings.

---

## 🚛 Trip Management

### Key Benefits
- **60% faster trip creation** with lane templates
- **100% tracking coverage** with dual-mode tracking
- **Complete audit trail** for compliance

### Use Case
> Dispatcher creates morning trips using pre-configured lanes. System auto-calculates routes, assigns available vehicles, and initiates tracking. Operations monitors progress through real-time dashboard.

### Technical Highlights
- State machine for trip lifecycle
- Google Maps integration for routing
- Real-time ETA updates
- Configurable alert thresholds

---

## 📦 Shipment Management

### Key Benefits
- **10+ status stages** for granular tracking
- **Digital POD** collection and verification
- **Exception handling** with resolution workflow

### Use Case
> E-commerce company tracks 1000+ daily shipments. System automatically flags delays, captures delivery proof via mobile, and escalates unresolved exceptions to supervisors.

### Technical Highlights
- Multi-shipment per trip support
- Bulk import with validation
- Sub-status for detailed tracking
- Automated exception detection

---

## 📍 Real-Time Tracking

### Key Benefits
- **Dual-mode**: GPS + SIM tracking
- **Automatic fallback** ensures coverage
- **Consent management** for compliance

### Use Case
> Mixed fleet with GPS-equipped and non-equipped vehicles. System uses GPS where available, requests driver consent for SIM tracking otherwise. All vehicles visible on single dashboard.

### Technical Highlights
- WheelsEye GPS integration
- Telenity SIM tracking
- Location history storage
- Geofence monitoring

---

## ⚠️ Alert System

### Key Benefits
- **9 alert types** covering all scenarios
- **Configurable thresholds** per organization
- **Proactive notifications** before issues escalate

### Use Case
> Truck deviates from planned route. System detects within 2 minutes, alerts control tower, logs incident. Operator acknowledges, contacts driver, resolves issue. Full audit trail maintained.

### Technical Highlights
- Real-time monitoring via edge functions
- Severity-based prioritization
- Escalation workflow
- Alert analytics

---

## 👥 Master Data

### Key Benefits
- **Centralized management** of all entities
- **Compliance tracking** for documents
- **Bulk import** for scale operations

### Use Case
> Onboarding 50 new drivers. HR uploads CSV with driver details. System validates licenses, checks expiry dates, flags missing documents. Managers review and approve.

### Technical Highlights
- Document expiry tracking
- Verification status
- Transporter association
- Integration code mapping

---

## 🛣️ Serviceability Lanes

### Key Benefits
- **Pre-calculated routes** reduce planning time
- **Standard TAT** for performance benchmarking
- **Transporter mapping** for vendor management

### Use Case
> Regular route Mumbai → Pune. Lane configured with 4-hour TAT, preferred transporter, vehicle type. New trips inherit settings, reducing setup from 10 minutes to 30 seconds.

### Technical Highlights
- Google Maps route calculation
- Distance and duration storage
- Encoded polyline for display
- Multi-modal support

---

## 📊 Role-Based Dashboards

### Key Benefits
- **12+ specialized dashboards** for different roles
- **Relevant metrics only** - no information overload
- **Quick actions** for common tasks

### Use Case
> Control tower operator sees live map with all vehicles, active alerts, and exception count. One-click access to trip details, acknowledge alerts, contact drivers.

### Technical Highlights
- React Query for real-time updates
- Widget-based composition
- Responsive design
- Dark mode support

---

## 🔐 User Management

### Key Benefits
- **Granular permissions** per resource
- **Custom roles** for organization needs
- **Audit logging** for compliance

### Use Case
> New transporter partner needs limited access. Admin creates "Partner" role with view-only permissions for assigned trips. All actions logged for accountability.

### Technical Highlights
- Row-Level Security (RLS)
- JWT authentication
- Password policy enforcement
- Session management

---

## ⚙️ Settings

### Key Benefits
- **Centralized configuration** for all features
- **Per-integration settings** for fine-tuning
- **No-code customization** by admins

### Use Case
> Organization wants stricter speed alerts. Admin changes threshold from 80 to 60 km/h. Change applies immediately to all new trips without developer involvement.

### Technical Highlights
- Database-backed settings
- Real-time application
- Category-based organization
- Default value fallbacks

---

## 🔌 API Integrations

### Key Benefits
- **4 pre-built integrations** ready to use
- **Token auto-refresh** prevents failures
- **Rate limiting** controls costs

### Use Case
> Google Maps API usage spiking. Admin sets rate limit to 100 requests/minute. System queues excess requests, preventing quota exhaustion while maintaining service.

### Technical Highlights
- Edge function wrappers
- Token management table
- Cron-based refresh
- Error handling

---

## Quick Comparison Matrix

| Module | Primary User | Time Saved | Risk Reduced |
|--------|-------------|------------|--------------|
| Trip Management | Dispatcher | 60% | Medium |
| Shipment Management | Operations | 40% | High |
| Real-Time Tracking | Control Tower | 30% | Critical |
| Alert System | All | 50% | Critical |
| Master Data | Admin | 70% | Medium |
| Serviceability Lanes | Route Planner | 60% | Low |
| Dashboards | All | 40% | Low |
| User Management | Admin | 50% | High |
| Settings | Admin | 80% | Medium |
| API Integrations | IT | 90% | High |
