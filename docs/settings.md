# Settings Management

## Overview

The Settings module provides centralized configuration management for the TMS application. Settings are organized into individual pages for better navigation and maintainability.

## Settings Pages

### URL Structure

| Page | Route | Access Level |
|------|-------|--------------|
| Trip Settings | `/settings/trips` | All authenticated users |
| Notifications | `/settings/notifications` | All authenticated users |
| Security | `/settings/security` | All authenticated users |
| System | `/settings/system` | All authenticated users |
| Integrations | `/settings/integrations` | Super Admin only |

## Trip Settings

**Route:** `/settings/trips`

Configures trip-related operational parameters.

### Available Settings

| Setting | Key | Default | Description |
|---------|-----|---------|-------------|
| Auto-Assign Drivers | `auto_assign_drivers` | false | Automatically assign drivers to trips |
| Require Trip Approval | `require_trip_approval` | false | Require approval before trip starts |
| Default Trip Duration | `default_trip_duration_hours` | 24 | Default duration in hours |
| Vehicle Proximity Radius | `vehicle_proximity_radius_km` | 50 | Radius for vehicle proximity checks (km) |
| Origin Geofence Radius | `origin_geofence_radius_km` | 2 | Geofence radius at origin (km) |
| Destination Geofence Radius | `destination_geofence_radius_km` | 2 | Geofence radius at destination (km) |

### Tracking Thresholds

| Setting | Key | Default | Description |
|---------|-----|---------|-------------|
| Tracking Frequency | `tracking_frequency_seconds` | 900 | Location poll interval (seconds) |
| Route Deviation Threshold | `route_deviation_threshold_meters` | 500 | Distance for route deviation alert (meters) |
| Stoppage Threshold | `stoppage_threshold_minutes` | 30 | Duration for stoppage alert (minutes) |
| Tracking Lost Threshold | `tracking_lost_threshold_minutes` | 30 | No-signal duration for lost alert (minutes) |
| Delay Threshold | `delay_threshold_minutes` | 60 | Duration for delay warning (minutes) |
| Idle Threshold | `idle_threshold_minutes` | 120 | Duration for idle time alert (minutes) |

---

## Notification Settings

**Route:** `/settings/notifications`

Configures notification preferences and channels.

### Notification Channels

| Channel | Description |
|---------|-------------|
| Email | Email notifications via Resend API |
| SMS | SMS alerts (future) |
| Push | Browser push notifications (future) |

### Notification Types

| Type | Description |
|------|-------------|
| Trip Alerts | Route deviation, stoppage, tracking lost |
| Shipment Updates | Status changes, exceptions |
| Driver Consent | Consent requested, approved, expired |
| System Alerts | Token expiry, API errors |

---

## Security Settings

**Route:** `/settings/security`

Configures security policies and access controls.

### Available Settings

| Setting | Description |
|---------|-------------|
| Session Timeout | Auto-logout after inactivity period |
| Two-Factor Authentication | Enable 2FA for all users |
| Password Policy | Minimum requirements for passwords |
| IP Whitelist | Restrict access to specific IPs |

---

## System Settings

**Route:** `/settings/system`

Configures system-wide preferences.

### Available Settings

| Setting | Key | Default | Description |
|---------|-----|---------|-------------|
| Timezone | `timezone` | Asia/Kolkata | System timezone |
| Date Format | `dateFormat` | DD/MM/YYYY | Date display format |
| Currency | `currency` | INR | Default currency |
| Language | `language` | en | UI language |

---

## Integration Settings

**Route:** `/settings/integrations`

Manages external API integrations and tokens. **Super Admin access only.**

### Token Status Monitor

Displays current status of integration tokens:

| Token | Expiry | Auto-Refresh |
|-------|--------|--------------|
| Telenity Auth Token | 6 hours | Every 5 hours |
| Telenity Access Token | 30 minutes | Every 25 minutes |

### Token Actions

| Action | Description |
|--------|-------------|
| Refresh All | Refreshes both authentication and access tokens |
| Refresh Individual | Refresh specific token type |

### Integration Status

