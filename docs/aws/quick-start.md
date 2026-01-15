# AWS Quick Start Guide

> **Get your TMS running on AWS in 30 minutes**

This guide deploys a minimal AWS infrastructure for testing. For production, see the [Complete Deployment Guide](./deployment-guide.md).

---

## Prerequisites

### 1. Install Required Tools

```bash
# macOS
brew install awscli terraform postgresql@15

# Ubuntu/Debian
sudo apt-get install awscli postgresql-client-15
curl -fsSL https://apt.releases.hashicorp.com/gpg | sudo apt-key add -
sudo apt-get install terraform
```

### 2. Configure AWS CLI

```bash
aws configure
```

Enter your credentials:
```
AWS Access Key ID: YOUR_ACCESS_KEY
AWS Secret Access Key: YOUR_SECRET_KEY
Default region name: ap-south-1
Default output format: json
```

### 3. Verify Connection

```bash
aws sts get-caller-identity
```

You should see your account info:
```json
{
    "UserId": "AIDAXXXXXXXXXX",
    "Account": "123456789012",
    "Arn": "arn:aws:iam::123456789012:user/yourname"
}
```

---

## Step 1: Create Infrastructure (5 minutes)

### Option A: One-Click CloudFormation

Download and deploy our CloudFormation template:

```bash
# Download template
curl -O https://raw.githubusercontent.com/your-org/tms-aws/main/cloudformation/quick-start.yaml

# Deploy stack
aws cloudformation create-stack \
  --stack-name tms-quick-start \
  --template-body file://quick-start.yaml \
  --parameters \
    ParameterKey=DBPassword,ParameterValue=YourSecurePassword123! \
  --capabilities CAPABILITY_IAM

# Wait for completion (5-10 minutes)
aws cloudformation wait stack-create-complete --stack-name tms-quick-start
```

### Option B: Terraform Quick Deploy

```bash
# Clone infrastructure repo
git clone https://github.com/your-org/tms-aws-infra.git
cd tms-aws-infra

# Create variables file
cat > terraform.tfvars << EOF
environment = "dev"
db_password = "YourSecurePassword123!"
EOF

# Deploy
terraform init
terraform apply -auto-approve
```

---

## Step 2: Get Connection Details (2 minutes)

### From CloudFormation:

```bash
aws cloudformation describe-stacks \
  --stack-name tms-quick-start \
  --query 'Stacks[0].Outputs' \
  --output table
```

### From Terraform:

```bash
terraform output
```

Save these values:
```
DB_HOST = tms-dev-db.xxxxxx.ap-south-1.rds.amazonaws.com
DB_PORT = 5432
DB_NAME = tms_dev
API_ENDPOINT = https://xxxxxx.execute-api.ap-south-1.amazonaws.com
S3_BUCKET = tms-dev-documents
```

---

## Step 3: Migrate Database (10 minutes)

### Export from Supabase

```bash
# Set Supabase connection
export SUPABASE_URL="postgresql://postgres.[project-ref]:[password]@aws-0-ap-south-1.pooler.supabase.com:6543/postgres"

# Export schema
pg_dump "$SUPABASE_URL" \
  --schema-only \
  --no-owner \
  --no-acl \
  -f schema.sql

# Export data
pg_dump "$SUPABASE_URL" \
  --data-only \
  --no-owner \
  -f data.sql
```

### Import to RDS

```bash
# Set RDS connection (use values from Step 2)
export RDS_URL="postgresql://postgres:YourSecurePassword123!@tms-dev-db.xxxxxx.ap-south-1.rds.amazonaws.com:5432/tms_dev"

# Import schema (apply our converted schema first)
psql "$RDS_URL" -f docs/aws/converted-schema.sql

# Import data
psql "$RDS_URL" -f data.sql
```

---

## Step 4: Configure Secrets (5 minutes)

```bash
# Store API keys in AWS Secrets Manager
aws secretsmanager create-secret \
  --name tms-dev-api-keys \
  --secret-string '{
    "GOOGLE_MAPS_API_KEY": "your-google-maps-key",
    "TELENITY_AUTH_TOKEN": "your-telenity-token",
    "TELENITY_BASIC_TOKEN": "your-telenity-basic",
    "WHEELSEYE_ACCESS_TOKEN": "your-wheelseye-token"
  }'
```

---

## Step 5: Deploy Lambda Functions (5 minutes)

```bash
# Navigate to lambda directory
cd lambda-functions

# Install dependencies
npm install

# Package functions
npm run build

# Deploy all functions
npm run deploy
```

Or deploy individually:

```bash
# Deploy a specific function
aws lambda update-function-code \
  --function-name tms-dev-telenity-tracking \
  --zip-file fileb://dist/telenity-tracking.zip
```

---

## Step 6: Update Frontend (3 minutes)

Update your `.env` file:

```bash
# .env (local development)
VITE_API_ENDPOINT=https://xxxxxx.execute-api.ap-south-1.amazonaws.com/dev
VITE_AWS_REGION=ap-south-1
VITE_COGNITO_USER_POOL_ID=ap-south-1_XXXXXXX
VITE_COGNITO_CLIENT_ID=xxxxxxxxxxxxxxxxxxxxxxxxxx
```

Update the API client:

```typescript
// src/integrations/aws/client.ts
const API_ENDPOINT = import.meta.env.VITE_API_ENDPOINT;

export async function callAPI(path: string, options: RequestInit = {}) {
  const response = await fetch(`${API_ENDPOINT}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });
  return response.json();
}
```

---

## Verification Checklist

Test each component:

```bash
# ✅ Test database connection
psql "$RDS_URL" -c "SELECT COUNT(*) FROM trips;"

# ✅ Test API endpoint
curl -X GET "$API_ENDPOINT/health"

# ✅ Test Lambda function
aws lambda invoke \
  --function-name tms-dev-google-maps-route \
  --payload '{"test": true}' \
  response.json

# ✅ Test S3 bucket
aws s3 ls s3://tms-dev-documents/
```

---

## What's Next?

Your basic AWS infrastructure is running! Now:

1. **For Production**: Follow the [Complete Deployment Guide](./deployment-guide.md)
2. **Add Authentication**: Set up [Cognito Auth](./deployment-guide.md#authentication)
3. **Enable HTTPS**: Configure [CloudFront + SSL](./deployment-guide.md#cloudfront)
4. **Add Monitoring**: Set up [CloudWatch Dashboards](./deployment-guide.md#monitoring)

---

## Quick Troubleshooting

### Database Connection Failed

```bash
# Check security group allows your IP
aws ec2 describe-security-groups --group-ids sg-xxxxxx

# Verify RDS is available
aws rds describe-db-instances --db-instance-identifier tms-dev-db
```

### Lambda Function Error

```bash
# View recent logs
aws logs tail /aws/lambda/tms-dev-telenity-tracking --follow
```

### API Gateway 403 Error

```bash
# Check API Gateway settings
aws apigatewayv2 get-api --api-id xxxxxx
```

---

## Cleanup (If Testing)

To remove all resources:

```bash
# CloudFormation
aws cloudformation delete-stack --stack-name tms-quick-start

# Terraform
terraform destroy -auto-approve
```

---

## Cost Estimate (Quick Start)

| Service | Hourly | Monthly |
|---------|--------|---------|
| RDS db.t3.micro | $0.02 | ~$15 |
| Lambda (low usage) | Free tier | $0 |
| S3 (1GB) | - | ~$0.03 |
| API Gateway | - | ~$3 |
| **Total** | | **~$20/mo** |

> **Tip**: Use `terraform destroy` or delete the CloudFormation stack when not testing to avoid charges.
