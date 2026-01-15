# Telenity Consent Flow Documentation

## Overview

This document describes the Telenity SIM-based tracking consent flow integrated into trip creation.

## Token Management

### Two Token Types

1. **Authentication Token** (`authentication`)
   - Used for: Import API, Location API
   - Expires: 6 hours
   - Source: Smarttrail Login API
   - Base credential: `TELENITY_AUTH_TOKEN`

2. **Access Token** (`access`)
   - Used for: Consent Check API
   - Expires: 30 minutes
   - Source: Consent Auth API
   - Base credential: `TELENITY_CONSENT_AUTH_TOKEN`

### Storage

Tokens are stored in the `integration_tokens` table with automatic upsert (no duplicate rows).

## Edge Functions

### telenity-token-refresh

Endpoints:
- `POST /refresh-authentication` - Refresh authentication token
- `POST /refresh-access` - Refresh access token
- `POST /refresh-all` - Refresh both tokens
- `GET /status` - Check token validity

### telenity-tracking

Endpoints:
- `POST /import` - Import driver and send consent SMS
- `GET /check-consent` - Check driver consent status
- `GET /search` - Search entity by MSISDN
- `GET /location` - Get current location
- `GET /token-status` - Check token status

## Consent Flow

1. **Vehicle Selection**: Check if vehicle has GPS tracking asset
2. **If no GPS**: SIM tracking required → driver consent needed
3. **Driver Selection**: Check existing consent in `driver_consents` table
4. **Request Consent**: Call Import API → sends SMS to driver
5. **Check Status**: Poll Consent Check API until `ALLOWED`
6. **Create Trip**: With `sim_consent_id` linked

## Cron Jobs Setup

Run this SQL to set up automatic token refresh:

```sql
-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

-- Refresh authentication token every 5 hours
SELECT cron.schedule(
  'refresh-telenity-auth-token',
  '0 */5 * * *',
  $$
  SELECT net.http_post(
    url := 'https://ofjgwusjzgjkfwumzwwy.supabase.co/functions/v1/telenity-token-refresh/refresh-authentication',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);

-- Refresh access token every 25 minutes
SELECT cron.schedule(
  'refresh-telenity-access-token',
  '*/25 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://ofjgwusjzgjkfwumzwwy.supabase.co/functions/v1/telenity-token-refresh/refresh-access',
    headers := '{"Content-Type": "application/json"}'::jsonb
  );
  $$
);
```

## Required Secrets

- `TELENITY_AUTH_TOKEN` - Base64 authorization token for Smarttrail
- `TELENITY_CONSENT_AUTH_TOKEN` - Base64 consent auth token
