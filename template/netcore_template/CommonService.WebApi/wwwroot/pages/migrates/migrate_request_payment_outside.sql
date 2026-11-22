-- Payment outside: Request_FormExternals → Request_FormCostSaving (Kind = payment_outside)
-- Run once on existing DB before deploying backend without FormExternals.

-- 1) Allow new Kind
IF EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE name = N'CK_Request_FormCostSaving_Kind'
      AND parent_object_id = OBJECT_ID(N'dbo.Request_FormCostSaving')
)
BEGIN
    ALTER TABLE [dbo].[Request_FormCostSaving] DROP CONSTRAINT [CK_Request_FormCostSaving_Kind];
    ALTER TABLE [dbo].[Request_FormCostSaving] ADD CONSTRAINT [CK_Request_FormCostSaving_Kind]
        CHECK ([Kind] IN (N'personnel', N'manual_efficiency', N'additional', N'payment_outside'));
END;

-- 2) Migrate legacy rows (map calendar Year → AmountY0..Y5 by CycleStartMonth)
IF OBJECT_ID(N'dbo.Request_FormExternals', N'U') IS NOT NULL
BEGIN
    INSERT INTO [dbo].[Request_FormCostSaving] (
        [ID], [RequestID], [Kind], [ClientId], [Category],
        [AmountY0], [AmountY1], [AmountY2], [AmountY3], [AmountY4], [AmountY5],
        [SortOrder]
    )
    SELECT
        NEWID(),
        e.[RequestID],
        N'payment_outside',
        e.[ClientId],
        N'other',
        CASE WHEN e.[Year] = TRY_CAST(LEFT(NULLIF(m.[CycleStartMonth], N''), 4) AS int) THEN e.[Amount] ELSE 0 END,
        CASE WHEN e.[Year] = TRY_CAST(LEFT(NULLIF(m.[CycleStartMonth], N''), 4) AS int) + 1 THEN e.[Amount] ELSE 0 END,
        CASE WHEN e.[Year] = TRY_CAST(LEFT(NULLIF(m.[CycleStartMonth], N''), 4) AS int) + 2 THEN e.[Amount] ELSE 0 END,
        CASE WHEN e.[Year] = TRY_CAST(LEFT(NULLIF(m.[CycleStartMonth], N''), 4) AS int) + 3 THEN e.[Amount] ELSE 0 END,
        CASE WHEN e.[Year] = TRY_CAST(LEFT(NULLIF(m.[CycleStartMonth], N''), 4) AS int) + 4 THEN e.[Amount] ELSE 0 END,
        CASE WHEN e.[Year] = TRY_CAST(LEFT(NULLIF(m.[CycleStartMonth], N''), 4) AS int) + 5 THEN e.[Amount] ELSE 0 END,
        e.[SortOrder]
    FROM [dbo].[Request_FormExternals] e
    INNER JOIN [dbo].[Request_Main] m ON m.[ID] = e.[RequestID];

    DROP TABLE [dbo].[Request_FormExternals];
END;
