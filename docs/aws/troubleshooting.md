# AWS Troubleshooting Guide

> **Common issues and their solutions**

---

## Quick Diagnostics

```bash
# Check AWS credentials
aws sts get-caller-identity

# Test RDS connectivity
nc -zv your-rds-endpoint.rds.amazonaws.com 5432

# Check Lambda logs
aws logs tail /aws/lambda/tms-prod-telenity-tracking --since 1h

# Verify API Gateway
curl -I https://your-api-id.execute-api.ap-south-1.amazonaws.com/prod/health
```

---

## Database Issues

### Cannot Connect to RDS

**Symptoms:**
- Connection timeout
- "Connection refused" error

**Solutions:**

1. **Check Security Groups**
   ```bash
   # List security group rules
   aws ec2 describe-security-groups --group-ids sg-xxxxxx
   
   # Add inbound rule for your IP
   aws ec2 authorize-security-group-ingress \
     --group-id sg-xxxxxx \
     --protocol tcp \
     --port 5432 \
     --cidr YOUR_IP/32
   ```

2. **Verify RDS is Running**
   ```bash
   aws rds describe-db-instances \
     --db-instance-identifier tms-prod-db \
     --query 'DBInstances[0].DBInstanceStatus'
   ```

3. **Check VPC Subnets**
   - Ensure RDS is in the correct subnet group
   - Lambda must be in the same VPC to connect

4. **Test from Lambda**
   ```typescript
   // Add this test in a Lambda
   const net = require('net');
   const socket = new net.Socket();
   socket.connect(5432, 'rds-endpoint', () => {
     console.log('Connected!');
     socket.destroy();
   });
   ```

### Slow Queries

**Solutions:**

1. **Check Connection Pooling**
   ```typescript
   // Use connection pooling
   const pool = new Pool({ max: 10 });
   ```

2. **Add Database Indexes**
   ```sql
   -- Common indexes needed
   CREATE INDEX idx_trips_status ON trips(status);
   CREATE INDEX idx_trips_created ON trips(created_at);
   CREATE INDEX idx_location_history_trip ON location_history(trip_id);
   ```

3. **Monitor with Performance Insights**
   ```bash
   aws rds describe-db-instances \
     --db-instance-identifier tms-prod-db \
     --query 'DBInstances[0].PerformanceInsightsEnabled'
   ```

---

## Lambda Issues

### Function Timeout

**Symptoms:**
- "Task timed out after X seconds"

**Solutions:**

1. **Increase Timeout**
   ```bash
   aws lambda update-function-configuration \
     --function-name tms-prod-telenity-tracking \
     --timeout 60
   ```

2. **Increase Memory (also increases CPU)**
   ```bash
   aws lambda update-function-configuration \
     --function-name tms-prod-telenity-tracking \
     --memory-size 1024
   ```

3. **Check VPC Cold Starts**
   - VPC-attached Lambdas have longer cold starts
   - Use Provisioned Concurrency for critical functions
   ```bash
   aws lambda put-provisioned-concurrency-config \
     --function-name tms-prod-telenity-tracking \
     --qualifier prod \
     --provisioned-concurrent-executions 5
   ```

### Out of Memory

**Symptoms:**
- "Runtime exited with error: signal: killed"

**Solutions:**

1. **Increase Memory**
   ```bash
   aws lambda update-function-configuration \
     --function-name tms-prod-function \
     --memory-size 2048
   ```

2. **Stream Large Data**
   ```typescript
   // Instead of loading all at once
   // Bad: const allData = await query('SELECT * FROM big_table');
   
   // Good: Use cursor-based pagination
   const batchSize = 1000;
   let offset = 0;
   while (true) {
     const batch = await query(
       'SELECT * FROM big_table LIMIT $1 OFFSET $2',
       [batchSize, offset]
     );
     if (batch.length === 0) break;
     processBatch(batch);
     offset += batchSize;
   }
   ```

### Cannot Access Secrets

**Symptoms:**
- "AccessDeniedException" when calling GetSecretValue

**Solutions:**

1. **Check IAM Role**
   ```bash
   # Get Lambda's role
   aws lambda get-function \
     --function-name tms-prod-function \
     --query 'Configuration.Role'
   
   # Check role policies
   aws iam list-attached-role-policies --role-name ROLE_NAME
   ```

2. **Verify Secret ARN**
   ```bash
   aws secretsmanager describe-secret --secret-id tms-prod-api-keys
   ```

3. **Add Missing Policy**
   ```bash
   aws iam attach-role-policy \
     --role-name LAMBDA_ROLE \
     --policy-arn arn:aws:iam::aws:policy/SecretsManagerReadWrite
   ```

---

## API Gateway Issues

### 502 Bad Gateway

**Causes:**
- Lambda function error
- Integration timeout

**Solutions:**

1. **Check Lambda Logs**
   ```bash
   aws logs tail /aws/lambda/tms-prod-function --since 10m
   ```

2. **Increase Integration Timeout**
   ```bash
   aws apigatewayv2 update-integration \
     --api-id API_ID \
     --integration-id INTEGRATION_ID \
     --timeout-in-millis 30000
   ```

### 403 Forbidden

**Causes:**
- CORS not configured
- Missing permissions

**Solutions:**

1. **Check CORS Settings**
   ```bash
   aws apigatewayv2 get-api --api-id API_ID \
     --query 'CorsConfiguration'
   ```

