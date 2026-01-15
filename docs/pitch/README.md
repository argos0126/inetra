# Logistics TMS - Product Pitch Documentation

## Overview

This directory contains comprehensive product pitch materials for the Logistics TMS platform, including detailed feature breakdowns, architecture diagrams, and competitive analysis.

## Documents

| Document | Description |
|----------|-------------|
| [Product Overview](./product-overview.md) | Complete product pitch with all features |
| [Feature Cards](./feature-cards.md) | One-page summaries for each module |
| [Competitive Analysis](./competitive-analysis.md) | Market positioning and comparisons |

## Architecture Diagrams

All diagrams are in Mermaid format (`.mermaid`) for easy export to PNG/SVG.

| Diagram | Description |
|---------|-------------|
| [System Architecture](./diagrams/system-architecture.mermaid) | Complete system architecture |
| [Trip Lifecycle](./diagrams/trip-lifecycle.mermaid) | Trip status workflow |
| [Shipment Workflow](./diagrams/shipment-workflow.mermaid) | Shipment status progression |
| [Tracking Flow](./diagrams/tracking-flow.mermaid) | Real-time tracking data flow |
| [Consent Flow](./diagrams/consent-flow.mermaid) | Driver consent management |
| [Alert System](./diagrams/alert-system.mermaid) | Alert detection and resolution |
| [User Roles](./diagrams/user-roles.mermaid) | Role hierarchy and permissions |
| [API Integrations](./diagrams/api-integrations.mermaid) | External API architecture |
| [Database ERD](./diagrams/database-erd.mermaid) | Entity relationship diagram |
| [Data Flow](./diagrams/data-flow.mermaid) | End-to-end data flow |

## How to Export Diagrams

### Option 1: Mermaid Live Editor
1. Visit [mermaid.live](https://mermaid.live)
2. Paste the diagram code
3. Export as PNG, SVG, or PDF

### Option 2: VS Code Extension
1. Install "Mermaid Preview" extension
2. Open `.mermaid` file
3. Right-click → Export

### Option 3: CLI Tool
```bash
npm install -g @mermaid-js/mermaid-cli
mmdc -i diagram.mermaid -o diagram.png
```

## Quick Stats

- **10 Core Modules** with complete feature coverage
- **12+ Role-Based Dashboards** for different user personas
- **4 External API Integrations** (GPS, SIM, Maps, Email)
- **9 Alert Types** with configurable thresholds
- **11 Exception Types** with resolution workflows
- **20+ Database Tables** with Row-Level Security

## Target Markets

1. **Logistics Companies** - Fleet management and tracking
2. **E-commerce** - Last-mile delivery management
3. **Manufacturing** - Supply chain visibility
4. **3PL Providers** - Multi-client shipment management
5. **Enterprise** - Custom deployment and integrations
