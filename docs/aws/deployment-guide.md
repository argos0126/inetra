# Complete AWS Deployment Guide

> **Step-by-step production deployment for Logistics TMS**

This guide covers a full production-ready AWS deployment with high availability, security, and monitoring.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [AWS Account Setup](#2-aws-account-setup)
3. [VPC & Networking](#3-vpc--networking)
4. [Database (RDS PostgreSQL)](#4-database-rds-postgresql)
5. [Storage (S3)](#5-storage-s3)
6. [Authentication (Cognito)](#6-authentication-cognito)
7. [Lambda Functions](#7-lambda-functions)
8. [API Gateway](#8-api-gateway)
9. [Frontend (S3 + CloudFront)](#9-frontend-s3--cloudfront)
10. [Monitoring & Alerts](#10-monitoring--alerts)

---

## 1. Prerequisites

### Required Tools

```bash
# Install AWS CLI
curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip"
unzip awscliv2.zip
sudo ./aws/install

# Install Terraform
wget https://releases.hashicorp.com/terraform/1.5.7/terraform_1.5.7_linux_amd64.zip
unzip terraform_1.5.7_linux_amd64.zip
sudo mv terraform /usr/local/bin/

# Install PostgreSQL client
sudo apt-get install postgresql-client-15

# Verify installations
aws --version
terraform version
psql --version
```

### Required Information

Before starting, gather:

| Item | Where to Find |
|------|---------------|
| Supabase DB URL | Supabase Dashboard → Settings → Database |
| Google Maps API Key | Google Cloud Console |
| Telenity Credentials | Telenity Portal |
| WheelsEye Token | WheelsEye Dashboard |
| Domain Name | Your DNS provider |

---

## 2. AWS Account Setup

### 2.1 Create IAM Admin User

```bash
# Create admin user for Terraform
aws iam create-user --user-name tms-terraform-admin

# Attach admin policy
aws iam attach-user-policy \
  --user-name tms-terraform-admin \
  --policy-arn arn:aws:iam::aws:policy/AdministratorAccess

# Create access keys
aws iam create-access-key --user-name tms-terraform-admin
```

**Save the output:**
```json
{
    "AccessKeyId": "AKIAIOSFODNN7EXAMPLE",
    "SecretAccessKey": "wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY"
}
```

### 2.2 Configure AWS Profile

```bash
aws configure --profile tms-prod
```

Enter:
```
AWS Access Key ID: AKIAIOSFODNN7EXAMPLE
AWS Secret Access Key: wJalrXUtnFEMI/K7MDENG/bPxRfiCYEXAMPLEKEY
Default region name: ap-south-1
Default output format: json
```

### 2.3 Create Terraform State Bucket

```bash
# Create S3 bucket for Terraform state
aws s3 mb s3://tms-terraform-state-$(aws sts get-caller-identity --query Account --output text) \
  --region ap-south-1

# Enable versioning
aws s3api put-bucket-versioning \
  --bucket tms-terraform-state-$(aws sts get-caller-identity --query Account --output text) \
  --versioning-configuration Status=Enabled

# Create DynamoDB table for state locking
aws dynamodb create-table \
  --table-name tms-terraform-locks \
  --attribute-definitions AttributeName=LockID,AttributeType=S \
  --key-schema AttributeName=LockID,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-south-1
```

---

## 3. VPC & Networking

### 3.1 Create VPC with Terraform

Create `vpc.tf`:

```hcl
# vpc.tf

module "vpc" {
  source  = "terraform-aws-modules/vpc/aws"
  version = "~> 5.0"

  name = "tms-production-vpc"
  cidr = "10.0.0.0/16"

  azs             = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]
  private_subnets = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
  public_subnets  = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
  database_subnets = ["10.0.201.0/24", "10.0.202.0/24", "10.0.203.0/24"]

  enable_nat_gateway = true
  single_nat_gateway = false  # High availability

  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Environment = "production"
    Project     = "tms"
  }
}
```

### 3.2 Deploy VPC

```bash
terraform init
terraform plan -out=vpc.plan
terraform apply vpc.plan
```

**Expected Output:**
```
vpc_id = "vpc-0abc123def456"
private_subnets = ["subnet-0abc...", "subnet-0def...", "subnet-0ghi..."]
public_subnets = ["subnet-0jkl...", "subnet-0mno...", "subnet-0pqr..."]
```

---

## 4. Database (RDS PostgreSQL)

### 4.1 Create RDS Instance

Create `rds.tf`:

```hcl
# rds.tf

resource "aws_db_subnet_group" "tms" {
  name       = "tms-db-subnet-group"
  subnet_ids = module.vpc.database_subnets

  tags = {
    Name = "TMS DB Subnet Group"
  }
}

resource "aws_security_group" "rds" {
  name        = "tms-rds-sg"
  description = "Security group for TMS RDS"
  vpc_id      = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
  }

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}

resource "aws_db_instance" "tms" {
  identifier = "tms-production-db"

  engine               = "postgres"
  engine_version       = "15.4"
  instance_class       = "db.r6g.large"
  allocated_storage    = 100
  max_allocated_storage = 500
  storage_type         = "gp3"
  storage_encrypted    = true

  db_name  = "tms_production"
  username = "postgres"
  password = var.db_password  # From secrets

  multi_az               = true
  db_subnet_group_name   = aws_db_subnet_group.tms.name
  vpc_security_group_ids = [aws_security_group.rds.id]

  backup_retention_period = 30
  backup_window          = "03:00-04:00"
  maintenance_window     = "Mon:04:00-Mon:05:00"

  skip_final_snapshot       = false
  final_snapshot_identifier = "tms-final-snapshot"
  deletion_protection       = true

  performance_insights_enabled = true
  
  tags = {
    Name        = "TMS Production Database"
    Environment = "production"
  }
}
```

### 4.2 Deploy RDS

```bash
terraform apply -target=aws_db_instance.tms
```

**Wait for ~10-15 minutes for the database to be available.**

### 4.3 Connect to RDS

```bash
# Get the endpoint
aws rds describe-db-instances \
  --db-instance-identifier tms-production-db \
  --query 'DBInstances[0].Endpoint.Address' \
  --output text

# Connect
psql "postgresql://postgres:YOUR_PASSWORD@tms-production-db.xxxxx.ap-south-1.rds.amazonaws.com:5432/tms_production"
```

---

## 5. Storage (S3)

### 5.1 Create S3 Buckets

Create `s3.tf`:

```hcl
# s3.tf

resource "aws_s3_bucket" "documents" {
  bucket = "tms-production-documents"
}

resource "aws_s3_bucket_versioning" "documents" {
  bucket = aws_s3_bucket.documents.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# Create folders
resource "aws_s3_object" "folders" {
  for_each = toset(["driver-documents/", "pod-documents/", "exports/"])
  
  bucket = aws_s3_bucket.documents.id
  key    = each.value
}

# CORS configuration for uploads
resource "aws_s3_bucket_cors_configuration" "documents" {
  bucket = aws_s3_bucket.documents.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "PUT", "POST"]
    allowed_origins = ["https://yourdomain.com"]
    expose_headers  = ["ETag"]
    max_age_seconds = 3000
  }
}
```

### 5.2 Deploy S3

```bash
terraform apply -target=aws_s3_bucket.documents
```

---

## 6. Authentication (Cognito)

### 6.1 Create User Pool

Create `cognito.tf`:

```hcl
# cognito.tf

resource "aws_cognito_user_pool" "tms" {
  name = "tms-production-users"

  username_attributes      = ["email"]
  auto_verified_attributes = ["email"]

  password_policy {
    minimum_length    = 8
    require_lowercase = true
    require_numbers   = true
    require_symbols   = true
    require_uppercase = true
  }

  verification_message_template {
    default_email_option = "CONFIRM_WITH_CODE"
    email_subject       = "TMS - Verify your email"
    email_message       = "Your verification code is {####}"
  }

  schema {
    name                = "email"
    attribute_data_type = "String"
    required            = true
    mutable             = true
  }

  schema {
    name                = "name"
    attribute_data_type = "String"
    required            = false
    mutable             = true
  }

  admin_create_user_config {
    allow_admin_create_user_only = true
  }

  tags = {
    Environment = "production"
  }
}

resource "aws_cognito_user_pool_client" "tms_web" {
  name         = "tms-web-client"
  user_pool_id = aws_cognito_user_pool.tms.id

  generate_secret = false

  explicit_auth_flows = [
    "ALLOW_USER_PASSWORD_AUTH",
    "ALLOW_REFRESH_TOKEN_AUTH"
  ]

  supported_identity_providers = ["COGNITO"]

  callback_urls = ["https://yourdomain.com/auth/callback"]
  logout_urls   = ["https://yourdomain.com/logout"]

  access_token_validity  = 60       # minutes
  id_token_validity      = 60       # minutes
  refresh_token_validity = 30       # days
}
```

### 6.2 Deploy Cognito

```bash
terraform apply -target=aws_cognito_user_pool.tms
```

**Save output:**
```
user_pool_id = "ap-south-1_XXXXXXXX"
client_id = "xxxxxxxxxxxxxxxxxxxxxxxxxx"
```

---

## 7. Lambda Functions

### 7.1 Create Lambda Security Group

```hcl
# lambda.tf

resource "aws_security_group" "lambda" {
  name        = "tms-lambda-sg"
  description = "Security group for Lambda functions"
  vpc_id      = module.vpc.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

### 7.2 Create Lambda Functions

See [Lambda Functions Guide](./lambda-functions.md) for complete function code and deployment.

```bash
# Deploy all Lambda functions
cd lambda-functions
npm install
npm run build
npm run deploy
```

---

## 8. API Gateway

### 8.1 Create HTTP API

```hcl
# api-gateway.tf

resource "aws_apigatewayv2_api" "tms" {
  name          = "tms-production-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["https://yourdomain.com"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_stage" "prod" {
  api_id      = aws_apigatewayv2_api.tms.id
  name        = "prod"
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api.arn
    format = jsonencode({
      requestId        = "$context.requestId"
      ip               = "$context.identity.sourceIp"
      method           = "$context.httpMethod"
      path             = "$context.routeKey"
      status           = "$context.status"
      responseLength   = "$context.responseLength"
    })
  }
}
```

---

## 9. Frontend (S3 + CloudFront)

### 9.1 Create Frontend Bucket

```hcl
# frontend.tf

resource "aws_s3_bucket" "frontend" {
  bucket = "tms-production-frontend"
}

resource "aws_s3_bucket_website_configuration" "frontend" {
  bucket = aws_s3_bucket.frontend.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"  # SPA routing
  }
}

resource "aws_cloudfront_distribution" "frontend" {
  origin {
    domain_name = aws_s3_bucket.frontend.bucket_regional_domain_name
    origin_id   = "S3-tms-frontend"

    s3_origin_config {
      origin_access_identity = aws_cloudfront_origin_access_identity.frontend.cloudfront_access_identity_path
    }
  }

  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"

  aliases = ["tms.yourdomain.com"]

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3-tms-frontend"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  # Handle SPA routing
  custom_error_response {
    error_code         = 403
    response_code      = 200
    response_page_path = "/index.html"
  }

  restrictions {
    geo_restriction {
      restriction_type = "none"
    }
  }

  viewer_certificate {
    acm_certificate_arn      = aws_acm_certificate.tms.arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2021"
  }
}
```

### 9.2 Deploy Frontend

```bash
# Build frontend
npm run build

# Upload to S3
aws s3 sync dist/ s3://tms-production-frontend --delete

# Invalidate CloudFront cache
aws cloudfront create-invalidation \
  --distribution-id EXXXXXXXXXX \
  --paths "/*"
```

---

## 10. Monitoring & Alerts

### 10.1 Create CloudWatch Dashboard

```hcl
# monitoring.tf

resource "aws_cloudwatch_dashboard" "tms" {
  dashboard_name = "TMS-Production"

  dashboard_body = jsonencode({
    widgets = [
      {
        type   = "metric"
        x      = 0
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "API Requests"
          metrics = [
            ["AWS/ApiGateway", "Count", "ApiId", aws_apigatewayv2_api.tms.id]
          ]
          period = 300
        }
      },
      {
        type   = "metric"
        x      = 12
        y      = 0
        width  = 12
        height = 6
        properties = {
          title   = "Database Connections"
          metrics = [
            ["AWS/RDS", "DatabaseConnections", "DBInstanceIdentifier", "tms-production-db"]
          ]
          period = 60
        }
      }
    ]
  })
}
```

### 10.2 Create Alerts

```hcl
resource "aws_cloudwatch_metric_alarm" "db_cpu" {
  alarm_name          = "tms-db-high-cpu"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = "2"
  metric_name         = "CPUUtilization"
  namespace           = "AWS/RDS"
  period              = "300"
  statistic           = "Average"
  threshold           = "80"
  alarm_description   = "Database CPU utilization is high"

  dimensions = {
    DBInstanceIdentifier = "tms-production-db"
  }

  alarm_actions = [aws_sns_topic.alerts.arn]
}
```

---

## Deployment Checklist

- [ ] VPC and subnets created
- [ ] RDS PostgreSQL running
- [ ] S3 buckets created
- [ ] Cognito user pool configured
- [ ] Lambda functions deployed
- [ ] API Gateway configured
- [ ] Frontend deployed to S3/CloudFront
- [ ] DNS configured
- [ ] SSL certificates active
- [ ] Monitoring dashboards created
- [ ] Alerts configured

---

## Next Steps

1. [Migrate Database](./database-migration.md)
2. [Update Frontend Code](./code-changes.md)
3. [Configure Secrets](./secrets-setup.md)
4. [Test Everything](./troubleshooting.md)
