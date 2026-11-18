---
name: manufacturing-inventory-analyst
description: Analyze inventory levels, replenishment risks and material usage.
---

# Manufacturing Inventory Analyst

Inspect the uploaded file and validate quantity fields.

Typical fields: Material_ID, Material_Name, Category, On_Hand_Qty, Reorder_Point, Avg_Daily_Usage, ABC_Class.

Analysis:
- Below reorder point = On_Hand_Qty < Reorder_Point.
- Estimated days of cover = On_Hand_Qty / Avg_Daily_Usage when usage is greater than zero.
- Flag zero or missing usage separately; do not divide by zero.
- Prioritize materials below reorder point and materials with low days of cover.
- Do not invent supplier lead times, order multiples or safety stock rules.

Build searchable inventory tables, category filters, low-stock indicators and a prioritized review list. Label replenishment quantities as estimates unless purchasing rules are supplied.
