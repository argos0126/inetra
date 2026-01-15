# AWS Architecture Reference

> **Technical deep-dive into the AWS infrastructure**

This document provides detailed architectural information for the AWS deployment.

---

## High-Level Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              AWS Cloud (ap-south-1)                          │
│                                                                              │
│  ┌────────────┐         ┌────────────────┐         ┌──────────────────────┐ │
│  │  Route 53  │────────▶│   CloudFront   │────────▶│   S3 (Frontend)      │ │
│  │    (DNS)   │         │     (CDN)      │         │   React SPA          │ │
│  └────────────┘         └───────┬────────┘         └──────────────────────┘ │
│                                 │                                            │
│                                 │ /api/*                                     │
│                                 ▼                                            │
│                        ┌────────────────┐                                    │
│                        │  API Gateway   │                                    │
│                        │   (HTTP API)   │                                    │
│                        └───────┬────────┘                                    │
│                                │                                             │
│     ┌──────────────────────────┼──────────────────────────┐                  │
│     │                          │                          │                  │
│     ▼                          ▼                          ▼                  │
│ ┌─────────┐              ┌─────────┐              ┌─────────┐               │
│ │ Lambda  │              │ Lambda  │              │ Lambda  │               │
│ │Tracking │              │  Maps   │              │  Trips  │               │
│ └────┬────┘              └────┬────┘              └────┬────┘               │
│      │                        │                        │                     │
│      └────────────────────────┼────────────────────────┘                     │
│                               │                                              │
│                               ▼                                              │
│  ┌──────────────────────────────────────────────────────────────────────┐   │
│  │                              VPC                                      │   │
│  │  ┌─────────────────────────────────────────────────────────────────┐ │   │
│  │  │                       Private Subnets                            │ │   │
│  │  │  ┌───────────────────────┐    ┌───────────────────────┐         │ │   │
│  │  │  │   RDS PostgreSQL      │    │    ElastiCache        │         │ │   │
│  │  │  │   (Multi-AZ)          │    │    (Redis)            │         │ │   │
│  │  │  │   Primary + Standby   │    │    Session/Cache      │         │ │   │
│  │  │  └───────────────────────┘    └───────────────────────┘         │ │   │
│  │  └─────────────────────────────────────────────────────────────────┘ │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                              │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐     │
│  │ EventBridge  │  │   Cognito    │  │  S3 Storage  │  │   Secrets    │     │
│  │  Scheduler   │  │    Auth      │  │  Documents   │  │   Manager    │     │
│  └──────────────┘  └──────────────┘  └──────────────┘  └──────────────┘     │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Component Details

### 1. DNS & CDN Layer

| Service | Purpose | Configuration |
|---------|---------|---------------|
| Route 53 | DNS management | A/AAAA records pointing to CloudFront |
| CloudFront | CDN & SSL termination | Origins: S3 (frontend), API Gateway (api) |
| ACM | SSL certificates | Must be in us-east-1 for CloudFront |

### 2. API Layer

| Service | Purpose | Configuration |
|---------|---------|---------------|
| API Gateway (HTTP) | REST API routing | Routes to Lambda functions |
| Lambda | Serverless compute | VPC-attached for RDS access |
| Authorizer | JWT validation | Cognito token verification |

### 3. Data Layer

| Service | Purpose | Configuration |
|---------|---------|---------------|
| RDS PostgreSQL | Primary database | Multi-AZ, encrypted, 15.4 |
| ElastiCache Redis | Session/caching | Optional, for performance |
| S3 | Document storage | Versioned, encrypted |

### 4. Auth & Security

| Service | Purpose | Configuration |
|---------|---------|---------------|
| Cognito | User authentication | User pool + app client |
| Secrets Manager | Credentials storage | API keys, DB passwords |
| IAM | Access control | Least privilege policies |

---

## Network Architecture

```
VPC CIDR: 10.0.0.0/16

┌─────────────────────────────────────────────────────────────┐
│                          VPC                                 │
│                                                              │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Public Subnets (Internet-facing)           ││
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐  ││
│  │  │ 10.0.101.0/24 │ │ 10.0.102.0/24 │ │ 10.0.103.0/24 │  ││
│  │  │    AZ-1a      │ │    AZ-1b      │ │    AZ-1c      │  ││
│  │  │  NAT Gateway  │ │  NAT Gateway  │ │  NAT Gateway  │  ││
│  │  └───────────────┘ └───────────────┘ └───────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
│                            │                                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Private Subnets (Lambda, RDS)              ││
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐  ││
│  │  │  10.0.1.0/24  │ │  10.0.2.0/24  │ │  10.0.3.0/24  │  ││
│  │  │    AZ-1a      │ │    AZ-1b      │ │    AZ-1c      │  ││
│  │  │   Lambda      │ │   Lambda      │ │   Lambda      │  ││
│  │  └───────────────┘ └───────────────┘ └───────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
│                            │                                 │
│  ┌─────────────────────────────────────────────────────────┐│
│  │              Database Subnets (Isolated)                ││
│  │  ┌───────────────┐ ┌───────────────┐ ┌───────────────┐  ││
│  │  │ 10.0.201.0/24 │ │ 10.0.202.0/24 │ │ 10.0.203.0/24 │  ││
│  │  │    AZ-1a      │ │    AZ-1b      │ │    AZ-1c      │  ││
│  │  │ RDS Primary   │ │ RDS Standby   │ │               │  ││
│  │  └───────────────┘ └───────────────┘ └───────────────┘  ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

---

## Security Groups

### Lambda Security Group

```hcl
# Outbound only - Lambda initiates connections
resource "aws_security_group" "lambda" {
  name   = "tms-lambda-sg"
  vpc_id = module.vpc.vpc_id

  egress {
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }
}
```

### RDS Security Group

```hcl
# Only accepts connections from Lambda
resource "aws_security_group" "rds" {
  name   = "tms-rds-sg"
  vpc_id = module.vpc.vpc_id

  ingress {
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.lambda.id]
  }
}
```

---

## Data Flow

### Request Flow (API Call)

```
1. Client → CloudFront
2. CloudFront → API Gateway (if /api/*)
3. API Gateway → Lambda Authorizer (validate JWT)
4. API Gateway → Lambda Function
5. Lambda → RDS (via VPC)
6. Lambda → External APIs (via NAT Gateway)
7. Response back through chain
```

### Authentication Flow

```
1. User submits credentials
2. Frontend → Cognito (authenticate)
3. Cognito → Returns JWT tokens
4. Frontend stores tokens
5. API calls include Authorization header
6. API Gateway validates token
7. Lambda receives verified user context
```

### File Upload Flow

```
1. Frontend requests presigned URL
2. Lambda generates S3 presigned URL
3. Frontend uploads directly to S3
4. S3 triggers Lambda (optional processing)
5. Frontend confirms upload via API
```

---

## Scaling Configuration

### Lambda

| Setting | Value | Reason |
|---------|-------|--------|
| Memory | 512-1024 MB | Balance cost/performance |
| Timeout | 30 seconds | Most API operations |
| Reserved Concurrency | 100 | Prevent runaway costs |
| Provisioned Concurrency | 5 (critical functions) | Reduce cold starts |

### RDS

| Setting | Value | Reason |
|---------|-------|--------|
| Instance Class | db.r6g.large | Production workload |
| Storage | 100 GB gp3 | IOPS/throughput balance |
| Max Connections | ~200 | Based on instance size |
| Read Replicas | 1 (optional) | Read-heavy workloads |

### API Gateway

| Setting | Value | Reason |
|---------|-------|--------|
| Throttle Rate | 1000 req/sec | Prevent abuse |
| Burst Limit | 500 | Handle traffic spikes |
| Timeout | 30 seconds | Match Lambda timeout |

---

## Cost Optimization

### Reserved Instances

```
RDS Reserved Instance (1 year): ~40% savings
- db.r6g.large: ~$0.18/hour → ~$0.11/hour
```

### Lambda Savings

```
- Use ARM64 (Graviton2): 20% cheaper
- Right-size memory allocation
- Use Provisioned Concurrency sparingly
```

### S3 Lifecycle Rules

```
- Move to Glacier after 90 days
- Delete old versions after 30 days
- Use Intelligent-Tiering for unpredictable access
```

---

## Disaster Recovery

### Backup Strategy

| Component | Backup Type | Retention | RPO |
|-----------|-------------|-----------|-----|
| RDS | Automated snapshots | 30 days | 5 min |
| S3 | Cross-region replication | Indefinite | Near-zero |
| Secrets | Multi-region | N/A | N/A |

### Recovery Procedures

```bash
# Restore RDS from snapshot
aws rds restore-db-instance-from-db-snapshot \
  --db-instance-identifier tms-restored \
  --db-snapshot-identifier rds:tms-prod-db-2024-01-15-03-00

# Restore S3 object version
aws s3api get-object \
  --bucket tms-documents \
  --key path/to/file \
  --version-id VERSION_ID \
  restored-file
```

---

## Monitoring & Observability

### CloudWatch Dashboards

**Key Metrics to Monitor:**

| Metric | Service | Threshold |
|--------|---------|-----------|
| CPU Utilization | RDS | > 80% |
| Free Memory | RDS | < 500 MB |
| Error Count | Lambda | > 10/min |
| Duration | Lambda | > 10 sec |
| 5XX Errors | API Gateway | > 1% |
| Latency | API Gateway | > 1 sec |

### Log Groups

```
/aws/lambda/tms-prod-*
/aws/rds/instance/tms-prod-db/postgresql
/aws/apigateway/tms-prod-api
```

---

## Compliance Considerations

### Data Residency

- All data stored in ap-south-1 (Mumbai)
- S3 bucket in same region
- Cross-region backup optional (for DR)

### Encryption

- RDS: Encrypted at rest (AES-256)
- S3: Server-side encryption
- Transit: TLS 1.2+
- Secrets: AWS KMS encryption

### Access Control

- IAM roles with least privilege
- Cognito for user authentication
- API Gateway authorizers
- VPC isolation for databases
