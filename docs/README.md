# Logistics TMS Documentation

## Overview

A comprehensive Transportation Management System (TMS) for logistics operations, featuring real-time tracking, shipment management, fleet operations, and configurable system settings.

## Table of Contents

1. [Features Overview](./features/README.md)
2. [Database Schema](./database-schema.md)
3. [Edge Functions](./edge-functions.md)
4. [API Integrations](./api-integrations.md)
5. [Authentication & Authorization](./auth.md)
6. [Tracking System](./features/tracking.md)
7. [Settings Management](./settings.md)
8. [**AWS Deployment Guide**](./aws/README.md) ⭐ NEW

## AWS Deployment

Ready to host on your own AWS infrastructure? See our comprehensive AWS deployment documentation:

- [AWS Overview & Quick Links](./aws/README.md) - Start here
- [30-Minute Quick Start](./aws/quick-start.md) - Fast deployment
- [Complete Deployment Guide](./aws/deployment-guide.md) - Step-by-step
- [Code Migration Guide](./aws/code-changes.md) - Frontend changes
- [Database Migration](./aws/database-migration.md) - PostgreSQL setup
- [Troubleshooting](./aws/troubleshooting.md) - Common issues

## Tech Stack

- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS
- **UI Components**: Shadcn/ui, Radix UI
- **Backend**: Supabase (PostgreSQL, Edge Functions, Auth)
- **Maps**: Google Maps API, Leaflet, Mapbox GL
- **State Management**: TanStack React Query

## Quick Links

- [Telenity Consent Flow](./telenity-consent-flow.md)
- [Security Guidelines](./security.md)
- [Settings Management](./settings.md)

## Project Structure

```
src/
├── components/          # Reusable UI components
│   ├── ui/             # Shadcn UI components
│   ├── trip/           # Trip-related components
│   ├── shipment/       # Shipment components
│   ├── tracking/       # Tracking components
│   ├── admin/          # Admin components (TokenStatusMonitor)
│   └── ...
├── pages/              # Route pages
│   ├── settings/       # Settings sub-pages
│   │   ├── SettingsLayout.tsx
│   │   ├── TripSettings.tsx
│   │   ├── NotificationSettings.tsx
│   │   ├── SecuritySettings.tsx
│   │   ├── SystemSettings.tsx
│   │   └── IntegrationSettings.tsx
│   └── ...
├── hooks/              # Custom React hooks
│   ├── useSettings.ts  # Settings management hook
│   └── ...
├── utils/              # Utility functions
├── contexts/           # React contexts
└── integrations/       # External integrations

supabase/
├── functions/          # Edge functions
│   ├── telenity-token-refresh/
│   ├── telenity-tracking/
│   ├── wheelseye-tracking/
│   ├── google-maps-route/
│   ├── google-maps-places/
│   └── ...
├── migrations/         # Database migrations
└── config.toml         # Supabase configuration
```

## Key Features

### Core Operations
- **Trip Management** - End-to-end trip lifecycle management
- **Shipment Tracking** - Individual shipment status workflow
- **Real-Time Tracking** - GPS and SIM-based location tracking
- **Alerts & Exceptions** - Proactive monitoring and exception handling

### Master Data
- Customers, Drivers, Vehicles, Transporters
- Locations with geofencing
- Serviceability Lanes with route calculation
- Materials and Vehicle Types

### Settings Management
- **Trip Settings** - Auto-assign, approval, geofence radius
- **Notification Settings** - Email, SMS, push preferences
- **Security Settings** - Session timeout, 2FA, password policies
- **System Settings** - Timezone, date format, currency, language
- **Integration Settings** - API token management (Super Admin only)

### User Management
- Role-based access control (RBAC)
- Super Admin, Admin, and User roles
- Custom role permissions
