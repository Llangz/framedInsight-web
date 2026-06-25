# FramedInsight Database Master Reference

Version: 2026.06

## 1. Platform Overview

FramedInsight is an integrated agricultural management platform supporting:

- Coffee
- Dairy
- Poultry
- Cooperatives
- Financial Management
- Compliance
- Traceability

The platform follows a domain-driven architecture where each enterprise
operates independently while sharing common farm, cooperative and user data.

---

## 2. Architectural Principles

### Multi-Tenant Design

Ownership Hierarchy:

System
 └── Cooperative
      └── Farm
           └── Enterprise

### Security First

- Row Level Security (RLS)
- Cooperative Isolation
- Farm Ownership Controls

### Auditability

All business-critical actions must be auditable.

### Extensibility

New agricultural enterprises should be addable without redesigning the platform.

---

## 3. Core Domains

### Identity Domain

Tables:
- profiles
- farm_managers
- cooperative_officers

Responsibilities:
- Authentication
- Authorization
- Ownership

---

### Farm Domain

Tables:
- farms

Responsibilities:
- Land ownership
- Enterprise container
- Financial ownership

Relationships:
farms
 ├── coffee_plots
 ├── dairy
 ├── poultry
 └── finance

---

### Coffee Domain

Subdomains:

Production
Health
Quality
Compliance
Traceability

Tables:
- coffee_plots
- coffee_plants
- coffee_activities
- coffee_inputs
- coffee_harvests
- coffee_quality_records
- coffee_health_records
- coffee_scouting_records

---

### Compliance Domain

Tables:
- coffee_eudr_compliance
- coffee_satellite_indices
- coffee_satellite_fetch_log

Purpose:
Support EUDR compliance and sustainability monitoring.

---

### Traceability Domain

Tables:
- export_lots
- coffee_passports

View:
- v_passport_chain

Purpose:
Track coffee from production to export and provide
consumer-facing digital passports.

---

## 4. Cross-Domain Relationships

[Relationship diagrams]

---

## 5. Security Architecture

[Detailed RLS model]

---

## 6. Audit Architecture

[Audit tables, logs and monitoring]

---

## 7. Future Architecture

### Factory Operations

Planned Tables:
- coffee_cherry_deliveries
- coffee_processing_batches

### Export Traceability

Planned Tables:
- coffee_traceability_events

### Consumer Intelligence

Planned Tables:
- coffee_qr_scans