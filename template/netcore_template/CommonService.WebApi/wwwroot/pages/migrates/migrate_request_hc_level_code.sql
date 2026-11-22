-- Request_FormCostSaving.[Level]: int → nvarchar code (1-3_D / 4-6_D / 7-8_ID / 9_ID)
IF EXISTS (
    SELECT 1 FROM sys.columns c
    INNER JOIN sys.types t ON c.user_type_id = t.user_type_id
    WHERE c.object_id = OBJECT_ID(N'dbo.Request_FormCostSaving')
      AND c.name = N'Level'
      AND t.name IN (N'int', N'smallint', N'tinyint')
)
BEGIN
    ALTER TABLE [dbo].[Request_FormCostSaving] ADD [LevelCode] [nvarchar](20) NULL;

    UPDATE [dbo].[Request_FormCostSaving]
    SET [LevelCode] = CASE
        WHEN [Level] >= 9 THEN N'9_ID'
        WHEN [Level] >= 7 THEN N'7-8_ID'
        WHEN [Level] >= 4 THEN N'4-6_D'
        WHEN [Level] IS NOT NULL THEN N'1-3_D'
        ELSE NULL
    END;

    ALTER TABLE [dbo].[Request_FormCostSaving] DROP COLUMN [Level];
    EXEC sp_rename N'dbo.Request_FormCostSaving.LevelCode', N'Level', N'COLUMN';
END
GO
