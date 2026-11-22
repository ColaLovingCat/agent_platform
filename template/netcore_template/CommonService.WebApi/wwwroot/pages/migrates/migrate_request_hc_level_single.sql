-- Request_FormCostSaving.[Level]: band codes → single level (1_D…6_D / 7_ID…9_ID)
-- Run once on existing DB after deploying the new level list.

UPDATE [dbo].[Request_FormCostSaving]
SET [Level] = CASE
    WHEN [Level] = N'1-3_D' THEN N'2_D'
    WHEN [Level] = N'4-6_D' THEN N'5_D'
    WHEN [Level] = N'7-8_ID' THEN N'8_ID'
    WHEN [Level] IN (N'1_D', N'2_D', N'3_D', N'4_D', N'5_D', N'6_D', N'7_ID', N'8_ID', N'9_ID') THEN [Level]
    WHEN TRY_CAST([Level] AS int) BETWEEN 1 AND 6 THEN CONCAT(TRY_CAST([Level] AS int), N'_D')
    WHEN TRY_CAST([Level] AS int) BETWEEN 7 AND 9 THEN CONCAT(TRY_CAST([Level] AS int), N'_ID')
    ELSE N'4_D'
END
WHERE [Kind] IN (N'personnel', N'manual_efficiency');
