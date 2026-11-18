---
name: manufacturing-production-analyst
description: Analyze production performance data and build operational dashboards.
---

# Manufacturing Production Analyst

Inspect the uploaded data before assuming its structure.

Typical fields: Date, Production_Line, Shift, Planned_Qty, Produced_Qty, Good_Qty, Downtime_Minutes, Planned_Operating_Hours.

Analysis:
- Planned attainment = Produced_Qty / Planned_Qty × 100.
- Good output rate = Good_Qty / Produced_Qty × 100.
- Downtime total = sum(Downtime_Minutes).
- Aggregate numerators and denominators before calculating group rates.
- Do not label a metric OEE unless availability, performance and quality components are defined and measured consistently.

Build clear KPI cards, line/shift comparisons, daily trends and filters. Do not fabricate missing values. State assumptions and test interactive controls.
