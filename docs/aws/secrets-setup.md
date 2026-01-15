# AWS Secrets Configuration

> **Securely store and manage API keys and credentials**

---

## Required Secrets

| Secret Name | Description | Source |
|-------------|-------------|--------|
| `GOOGLE_MAPS_API_KEY` | Google Maps API key | [Google Cloud Console](https://console.cloud.google.com/apis/credentials) |
| `TELENITY_AUTH_TOKEN` | Telenity OAuth token | Telenity Portal |
| `TELENITY_BASIC_TOKEN` | Telenity Basic auth (Base64) | Telenity Portal |
| `WHEELSEYE_ACCESS_TOKEN` | WheelsEye API token | WheelsEye Dashboard |
| `DATABASE_URL` | PostgreSQL connection string | RDS Console |

---

## Step 1: Create Secrets in AWS

### Using AWS Console

1. Go to [AWS Secrets Manager](https://console.aws.amazon.com/secretsmanager)
2. Click **Store a new secret**
3. Select **Other type of secret**
4. Add key-value pairs
5. Name it `tms-prod-api-keys`
6. Click **Store**

### Using AWS CLI

```bash
# Create the secret with all API keys
aws secretsmanager create-secret \
  --name tms-prod-api-keys \
  --description "TMS Production API Keys" \
  --secret-string '{
    "GOOGLE_MAPS_API_KEY": "AIzaSy...",
    "TELENITY_AUTH_TOKEN": "eyJhbGc...",
    "TELENITY_BASIC_TOKEN": "dXNlcjpwYXNz...",
    "WHEELSEYE_ACCESS_TOKEN": "wse_token_..."
  }'
```

### Create Database Secret

```bash
# Separate secret for database credentials
aws secretsmanager create-secret \
  --name tms-prod-database \
  --description "TMS Database Credentials" \
  --secret-string '{
    "host": "tms-prod-db.xxxxx.ap-south-1.rds.amazonaws.com",
    "port": 5432,
    "database": "tms_production",
    "username": "postgres",
    "password": "your-secure-password"
  }'
```

---

## Step 2: Grant Lambda Access

### Create IAM Policy

```json
{
  "Version": "2012-10-17",
  "Statement": [
    {
      "Effect": "Allow",
      "Action": [
        "secretsmanager:GetSecretValue"
      ],
      "Resource": [
        "arn:aws:secretsmanager:ap-south-1:*:secret:tms-prod-*"
      ]
    }
  ]
}
```

### Attach to Lambda Role

```bash
# Create policy
aws iam create-policy \
  --policy-name TMS-SecretsAccess \
  --policy-document file://secrets-policy.json

# Attach to Lambda execution role
aws iam attach-role-policy \
  --role-name tms-lambda-role \
  --policy-arn arn:aws:iam::ACCOUNT_ID:policy/TMS-SecretsAccess
```

---

## Step 3: Access Secrets in Lambda

```typescript
// src/utils/secrets.ts

import { 
  SecretsManagerClient, 
  GetSecretValueCommand 
} from '@aws-sdk/client-secrets-manager';

const client = new SecretsManagerClient({ 
  region: process.env.AWS_REGION || 'ap-south-1' 
});

// Cache secrets to avoid repeated API calls
const secretCache: Record<string, any> = {};

export async function getSecret<T = Record<string, string>>(
  secretName: string
): Promise<T> {
  // Return cached value if available
  if (secretCache[secretName]) {
    return secretCache[secretName];
  }

  try {
    const command = new GetSecretValueCommand({ 
      SecretId: secretName 
    });
    
    const response = await client.send(command);
    
    if (!response.SecretString) {
      throw new Error(`Secret ${secretName} has no value`);
    }
    
    const secret = JSON.parse(response.SecretString);
    secretCache[secretName] = secret;
    
    return secret;
  } catch (error) {
    console.error(`Failed to get secret ${secretName}:`, error);
    throw error;
  }
}

// Convenience function for API keys
export async function getApiKeys() {
  return getSecret<{
    GOOGLE_MAPS_API_KEY: string;
    TELENITY_AUTH_TOKEN: string;
    TELENITY_BASIC_TOKEN: string;
    WHEELSEYE_ACCESS_TOKEN: string;
  }>('tms-prod-api-keys');
}

// Convenience function for database config
export async function getDatabaseConfig() {
  return getSecret<{
    host: string;
    port: number;
    database: string;
    username: string;
    password: string;
  }>('tms-prod-database');
}
```

---

## Step 4: Usage Example

```typescript
// In a Lambda handler
import { getApiKeys, getDatabaseConfig } from './utils/secrets';

export async function handler(event: any) {
  // Get API keys
  const apiKeys = await getApiKeys();
  
  // Use Google Maps
  const mapsResponse = await fetch(
    `https://maps.googleapis.com/maps/api/...?key=${apiKeys.GOOGLE_MAPS_API_KEY}`
  );
  
  // Get database config
  const dbConfig = await getDatabaseConfig();
  
  // Connect to database
  const pool = new Pool({
    host: dbConfig.host,
    port: dbConfig.port,
    database: dbConfig.database,
    user: dbConfig.username,
    password: dbConfig.password,
  });
}
```

---

## Secret Rotation

### Enable Automatic Rotation

```bash
# Create rotation Lambda (AWS provides templates)
aws secretsmanager rotate-secret \
  --secret-id tms-prod-database \
  --rotation-lambda-arn arn:aws:lambda:ap-south-1:ACCOUNT:function:SecretsManagerRotation \
  --rotation-rules AutomaticallyAfterDays=30
