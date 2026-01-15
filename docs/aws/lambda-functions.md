# Lambda Functions Reference

> **Converting Supabase Edge Functions to AWS Lambda**

This guide covers deploying all backend functions as AWS Lambda.

---

## Function Mapping

| Supabase Edge Function | AWS Lambda | Trigger |
|------------------------|------------|---------|
| telenity-tracking | tms-telenity-tracking | API Gateway POST |
| telenity-token-refresh | tms-token-refresh | EventBridge (hourly) |
| wheelseye-tracking | tms-wheelseye-tracking | API Gateway POST |
| google-maps-route | tms-google-maps-route | API Gateway POST |
| google-maps-places | tms-google-maps-places | API Gateway GET |
| google-maps-static | tms-google-maps-static | API Gateway GET |
| google-maps-snap-to-roads | tms-snap-to-roads | API Gateway POST |
| start-trip | tms-start-trip | API Gateway POST |
| trip-alerts-monitor | tms-trip-alerts | EventBridge (5 min) |
| compliance-alerts-monitor | tms-compliance-alerts | EventBridge (daily) |
| admin-create-user | tms-admin-create-user | API Gateway POST |
| reset-user-password | tms-reset-password | API Gateway POST |
| bulk-location-update | tms-bulk-location | API Gateway POST |

---

## Project Structure

```
lambda-functions/
├── package.json
├── tsconfig.json
├── serverless.yml
├── src/
│   ├── handlers/
│   │   ├── telenity-tracking.ts
│   │   ├── wheelseye-tracking.ts
│   │   ├── google-maps-route.ts
│   │   ├── google-maps-places.ts
│   │   ├── start-trip.ts
│   │   ├── trip-alerts.ts
│   │   ├── token-refresh.ts
│   │   └── ...
│   ├── utils/
│   │   ├── db.ts
│   │   ├── secrets.ts
│   │   ├── response.ts
│   │   └── auth.ts
│   └── types/
│       └── index.ts
└── scripts/
    └── deploy.sh
```

---

## Common Utilities

### Database Connection

```typescript
// src/utils/db.ts

import { Pool, PoolClient } from 'pg';
import { getSecret } from './secrets';

let pool: Pool | null = null;

export async function getPool(): Promise<Pool> {
  if (!pool) {
    const dbConfig = await getSecret('tms-database');
    
    pool = new Pool({
      host: dbConfig.host,
      port: dbConfig.port || 5432,
      database: dbConfig.database,
      user: dbConfig.username,
      password: dbConfig.password,
      ssl: { rejectUnauthorized: false },
      max: 10,
      idleTimeoutMillis: 30000,
    });
  }
  return pool;
}

export async function query<T>(sql: string, params?: any[]): Promise<T[]> {
  const pool = await getPool();
  const result = await pool.query(sql, params);
  return result.rows;
}

export async function queryOne<T>(sql: string, params?: any[]): Promise<T | null> {
  const rows = await query<T>(sql, params);
  return rows[0] || null;
}
```

### Secrets Manager

```typescript
// src/utils/secrets.ts

import { SecretsManagerClient, GetSecretValueCommand } from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ region: process.env.AWS_REGION });
const cache: Record<string, any> = {};

export async function getSecret<T = Record<string, string>>(secretName: string): Promise<T> {
  if (cache[secretName]) {
    return cache[secretName];
  }

  const command = new GetSecretValueCommand({ SecretId: secretName });
  const response = await client.send(command);
  
  const secret = JSON.parse(response.SecretString || '{}');
  cache[secretName] = secret;
  
  return secret;
}
```

### Response Helper

```typescript
// src/utils/response.ts

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type,Authorization',
  'Content-Type': 'application/json',
};

export function success(data: any) {
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: JSON.stringify(data),
  };
}

export function error(message: string, statusCode = 500) {
  return {
    statusCode,
    headers: corsHeaders,
    body: JSON.stringify({ error: message }),
  };
}

export function options() {
  return {
    statusCode: 200,
    headers: corsHeaders,
    body: '',
  };
}
```

---

## Function Examples

### 1. Telenity Tracking

