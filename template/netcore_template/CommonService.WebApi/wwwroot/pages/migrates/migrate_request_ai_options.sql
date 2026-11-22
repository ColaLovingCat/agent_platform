IF COL_LENGTH(N'dbo.Request_FormAIOptions', N'BoschChinaOnly') IS NULL
BEGIN
    ALTER TABLE [dbo].[Request_FormAIOptions]
        ADD [BoschChinaOnly] [bit] NOT NULL
            CONSTRAINT [DF_Request_FormAIOptions_China] DEFAULT 1 WITH VALUES;
END;

IF COL_LENGTH(N'dbo.Request_FormAIOptions', N'PersonalDataLevel') IS NULL
BEGIN
    ALTER TABLE [dbo].[Request_FormAIOptions]
        ADD [PersonalDataLevel] [int] NOT NULL
            CONSTRAINT [DF_Request_FormAIOptions_Personal] DEFAULT 1 WITH VALUES;
END;

IF COL_LENGTH(N'dbo.Request_FormAIOptions', N'ImpactLossLevel') IS NULL
BEGIN
    ALTER TABLE [dbo].[Request_FormAIOptions]
        ADD [ImpactLossLevel] [int] NOT NULL
            CONSTRAINT [DF_Request_FormAIOptions_Impact] DEFAULT 1 WITH VALUES;
END;

IF COL_LENGTH(N'dbo.Request_FormAIOptions', N'NoReputationPhysicalHarm') IS NULL
BEGIN
    ALTER TABLE [dbo].[Request_FormAIOptions]
        ADD [NoReputationPhysicalHarm] [bit] NOT NULL
            CONSTRAINT [DF_Request_FormAIOptions_Harm] DEFAULT 1 WITH VALUES;
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE [name] = N'CK_Request_FormAIOptions_Personal'
)
BEGIN
    EXEC(N'
        ALTER TABLE [dbo].[Request_FormAIOptions] WITH CHECK
            ADD CONSTRAINT [CK_Request_FormAIOptions_Personal]
            CHECK ([PersonalDataLevel] BETWEEN 1 AND 3);
    ');
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.check_constraints
    WHERE [name] = N'CK_Request_FormAIOptions_Impact'
)
BEGIN
    EXEC(N'
        ALTER TABLE [dbo].[Request_FormAIOptions] WITH CHECK
            ADD CONSTRAINT [CK_Request_FormAIOptions_Impact]
            CHECK ([ImpactLossLevel] BETWEEN 1 AND 3);
    ');
END;

-- Keep the list-level value in Request_Main aligned with the actual form choices.
UPDATE main
SET [AiLevel] = calculated.[AiLevel]
FROM [dbo].[Request_Main] AS main
INNER JOIN [dbo].[Request_FormAIOptions] AS options
    ON options.[RequestID] = main.[ID]
CROSS APPLY (
    SELECT MAX(levels.[Value]) AS [AiLevel]
    FROM (VALUES
        (CASE WHEN options.[HumanInLoop] = 1 THEN 1 ELSE 4 END),
        (CASE WHEN options.[BoschChinaOnly] = 1 THEN 1 ELSE 3 END),
        (options.[PersonalDataLevel]),
        (options.[ImpactLossLevel]),
        (CASE WHEN options.[NoReputationPhysicalHarm] = 1 THEN 1 ELSE 3 END)
    ) AS levels([Value])
) AS calculated
WHERE main.[AiLevel] <> calculated.[AiLevel];
