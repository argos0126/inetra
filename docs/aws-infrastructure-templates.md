# AWS Infrastructure-as-Code Templates

Complete Terraform and AWS CDK templates for deploying the TMS application infrastructure on AWS.

## Table of Contents

1. [Architecture Overview](#architecture-overview)
2. [Terraform Templates](#terraform-templates)
3. [AWS CDK Templates (TypeScript)](#aws-cdk-templates-typescript)
4. [Deployment Instructions](#deployment-instructions)
5. [Cost Optimization](#cost-optimization)

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────────────────┐ │
│  │   Route 53   │────▶│  CloudFront  │────▶│    S3 (Static Site)      │ │
│  └──────────────┘     └──────────────┘     └──────────────────────────┘ │
│                              │                                           │
│                              ▼                                           │
│                    ┌──────────────────┐                                  │
│                    │   API Gateway    │                                  │
│                    └────────┬─────────┘                                  │
│                             │                                            │
│         ┌───────────────────┼───────────────────┐                        │
│         ▼                   ▼                   ▼                        │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                  │
│  │   Lambda    │    │   Lambda    │    │   Lambda    │                  │
│  │  (Tracking) │    │  (Routes)   │    │   (Auth)    │                  │
│  └──────┬──────┘    └──────┬──────┘    └──────┬──────┘                  │
│         │                  │                  │                          │
│         └──────────────────┼──────────────────┘                          │
│                            ▼                                             │
│  ┌──────────────────────────────────────────────────────┐               │
│  │                    VPC                                │               │
│  │  ┌─────────────────────────────────────────────────┐ │               │
│  │  │              Private Subnets                     │ │               │
│  │  │  ┌───────────────────┐  ┌───────────────────┐   │ │               │
│  │  │  │   RDS PostgreSQL  │  │   ElastiCache     │   │ │               │
│  │  │  │   (Multi-AZ)      │  │   (Redis)         │   │ │               │
│  │  │  └───────────────────┘  └───────────────────┘   │ │               │
│  │  └─────────────────────────────────────────────────┘ │               │
│  └──────────────────────────────────────────────────────┘               │
│                                                                          │
│  ┌──────────────┐     ┌──────────────┐     ┌──────────────┐             │
│  │ EventBridge  │────▶│   Lambda     │────▶│   SNS/SQS    │             │
│  │  Scheduler   │     │  (Cron Jobs) │     │   (Alerts)   │             │
│  └──────────────┘     └──────────────┘     └──────────────┘             │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │                         S3 Buckets                                │   │
│  │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐   │   │
│  │  │ driver-documents│  │  pod-documents  │  │   static-assets │   │   │
│  │  └─────────────────┘  └─────────────────┘  └─────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Terraform Templates

### Project Structure

```
terraform/
├── main.tf
├── variables.tf
├── outputs.tf
├── versions.tf
├── modules/
│   ├── vpc/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── rds/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── lambda/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   ├── s3/
│   │   ├── main.tf
│   │   ├── variables.tf
│   │   └── outputs.tf
│   └── eventbridge/
│       ├── main.tf
│       ├── variables.tf
│       └── outputs.tf
├── environments/
│   ├── dev.tfvars
│   ├── staging.tfvars
│   └── prod.tfvars
└── lambda-code/
    ├── telenity-tracking/
    ├── wheelseye-tracking/
    ├── google-maps-route/
    └── token-refresh/
```

### versions.tf

```hcl
# terraform/versions.tf

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
    archive = {
      source  = "hashicorp/archive"
      version = "~> 2.4"
    }
  }

  backend "s3" {
    bucket         = "tms-terraform-state"
    key            = "infrastructure/terraform.tfstate"
    region         = "ap-south-1"
    encrypt        = true
    dynamodb_table = "tms-terraform-locks"
  }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "TMS"
      Environment = var.environment
      ManagedBy   = "Terraform"
    }
  }
}
```

### variables.tf

```hcl
# terraform/variables.tf

variable "aws_region" {
  description = "AWS region to deploy resources"
  type        = string
  default     = "ap-south-1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
  default     = "tms"
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "Availability zones for the VPC"
  type        = list(string)
  default     = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]
}

# RDS Configuration
variable "db_instance_class" {
  description = "RDS instance class"
  type        = string
  default     = "db.t3.medium"
}

variable "db_allocated_storage" {
  description = "Allocated storage for RDS in GB"
  type        = number
  default     = 100
}

variable "db_name" {
  description = "Database name"
  type        = string
  default     = "tms_production"
}

variable "db_username" {
  description = "Database master username"
  type        = string
  default     = "postgres"
  sensitive   = true
}

variable "db_password" {
  description = "Database master password"
  type        = string
  sensitive   = true
}

# Lambda Configuration
variable "lambda_memory_size" {
  description = "Memory size for Lambda functions"
  type        = number
  default     = 512
}

variable "lambda_timeout" {
  description = "Timeout for Lambda functions in seconds"
  type        = number
  default     = 30
}

# API Keys (Secrets)
variable "google_maps_api_key" {
  description = "Google Maps API Key"
  type        = string
  sensitive   = true
}

variable "telenity_auth_token" {
  description = "Telenity Auth Token"
  type        = string
  sensitive   = true
}

variable "telenity_basic_token" {
  description = "Telenity Basic Token"
  type        = string
  sensitive   = true
}

variable "wheelseye_access_token" {
  description = "Wheelseye Access Token"
  type        = string
  sensitive   = true
}
```

### main.tf

```hcl
# terraform/main.tf

locals {
  name_prefix = "${var.project_name}-${var.environment}"
}

# ============================================
# VPC Module
# ============================================
module "vpc" {
  source = "./modules/vpc"

  name_prefix        = local.name_prefix
  vpc_cidr           = var.vpc_cidr
  availability_zones = var.availability_zones
  environment        = var.environment
}

# ============================================
# RDS Module
# ============================================
module "rds" {
  source = "./modules/rds"

  name_prefix          = local.name_prefix
  vpc_id               = module.vpc.vpc_id
  private_subnet_ids   = module.vpc.private_subnet_ids
  db_instance_class    = var.db_instance_class
  db_allocated_storage = var.db_allocated_storage
  db_name              = var.db_name
  db_username          = var.db_username
  db_password          = var.db_password
  environment          = var.environment

  allowed_security_groups = [module.lambda.security_group_id]
}

# ============================================
# S3 Module
# ============================================
module "s3" {
  source = "./modules/s3"

  name_prefix = local.name_prefix
  environment = var.environment
}

# ============================================
# Secrets Manager
# ============================================
resource "aws_secretsmanager_secret" "api_keys" {
  name        = "${local.name_prefix}-api-keys"
  description = "API keys for TMS integrations"

  recovery_window_in_days = 7
}

resource "aws_secretsmanager_secret_version" "api_keys" {
  secret_id = aws_secretsmanager_secret.api_keys.id
  secret_string = jsonencode({
    GOOGLE_MAPS_API_KEY    = var.google_maps_api_key
    TELENITY_AUTH_TOKEN    = var.telenity_auth_token
    TELENITY_BASIC_TOKEN   = var.telenity_basic_token
    WHEELSEYE_ACCESS_TOKEN = var.wheelseye_access_token
    DATABASE_URL           = module.rds.connection_string
  })
}

# ============================================
# Lambda Module
# ============================================
module "lambda" {
  source = "./modules/lambda"

  name_prefix        = local.name_prefix
  vpc_id             = module.vpc.vpc_id
  private_subnet_ids = module.vpc.private_subnet_ids
  lambda_memory_size = var.lambda_memory_size
  lambda_timeout     = var.lambda_timeout
  environment        = var.environment

  secrets_arn = aws_secretsmanager_secret.api_keys.arn

  s3_bucket_arns = [
    module.s3.driver_documents_bucket_arn,
    module.s3.pod_documents_bucket_arn
  ]
}

# ============================================
# EventBridge Module
# ============================================
module "eventbridge" {
  source = "./modules/eventbridge"

  name_prefix = local.name_prefix
  environment = var.environment

  lambda_functions = {
    token_refresh = {
      arn           = module.lambda.token_refresh_function_arn
      function_name = module.lambda.token_refresh_function_name
      schedule      = "rate(23 hours)"
    }
    tracking_poller = {
      arn           = module.lambda.tracking_poller_function_arn
      function_name = module.lambda.tracking_poller_function_name
      schedule      = "rate(5 minutes)"
    }
    consent_expiry_check = {
      arn           = module.lambda.consent_expiry_function_arn
      function_name = module.lambda.consent_expiry_function_name
      schedule      = "rate(1 hour)"
    }
  }
}

# ============================================
# API Gateway
# ============================================
resource "aws_apigatewayv2_api" "main" {
  name          = "${local.name_prefix}-api"
  protocol_type = "HTTP"

  cors_configuration {
    allow_origins = ["*"]
    allow_methods = ["GET", "POST", "PUT", "DELETE", "OPTIONS"]
    allow_headers = ["Content-Type", "Authorization", "X-Client-Info"]
    max_age       = 300
  }
}

resource "aws_apigatewayv2_stage" "main" {
  api_id      = aws_apigatewayv2_api.main.id
  name        = var.environment
  auto_deploy = true

  access_log_settings {
    destination_arn = aws_cloudwatch_log_group.api_gateway.arn
    format = jsonencode({
      requestId        = "$context.requestId"
      ip               = "$context.identity.sourceIp"
      requestTime      = "$context.requestTime"
      httpMethod       = "$context.httpMethod"
      routeKey         = "$context.routeKey"
      status           = "$context.status"
      responseLength   = "$context.responseLength"
      integrationError = "$context.integrationErrorMessage"
    })
  }
}

resource "aws_cloudwatch_log_group" "api_gateway" {
  name              = "/aws/apigateway/${local.name_prefix}"
  retention_in_days = 30
}

# API Gateway Lambda Integrations
resource "aws_apigatewayv2_integration" "telenity_tracking" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.lambda.telenity_tracking_function_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "telenity_tracking" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /telenity-tracking"
  target    = "integrations/${aws_apigatewayv2_integration.telenity_tracking.id}"
}

resource "aws_lambda_permission" "telenity_tracking_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda.telenity_tracking_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_apigatewayv2_integration" "wheelseye_tracking" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.lambda.wheelseye_tracking_function_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "wheelseye_tracking" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /wheelseye-tracking"
  target    = "integrations/${aws_apigatewayv2_integration.wheelseye_tracking.id}"
}

resource "aws_lambda_permission" "wheelseye_tracking_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda.wheelseye_tracking_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_apigatewayv2_integration" "google_maps_route" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.lambda.google_maps_route_function_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "google_maps_route" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /google-maps-route"
  target    = "integrations/${aws_apigatewayv2_integration.google_maps_route.id}"
}

resource "aws_lambda_permission" "google_maps_route_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda.google_maps_route_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_apigatewayv2_integration" "google_maps_places" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.lambda.google_maps_places_function_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "google_maps_places" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /google-maps-places"
  target    = "integrations/${aws_apigatewayv2_integration.google_maps_places.id}"
}

resource "aws_lambda_permission" "google_maps_places_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda.google_maps_places_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}

resource "aws_apigatewayv2_integration" "start_trip" {
  api_id                 = aws_apigatewayv2_api.main.id
  integration_type       = "AWS_PROXY"
  integration_uri        = module.lambda.start_trip_function_arn
  payload_format_version = "2.0"
}

resource "aws_apigatewayv2_route" "start_trip" {
  api_id    = aws_apigatewayv2_api.main.id
  route_key = "POST /start-trip"
  target    = "integrations/${aws_apigatewayv2_integration.start_trip.id}"
}

resource "aws_lambda_permission" "start_trip_api" {
  statement_id  = "AllowAPIGatewayInvoke"
  action        = "lambda:InvokeFunction"
  function_name = module.lambda.start_trip_function_name
  principal     = "apigateway.amazonaws.com"
  source_arn    = "${aws_apigatewayv2_api.main.execution_arn}/*/*"
}
```

### modules/vpc/main.tf

```hcl
# terraform/modules/vpc/main.tf

resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true

  tags = {
    Name = "${var.name_prefix}-vpc"
  }
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id

  tags = {
    Name = "${var.name_prefix}-igw"
  }
}

# Public Subnets
resource "aws_subnet" "public" {
  count = length(var.availability_zones)

  vpc_id                  = aws_vpc.main.id
  cidr_block              = cidrsubnet(var.vpc_cidr, 4, count.index)
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true

  tags = {
    Name = "${var.name_prefix}-public-${count.index + 1}"
    Type = "public"
  }
}

# Private Subnets
resource "aws_subnet" "private" {
  count = length(var.availability_zones)

  vpc_id            = aws_vpc.main.id
  cidr_block        = cidrsubnet(var.vpc_cidr, 4, count.index + length(var.availability_zones))
  availability_zone = var.availability_zones[count.index]

  tags = {
    Name = "${var.name_prefix}-private-${count.index + 1}"
    Type = "private"
  }
}

# Elastic IPs for NAT Gateways
resource "aws_eip" "nat" {
  count  = var.environment == "prod" ? length(var.availability_zones) : 1
  domain = "vpc"

  tags = {
    Name = "${var.name_prefix}-nat-eip-${count.index + 1}"
  }

  depends_on = [aws_internet_gateway.main]
}

# NAT Gateways
resource "aws_nat_gateway" "main" {
  count = var.environment == "prod" ? length(var.availability_zones) : 1

  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id

  tags = {
    Name = "${var.name_prefix}-nat-${count.index + 1}"
  }

  depends_on = [aws_internet_gateway.main]
}

# Public Route Table
resource "aws_route_table" "public" {
  vpc_id = aws_vpc.main.id

  route {
    cidr_block = "0.0.0.0/0"
    gateway_id = aws_internet_gateway.main.id
  }

  tags = {
    Name = "${var.name_prefix}-public-rt"
  }
}

# Public Route Table Associations
resource "aws_route_table_association" "public" {
  count = length(aws_subnet.public)

  subnet_id      = aws_subnet.public[count.index].id
  route_table_id = aws_route_table.public.id
}

# Private Route Tables
resource "aws_route_table" "private" {
  count = var.environment == "prod" ? length(var.availability_zones) : 1

  vpc_id = aws_vpc.main.id

  route {
    cidr_block     = "0.0.0.0/0"
    nat_gateway_id = aws_nat_gateway.main[count.index].id
  }

  tags = {
    Name = "${var.name_prefix}-private-rt-${count.index + 1}"
  }
}

# Private Route Table Associations
resource "aws_route_table_association" "private" {
  count = length(aws_subnet.private)

  subnet_id      = aws_subnet.private[count.index].id
  route_table_id = aws_route_table.private[var.environment == "prod" ? count.index : 0].id
}

# VPC Flow Logs
resource "aws_cloudwatch_log_group" "vpc_flow_logs" {
  name              = "/aws/vpc/${var.name_prefix}-flow-logs"
  retention_in_days = 30
}

resource "aws_iam_role" "vpc_flow_logs" {
  name = "${var.name_prefix}-vpc-flow-logs-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "vpc-flow-logs.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "vpc_flow_logs" {
  name = "${var.name_prefix}-vpc-flow-logs-policy"
  role = aws_iam_role.vpc_flow_logs.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = [
        "logs:CreateLogGroup",
        "logs:CreateLogStream",
        "logs:PutLogEvents",
        "logs:DescribeLogGroups",
        "logs:DescribeLogStreams"
      ]
      Effect   = "Allow"
      Resource = "*"
    }]
  })
}

resource "aws_flow_log" "main" {
  vpc_id                   = aws_vpc.main.id
  traffic_type             = "ALL"
  log_destination_type     = "cloud-watch-logs"
  log_destination          = aws_cloudwatch_log_group.vpc_flow_logs.arn
  iam_role_arn             = aws_iam_role.vpc_flow_logs.arn
  max_aggregation_interval = 60

  tags = {
    Name = "${var.name_prefix}-flow-logs"
  }
}
```

### modules/vpc/variables.tf

```hcl
# terraform/modules/vpc/variables.tf

variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
}

variable "availability_zones" {
  description = "Availability zones"
  type        = list(string)
}

variable "environment" {
  description = "Environment name"
  type        = string
}
```

### modules/vpc/outputs.tf

```hcl
# terraform/modules/vpc/outputs.tf

output "vpc_id" {
  description = "VPC ID"
  value       = aws_vpc.main.id
}

output "public_subnet_ids" {
  description = "Public subnet IDs"
  value       = aws_subnet.public[*].id
}

output "private_subnet_ids" {
  description = "Private subnet IDs"
  value       = aws_subnet.private[*].id
}

output "nat_gateway_ips" {
  description = "NAT Gateway Elastic IPs"
  value       = aws_eip.nat[*].public_ip
}
```

### modules/rds/main.tf

```hcl
# terraform/modules/rds/main.tf

resource "aws_db_subnet_group" "main" {
  name        = "${var.name_prefix}-db-subnet-group"
  description = "Database subnet group for ${var.name_prefix}"
  subnet_ids  = var.private_subnet_ids

  tags = {
    Name = "${var.name_prefix}-db-subnet-group"
  }
}

resource "aws_security_group" "rds" {
  name        = "${var.name_prefix}-rds-sg"
  description = "Security group for RDS PostgreSQL"
  vpc_id      = var.vpc_id

  tags = {
    Name = "${var.name_prefix}-rds-sg"
  }
}

resource "aws_security_group_rule" "rds_ingress" {
  count = length(var.allowed_security_groups)

  type                     = "ingress"
  from_port                = 5432
  to_port                  = 5432
  protocol                 = "tcp"
  source_security_group_id = var.allowed_security_groups[count.index]
  security_group_id        = aws_security_group.rds.id
  description              = "Allow PostgreSQL from allowed security groups"
}

resource "aws_security_group_rule" "rds_egress" {
  type              = "egress"
  from_port         = 0
  to_port           = 0
  protocol          = "-1"
  cidr_blocks       = ["0.0.0.0/0"]
  security_group_id = aws_security_group.rds.id
  description       = "Allow all outbound traffic"
}

resource "aws_db_parameter_group" "main" {
  name        = "${var.name_prefix}-pg15-params"
  family      = "postgres15"
  description = "Custom parameter group for ${var.name_prefix}"

  parameter {
    name  = "log_connections"
    value = "1"
  }

  parameter {
    name  = "log_disconnections"
    value = "1"
  }

  parameter {
    name  = "log_duration"
    value = "1"
  }

  parameter {
    name  = "log_min_duration_statement"
    value = "1000" # Log queries taking more than 1 second
  }

  parameter {
    name         = "shared_preload_libraries"
    value        = "pg_stat_statements"
    apply_method = "pending-reboot"
  }

  tags = {
    Name = "${var.name_prefix}-pg15-params"
  }
}

resource "aws_db_instance" "main" {
  identifier = "${var.name_prefix}-postgres"

  engine         = "postgres"
  engine_version = "15.4"
  instance_class = var.db_instance_class

  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_allocated_storage * 2 # Enable autoscaling
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = var.db_password

  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.main.name

  multi_az               = var.environment == "prod"
  publicly_accessible    = false
  deletion_protection    = var.environment == "prod"
  skip_final_snapshot    = var.environment != "prod"
  final_snapshot_identifier = var.environment == "prod" ? "${var.name_prefix}-final-snapshot" : null

  backup_retention_period = var.environment == "prod" ? 7 : 1
  backup_window           = "03:00-04:00"
  maintenance_window      = "Mon:04:00-Mon:05:00"

  performance_insights_enabled          = var.environment == "prod"
  performance_insights_retention_period = var.environment == "prod" ? 7 : 0

  enabled_cloudwatch_logs_exports = ["postgresql", "upgrade"]

  tags = {
    Name = "${var.name_prefix}-postgres"
  }
}

# Read replica for production
resource "aws_db_instance" "replica" {
  count = var.environment == "prod" ? 1 : 0

  identifier = "${var.name_prefix}-postgres-replica"

  replicate_source_db = aws_db_instance.main.identifier
  instance_class      = var.db_instance_class
  storage_encrypted   = true

  vpc_security_group_ids = [aws_security_group.rds.id]
  parameter_group_name   = aws_db_parameter_group.main.name

  publicly_accessible = false
  skip_final_snapshot = true

  performance_insights_enabled          = true
  performance_insights_retention_period = 7

  tags = {
    Name = "${var.name_prefix}-postgres-replica"
  }
}
```

### modules/rds/variables.tf

```hcl
# terraform/modules/rds/variables.tf

variable "name_prefix" {
  type = string
}

variable "vpc_id" {
  type = string
}

variable "private_subnet_ids" {
  type = list(string)
}

variable "db_instance_class" {
  type = string
}

variable "db_allocated_storage" {
  type = number
}

variable "db_name" {
  type = string
}

variable "db_username" {
  type      = string
  sensitive = true
}

variable "db_password" {
  type      = string
  sensitive = true
}

variable "environment" {
  type = string
}

variable "allowed_security_groups" {
  type    = list(string)
  default = []
}
```

### modules/rds/outputs.tf

```hcl
# terraform/modules/rds/outputs.tf

output "endpoint" {
  description = "RDS endpoint"
  value       = aws_db_instance.main.endpoint
}

output "address" {
  description = "RDS address"
  value       = aws_db_instance.main.address
}

output "port" {
  description = "RDS port"
  value       = aws_db_instance.main.port
}

output "connection_string" {
  description = "PostgreSQL connection string"
  value       = "postgresql://${var.db_username}:${var.db_password}@${aws_db_instance.main.endpoint}/${var.db_name}"
  sensitive   = true
}

output "security_group_id" {
  description = "RDS security group ID"
  value       = aws_security_group.rds.id
}

output "replica_endpoint" {
  description = "Read replica endpoint"
  value       = var.environment == "prod" ? aws_db_instance.replica[0].endpoint : null
}
```

### modules/s3/main.tf

```hcl
# terraform/modules/s3/main.tf

# Driver Documents Bucket
resource "aws_s3_bucket" "driver_documents" {
  bucket = "${var.name_prefix}-driver-documents"

  tags = {
    Name = "${var.name_prefix}-driver-documents"
  }
}

resource "aws_s3_bucket_versioning" "driver_documents" {
  bucket = aws_s3_bucket.driver_documents.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "driver_documents" {
  bucket = aws_s3_bucket.driver_documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "driver_documents" {
  bucket = aws_s3_bucket.driver_documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "driver_documents" {
  bucket = aws_s3_bucket.driver_documents.id

  rule {
    id     = "move-to-ia"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    transition {
      days          = 365
      storage_class = "GLACIER"
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# POD Documents Bucket
resource "aws_s3_bucket" "pod_documents" {
  bucket = "${var.name_prefix}-pod-documents"

  tags = {
    Name = "${var.name_prefix}-pod-documents"
  }
}

resource "aws_s3_bucket_versioning" "pod_documents" {
  bucket = aws_s3_bucket.pod_documents.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "pod_documents" {
  bucket = aws_s3_bucket.pod_documents.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_bucket_public_access_block" "pod_documents" {
  bucket = aws_s3_bucket.pod_documents.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_lifecycle_configuration" "pod_documents" {
  bucket = aws_s3_bucket.pod_documents.id

  rule {
    id     = "move-to-ia"
    status = "Enabled"

    transition {
      days          = 90
      storage_class = "STANDARD_IA"
    }

    noncurrent_version_expiration {
      noncurrent_days = 90
    }
  }
}

# Static Assets Bucket (for frontend)
resource "aws_s3_bucket" "static_assets" {
  bucket = "${var.name_prefix}-static-assets"

  tags = {
    Name = "${var.name_prefix}-static-assets"
  }
}

resource "aws_s3_bucket_website_configuration" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  index_document {
    suffix = "index.html"
  }

  error_document {
    key = "index.html"
  }
}

resource "aws_s3_bucket_cors_configuration" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = ["*"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_policy" "static_assets" {
  bucket = aws_s3_bucket.static_assets.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid       = "AllowCloudFrontAccess"
        Effect    = "Allow"
        Principal = {
          Service = "cloudfront.amazonaws.com"
        }
        Action   = "s3:GetObject"
        Resource = "${aws_s3_bucket.static_assets.arn}/*"
        Condition = {
          StringEquals = {
            "AWS:SourceArn" = aws_cloudfront_distribution.main.arn
          }
        }
      }
    ]
  })
}

# CloudFront Distribution
resource "aws_cloudfront_origin_access_control" "main" {
  name                              = "${var.name_prefix}-oac"
  description                       = "OAC for ${var.name_prefix}"
  origin_access_control_origin_type = "s3"
  signing_behavior                  = "always"
  signing_protocol                  = "sigv4"
}

resource "aws_cloudfront_distribution" "main" {
  enabled             = true
  is_ipv6_enabled     = true
  default_root_object = "index.html"
  price_class         = "PriceClass_200"

  origin {
    domain_name              = aws_s3_bucket.static_assets.bucket_regional_domain_name
    origin_id                = "S3Origin"
    origin_access_control_id = aws_cloudfront_origin_access_control.main.id
  }

  default_cache_behavior {
    allowed_methods  = ["GET", "HEAD", "OPTIONS"]
    cached_methods   = ["GET", "HEAD"]
    target_origin_id = "S3Origin"

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
    compress               = true
  }

  # SPA routing - return index.html for 404
  custom_error_response {
    error_code         = 404
    response_code      = 200
    response_page_path = "/index.html"
  }

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
    cloudfront_default_certificate = true
  }

  tags = {
    Name = "${var.name_prefix}-cdn"
  }
}
```

### modules/s3/outputs.tf

```hcl
# terraform/modules/s3/outputs.tf

output "driver_documents_bucket_name" {
  value = aws_s3_bucket.driver_documents.id
}

output "driver_documents_bucket_arn" {
  value = aws_s3_bucket.driver_documents.arn
}

output "pod_documents_bucket_name" {
  value = aws_s3_bucket.pod_documents.id
}

output "pod_documents_bucket_arn" {
  value = aws_s3_bucket.pod_documents.arn
}

output "static_assets_bucket_name" {
  value = aws_s3_bucket.static_assets.id
}

output "cloudfront_distribution_domain" {
  value = aws_cloudfront_distribution.main.domain_name
}

output "cloudfront_distribution_id" {
  value = aws_cloudfront_distribution.main.id
}
```

### modules/lambda/main.tf

```hcl
# terraform/modules/lambda/main.tf

# Lambda Security Group
resource "aws_security_group" "lambda" {
  name        = "${var.name_prefix}-lambda-sg"
  description = "Security group for Lambda functions"
  vpc_id      = var.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
    description = "Allow all outbound traffic"
  }

  tags = {
    Name = "${var.name_prefix}-lambda-sg"
  }
}

# Lambda IAM Role
resource "aws_iam_role" "lambda" {
  name = "${var.name_prefix}-lambda-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "lambda.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy_attachment" "lambda_vpc" {
  role       = aws_iam_role.lambda.name
  policy_arn = "arn:aws:iam::aws:policy/service-role/AWSLambdaVPCAccessExecutionRole"
}

resource "aws_iam_role_policy" "lambda_secrets" {
  name = "${var.name_prefix}-lambda-secrets-policy"
  role = aws_iam_role.lambda.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "secretsmanager:GetSecretValue"
        ]
        Resource = [var.secrets_arn]
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:ListBucket"
        ]
        Resource = concat(
          var.s3_bucket_arns,
          [for arn in var.s3_bucket_arns : "${arn}/*"]
        )
      },
      {
        Effect = "Allow"
        Action = [
          "logs:CreateLogGroup",
          "logs:CreateLogStream",
          "logs:PutLogEvents"
        ]
        Resource = "arn:aws:logs:*:*:*"
      }
    ]
  })
}

# Lambda Layer for common dependencies
resource "aws_lambda_layer_version" "common" {
  filename            = "${path.module}/../../lambda-code/layers/common.zip"
  layer_name          = "${var.name_prefix}-common-layer"
  compatible_runtimes = ["nodejs18.x", "nodejs20.x"]
  description         = "Common dependencies for Lambda functions"
}

# Telenity Tracking Lambda
data "archive_file" "telenity_tracking" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-code/telenity-tracking"
  output_path = "${path.module}/../../.build/telenity-tracking.zip"
}

resource "aws_lambda_function" "telenity_tracking" {
  filename         = data.archive_file.telenity_tracking.output_path
  function_name    = "${var.name_prefix}-telenity-tracking"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.telenity_tracking.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = var.lambda_timeout
  memory_size      = var.lambda_memory_size

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      SECRETS_ARN = var.secrets_arn
      NODE_ENV    = var.environment
    }
  }

  layers = [aws_lambda_layer_version.common.arn]

  tags = {
    Name = "${var.name_prefix}-telenity-tracking"
  }
}

# Wheelseye Tracking Lambda
data "archive_file" "wheelseye_tracking" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-code/wheelseye-tracking"
  output_path = "${path.module}/../../.build/wheelseye-tracking.zip"
}

resource "aws_lambda_function" "wheelseye_tracking" {
  filename         = data.archive_file.wheelseye_tracking.output_path
  function_name    = "${var.name_prefix}-wheelseye-tracking"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.wheelseye_tracking.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = var.lambda_timeout
  memory_size      = var.lambda_memory_size

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      SECRETS_ARN = var.secrets_arn
      NODE_ENV    = var.environment
    }
  }

  layers = [aws_lambda_layer_version.common.arn]

  tags = {
    Name = "${var.name_prefix}-wheelseye-tracking"
  }
}

# Google Maps Route Lambda
data "archive_file" "google_maps_route" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-code/google-maps-route"
  output_path = "${path.module}/../../.build/google-maps-route.zip"
}

resource "aws_lambda_function" "google_maps_route" {
  filename         = data.archive_file.google_maps_route.output_path
  function_name    = "${var.name_prefix}-google-maps-route"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.google_maps_route.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = var.lambda_timeout
  memory_size      = var.lambda_memory_size

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      SECRETS_ARN = var.secrets_arn
      NODE_ENV    = var.environment
    }
  }

  layers = [aws_lambda_layer_version.common.arn]

  tags = {
    Name = "${var.name_prefix}-google-maps-route"
  }
}

# Google Maps Places Lambda
data "archive_file" "google_maps_places" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-code/google-maps-places"
  output_path = "${path.module}/../../.build/google-maps-places.zip"
}

resource "aws_lambda_function" "google_maps_places" {
  filename         = data.archive_file.google_maps_places.output_path
  function_name    = "${var.name_prefix}-google-maps-places"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.google_maps_places.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = var.lambda_timeout
  memory_size      = var.lambda_memory_size

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      SECRETS_ARN = var.secrets_arn
      NODE_ENV    = var.environment
    }
  }

  layers = [aws_lambda_layer_version.common.arn]

  tags = {
    Name = "${var.name_prefix}-google-maps-places"
  }
}

# Start Trip Lambda
data "archive_file" "start_trip" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-code/start-trip"
  output_path = "${path.module}/../../.build/start-trip.zip"
}

resource "aws_lambda_function" "start_trip" {
  filename         = data.archive_file.start_trip.output_path
  function_name    = "${var.name_prefix}-start-trip"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.start_trip.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = var.lambda_timeout
  memory_size      = var.lambda_memory_size

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      SECRETS_ARN = var.secrets_arn
      NODE_ENV    = var.environment
    }
  }

  layers = [aws_lambda_layer_version.common.arn]

  tags = {
    Name = "${var.name_prefix}-start-trip"
  }
}

# Token Refresh Lambda (for cron)
data "archive_file" "token_refresh" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-code/token-refresh"
  output_path = "${path.module}/../../.build/token-refresh.zip"
}

resource "aws_lambda_function" "token_refresh" {
  filename         = data.archive_file.token_refresh.output_path
  function_name    = "${var.name_prefix}-token-refresh"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.token_refresh.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 60
  memory_size      = 256

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      SECRETS_ARN = var.secrets_arn
      NODE_ENV    = var.environment
    }
  }

  layers = [aws_lambda_layer_version.common.arn]

  tags = {
    Name = "${var.name_prefix}-token-refresh"
  }
}

# Tracking Poller Lambda (for cron)
data "archive_file" "tracking_poller" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-code/tracking-poller"
  output_path = "${path.module}/../../.build/tracking-poller.zip"
}

resource "aws_lambda_function" "tracking_poller" {
  filename         = data.archive_file.tracking_poller.output_path
  function_name    = "${var.name_prefix}-tracking-poller"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.tracking_poller.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 120
  memory_size      = 512

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      SECRETS_ARN = var.secrets_arn
      NODE_ENV    = var.environment
    }
  }

  layers = [aws_lambda_layer_version.common.arn]

  tags = {
    Name = "${var.name_prefix}-tracking-poller"
  }
}

# Consent Expiry Check Lambda (for cron)
data "archive_file" "consent_expiry" {
  type        = "zip"
  source_dir  = "${path.module}/../../lambda-code/consent-expiry"
  output_path = "${path.module}/../../.build/consent-expiry.zip"
}

resource "aws_lambda_function" "consent_expiry" {
  filename         = data.archive_file.consent_expiry.output_path
  function_name    = "${var.name_prefix}-consent-expiry"
  role             = aws_iam_role.lambda.arn
  handler          = "index.handler"
  source_code_hash = data.archive_file.consent_expiry.output_base64sha256
  runtime          = "nodejs20.x"
  timeout          = 60
  memory_size      = 256

  vpc_config {
    subnet_ids         = var.private_subnet_ids
    security_group_ids = [aws_security_group.lambda.id]
  }

  environment {
    variables = {
      SECRETS_ARN = var.secrets_arn
      NODE_ENV    = var.environment
    }
  }

  layers = [aws_lambda_layer_version.common.arn]

  tags = {
    Name = "${var.name_prefix}-consent-expiry"
  }
}
```

### modules/lambda/outputs.tf

```hcl
# terraform/modules/lambda/outputs.tf

output "security_group_id" {
  value = aws_security_group.lambda.id
}

output "telenity_tracking_function_arn" {
  value = aws_lambda_function.telenity_tracking.invoke_arn
}

output "telenity_tracking_function_name" {
  value = aws_lambda_function.telenity_tracking.function_name
}

output "wheelseye_tracking_function_arn" {
  value = aws_lambda_function.wheelseye_tracking.invoke_arn
}

output "wheelseye_tracking_function_name" {
  value = aws_lambda_function.wheelseye_tracking.function_name
}

output "google_maps_route_function_arn" {
  value = aws_lambda_function.google_maps_route.invoke_arn
}

output "google_maps_route_function_name" {
  value = aws_lambda_function.google_maps_route.function_name
}

output "google_maps_places_function_arn" {
  value = aws_lambda_function.google_maps_places.invoke_arn
}

output "google_maps_places_function_name" {
  value = aws_lambda_function.google_maps_places.function_name
}

output "start_trip_function_arn" {
  value = aws_lambda_function.start_trip.invoke_arn
}

output "start_trip_function_name" {
  value = aws_lambda_function.start_trip.function_name
}

output "token_refresh_function_arn" {
  value = aws_lambda_function.token_refresh.arn
}

output "token_refresh_function_name" {
  value = aws_lambda_function.token_refresh.function_name
}

output "tracking_poller_function_arn" {
  value = aws_lambda_function.tracking_poller.arn
}

output "tracking_poller_function_name" {
  value = aws_lambda_function.tracking_poller.function_name
}

output "consent_expiry_function_arn" {
  value = aws_lambda_function.consent_expiry.arn
}

output "consent_expiry_function_name" {
  value = aws_lambda_function.consent_expiry.function_name
}
```

### modules/eventbridge/main.tf

```hcl
# terraform/modules/eventbridge/main.tf

resource "aws_scheduler_schedule_group" "main" {
  name = "${var.name_prefix}-schedules"
}

resource "aws_iam_role" "scheduler" {
  name = "${var.name_prefix}-scheduler-role"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "scheduler.amazonaws.com"
      }
    }]
  })
}

resource "aws_iam_role_policy" "scheduler_invoke_lambda" {
  name = "${var.name_prefix}-scheduler-invoke-lambda"
  role = aws_iam_role.scheduler.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [{
      Effect = "Allow"
      Action = "lambda:InvokeFunction"
      Resource = [for k, v in var.lambda_functions : v.arn]
    }]
  })
}

resource "aws_scheduler_schedule" "cron_jobs" {
  for_each = var.lambda_functions

  name       = "${var.name_prefix}-${each.key}"
  group_name = aws_scheduler_schedule_group.main.name

  flexible_time_window {
    mode = "OFF"
  }

  schedule_expression          = each.value.schedule
  schedule_expression_timezone = "Asia/Kolkata"

  target {
    arn      = each.value.arn
    role_arn = aws_iam_role.scheduler.arn

    retry_policy {
      maximum_event_age_in_seconds = 3600
      maximum_retry_attempts       = 3
    }
  }

  state = var.environment == "prod" ? "ENABLED" : "DISABLED"
}

# CloudWatch Alarms for failed invocations
resource "aws_cloudwatch_metric_alarm" "lambda_errors" {
  for_each = var.lambda_functions

  alarm_name          = "${var.name_prefix}-${each.key}-errors"
  comparison_operator = "GreaterThanThreshold"
  evaluation_periods  = 1
  metric_name         = "Errors"
  namespace           = "AWS/Lambda"
  period              = 300
  statistic           = "Sum"
  threshold           = 0
  alarm_description   = "Lambda function ${each.key} errors"

  dimensions = {
    FunctionName = each.value.function_name
  }

  alarm_actions = var.environment == "prod" ? [aws_sns_topic.alerts[0].arn] : []

  tags = {
    Name = "${var.name_prefix}-${each.key}-errors-alarm"
  }
}

# SNS Topic for alerts (prod only)
resource "aws_sns_topic" "alerts" {
  count = var.environment == "prod" ? 1 : 0
  name  = "${var.name_prefix}-alerts"
}
```

### modules/eventbridge/variables.tf

```hcl
# terraform/modules/eventbridge/variables.tf

variable "name_prefix" {
  type = string
}

variable "environment" {
  type = string
}

variable "lambda_functions" {
  description = "Map of Lambda functions to schedule"
  type = map(object({
    arn           = string
    function_name = string
    schedule      = string
  }))
}
```

### outputs.tf

```hcl
# terraform/outputs.tf

output "vpc_id" {
  description = "VPC ID"
  value       = module.vpc.vpc_id
}

output "rds_endpoint" {
  description = "RDS endpoint"
  value       = module.rds.endpoint
}

output "api_gateway_url" {
  description = "API Gateway URL"
  value       = aws_apigatewayv2_stage.main.invoke_url
}

output "cloudfront_domain" {
  description = "CloudFront distribution domain"
  value       = module.s3.cloudfront_distribution_domain
}

output "s3_buckets" {
  description = "S3 bucket names"
  value = {
    driver_documents = module.s3.driver_documents_bucket_name
    pod_documents    = module.s3.pod_documents_bucket_name
    static_assets    = module.s3.static_assets_bucket_name
  }
}
```

### environments/prod.tfvars

```hcl
# terraform/environments/prod.tfvars

environment          = "prod"
aws_region           = "ap-south-1"
vpc_cidr             = "10.0.0.0/16"
availability_zones   = ["ap-south-1a", "ap-south-1b", "ap-south-1c"]

# RDS
db_instance_class    = "db.r6g.large"
db_allocated_storage = 200

# Lambda
lambda_memory_size   = 1024
lambda_timeout       = 30
```

---

## AWS CDK Templates (TypeScript)

### CDK Project Structure

```
cdk/
├── bin/
│   └── app.ts
├── lib/
│   ├── vpc-stack.ts
│   ├── rds-stack.ts
│   ├── lambda-stack.ts
│   ├── s3-stack.ts
│   ├── eventbridge-stack.ts
│   └── api-gateway-stack.ts
├── lambda/
│   ├── telenity-tracking/
│   ├── wheelseye-tracking/
│   ├── google-maps-route/
│   └── token-refresh/
├── cdk.json
├── package.json
└── tsconfig.json
```

### package.json

```json
{
  "name": "tms-infrastructure",
  "version": "1.0.0",
  "scripts": {
    "build": "tsc",
    "watch": "tsc -w",
    "cdk": "cdk",
    "deploy:dev": "cdk deploy --all -c env=dev",
    "deploy:staging": "cdk deploy --all -c env=staging",
    "deploy:prod": "cdk deploy --all -c env=prod --require-approval broadening"
  },
  "devDependencies": {
    "@types/node": "^20.0.0",
    "aws-cdk": "^2.120.0",
    "typescript": "^5.3.0"
  },
  "dependencies": {
    "aws-cdk-lib": "^2.120.0",
    "constructs": "^10.3.0"
  }
}
```

### bin/app.ts

```typescript
// cdk/bin/app.ts

import * as cdk from 'aws-cdk-lib';
import { VpcStack } from '../lib/vpc-stack';
import { RdsStack } from '../lib/rds-stack';
import { S3Stack } from '../lib/s3-stack';
import { LambdaStack } from '../lib/lambda-stack';
import { EventBridgeStack } from '../lib/eventbridge-stack';
import { ApiGatewayStack } from '../lib/api-gateway-stack';

const app = new cdk.App();

const env = app.node.tryGetContext('env') || 'dev';
const projectName = 'tms';

const envConfig: Record<string, {
  account: string;
  region: string;
  rdsInstanceClass: string;
  rdsStorage: number;
  lambdaMemory: number;
  multiAz: boolean;
}> = {
  dev: {
    account: process.env.CDK_DEFAULT_ACCOUNT!,
    region: 'ap-south-1',
    rdsInstanceClass: 'db.t3.medium',
    rdsStorage: 50,
    lambdaMemory: 512,
    multiAz: false,
  },
  staging: {
    account: process.env.CDK_DEFAULT_ACCOUNT!,
    region: 'ap-south-1',
    rdsInstanceClass: 'db.t3.large',
    rdsStorage: 100,
    lambdaMemory: 512,
    multiAz: false,
  },
  prod: {
    account: process.env.CDK_DEFAULT_ACCOUNT!,
    region: 'ap-south-1',
    rdsInstanceClass: 'db.r6g.large',
    rdsStorage: 200,
    lambdaMemory: 1024,
    multiAz: true,
  },
};

const config = envConfig[env];
const prefix = `${projectName}-${env}`;

const awsEnv = {
  account: config.account,
  region: config.region,
};

// VPC Stack
const vpcStack = new VpcStack(app, `${prefix}-vpc`, {
  env: awsEnv,
  prefix,
  environment: env,
});

// S3 Stack
const s3Stack = new S3Stack(app, `${prefix}-s3`, {
  env: awsEnv,
  prefix,
  environment: env,
});

// RDS Stack
const rdsStack = new RdsStack(app, `${prefix}-rds`, {
  env: awsEnv,
  prefix,
  environment: env,
  vpc: vpcStack.vpc,
  instanceClass: config.rdsInstanceClass,
  allocatedStorage: config.rdsStorage,
  multiAz: config.multiAz,
});
rdsStack.addDependency(vpcStack);

// Lambda Stack
const lambdaStack = new LambdaStack(app, `${prefix}-lambda`, {
  env: awsEnv,
  prefix,
  environment: env,
  vpc: vpcStack.vpc,
  memorySize: config.lambdaMemory,
  rdsSecurityGroup: rdsStack.securityGroup,
  s3Buckets: {
    driverDocuments: s3Stack.driverDocumentsBucket,
    podDocuments: s3Stack.podDocumentsBucket,
  },
});
lambdaStack.addDependency(vpcStack);
lambdaStack.addDependency(rdsStack);
lambdaStack.addDependency(s3Stack);

// EventBridge Stack
const eventBridgeStack = new EventBridgeStack(app, `${prefix}-eventbridge`, {
  env: awsEnv,
  prefix,
  environment: env,
  lambdaFunctions: {
    tokenRefresh: lambdaStack.tokenRefreshFunction,
    trackingPoller: lambdaStack.trackingPollerFunction,
    consentExpiry: lambdaStack.consentExpiryFunction,
  },
});
eventBridgeStack.addDependency(lambdaStack);

// API Gateway Stack
const apiGatewayStack = new ApiGatewayStack(app, `${prefix}-api`, {
  env: awsEnv,
  prefix,
  environment: env,
  lambdaFunctions: {
    telenityTracking: lambdaStack.telenityTrackingFunction,
    wheelseyeTracking: lambdaStack.wheelseyeTrackingFunction,
    googleMapsRoute: lambdaStack.googleMapsRouteFunction,
    googleMapsPlaces: lambdaStack.googleMapsPlacesFunction,
    startTrip: lambdaStack.startTripFunction,
  },
});
apiGatewayStack.addDependency(lambdaStack);

app.synth();
```

### lib/vpc-stack.ts

```typescript
// cdk/lib/vpc-stack.ts

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface VpcStackProps extends cdk.StackProps {
  prefix: string;
  environment: string;
}

export class VpcStack extends cdk.Stack {
  public readonly vpc: ec2.Vpc;

  constructor(scope: Construct, id: string, props: VpcStackProps) {
    super(scope, id, props);

    const isProd = props.environment === 'prod';

    // Create VPC
    this.vpc = new ec2.Vpc(this, 'Vpc', {
      vpcName: `${props.prefix}-vpc`,
      maxAzs: isProd ? 3 : 2,
      natGateways: isProd ? 3 : 1,
      ipAddresses: ec2.IpAddresses.cidr('10.0.0.0/16'),
      subnetConfiguration: [
        {
          name: 'Public',
          subnetType: ec2.SubnetType.PUBLIC,
          cidrMask: 20,
        },
        {
          name: 'Private',
          subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS,
          cidrMask: 20,
        },
        {
          name: 'Isolated',
          subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
          cidrMask: 20,
        },
      ],
    });

    // VPC Flow Logs
    const flowLogGroup = new logs.LogGroup(this, 'FlowLogGroup', {
      logGroupName: `/aws/vpc/${props.prefix}-flow-logs`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    new ec2.FlowLog(this, 'FlowLog', {
      resourceType: ec2.FlowLogResourceType.fromVpc(this.vpc),
      destination: ec2.FlowLogDestination.toCloudWatchLogs(flowLogGroup),
      trafficType: ec2.FlowLogTrafficType.ALL,
    });

    // VPC Endpoints for AWS services
    this.vpc.addGatewayEndpoint('S3Endpoint', {
      service: ec2.GatewayVpcEndpointAwsService.S3,
    });

    this.vpc.addInterfaceEndpoint('SecretsManagerEndpoint', {
      service: ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER,
    });

    // Outputs
    new cdk.CfnOutput(this, 'VpcId', {
      value: this.vpc.vpcId,
      description: 'VPC ID',
    });
  }
}
```

### lib/rds-stack.ts

```typescript
// cdk/lib/rds-stack.ts

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as rds from 'aws-cdk-lib/aws-rds';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';

export interface RdsStackProps extends cdk.StackProps {
  prefix: string;
  environment: string;
  vpc: ec2.Vpc;
  instanceClass: string;
  allocatedStorage: number;
  multiAz: boolean;
}

export class RdsStack extends cdk.Stack {
  public readonly instance: rds.DatabaseInstance;
  public readonly securityGroup: ec2.SecurityGroup;
  public readonly secret: secretsmanager.Secret;

  constructor(scope: Construct, id: string, props: RdsStackProps) {
    super(scope, id, props);

    const isProd = props.environment === 'prod';

    // Database credentials secret
    this.secret = new secretsmanager.Secret(this, 'DbSecret', {
      secretName: `${props.prefix}/rds/credentials`,
      description: 'RDS PostgreSQL credentials',
      generateSecretString: {
        secretStringTemplate: JSON.stringify({ username: 'postgres' }),
        generateStringKey: 'password',
        excludeCharacters: '/@"\'\\',
        passwordLength: 32,
      },
    });

    // Security Group
    this.securityGroup = new ec2.SecurityGroup(this, 'DbSecurityGroup', {
      vpc: props.vpc,
      securityGroupName: `${props.prefix}-rds-sg`,
      description: 'Security group for RDS PostgreSQL',
      allowAllOutbound: true,
    });

    // Parameter Group
    const parameterGroup = new rds.ParameterGroup(this, 'ParameterGroup', {
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_4,
      }),
      description: `${props.prefix} PostgreSQL 15 parameters`,
      parameters: {
        'log_connections': '1',
        'log_disconnections': '1',
        'log_duration': '1',
        'log_min_duration_statement': '1000',
        'shared_preload_libraries': 'pg_stat_statements',
      },
    });

    // Parse instance class
    const [instanceType, instanceSize] = props.instanceClass.replace('db.', '').split('.');
    
    // RDS Instance
    this.instance = new rds.DatabaseInstance(this, 'Database', {
      instanceIdentifier: `${props.prefix}-postgres`,
      engine: rds.DatabaseInstanceEngine.postgres({
        version: rds.PostgresEngineVersion.VER_15_4,
      }),
      instanceType: ec2.InstanceType.of(
        ec2.InstanceClass[instanceType.toUpperCase() as keyof typeof ec2.InstanceClass],
        ec2.InstanceSize[instanceSize.toUpperCase() as keyof typeof ec2.InstanceSize]
      ),
      vpc: props.vpc,
      vpcSubnets: {
        subnetType: ec2.SubnetType.PRIVATE_ISOLATED,
      },
      securityGroups: [this.securityGroup],
      credentials: rds.Credentials.fromSecret(this.secret),
      databaseName: 'tms_production',
      parameterGroup,
      allocatedStorage: props.allocatedStorage,
      maxAllocatedStorage: props.allocatedStorage * 2,
      storageType: rds.StorageType.GP3,
      storageEncrypted: true,
      multiAz: props.multiAz,
      autoMinorVersionUpgrade: true,
      backupRetention: cdk.Duration.days(isProd ? 7 : 1),
      deleteAutomatedBackups: !isProd,
      deletionProtection: isProd,
      removalPolicy: isProd ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
      enablePerformanceInsights: isProd,
      performanceInsightRetention: isProd 
        ? rds.PerformanceInsightRetention.DEFAULT 
        : undefined,
      cloudwatchLogsExports: ['postgresql', 'upgrade'],
    });

    // Outputs
    new cdk.CfnOutput(this, 'DbEndpoint', {
      value: this.instance.instanceEndpoint.hostname,
      description: 'RDS endpoint',
    });

    new cdk.CfnOutput(this, 'DbSecretArn', {
      value: this.secret.secretArn,
      description: 'Database credentials secret ARN',
    });
  }
}
```

### lib/lambda-stack.ts

```typescript
// cdk/lib/lambda-stack.ts

import * as cdk from 'aws-cdk-lib';
import * as ec2 from 'aws-cdk-lib/aws-ec2';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as secretsmanager from 'aws-cdk-lib/aws-secretsmanager';
import { Construct } from 'constructs';
import * as path from 'path';

export interface LambdaStackProps extends cdk.StackProps {
  prefix: string;
  environment: string;
  vpc: ec2.Vpc;
  memorySize: number;
  rdsSecurityGroup: ec2.SecurityGroup;
  s3Buckets: {
    driverDocuments: s3.Bucket;
    podDocuments: s3.Bucket;
  };
}

export class LambdaStack extends cdk.Stack {
  public readonly telenityTrackingFunction: lambda.Function;
  public readonly wheelseyeTrackingFunction: lambda.Function;
  public readonly googleMapsRouteFunction: lambda.Function;
  public readonly googleMapsPlacesFunction: lambda.Function;
  public readonly startTripFunction: lambda.Function;
  public readonly tokenRefreshFunction: lambda.Function;
  public readonly trackingPollerFunction: lambda.Function;
  public readonly consentExpiryFunction: lambda.Function;

  constructor(scope: Construct, id: string, props: LambdaStackProps) {
    super(scope, id, props);

    // API Keys Secret
    const apiKeysSecret = new secretsmanager.Secret(this, 'ApiKeysSecret', {
      secretName: `${props.prefix}/api-keys`,
      description: 'API keys for TMS integrations',
    });

    // Lambda Security Group
    const lambdaSg = new ec2.SecurityGroup(this, 'LambdaSecurityGroup', {
      vpc: props.vpc,
      securityGroupName: `${props.prefix}-lambda-sg`,
      description: 'Security group for Lambda functions',
      allowAllOutbound: true,
    });

    // Allow Lambda to connect to RDS
    props.rdsSecurityGroup.addIngressRule(
      lambdaSg,
      ec2.Port.tcp(5432),
      'Allow Lambda to connect to PostgreSQL'
    );

    // Common Lambda layer
    const commonLayer = new lambda.LayerVersion(this, 'CommonLayer', {
      layerVersionName: `${props.prefix}-common`,
      code: lambda.Code.fromAsset(path.join(__dirname, '../lambda/layers/common')),
      compatibleRuntimes: [lambda.Runtime.NODEJS_20_X],
      description: 'Common dependencies for Lambda functions',
    });

    // Common environment variables
    const commonEnv = {
      NODE_ENV: props.environment,
      SECRETS_ARN: apiKeysSecret.secretArn,
    };

    // Common function props
    const createFunction = (name: string, timeout: number = 30): lambda.Function => {
      const fn = new lambda.Function(this, name, {
        functionName: `${props.prefix}-${name.toLowerCase().replace(/([A-Z])/g, '-$1').slice(1)}`,
        runtime: lambda.Runtime.NODEJS_20_X,
        handler: 'index.handler',
        code: lambda.Code.fromAsset(path.join(__dirname, `../lambda/${name.toLowerCase()}`)),
        memorySize: props.memorySize,
        timeout: cdk.Duration.seconds(timeout),
        vpc: props.vpc,
        vpcSubnets: { subnetType: ec2.SubnetType.PRIVATE_WITH_EGRESS },
        securityGroups: [lambdaSg],
        environment: commonEnv,
        layers: [commonLayer],
        tracing: lambda.Tracing.ACTIVE,
      });

      // Grant access to secrets
      apiKeysSecret.grantRead(fn);

      // Grant access to S3 buckets
      props.s3Buckets.driverDocuments.grantReadWrite(fn);
      props.s3Buckets.podDocuments.grantReadWrite(fn);

      return fn;
    };

    // Create all Lambda functions
    this.telenityTrackingFunction = createFunction('TelenityTracking');
    this.wheelseyeTrackingFunction = createFunction('WheelseyeTracking');
    this.googleMapsRouteFunction = createFunction('GoogleMapsRoute');
    this.googleMapsPlacesFunction = createFunction('GoogleMapsPlaces');
    this.startTripFunction = createFunction('StartTrip');
    this.tokenRefreshFunction = createFunction('TokenRefresh', 60);
    this.trackingPollerFunction = createFunction('TrackingPoller', 120);
    this.consentExpiryFunction = createFunction('ConsentExpiry', 60);
  }
}
```

### lib/eventbridge-stack.ts

```typescript
// cdk/lib/eventbridge-stack.ts

import * as cdk from 'aws-cdk-lib';
import * as events from 'aws-cdk-lib/aws-events';
import * as targets from 'aws-cdk-lib/aws-events-targets';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as cloudwatch from 'aws-cdk-lib/aws-cloudwatch';
import * as sns from 'aws-cdk-lib/aws-sns';
import * as cloudwatchActions from 'aws-cdk-lib/aws-cloudwatch-actions';
import { Construct } from 'constructs';

export interface EventBridgeStackProps extends cdk.StackProps {
  prefix: string;
  environment: string;
  lambdaFunctions: {
    tokenRefresh: lambda.Function;
    trackingPoller: lambda.Function;
    consentExpiry: lambda.Function;
  };
}

export class EventBridgeStack extends cdk.Stack {
  constructor(scope: Construct, id: string, props: EventBridgeStackProps) {
    super(scope, id, props);

    const isProd = props.environment === 'prod';

    // Token Refresh - Every 23 hours
    new events.Rule(this, 'TokenRefreshRule', {
      ruleName: `${props.prefix}-token-refresh`,
      schedule: events.Schedule.rate(cdk.Duration.hours(23)),
      targets: [new targets.LambdaFunction(props.lambdaFunctions.tokenRefresh, {
        retryAttempts: 3,
      })],
      enabled: isProd,
    });

    // Tracking Poller - Every 5 minutes
    new events.Rule(this, 'TrackingPollerRule', {
      ruleName: `${props.prefix}-tracking-poller`,
      schedule: events.Schedule.rate(cdk.Duration.minutes(5)),
      targets: [new targets.LambdaFunction(props.lambdaFunctions.trackingPoller, {
        retryAttempts: 2,
      })],
      enabled: isProd,
    });

    // Consent Expiry Check - Every hour
    new events.Rule(this, 'ConsentExpiryRule', {
      ruleName: `${props.prefix}-consent-expiry`,
      schedule: events.Schedule.rate(cdk.Duration.hours(1)),
      targets: [new targets.LambdaFunction(props.lambdaFunctions.consentExpiry, {
        retryAttempts: 2,
      })],
      enabled: isProd,
    });

    // Alerts SNS Topic (prod only)
    if (isProd) {
      const alertsTopic = new sns.Topic(this, 'AlertsTopic', {
        topicName: `${props.prefix}-alerts`,
        displayName: 'TMS Lambda Alerts',
      });

      // Create alarms for each Lambda function
      Object.entries(props.lambdaFunctions).forEach(([name, fn]) => {
        const alarm = new cloudwatch.Alarm(this, `${name}ErrorAlarm`, {
          alarmName: `${props.prefix}-${name}-errors`,
          metric: fn.metricErrors({
            period: cdk.Duration.minutes(5),
            statistic: 'Sum',
          }),
          threshold: 1,
          evaluationPeriods: 1,
          comparisonOperator: cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
          treatMissingData: cloudwatch.TreatMissingData.NOT_BREACHING,
        });

        alarm.addAlarmAction(new cloudwatchActions.SnsAction(alertsTopic));
      });
    }
  }
}
```

### lib/api-gateway-stack.ts

```typescript
// cdk/lib/api-gateway-stack.ts

import * as cdk from 'aws-cdk-lib';
import * as apigatewayv2 from 'aws-cdk-lib/aws-apigatewayv2';
import * as integrations from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import * as lambda from 'aws-cdk-lib/aws-lambda';
import * as logs from 'aws-cdk-lib/aws-logs';
import { Construct } from 'constructs';

export interface ApiGatewayStackProps extends cdk.StackProps {
  prefix: string;
  environment: string;
  lambdaFunctions: {
    telenityTracking: lambda.Function;
    wheelseyeTracking: lambda.Function;
    googleMapsRoute: lambda.Function;
    googleMapsPlaces: lambda.Function;
    startTrip: lambda.Function;
  };
}

export class ApiGatewayStack extends cdk.Stack {
  public readonly api: apigatewayv2.HttpApi;

  constructor(scope: Construct, id: string, props: ApiGatewayStackProps) {
    super(scope, id, props);

    // Access logs
    const accessLogs = new logs.LogGroup(this, 'ApiAccessLogs', {
      logGroupName: `/aws/apigateway/${props.prefix}`,
      retention: logs.RetentionDays.ONE_MONTH,
      removalPolicy: cdk.RemovalPolicy.DESTROY,
    });

    // HTTP API
    this.api = new apigatewayv2.HttpApi(this, 'Api', {
      apiName: `${props.prefix}-api`,
      corsPreflight: {
        allowOrigins: ['*'],
        allowMethods: [
          apigatewayv2.CorsHttpMethod.GET,
          apigatewayv2.CorsHttpMethod.POST,
          apigatewayv2.CorsHttpMethod.PUT,
          apigatewayv2.CorsHttpMethod.DELETE,
          apigatewayv2.CorsHttpMethod.OPTIONS,
        ],
        allowHeaders: ['Content-Type', 'Authorization', 'X-Client-Info'],
        maxAge: cdk.Duration.minutes(5),
      },
    });

    // Add routes for each Lambda function
    const routes: Array<{ path: string; function: lambda.Function }> = [
      { path: '/telenity-tracking', function: props.lambdaFunctions.telenityTracking },
      { path: '/wheelseye-tracking', function: props.lambdaFunctions.wheelseyeTracking },
      { path: '/google-maps-route', function: props.lambdaFunctions.googleMapsRoute },
      { path: '/google-maps-places', function: props.lambdaFunctions.googleMapsPlaces },
      { path: '/start-trip', function: props.lambdaFunctions.startTrip },
    ];

    routes.forEach(({ path, function: fn }) => {
      this.api.addRoutes({
        path,
        methods: [apigatewayv2.HttpMethod.POST],
        integration: new integrations.HttpLambdaIntegration(
          `${path.slice(1)}-integration`,
          fn
        ),
      });
    });

    // Outputs
    new cdk.CfnOutput(this, 'ApiUrl', {
      value: this.api.apiEndpoint,
      description: 'API Gateway URL',
    });
  }
}
```

---

## Deployment Instructions

### Terraform Deployment

```bash
# Initialize Terraform
cd terraform
terraform init

# Create workspace for environment
terraform workspace new prod
terraform workspace select prod

# Plan deployment
terraform plan -var-file=environments/prod.tfvars -out=tfplan

# Apply deployment
terraform apply tfplan

# Destroy (if needed)
terraform destroy -var-file=environments/prod.tfvars
```

### CDK Deployment

```bash
# Install dependencies
cd cdk
npm install

# Bootstrap CDK (first time only)
npx cdk bootstrap

# Deploy all stacks
npm run deploy:prod

# Deploy specific stack
npx cdk deploy tms-prod-rds -c env=prod

# Destroy all stacks
npx cdk destroy --all -c env=prod
```

---

## Cost Optimization

### Estimated Monthly Costs (Production)

| Service | Configuration | Est. Monthly Cost |
|---------|--------------|-------------------|
| RDS PostgreSQL | db.r6g.large, Multi-AZ, 200GB | $350-400 |
| Lambda | 6 functions, 1M invocations | $50-100 |
| API Gateway | 5M requests | $15-20 |
| S3 | 100GB storage | $2-5 |
| CloudFront | 1TB transfer | $85-100 |
| NAT Gateway | 3x (prod) | $100-150 |
| VPC | Flow logs, endpoints | $20-30 |
| Secrets Manager | 5 secrets | $2-5 |
| CloudWatch | Logs, metrics | $20-30 |
| **Total** | | **$650-850** |

### Cost Saving Tips

1. **Use Reserved Instances** for RDS (up to 60% savings)
2. **Use Savings Plans** for Lambda (up to 17% savings)
3. **Implement lifecycle policies** for S3 (auto-archive old data)
4. **Right-size Lambda functions** based on actual usage
5. **Use single NAT Gateway** for non-prod environments
