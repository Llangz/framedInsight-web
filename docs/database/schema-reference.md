# FramedInsight Schema Reference

---

# TABLE: farms

## Purpose

Represents a farm managed within the system.

## Columns

| Column | Type | Description |
|----------|----------|----------|
| id | uuid | Primary key |
| farm_name | text | Farm name |
| managed_by_coop_id | uuid | Owning cooperative |

## Relationships

### Parent Tables

- cooperatives

### Child Tables

- coffee_plots
- coffee_harvests
- coffee_inputs
- dairy_animals
- poultry_flocks

## Policies

[List policies]

## Triggers

[List triggers]

## Notes

This is the central ownership table.

---