```typescript
// src/handlers/telenity-tracking.ts

import { APIGatewayProxyHandler } from 'aws-lambda';
import { query, queryOne } from '../utils/db';
import { getSecret } from '../utils/secrets';
import { success, error, options } from '../utils/response';

interface TrackingRequest {
  tripId: string;
  msisdn: string;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  // Handle CORS preflight
  if (event.httpMethod === 'OPTIONS') {
    return options();
  }

  try {
    const body: TrackingRequest = JSON.parse(event.body || '{}');
    const { tripId, msisdn } = body;

    if (!tripId || !msisdn) {
      return error('tripId and msisdn are required', 400);
    }

    // Get Telenity credentials
    const secrets = await getSecret('tms-api-keys');
    const authToken = secrets.TELENITY_AUTH_TOKEN;

    // Call Telenity API
    const response = await fetch(
      `https://api.telenity.com/v1/location/${msisdn}`,
      {
        method: 'GET',
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!response.ok) {
      console.error('Telenity API error:', await response.text());
      return error('Failed to get location from Telenity', 502);
    }

    const locationData = await response.json();

    // Store location in database
    await query(
      `INSERT INTO location_history 
       (trip_id, latitude, longitude, event_time, source, raw_response)
       VALUES ($1, $2, $3, NOW(), 'telenity', $4)`,
      [tripId, locationData.latitude, locationData.longitude, JSON.stringify(locationData)]
    );

    // Update trip's last ping
    await query(
      `UPDATE trips SET last_ping_at = NOW() WHERE id = $1`,
      [tripId]
    );

    return success({
      success: true,
      location: {
        latitude: locationData.latitude,
        longitude: locationData.longitude,
        timestamp: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Handler error:', err);
    return error('Internal server error');
  }
};
```

### 2. Google Maps Route

```typescript
// src/handlers/google-maps-route.ts

import { APIGatewayProxyHandler } from 'aws-lambda';
import { getSecret } from '../utils/secrets';
import { success, error, options } from '../utils/response';

interface RouteRequest {
  origin: { lat: number; lng: number };
  destination: { lat: number; lng: number };
  waypoints?: { lat: number; lng: number }[];
}

export const handler: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return options();
  }

  try {
    const body: RouteRequest = JSON.parse(event.body || '{}');
    const { origin, destination, waypoints } = body;

    if (!origin || !destination) {
      return error('origin and destination are required', 400);
    }

    const secrets = await getSecret('tms-api-keys');
    const apiKey = secrets.GOOGLE_MAPS_API_KEY;

    // Build waypoints string
    let waypointsParam = '';
    if (waypoints && waypoints.length > 0) {
      waypointsParam = '&waypoints=' + waypoints
        .map(wp => `${wp.lat},${wp.lng}`)
        .join('|');
    }

    const url = `https://maps.googleapis.com/maps/api/directions/json?` +
      `origin=${origin.lat},${origin.lng}` +
      `&destination=${destination.lat},${destination.lng}` +
      waypointsParam +
      `&key=${apiKey}`;

    const response = await fetch(url);
    const data = await response.json();

    if (data.status !== 'OK') {
      return error(`Google Maps API error: ${data.status}`, 502);
    }

    const route = data.routes[0];
    const leg = route.legs[0];

    return success({
      distance: leg.distance,
      duration: leg.duration,
      polyline: route.overview_polyline.points,
      steps: leg.steps,
    });
  } catch (err) {
    console.error('Handler error:', err);
    return error('Internal server error');
  }
};
```

### 3. Start Trip

```typescript
// src/handlers/start-trip.ts

import { APIGatewayProxyHandler } from 'aws-lambda';
import { query, queryOne } from '../utils/db';
import { success, error, options } from '../utils/response';

interface StartTripRequest {
  tripId: string;
}

export const handler: APIGatewayProxyHandler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return options();
  }

  try {
    const body: StartTripRequest = JSON.parse(event.body || '{}');
    const { tripId } = body;

    if (!tripId) {
      return error('tripId is required', 400);
    }

    // Get trip
    const trip = await queryOne<any>(
      'SELECT * FROM trips WHERE id = $1',
      [tripId]
    );

    if (!trip) {
      return error('Trip not found', 404);
    }

    if (trip.status !== 'created') {
      return error(`Cannot start trip with status: ${trip.status}`, 400);
    }

    // Update trip status
    await query(
      `UPDATE trips 
       SET status = 'ongoing', 
           actual_start_time = NOW(),
           updated_at = NOW()
       WHERE id = $1`,
      [tripId]
    );

    // Create audit log
    await query(
      `INSERT INTO trip_audit_logs 
       (trip_id, previous_status, new_status, change_reason)
       VALUES ($1, $2, 'ongoing', 'Trip started via API')`,
      [tripId, trip.status]
    );

    // Update related shipments
    await query(
      `UPDATE shipments 
       SET status = 'in_transit',
           in_transit_at = NOW(),
           updated_at = NOW()
       WHERE trip_id = $1 AND status = 'mapped'`,
      [tripId]
    );

    return success({
      success: true,
      trip: {
        id: tripId,
        status: 'ongoing',
        started_at: new Date().toISOString(),
      },
    });
  } catch (err) {
    console.error('Handler error:', err);
    return error('Internal server error');
  }
};
```

### 4. Token Refresh (Scheduled)

```typescript
// src/handlers/token-refresh.ts

import { ScheduledHandler } from 'aws-lambda';
import { query } from '../utils/db';
import { getSecret } from '../utils/secrets';

