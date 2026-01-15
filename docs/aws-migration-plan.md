# AWS Migration Plan

This document outlines the migration strategy from Supabase to AWS infrastructure with self-hosted PostgreSQL.

## Table of Contents

1. [Migration Overview](#migration-overview)
2. [Infrastructure Architecture](#infrastructure-architecture)
3. [Database Migration](#database-migration)
4. [Edge Functions to AWS Lambda](#edge-functions-to-aws-lambda)
5. [Cron Jobs with AWS](#cron-jobs-with-aws)
6. [Authentication Migration](#authentication-migration)
7. [Storage Migration](#storage-migration)
8. [Real-time Features](#real-time-features)
9. [Cost Comparison](#cost-comparison)
10. [Migration Checklist](#migration-checklist)

---

## Migration Overview

### Current Supabase Stack

| Component | Supabase Service | AWS Equivalent |
|-----------|------------------|----------------|
| Database | PostgreSQL (managed) | RDS PostgreSQL / Aurora |
| Edge Functions | Deno Edge Functions | AWS Lambda |
| Authentication | Supabase Auth | Amazon Cognito |
| Storage | Supabase Storage | Amazon S3 |
| Real-time | Supabase Realtime | AWS AppSync / WebSocket API |
| Cron Jobs | pg_cron + pg_net | EventBridge + Lambda |

### Migration Phases

```
Phase 1: Infrastructure Setup (Week 1-2)
    └── VPC, RDS, Lambda, S3, Cognito setup

Phase 2: Database Migration (Week 3-4)
    └── Schema migration, data transfer, RLS → application-level auth

Phase 3: Application Migration (Week 5-6)
    └── Edge functions → Lambda, client SDK changes

Phase 4: Testing & Cutover (Week 7-8)
    └── Integration testing, performance testing, go-live
```

---

## Infrastructure Architecture

### Recommended AWS Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         AWS Cloud                                │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────────────┐  │
│  │   Route 53  │───▶│ CloudFront  │───▶│   S3 (Frontend)     │  │
│  └─────────────┘    └─────────────┘    └─────────────────────┘  │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                    API Gateway                               ││
│  └─────────────────────────────────────────────────────────────┘│
│         │              │              │              │          │
│         ▼              ▼              ▼              ▼          │
│  ┌───────────┐  ┌───────────┐  ┌───────────┐  ┌───────────┐    │
│  │  Lambda   │  │  Lambda   │  │  Lambda   │  │  Lambda   │    │
│  │ (tracking)│  │ (maps)    │  │ (auth)    │  │ (trips)   │    │
│  └───────────┘  └───────────┘  └───────────┘  └───────────┘    │
│         │              │              │              │          │
│         └──────────────┴──────────────┴──────────────┘          │
│                            │                                     │
│                            ▼                                     │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │              RDS PostgreSQL (Multi-AZ)                       ││
│  │  ┌─────────┐    ┌─────────┐                                 ││
│  │  │ Primary │───▶│ Replica │                                 ││
│  │  └─────────┘    └─────────┘                                 ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐        │
│  │ EventBridge   │  │   Cognito     │  │      S3       │        │
│  │ (Scheduler)   │  │   (Auth)      │  │   (Storage)   │        │
│  └───────────────┘  └───────────────┘  └───────────────┘        │
└─────────────────────────────────────────────────────────────────┘
```

### Terraform Infrastructure

```hcl
# main.tf - Core Infrastructure

provider "aws" {
  region = "ap-south-1"  # Mumbai for India-based logistics
}

# VPC Configuration
module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "logistics-tms-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = false  # High availability

  tags = {
    Environment = "production"
    Project     = "logistics-tms"
  }
}

# RDS PostgreSQL
module "rds" {
  source  = "terraform-aws-modules/rds/aws"
  version = "~> 6.0"

  identifier = "logistics-tms-db"

  engine               = "postgres"
  engine_version       = "15.4"
  family               = "postgres15"
  major_engine_version = "15"
  instance_class       = "db.r6g.large"

  allocated_storage     = 100
  max_allocated_storage = 500

  db_name  = "logistics_tms"
  username = "postgres"
  port     = 5432

  multi_az               = true
  db_subnet_group_name   = module.vpc.database_subnet_group
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 30
  skip_final_snapshot     = false
  deletion_protection     = true

  performance_insights_enabled = true
  
  parameters = [
    {
      name  = "log_connections"
      value = "1"
    }
  ]
}
```

---

## Database Migration

### Schema Migration Steps

#### 1. Export Supabase Schema

```bash
# Connect to Supabase and export schema
pg_dump -h db.ofjgwusjzgjkfwumzwwy.supabase.co \
  -U postgres \
  -d postgres \
  --schema-only \
  --no-owner \
  --no-privileges \
  -f schema.sql
```

#### 2. Modify Schema for RDS

Remove Supabase-specific extensions and functions:

```sql
-- Remove Supabase-specific items from schema.sql
-- Comment out or remove:
-- - References to auth.users (replace with application users table)
-- - pg_net extension calls
-- - Supabase-specific triggers

-- Create application-level users table
CREATE TABLE public.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255) NOT NULL,
  first_name VARCHAR(100),
  last_name VARCHAR(100),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Modify foreign key references
-- FROM: user_id UUID REFERENCES auth.users(id)
-- TO: user_id UUID REFERENCES public.app_users(id)
```

#### 3. RLS to Application-Level Authorization

Supabase RLS policies must be converted to application-level checks:

**Current Supabase RLS:**
```sql
CREATE POLICY "Users can view their own trips"
ON trips FOR SELECT
USING (auth.uid() = user_id);
```

**AWS Lambda Authorization:**
```typescript
// middleware/authorization.ts
import { APIGatewayProxyEvent } from 'aws-lambda';
import { Pool } from 'pg';

interface AuthContext {
  userId: string;
  roles: string[];
}

export async function authorizeTripsAccess(
  event: APIGatewayProxyEvent,
  tripId: string,
  pool: Pool
): Promise<boolean> {
  const authContext = await extractAuthContext(event);
  
  // Check if user has access to this trip
  const result = await pool.query(
    `SELECT 1 FROM trips 
     WHERE id = $1 
     AND (
       user_id = $2 
       OR EXISTS (
         SELECT 1 FROM user_roles 
         WHERE user_id = $2 AND role IN ('admin', 'superadmin')
       )
     )`,
    [tripId, authContext.userId]
  );
  
  return result.rowCount > 0;
}

export async function extractAuthContext(
  event: APIGatewayProxyEvent
): Promise<AuthContext> {
  const token = event.headers.Authorization?.replace('Bearer ', '');
  // Validate JWT with Cognito
  const decoded = await verifyCognitoToken(token);
  
  return {
    userId: decoded.sub,
    roles: decoded['custom:roles']?.split(',') || ['user']
  };
}
```

#### 4. Data Migration

```bash
# Export data from Supabase
pg_dump -h db.ofjgwusjzgjkfwumzwwy.supabase.co \
  -U postgres \
  -d postgres \
  --data-only \
  --no-owner \
  -f data.sql

# Import to RDS
psql -h logistics-tms-db.xxxx.ap-south-1.rds.amazonaws.com \
  -U postgres \
  -d logistics_tms \
  -f schema.sql

psql -h logistics-tms-db.xxxx.ap-south-1.rds.amazonaws.com \
  -U postgres \
  -d logistics_tms \
  -f data.sql
```

---

## Edge Functions to AWS Lambda

### Function Mapping

| Supabase Edge Function | AWS Lambda Function | Trigger |
|------------------------|---------------------|---------|
| telenity-tracking | telenity-tracking-fn | API Gateway |
| telenity-token-refresh | telenity-token-refresh-fn | EventBridge (scheduled) |
| wheelseye-tracking | wheelseye-tracking-fn | API Gateway |
| google-maps-route | google-maps-route-fn | API Gateway |
| google-maps-places | google-maps-places-fn | API Gateway |
| start-trip | start-trip-fn | API Gateway |

### Lambda Function Example

**Supabase Edge Function (Current):**
```typescript
// supabase/functions/telenity-tracking/index.ts
import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )
  // ... function logic
})
```

**AWS Lambda Equivalent:**
```typescript
// lambda/telenity-tracking/index.ts
import { APIGatewayProxyHandler } from 'aws-lambda';
import { Pool } from 'pg';
import { SecretsManager } from '@aws-sdk/client-secrets-manager';

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: { rejectUnauthorized: false }
});

export const handler: APIGatewayProxyHandler = async (event) => {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type,Authorization',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  try {
    const body = JSON.parse(event.body || '{}');
    const { tripId, msisdn } = body;

    // Get Telenity token from Secrets Manager
    const secretsManager = new SecretsManager({ region: 'ap-south-1' });
    const secret = await secretsManager.getSecretValue({
      SecretId: 'telenity-credentials'
    });
    const { authToken } = JSON.parse(secret.SecretString!);

    // Call Telenity API
    const response = await fetch(
      `https://api.telenity.com/location/${msisdn}`,
      {
        headers: {
          'Authorization': `Bearer ${authToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    const locationData = await response.json();

    // Store in PostgreSQL
    await pool.query(
      `INSERT INTO location_history 
       (trip_id, latitude, longitude, event_time, source)
       VALUES ($1, $2, $3, NOW(), 'telenity')`,
      [tripId, locationData.latitude, locationData.longitude]
    );

    // Update trip's last ping
    await pool.query(
      `UPDATE trips SET last_ping_at = NOW() WHERE id = $1`,
      [tripId]
    );

    return {
      statusCode: 200,
      headers: corsHeaders,
      body: JSON.stringify({
        success: true,
        location: locationData
      })
    };
  } catch (error) {
    console.error('Error:', error);
    return {
      statusCode: 500,
      headers: corsHeaders,
      body: JSON.stringify({ error: 'Internal server error' })
    };
  }
};
```

### Lambda Deployment Configuration

```yaml
# serverless.yml
service: logistics-tms-api

provider:
  name: aws
  runtime: nodejs18.x
  region: ap-south-1
  stage: ${opt:stage, 'prod'}
  
  environment:
    DB_HOST: ${ssm:/logistics-tms/db-host}
    DB_PORT: '5432'
    DB_NAME: logistics_tms
    DB_USER: ${ssm:/logistics-tms/db-user}
    DB_PASSWORD: ${ssm:/logistics-tms/db-password~true}

  vpc:
    securityGroupIds:
      - ${ssm:/logistics-tms/lambda-sg}
    subnetIds:
      - ${ssm:/logistics-tms/private-subnet-1}
      - ${ssm:/logistics-tms/private-subnet-2}

  iam:
    role:
      statements:
        - Effect: Allow
          Action:
            - secretsmanager:GetSecretValue
          Resource: 
            - arn:aws:secretsmanager:ap-south-1:*:secret:telenity-*
            - arn:aws:secretsmanager:ap-south-1:*:secret:wheelseye-*
            - arn:aws:secretsmanager:ap-south-1:*:secret:google-maps-*

functions:
  telenityTracking:
    handler: src/handlers/telenity-tracking.handler
    events:
      - http:
          path: /tracking/telenity
          method: post
          cors: true
    timeout: 30
    memorySize: 256

  wheelseyeTracking:
    handler: src/handlers/wheelseye-tracking.handler
    events:
      - http:
          path: /tracking/wheelseye
          method: post
          cors: true
    timeout: 30
    memorySize: 256

  googleMapsRoute:
    handler: src/handlers/google-maps-route.handler
    events:
      - http:
          path: /maps/route
          method: post
          cors: true
    timeout: 30
    memorySize: 256

  googleMapsPlaces:
    handler: src/handlers/google-maps-places.handler
    events:
      - http:
          path: /maps/places
          method: get
          cors: true
    timeout: 15
    memorySize: 256

  startTrip:
    handler: src/handlers/start-trip.handler
    events:
      - http:
          path: /trips/start
          method: post
          cors: true
    timeout: 30
    memorySize: 256

  # Scheduled functions
  telenityTokenRefresh:
    handler: src/handlers/telenity-token-refresh.handler
    events:
      - schedule: rate(50 minutes)
    timeout: 60
    memorySize: 256
```

---

## Cron Jobs with AWS

### Current pg_cron Jobs

The project uses pg_cron for scheduled tasks. These need to be migrated to AWS EventBridge.

### EventBridge Scheduler Configuration

```typescript
// infrastructure/schedulers.ts
import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';

export class SchedulersStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Token Refresh - Every 50 minutes
    const tokenRefreshRule = new events.Rule(this, 'TelenityTokenRefresh', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(50)),
      description: 'Refresh Telenity OAuth token'
    });

    tokenRefreshRule.addTarget(
      new targets.LambdaFunction(tokenRefreshLambda)
    );

    // Active Trip Tracking - Every 5 minutes
    const trackingRule = new events.Rule(this, 'ActiveTripTracking', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      description: 'Poll location for active trips'
    });

    trackingRule.addTarget(
      new targets.LambdaFunction(trackingPollerLambda)
    );

    // Daily Reports - Every day at 6 AM IST
    const dailyReportRule = new events.Rule(this, 'DailyReports', {
      schedule: events.Schedule.cron({
        minute: '30',
        hour: '1',  // 1:30 AM UTC = 7:00 AM IST
        day: '*',
        month: '*',
        year: '*'
      }),
      description: 'Generate daily operational reports'
    });

    dailyReportRule.addTarget(
      new targets.LambdaFunction(dailyReportLambda)
    );

    // Consent Expiry Check - Daily at midnight
    const consentExpiryRule = new events.Rule(this, 'ConsentExpiryCheck', {
      schedule: events.Schedule.cron({
        minute: '0',
        hour: '18',  // 6:00 PM UTC = 11:30 PM IST
        day: '*',
        month: '*',
        year: '*'
      }),
      description: 'Check and update expired driver consents'
    });

    consentExpiryRule.addTarget(
      new targets.LambdaFunction(consentExpiryLambda)
    );

    // ETA Recalculation - Every 15 minutes for active trips
    const etaRecalcRule = new events.Rule(this, 'ETARecalculation', {
      schedule: events.Schedule.rate(cdk.Duration.minutes(15)),
      description: 'Recalculate ETA for ongoing trips'
    });

    etaRecalcRule.addTarget(
      new targets.LambdaFunction(etaRecalcLambda)
    );
  }
}
```

### Scheduled Lambda Functions

```typescript
// lambda/scheduled/tracking-poller.ts
import { ScheduledHandler } from 'aws-lambda';
import { Pool } from 'pg';
import { SQS } from '@aws-sdk/client-sqs';

const pool = new Pool({ /* config */ });
const sqs = new SQS({ region: 'ap-south-1' });

export const handler: ScheduledHandler = async (event) => {
  console.log('Starting active trip tracking poll');

  // Get all active trips that need tracking
  const result = await pool.query(`
    SELECT 
      t.id,
      t.tracking_type,
      t.tracking_asset_id,
      t.driver_id,
      d.mobile as driver_mobile,
      ta.asset_type,
      ta.api_url,
      dc.msisdn
    FROM trips t
    LEFT JOIN drivers d ON t.driver_id = d.id
    LEFT JOIN tracking_assets ta ON t.tracking_asset_id = ta.id
    LEFT JOIN driver_consents dc ON t.sim_consent_id = dc.id
    WHERE t.status = 'ongoing'
    AND t.is_trackable = true
    AND (
      t.last_ping_at IS NULL 
      OR t.last_ping_at < NOW() - INTERVAL '5 minutes'
    )
  `);

  console.log(`Found ${result.rowCount} trips to poll`);

  // Queue tracking requests for each trip
  for (const trip of result.rows) {
    await sqs.sendMessage({
      QueueUrl: process.env.TRACKING_QUEUE_URL!,
      MessageBody: JSON.stringify({
        tripId: trip.id,
        trackingType: trip.tracking_type,
        msisdn: trip.msisdn,
        assetType: trip.asset_type,
        apiUrl: trip.api_url
      })
    });
  }

  return {
    statusCode: 200,
    body: JSON.stringify({
      message: `Queued ${result.rowCount} tracking requests`
    })
  };
};
```

```typescript
// lambda/scheduled/consent-expiry-check.ts
import { ScheduledHandler } from 'aws-lambda';
import { Pool } from 'pg';
import { SNS } from '@aws-sdk/client-sns';

const pool = new Pool({ /* config */ });
const sns = new SNS({ region: 'ap-south-1' });

export const handler: ScheduledHandler = async (event) => {
  console.log('Checking for expired consents');

  // Update expired consents
  const expiredResult = await pool.query(`
    UPDATE driver_consents
    SET consent_status = 'expired',
        updated_at = NOW()
    WHERE consent_status = 'allowed'
    AND consent_expires_at < NOW()
    RETURNING id, driver_id, trip_id
  `);

  console.log(`Expired ${expiredResult.rowCount} consents`);

  // Create alerts for affected trips
  for (const consent of expiredResult.rows) {
    if (consent.trip_id) {
      await pool.query(`
        INSERT INTO trip_alerts (
          trip_id,
          alert_type,
          title,
          description,
          severity,
          status,
          triggered_at
        ) VALUES (
          $1,
          'consent_revoked',
          'Driver Consent Expired',
          'The driver tracking consent has expired. Location tracking is no longer available.',
          'high',
          'active',
          NOW()
        )
      `, [consent.trip_id]);

      // Send notification
      await sns.publish({
        TopicArn: process.env.ALERTS_TOPIC_ARN!,
        Message: JSON.stringify({
          type: 'CONSENT_EXPIRED',
          tripId: consent.trip_id,
          driverId: consent.driver_id
        }),
        Subject: 'Driver Consent Expired'
      });
    }
  }

  // Check for consents expiring soon (within 24 hours)
  const expiringResult = await pool.query(`
    SELECT dc.*, t.trip_code, d.name as driver_name
    FROM driver_consents dc
    JOIN trips t ON dc.trip_id = t.id
    JOIN drivers d ON dc.driver_id = d.id
    WHERE dc.consent_status = 'allowed'
    AND dc.consent_expires_at BETWEEN NOW() AND NOW() + INTERVAL '24 hours'
    AND t.status = 'ongoing'
  `);

  for (const consent of expiringResult.rows) {
    await sns.publish({
      TopicArn: process.env.ALERTS_TOPIC_ARN!,
      Message: JSON.stringify({
        type: 'CONSENT_EXPIRING_SOON',
        tripId: consent.trip_id,
        tripCode: consent.trip_code,
        driverName: consent.driver_name,
        expiresAt: consent.consent_expires_at
      }),
      Subject: 'Driver Consent Expiring Soon'
    });
  }

  return {
    expired: expiredResult.rowCount,
    expiringSoon: expiringResult.rowCount
  };
};
```

---

## Authentication Migration

### Supabase Auth to Amazon Cognito

```typescript
// lib/cognito-client.ts
import {
  CognitoIdentityProviderClient,
  InitiateAuthCommand,
  SignUpCommand,
  ConfirmSignUpCommand,
  GetUserCommand
} from '@aws-sdk/client-cognito-identity-provider';

const cognitoClient = new CognitoIdentityProviderClient({
  region: 'ap-south-1'
});

const USER_POOL_ID = process.env.COGNITO_USER_POOL_ID!;
const CLIENT_ID = process.env.COGNITO_CLIENT_ID!;

export async function signUp(
  email: string,
  password: string,
  firstName: string,
  lastName: string
) {
  const command = new SignUpCommand({
    ClientId: CLIENT_ID,
    Username: email,
    Password: password,
    UserAttributes: [
      { Name: 'email', Value: email },
      { Name: 'given_name', Value: firstName },
      { Name: 'family_name', Value: lastName }
    ]
  });

  return await cognitoClient.send(command);
}

export async function signIn(email: string, password: string) {
  const command = new InitiateAuthCommand({
    AuthFlow: 'USER_PASSWORD_AUTH',
    ClientId: CLIENT_ID,
    AuthParameters: {
      USERNAME: email,
      PASSWORD: password
    }
  });

  const response = await cognitoClient.send(command);
  return {
    accessToken: response.AuthenticationResult?.AccessToken,
    idToken: response.AuthenticationResult?.IdToken,
    refreshToken: response.AuthenticationResult?.RefreshToken,
    expiresIn: response.AuthenticationResult?.ExpiresIn
  };
}
```

### Frontend Auth Context Migration

```typescript
// contexts/AuthContext.tsx (AWS version)
import React, { createContext, useContext, useEffect, useState } from 'react';
import { Amplify } from 'aws-amplify';
import { 
  signIn, 
  signUp, 
  signOut, 
  getCurrentUser,
  fetchAuthSession 
} from 'aws-amplify/auth';

Amplify.configure({
  Auth: {
    Cognito: {
      userPoolId: 'ap-south-1_XXXXXXX',
      userPoolClientId: 'XXXXXXXXXXXXXXX',
      signUpVerificationMethod: 'code'
    }
  }
});

interface AuthContextType {
  user: any | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, attrs: any) => Promise<void>;
  signOut: () => Promise<void>;
  getAccessToken: () => Promise<string | null>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<any | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    checkUser();
  }, []);

  async function checkUser() {
    try {
      const currentUser = await getCurrentUser();
      setUser(currentUser);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignIn(email: string, password: string) {
    const result = await signIn({ username: email, password });
    await checkUser();
  }

  async function handleSignUp(
    email: string, 
    password: string, 
    attributes: { firstName: string; lastName: string }
  ) {
    await signUp({
      username: email,
      password,
      options: {
        userAttributes: {
          email,
          given_name: attributes.firstName,
          family_name: attributes.lastName
        }
      }
    });
  }

  async function handleSignOut() {
    await signOut();
    setUser(null);
  }

  async function getAccessToken() {
    const session = await fetchAuthSession();
    return session.tokens?.accessToken?.toString() || null;
  }

  return (
    <AuthContext.Provider value={{
      user,
      loading,
      signIn: handleSignIn,
      signUp: handleSignUp,
      signOut: handleSignOut,
      getAccessToken
    }}>
      {children}
    </AuthContext.Provider>
  );
}
```

---

## Storage Migration

### S3 Bucket Configuration

```typescript
// infrastructure/storage.ts
import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as cloudfront from 'aws-cdk-lib/aws-cloudfront';

export class StorageStack extends cdk.Stack {
  constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
    super(scope, id, props);

    // Driver Documents Bucket (private)
    const driverDocsBucket = new s3.Bucket(this, 'DriverDocuments', {
      bucketName: 'logistics-tms-driver-documents',
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [{
        expiration: cdk.Duration.days(365 * 7),  // 7 years retention
        transitions: [{
          storageClass: s3.StorageClass.INTELLIGENT_TIERING,
          transitionAfter: cdk.Duration.days(90)
        }]
      }]
    });

    // POD Documents Bucket (private with signed URLs)
    const podDocsBucket = new s3.Bucket(this, 'PODDocuments', {
      bucketName: 'logistics-tms-pod-documents',
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      cors: [{
        allowedMethods: [
          s3.HttpMethods.GET,
          s3.HttpMethods.PUT,
          s3.HttpMethods.POST
        ],
        allowedOrigins: ['https://app.logistics-tms.com'],
        allowedHeaders: ['*']
      }]
    });
  }
}
```

### Presigned URL Generation

```typescript
// lambda/storage/presigned-url.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { APIGatewayProxyHandler } from 'aws-lambda';

const s3Client = new S3Client({ region: 'ap-south-1' });

export const handler: APIGatewayProxyHandler = async (event) => {
  const { action, bucket, key, contentType } = JSON.parse(event.body || '{}');

  let command;
  if (action === 'upload') {
    command = new PutObjectCommand({
      Bucket: bucket,
      Key: key,
      ContentType: contentType
    });
  } else {
    command = new GetObjectCommand({
      Bucket: bucket,
      Key: key
    });
  }

  const signedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: 3600  // 1 hour
  });

  return {
    statusCode: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({ url: signedUrl })
  };
};
```

---

## Real-time Features

### WebSocket API with API Gateway

```typescript
// lambda/websocket/connect.ts
import { APIGatewayProxyHandler } from 'aws-lambda';
import { DynamoDBClient, PutItemCommand } from '@aws-sdk/client-dynamodb';

const dynamodb = new DynamoDBClient({ region: 'ap-south-1' });

export const handler: APIGatewayProxyHandler = async (event) => {
  const connectionId = event.requestContext.connectionId;
  const tripId = event.queryStringParameters?.tripId;

  await dynamodb.send(new PutItemCommand({
    TableName: 'websocket-connections',
    Item: {
      connectionId: { S: connectionId! },
      tripId: { S: tripId || 'general' },
      connectedAt: { S: new Date().toISOString() }
    }
  }));

  return { statusCode: 200, body: 'Connected' };
};

// lambda/websocket/broadcast-location.ts
import { ApiGatewayManagementApiClient, PostToConnectionCommand } from '@aws-sdk/client-apigatewaymanagementapi';
import { DynamoDBClient, QueryCommand } from '@aws-sdk/client-dynamodb';

export async function broadcastLocationUpdate(
  tripId: string,
  location: { lat: number; lng: number; timestamp: string }
) {
  const dynamodb = new DynamoDBClient({ region: 'ap-south-1' });
  
  // Get all connections for this trip
  const result = await dynamodb.send(new QueryCommand({
    TableName: 'websocket-connections',
    IndexName: 'tripId-index',
    KeyConditionExpression: 'tripId = :tripId',
    ExpressionAttributeValues: {
      ':tripId': { S: tripId }
    }
  }));

  const apiGateway = new ApiGatewayManagementApiClient({
    endpoint: process.env.WEBSOCKET_API_ENDPOINT
  });

  for (const item of result.Items || []) {
    try {
      await apiGateway.send(new PostToConnectionCommand({
        ConnectionId: item.connectionId.S,
        Data: Buffer.from(JSON.stringify({
          type: 'LOCATION_UPDATE',
          tripId,
          location
        }))
      }));
    } catch (error) {
      // Connection stale, remove it
      console.log('Stale connection:', item.connectionId.S);
    }
  }
}
```

---

## Cost Comparison

### Monthly Cost Estimate (Based on Current Usage)

| Service | Supabase Pro | AWS Equivalent | AWS Cost |
|---------|--------------|----------------|----------|
| Database | $25/mo | RDS db.r6g.large | ~$180/mo |
| Edge Functions | Included | Lambda (500K invocations) | ~$15/mo |
| Storage (50GB) | Included | S3 | ~$2/mo |
| Auth (5K users) | Included | Cognito | ~$25/mo |
| Real-time | Included | WebSocket API + DynamoDB | ~$20/mo |
| Bandwidth | 250GB included | CloudFront | ~$25/mo |
| **Total** | **$25/mo** | - | **~$270/mo** |

### When AWS Makes Sense

- **Scale**: >100K monthly active users
- **Compliance**: Specific regulatory requirements (HIPAA, PCI-DSS)
- **Control**: Need for VPC peering, custom networking
- **Multi-region**: Global deployment requirements
- **Integration**: Heavy AWS ecosystem usage

---

## Migration Checklist

### Phase 1: Preparation
- [ ] Set up AWS account and IAM roles
- [ ] Create VPC and networking infrastructure
- [ ] Provision RDS PostgreSQL instance
- [ ] Set up Secrets Manager for credentials
- [ ] Configure S3 buckets

### Phase 2: Database
- [ ] Export Supabase schema
- [ ] Modify schema for RDS compatibility
- [ ] Remove RLS, convert to application auth
- [ ] Create database migration scripts
- [ ] Run schema migration on RDS
- [ ] Perform data migration
- [ ] Validate data integrity

### Phase 3: Authentication
- [ ] Set up Cognito User Pool
- [ ] Configure identity providers (if needed)
- [ ] Migrate user accounts
- [ ] Update frontend auth context
- [ ] Test authentication flows

### Phase 4: Functions
- [ ] Convert each edge function to Lambda
- [ ] Set up API Gateway
- [ ] Configure EventBridge schedules
- [ ] Set up SQS queues for async processing
- [ ] Deploy and test each function

### Phase 5: Storage
- [ ] Migrate files to S3
- [ ] Update file upload/download logic
- [ ] Configure CloudFront CDN
- [ ] Update presigned URL generation

### Phase 6: Frontend
- [ ] Update API endpoints
- [ ] Update Supabase client to custom API calls
- [ ] Update real-time subscriptions
- [ ] Update authentication integration

### Phase 7: Testing
- [ ] Integration testing
- [ ] Load testing
- [ ] Security testing
- [ ] UAT with stakeholders

### Phase 8: Cutover
- [ ] DNS cutover planning
- [ ] Data sync final migration
- [ ] Go-live
- [ ] Monitor and stabilize

---

## Rollback Plan

In case of critical issues during migration:

1. **Database**: Keep Supabase instance running in read-only mode
2. **DNS**: Quick rollback via Route 53 (low TTL during migration)
3. **Frontend**: Maintain Supabase-compatible build for emergency rollback
4. **Data Sync**: Continuous replication during transition period

---

## Support Resources

- [AWS Well-Architected Framework](https://aws.amazon.com/architecture/well-architected/)
- [RDS PostgreSQL Best Practices](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/CHAP_BestPractices.html)
- [Lambda Best Practices](https://docs.aws.amazon.com/lambda/latest/dg/best-practices.html)
- [Cognito Developer Guide](https://docs.aws.amazon.com/cognito/latest/developerguide/)
