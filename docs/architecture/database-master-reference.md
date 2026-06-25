# FramedInsight Database Master Reference

Version: 2026.06

Status: Living Architecture Document

---

# 1. Platform Overview

## Mission

FramedInsight is an integrated agricultural intelligence platform designed to digitize, monitor, optimize, and trace agricultural enterprises from production through commercialization.

The platform currently supports:

- Coffee Farming
- Dairy Farming
- Poultry Farming
- Small Ruminants
- Cooperative Management
- Financial Management
- Sustainability Monitoring
- Compliance Management
- Digital Product Passports
- Export Traceability

The long-term objective is to create a complete digital representation of agricultural value chains from farm to consumer.

---

# 2. Core Design Principles

## Multi-Tenant Architecture

FramedInsight follows a multi-tenant architecture.

Each cooperative operates independently while sharing the same platform infrastructure.

Ownership hierarchy:

System
└── Cooperative
    └── Farm
        └── Enterprise

Examples:

Coffee Enterprise
Dairy Enterprise
Poultry Enterprise
Small Ruminants Enterprise

---

## Security by Default

Every business entity is protected through:

- Row Level Security (RLS)
- Cooperative ownership validation
- Farm ownership validation
- Role-based authorization

No tenant should access another tenant's data.

---

## Auditability

All critical business actions must be traceable.

Examples:

- Harvest creation
- Animal registration
- Passport publication
- Compliance assessment
- Financial transactions

---

## Extensibility

New agricultural enterprises must be introduced without redesigning the platform.

Examples:

Future enterprises:

- Tea
- Avocado
- Macadamia
- Horticulture
- Aquaculture

---

# 3. Domain Architecture

FramedInsight follows Domain Driven Design (DDD).

## Domain Map

Identity Domain
Farm Domain
Coffee Domain
Dairy Domain
Poultry Domain
Small Ruminants Domain
Finance Domain
Compliance Domain
Traceability Domain
Messaging Domain
AI Domain
Administration Domain

---

# 4. Identity Domain

## Purpose

Provides authentication, authorization and ownership management.

## Responsibilities

- User authentication
- User authorization
- Cooperative membership
- Farm ownership
- Role assignment

## Key Components

auth.users

profiles

farm_managers

cooperative_officers

---

# 5. Farm Domain

## Purpose

Represents the physical farming entity.

The farm acts as the parent container for all production activities.

## Core Table

farms

## Relationships

farms
├── coffee_plots
├── dairy_animals
├── poultry_flocks
├── small_ruminants
├── financial_records
└── compliance_records

## Responsibilities

- Ownership
- Location
- Enterprise association
- Compliance linkage

---

# 6. Coffee Domain

## Purpose

Manage coffee production operations from planting to harvest.

---

## Coffee Production

Core Tables:

coffee_plots

coffee_plants

coffee_activities

coffee_inputs

coffee_harvests

---

### coffee_plots

Represents a production block.

Stores:

- Plot boundaries
- Variety information
- Area
- Production metadata

---

### coffee_plants

Represents coffee trees.

Stores:

- Variety
- Planting dates
- Population metrics

---

### coffee_activities

Stores operational activities.

Examples:

- Pruning
- Fertilizer application
- Spraying
- Weeding
- Irrigation

---

### coffee_inputs

Tracks:

- Fertilizers
- Herbicides
- Fungicides
- Insecticides

---

### coffee_harvests

Tracks:

- Harvest dates
- Yield
- Produce type
- Payment status

---

# 7. Coffee Health Domain

## Purpose

Monitor coffee crop health.

Tables:

coffee_health_records

coffee_scouting_records

---

### coffee_health_records

Tracks:

- Diseases
- Pests
- Observations
- Recommendations

---

### coffee_scouting_records

Tracks field inspections.

Stores:

- Pest incidence
- Disease incidence
- Intervention recommendations

---

# 8. Coffee Quality Domain

## Purpose

Capture quality metrics.

Tables:

coffee_quality_records

---

### Metrics

- Moisture
- Defects
- Grade
- Cup profile
- Quality assessments

---

# 9. Sustainability & Compliance Domain

## Purpose

Support certification and regulatory compliance.

---

## EUDR Compliance

Table:

coffee_eudr_compliance

Tracks:

- Compliance status
- Risk assessments
- Verification results
- Deforestation indicators