export const handler: ScheduledHandler = async () => {
  console.log('Starting token refresh...');

  try {
    const secrets = await getSecret('tms-api-keys');
    const basicToken = secrets.TELENITY_BASIC_TOKEN;

    // Refresh Telenity token
    const response = await fetch('https://api.telenity.com/oauth/token', {
      method: 'POST',
      headers: {
        'Authorization': `Basic ${basicToken}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: 'grant_type=client_credentials',
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    const expiresAt = new Date(Date.now() + (data.expires_in * 1000));

    // Update token in database
    await query(
      `INSERT INTO integration_tokens (token_type, token_value, expires_at)
       VALUES ('telenity', $1, $2)
       ON CONFLICT (token_type) 
       DO UPDATE SET token_value = $1, expires_at = $2, updated_at = NOW()`,
      [data.access_token, expiresAt]
    );

    console.log('Token refresh completed successfully');
  } catch (err) {
    console.error('Token refresh error:', err);
    throw err;
  }
};
```

---

## Serverless Configuration

```yaml
# serverless.yml

service: tms-api

frameworkVersion: '3'

provider:
  name: aws
  runtime: nodejs18.x
  region: ${opt:region, 'ap-south-1'}
  stage: ${opt:stage, 'prod'}
  memorySize: 512
  timeout: 30

  environment:
    AWS_NODEJS_CONNECTION_REUSE_ENABLED: '1'
    NODE_OPTIONS: '--enable-source-maps'

  vpc:
    securityGroupIds:
      - ${ssm:/tms/${self:provider.stage}/lambda-sg}
    subnetIds:
      - ${ssm:/tms/${self:provider.stage}/private-subnet-1}
      - ${ssm:/tms/${self:provider.stage}/private-subnet-2}

  iam:
    role:
      statements:
        - Effect: Allow
          Action:
            - secretsmanager:GetSecretValue
          Resource:
            - arn:aws:secretsmanager:${self:provider.region}:*:secret:tms-*

plugins:
  - serverless-esbuild
  - serverless-offline

custom:
  esbuild:
    bundle: true
    minify: true
    sourcemap: true
    target: node18

functions:
  telenityTracking:
    handler: src/handlers/telenity-tracking.handler
    events:
      - http:
          path: /telenity-tracking
          method: post
          cors: true

  wheelseyeTracking:
    handler: src/handlers/wheelseye-tracking.handler
    events:
      - http:
          path: /wheelseye-tracking
          method: post
          cors: true

  googleMapsRoute:
    handler: src/handlers/google-maps-route.handler
    events:
      - http:
          path: /google-maps-route
          method: post
          cors: true

  startTrip:
    handler: src/handlers/start-trip.handler
    events:
      - http:
          path: /trips/start
          method: post
          cors: true

  tokenRefresh:
    handler: src/handlers/token-refresh.handler
    events:
      - schedule: rate(23 hours)
    timeout: 60

  tripAlerts:
    handler: src/handlers/trip-alerts.handler
    events:
      - schedule: rate(5 minutes)
    timeout: 120
```

---

## Deployment

### Using Serverless Framework

```bash
# Install dependencies
npm install

# Deploy to production
npx serverless deploy --stage prod

# Deploy single function
npx serverless deploy function -f telenityTracking --stage prod

# View logs
npx serverless logs -f telenityTracking --stage prod --tail
```

### Manual Deployment

```bash
# Build
npm run build

# Create zip for each function
zip -j telenity-tracking.zip dist/telenity-tracking.js

# Upload to Lambda
aws lambda update-function-code \
  --function-name tms-prod-telenity-tracking \
  --zip-file fileb://telenity-tracking.zip
```

---

## Testing

### Local Testing

```bash
# Install serverless-offline
npm install -D serverless-offline

# Start local server
npx serverless offline

# Test endpoint
curl -X POST http://localhost:3000/telenity-tracking \
  -H "Content-Type: application/json" \
  -d '{"tripId": "test-123", "msisdn": "+919999999999"}'
```

### AWS Testing

```bash
# Invoke function directly
aws lambda invoke \
  --function-name tms-prod-telenity-tracking \
  --payload '{"body": "{\"tripId\": \"test\", \"msisdn\": \"+91999999\"}"}' \
  response.json

# View response
cat response.json
```

---

## Monitoring

### CloudWatch Logs

```bash
# View recent logs
aws logs tail /aws/lambda/tms-prod-telenity-tracking --follow

# Filter for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/tms-prod-telenity-tracking \
  --filter-pattern "ERROR"
```

### Set Up Alerts

```bash
aws cloudwatch put-metric-alarm \
  --alarm-name "TMS-Lambda-Errors" \
  --alarm-description "Lambda function errors" \
  --metric-name Errors \
  --namespace AWS/Lambda \
  --statistic Sum \
  --period 300 \
  --threshold 5 \
  --comparison-operator GreaterThanThreshold \
  --evaluation-periods 1 \
  --alarm-actions arn:aws:sns:ap-south-1:ACCOUNT_ID:alerts
```
