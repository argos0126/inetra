# AWS Deployment Guide

> **Complete guide to hosting your Logistics TMS on Amazon Web Services**

This documentation helps you migrate from Supabase to a self-hosted AWS infrastructure with full control over your data and services.

---

## 🎯 Quick Navigation

| Guide | Time | Description |
|-------|------|-------------|
| [**Quick Start**](./quick-start.md) | 30 min | Minimal deployment for testing |
| [**Full Deployment**](./deployment-guide.md) | 4-6 hours | Complete production setup |
| [**Code Changes**](./code-changes.md) | 1-2 hours | Frontend code updates |
| [**Database Migration**](./database-migration.md) | 2-3 hours | Move your data |
| [**Lambda Functions**](./lambda-functions.md) | 1-2 hours | Backend serverless functions |

---

## 📊 Why Migrate to AWS?

### Benefits

| Reason | Description |
|--------|-------------|
| **Full Control** | Own your infrastructure, data, and security |
| **Data Residency** | Keep data in specific regions for compliance |
| **Cost Optimization** | Scale resources based on actual usage |
| **Enterprise Security** | VPC, IAM, and advanced security features |
| **Customization** | Tune database, caching, and networking |

### Trade-offs

| Consideration | Description |
|---------------|-------------|
| **Complexity** | More moving parts to manage |
| **Maintenance** | You handle updates and patches |
| **Initial Setup** | Takes more time than managed services |

---

## 🏗️ Architecture Comparison

### Current: Supabase (Managed)

```
┌─────────────────────────────────────────────┐
│              Supabase Cloud                 │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐       │
│  │PostgreSQL│ │  Auth   │ │ Storage │       │
│  └─────────┘ └─────────┘ └─────────┘       │
│  ┌─────────────────────────────────┐       │
│  │      Edge Functions (Deno)      │       │
│  └─────────────────────────────────┘       │
└─────────────────────────────────────────────┘
```

### Target: AWS (Self-Hosted)

```
┌────────────────────────────────────────────────────────────────┐
│                         AWS Cloud                               │
│                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌─────────────────────┐       │
│  │ Route 53 │───▶│CloudFront│───▶│   S3 (Frontend)     │       │
│  └──────────┘    └──────────┘    └─────────────────────┘       │
│                       │                                         │
│                       ▼                                         │
│              ┌────────────────┐                                 │
│              │  API Gateway   │                                 │
│              └───────┬────────┘                                 │
│                      │                                          │
│        ┌─────────────┼─────────────┐                           │
│        ▼             ▼             ▼                            │
│  ┌──────────┐  ┌──────────┐  ┌──────────┐                      │
│  │  Lambda  │  │  Lambda  │  │  Lambda  │                      │
│  │(tracking)│  │ (maps)   │  │ (trips)  │                      │
│  └────┬─────┘  └────┬─────┘  └────┬─────┘                      │
│       └─────────────┼─────────────┘                             │
│                     ▼                                           │
│  ┌─────────────────────────────────────────────┐               │
│  │          RDS PostgreSQL (Multi-AZ)          │               │
│  └─────────────────────────────────────────────┘               │
│                                                                 │
│  ┌────────────┐  ┌────────────┐  ┌────────────┐                │
│  │EventBridge │  │  Cognito   │  │     S3     │                │
│  │ (Cron)     │  │  (Auth)    │  │ (Storage)  │                │
│  └────────────┘  └────────────┘  └────────────┘                │
└────────────────────────────────────────────────────────────────┘
```

---

## 📋 Service Mapping

| Supabase Service | AWS Equivalent | Purpose |
|------------------|----------------|---------|
| PostgreSQL | RDS PostgreSQL / Aurora | Database |
| Edge Functions | Lambda + API Gateway | Backend APIs |
| Supabase Auth | Amazon Cognito | Authentication |
| Supabase Storage | Amazon S3 | File storage |
| Realtime | AppSync / WebSocket API | Live updates |
| pg_cron | EventBridge Scheduler | Scheduled jobs |
| Secrets | Secrets Manager | API keys storage |

---

## ⏱️ Migration Timeline

```
Week 1-2: Infrastructure Setup
├── VPC and networking
├── RDS PostgreSQL setup
├── S3 buckets creation
└── Cognito configuration

Week 3-4: Database Migration
├── Schema export and conversion
├── Data migration
├── RLS to application-level auth
└── Data validation

Week 5-6: Application Migration
├── Lambda functions deployment
├── Frontend code changes
├── API Gateway setup
└── Integration testing

Week 7-8: Testing & Cutover
├── Performance testing
├── Security audit
├── DNS cutover
└── Go-live
```

---

## 💰 Cost Comparison

### Monthly Estimates (Production)

| Service | Supabase Pro | AWS Equivalent |
|---------|--------------|----------------|
| Database | $25/mo | $50-150/mo (RDS) |
| Auth | Included | $0-50/mo (Cognito) |
| Storage | $0.021/GB | $0.023/GB (S3) |
| Functions | Included | $0-20/mo (Lambda) |
| **Total** | ~$25-50/mo | ~$100-300/mo |

> **Note**: AWS costs increase with usage but offer more control and scalability.

---

## 📚 Documentation Index

### Setup Guides
- [Quick Start Guide](./quick-start.md) - Get running in 30 minutes
- [Complete Deployment Guide](./deployment-guide.md) - Full production setup
- [Infrastructure Templates](./infrastructure-templates.md) - Terraform & CDK

### Migration Guides
- [Database Migration](./database-migration.md) - PostgreSQL data transfer
- [Code Changes](./code-changes.md) - Frontend updates needed
- [Lambda Functions](./lambda-functions.md) - Backend API setup

### Reference
- [Architecture Details](./architecture.md) - Technical deep-dive
- [Secrets Setup](./secrets-setup.md) - API keys configuration
- [Troubleshooting](./troubleshooting.md) - Common issues & fixes

---

## ✅ Pre-Migration Checklist

Before starting, ensure you have:

- [ ] AWS Account with admin access
- [ ] AWS CLI installed and configured
- [ ] Terraform v1.5+ installed (or AWS CDK)
- [ ] PostgreSQL client tools (psql, pg_dump)
- [ ] Current Supabase database credentials
- [ ] All API keys (Google Maps, Telenity, WheelsEye)
- [ ] Domain name (if using custom domain)

---

## 🆘 Getting Help

- Check [Troubleshooting Guide](./troubleshooting.md) for common issues
- Review [AWS Documentation](https://docs.aws.amazon.com/)
- Join AWS Support if on paid plan

---

## 📝 Quick Commands Reference

```bash
# AWS CLI Configuration
aws configure

# Verify AWS Connection
aws sts get-caller-identity

# List available regions
aws ec2 describe-regions --output table

# Check Terraform version
terraform version
```