Displays connectivity status for:
- Telenity API (SIM tracking)
- WheelsEye API (GPS tracking)
- Google Maps API (Route calculation)
- Resend Email API (Notifications)

---

## Technical Implementation

### Settings Storage

Settings are stored in the `tracking_settings` table:

```sql
CREATE TABLE tracking_settings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  setting_key text UNIQUE NOT NULL,
  setting_value text NOT NULL,
  description text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
```

### Settings Hook

The `useSettings` hook provides centralized settings management:

```typescript
import { useSettings } from '@/hooks/useSettings';

const {
  settings,       // Current settings object
  loading,        // Loading state
  saving,         // Saving state
  handleSave,     // Save settings function
  handleReset,    // Reset to defaults function
  handleSettingChange,   // Update individual setting
  handleSwitchChange,    // Update boolean setting
} = useSettings();
```

### Components

| Component | Path | Description |
|-----------|------|-------------|
| SettingsLayout | `src/pages/settings/SettingsLayout.tsx` | Shared layout with sidebar |
| TripSettings | `src/pages/settings/TripSettings.tsx` | Trip configuration |
| NotificationSettings | `src/pages/settings/NotificationSettings.tsx` | Notification preferences |
| SecuritySettings | `src/pages/settings/SecuritySettings.tsx` | Security settings |
| SystemSettings | `src/pages/settings/SystemSettings.tsx` | System preferences |
| IntegrationSettings | `src/pages/settings/IntegrationSettings.tsx` | API integrations |
| TokenStatusMonitor | `src/components/admin/TokenStatusMonitor.tsx` | Token status display |

### Routing

Settings routes are defined in `App.tsx`:

```tsx
<Route path="/settings" element={<Settings />} />
<Route path="/settings/trips" element={<TripSettings />} />
<Route path="/settings/notifications" element={<NotificationSettings />} />
<Route path="/settings/security" element={<SecuritySettings />} />
<Route path="/settings/system" element={<SystemSettings />} />
<Route path="/settings/integrations" element={<IntegrationSettings />} />
```

---

## Access Control

### Page-Level Access

| Page | Required Role |
|------|---------------|
| Trip Settings | Authenticated user |
| Notifications | Authenticated user |
| Security | Authenticated user |
| System | Authenticated user |
| Integrations | Super Admin |

### Integration Settings Protection

```typescript
// IntegrationSettings.tsx
const { isSuperAdmin } = usePermissions();

if (!isSuperAdmin) {
  return <Navigate to="/settings/trips" replace />;
}
```

---

## Token Refresh API

### Edge Function: `telenity-token-refresh`

**Endpoints:**

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/refresh-authentication` | POST | Refresh auth token |
| `/refresh-access` | POST | Refresh access token |
| `/refresh-all` | POST | Refresh both tokens |
| `/status` | GET | Get token status |

**Usage from Frontend:**

```typescript
// Refresh all tokens
await supabase.functions.invoke('telenity-token-refresh/refresh-all', {
  body: {}
});

// Refresh specific token
await supabase.functions.invoke('telenity-token-refresh/refresh-access', {
  body: {}
});
```

---

## UI/UX Patterns

### Settings Layout

```
┌─────────────────────────────────────────────────────────────┐
│ Settings                                     [Reset] [Save] │
├────────────────┬────────────────────────────────────────────┤
│                │                                            │
│  📋 Trips      │   Trip Management Settings                 │
│  🔔 Notif.     │   ─────────────────────────               │
│  🛡️ Security   │   [ ] Auto-Assign Drivers                  │
│  🌐 System     │   [ ] Require Trip Approval                │
│  🔑 Integr.*   │   Default Trip Duration: [___]             │
│                │                                            │
│  * Super Admin │                                            │
│                │                                            │
└────────────────┴────────────────────────────────────────────┘
```

### Save/Reset Actions

- **Save**: Persists current settings to database
- **Reset**: Reverts to default values (with confirmation)

### Toast Notifications

- Success: "Settings saved successfully"
- Error: "Failed to save settings"
- Info: "Settings reset to defaults"