2. **Update CORS**
   ```bash
   aws apigatewayv2 update-api \
     --api-id API_ID \
     --cors-configuration '{
       "AllowOrigins": ["https://yourdomain.com"],
       "AllowMethods": ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
       "AllowHeaders": ["Content-Type", "Authorization"]
     }'
   ```

### 429 Too Many Requests

**Solutions:**

1. **Check Throttling Settings**
   ```bash
   aws apigatewayv2 get-stage \
     --api-id API_ID \
     --stage-name prod \
     --query 'DefaultRouteSettings'
   ```

2. **Increase Rate Limits**
   ```bash
   aws apigatewayv2 update-stage \
     --api-id API_ID \
     --stage-name prod \
     --default-route-settings '{
       "ThrottlingRateLimit": 1000,
       "ThrottlingBurstLimit": 500
     }'
   ```

---

## S3 Issues

### Access Denied

**Solutions:**

1. **Check Bucket Policy**
   ```bash
   aws s3api get-bucket-policy --bucket tms-prod-documents
   ```

2. **Add Lambda Permissions**
   ```json
   {
     "Effect": "Allow",
     "Action": ["s3:GetObject", "s3:PutObject"],
     "Resource": "arn:aws:s3:::tms-prod-documents/*"
   }
   ```

### CORS Error on Upload

**Solutions:**

1. **Update Bucket CORS**
   ```bash
   aws s3api put-bucket-cors \
     --bucket tms-prod-documents \
     --cors-configuration '{
       "CORSRules": [{
         "AllowedOrigins": ["https://yourdomain.com"],
         "AllowedMethods": ["GET", "PUT", "POST"],
         "AllowedHeaders": ["*"],
         "MaxAgeSeconds": 3000
       }]
     }'
   ```

---

## Cognito Issues

### User Cannot Sign In

**Solutions:**

1. **Check User Status**
   ```bash
   aws cognito-idp admin-get-user \
     --user-pool-id ap-south-1_XXXXXX \
     --username user@email.com
   ```

2. **Force Password Reset**
   ```bash
   aws cognito-idp admin-set-user-password \
     --user-pool-id ap-south-1_XXXXXX \
     --username user@email.com \
     --password 'NewPassword123!' \
     --permanent
   ```

### Token Expired

**Solutions:**

1. **Implement Token Refresh**
   ```typescript
   import { fetchAuthSession } from 'aws-amplify/auth';
   
   async function getValidToken() {
     const session = await fetchAuthSession({ forceRefresh: true });
     return session.tokens?.idToken?.toString();
   }
   ```

---

## CloudFront Issues

### Old Content Being Served

**Solutions:**

1. **Invalidate Cache**
   ```bash
   aws cloudfront create-invalidation \
     --distribution-id DISTRIBUTION_ID \
     --paths "/*"
   ```

2. **Check Invalidation Status**
   ```bash
   aws cloudfront list-invalidations \
     --distribution-id DISTRIBUTION_ID
   ```

### SSL Certificate Error

**Solutions:**

1. **Verify Certificate Status**
   ```bash
   aws acm describe-certificate \
     --certificate-arn CERT_ARN \
     --region us-east-1
   ```

2. **Check DNS Validation**
   - Ensure CNAME records are properly set
   - Certificate must be in `us-east-1` for CloudFront

---

## Monitoring Commands

### View CloudWatch Metrics

```bash
# Lambda invocations
aws cloudwatch get-metric-statistics \
  --namespace AWS/Lambda \
  --metric-name Invocations \
  --dimensions Name=FunctionName,Value=tms-prod-function \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Sum

# RDS CPU
aws cloudwatch get-metric-statistics \
  --namespace AWS/RDS \
  --metric-name CPUUtilization \
  --dimensions Name=DBInstanceIdentifier,Value=tms-prod-db \
  --start-time $(date -u -d '1 hour ago' +%Y-%m-%dT%H:%M:%SZ) \
  --end-time $(date -u +%Y-%m-%dT%H:%M:%SZ) \
  --period 300 \
  --statistics Average
```

### Real-Time Logs

```bash
# Follow Lambda logs
aws logs tail /aws/lambda/tms-prod-telenity-tracking --follow

# Filter for errors
aws logs filter-log-events \
  --log-group-name /aws/lambda/tms-prod-telenity-tracking \
  --filter-pattern "ERROR" \
  --start-time $(date -u -d '1 hour ago' +%s)000
```

---

## Emergency Rollback

### Rollback Lambda

```bash
# List versions
aws lambda list-versions-by-function \
  --function-name tms-prod-function

# Point alias to previous version
aws lambda update-alias \
  --function-name tms-prod-function \
  --name prod \
  --function-version 5
```

### Rollback Database

```bash
# Restore from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier tms-prod-db-restored \
  --db-snapshot-identifier tms-prod-snapshot-20240101
```

### Rollback Frontend

```bash
# Get previous deployment
aws s3 sync s3://tms-prod-backup/v1.2.3/ s3://tms-prod-frontend/ --delete

# Invalidate CloudFront
aws cloudfront create-invalidation \
  --distribution-id DISTRIBUTION_ID \
  --paths "/*"
```

---

## Getting Help

1. **AWS Support**: If on Business/Enterprise support, open a case
2. **AWS Forums**: [repost.aws](https://repost.aws/)
3. **Documentation**: [docs.aws.amazon.com](https://docs.aws.amazon.com/)