```

### Manual Rotation

```bash
# Update secret value
aws secretsmanager update-secret \
  --secret-id tms-prod-api-keys \
  --secret-string '{
    "GOOGLE_MAPS_API_KEY": "new-key...",
    "TELENITY_AUTH_TOKEN": "new-token...",
    ...
  }'
```

---

## Environment-Specific Secrets

```bash
# Development
aws secretsmanager create-secret \
  --name tms-dev-api-keys \
  --secret-string '{ "GOOGLE_MAPS_API_KEY": "dev-key..." }'

# Staging
aws secretsmanager create-secret \
  --name tms-staging-api-keys \
  --secret-string '{ "GOOGLE_MAPS_API_KEY": "staging-key..." }'

# Production
aws secretsmanager create-secret \
  --name tms-prod-api-keys \
  --secret-string '{ "GOOGLE_MAPS_API_KEY": "prod-key..." }'
```

### Load Based on Environment

```typescript
const stage = process.env.STAGE || 'prod';

export async function getApiKeys() {
  return getSecret(`tms-${stage}-api-keys`);
}
```

---

## Security Best Practices

1. **Principle of Least Privilege**
   - Only grant access to secrets each Lambda needs
   - Use separate secrets for different services

2. **Enable Encryption**
   - All secrets are encrypted by default with AWS KMS
   - Use customer-managed keys for extra control

3. **Audit Access**
   ```bash
   # View secret access logs
   aws cloudtrail lookup-events \
     --lookup-attributes AttributeKey=EventName,AttributeValue=GetSecretValue
   ```

4. **Version Control**
   - Never commit secrets to git
   - Use `.env.example` with placeholder values

5. **Regular Rotation**
   - Rotate API keys quarterly
   - Enable automatic rotation for database passwords

---

## Troubleshooting

### Permission Denied

```bash
# Check Lambda role policies
aws iam list-attached-role-policies --role-name tms-lambda-role

# Verify secret resource ARN matches policy
aws secretsmanager describe-secret --secret-id tms-prod-api-keys
```

### Secret Not Found

```bash
# List all secrets
aws secretsmanager list-secrets

# Check if secret exists in correct region
aws secretsmanager describe-secret \
  --secret-id tms-prod-api-keys \
  --region ap-south-1
```

### Caching Issues

```typescript
// Force refresh cached secret
export function clearSecretCache(secretName?: string) {
  if (secretName) {
    delete secretCache[secretName];
  } else {
    Object.keys(secretCache).forEach(key => delete secretCache[key]);
  }
}
```