---

## Satellite Monitoring

Tables:

coffee_satellite_indices

coffee_satellite_fetch_log

Purpose:

Monitor:

- NDVI
- Vegetation health
- Environmental indicators

---

# 10. Dairy Domain

## Purpose

Manage dairy operations.

Supports:

- Animal registration
- Breeding
- Health
- Production
- Feeding

---

## Core Entities

dairy_animals

dairy_milk_records

dairy_health_records

dairy_breeding_records

dairy_feed_records

dairy_calves

---

## Dairy Workflow

Animal
↓
Breeding
↓
Calving
↓
Milk Production
↓
Sales

---

# 11. Poultry Domain

## Purpose

Manage poultry operations.

---

## Core Entities

poultry_flocks

poultry_production_records

poultry_health_records

poultry_feed_records

---

## Workflow

Flock
↓
Feed
↓
Health
↓
Egg/Meat Production
↓
Sales

---

# 12. Small Ruminants Domain

## Purpose

Manage:

- Goats
- Sheep

Capabilities:

- Registration
- Breeding
- Health
- Production

---

# 13. Cooperative Domain

## Purpose

Manage cooperative organizations.

---

## Core Responsibilities

- Membership
- Governance
- Compliance
- Passport ownership

---

## Relationships

cooperative
├── farms
├── members
├── coffee_passports
└── export_lots

---

# 14. Finance Domain

## Purpose

Financial tracking and reporting.

Supports:

- Revenue
- Expenses
- Payments
- Enterprise profitability

---

## Relationships

Farm
└── Financial Records

Enterprise
└── Financial Records

---

# 15. Messaging Domain

## Purpose

Communication infrastructure.

Supports:

- Notifications
- SMS
- WhatsApp integrations
- Queue processing

---

# 16. AI Domain

## Purpose

Artificial intelligence and predictive analytics.

Known Components:

ai_predictions

Future:

- Yield forecasting
- Disease prediction
- Milk prediction
- Harvest optimization

---

# 17. Traceability Domain

## Strategic Importance

This domain transforms FramedInsight from a farm management system into a traceability platform.

---

## Current Components

export_lots

coffee_passports

v_passport_chain

---

## Coffee Passport Architecture

Cooperative
↓
Export Lot
↓
Coffee Passport
↓
Consumer

---

### coffee_passports

Purpose:

Digital Product Passport.

Supports:

- Origin verification
- Sustainability reporting
- Consumer transparency
- Buyer trust

---

### Export Lots

Purpose:

Represent export-ready coffee.

Stores:

- Grade
- Weight
- Buyer information
- Destination

---

### v_passport_chain

Purpose:

Public-facing aggregation layer.

Combines:

- Passport data
- Export lot data
- Cooperative data

Used by:

- QR code pages
- Consumer traceability pages
- Buyer dashboards

---

# 18. Security Architecture

## Row Level Security

FramedInsight heavily relies on PostgreSQL RLS.

Common helper functions include:

- can_manage_farm()
- cooperative ownership validation
- role validation functions

---

## Access Levels

Public

Authenticated User

Farm Manager

Cooperative Officer

Administrator

---

# 19. Audit & Governance

## Objectives

- Accountability
- Compliance
- Traceability

---

## Audit Events

Harvest Created

Harvest Updated

Animal Registered

Passport Published

Compliance Updated

Payment Recorded

---

# 20. Future Roadmap

## Coffee Factory Operations

Planned:

coffee_cherry_deliveries

coffee_processing_batches

coffee_batch_deliveries

---

## Milling Operations

Planned:

coffee_milling_lots

coffee_milling_lot_batches

---

## End-to-End Traceability

Planned:

coffee_traceability_events

Purpose:

Immutable chain of custody.

---

## Consumer Analytics

Planned:

coffee_qr_scans

Metrics:

- Country
- Device
- Browser
- Scan Frequency

---

# 21. Strategic Positioning

FramedInsight is evolving into:

Agricultural Intelligence Platform
+
Compliance Platform
+
Traceability Platform
+
Digital Product Passport Platform

Target Users:

- Farmers
- Cooperatives
- Processors
- Exporters
- Buyers
- Certification Bodies
- Governments

End-State Vision:

Farm
↓
Production
↓
Compliance
↓
Processing
↓
Export
↓
Digital Passport
↓
Consumer