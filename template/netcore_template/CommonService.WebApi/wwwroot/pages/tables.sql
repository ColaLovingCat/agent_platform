CREATE TABLE [dbo].[UserInfos](
	[ID] [uniqueidentifier] NOT NULL,
	[Userno] [nvarchar](50) NOT NULL,
	[Username] [nvarchar](100) NOT NULL,
	[Password] [nvarchar](max) NOT NULL,
	[NtAccount] [nvarchar](20) NULL,
	[Email] [nvarchar](100) NULL,
	[DeptName] [nvarchar](20) NULL,
	[Avatar] [nvarchar](max) NULL,
	[Status] [bit] NOT NULL,
	[CreatedAt] [datetime2](7) NOT NULL,
	[UpdatedAt] [datetime2](7) NULL,
	[DeletedAt] [datetime2](7) NULL,
	[LastLoginAt] [datetime2](7) NULL,
 CONSTRAINT [PK_UserInfos] PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY]

CREATE UNIQUE NONCLUSTERED INDEX [UQ_UserInfos_Userno] ON [dbo].[UserInfos]([Userno]);

CREATE TABLE [dbo].[UserRoles](
	[ID] [uniqueidentifier] NOT NULL,
	[RoleName] [nvarchar](50) NOT NULL,
	[Remark] [nvarchar](100) NULL,
 CONSTRAINT [PK_UserRoles_1] PRIMARY KEY CLUSTERED 
(
	[ID] ASC
)WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY]
) ON [PRIMARY]

CREATE TABLE [dbo].[UserLinks](
    [UserID] UNIQUEIDENTIFIER NOT NULL,
    [RoleID] UNIQUEIDENTIFIER NOT NULL,
    CONSTRAINT PK_UserLinks PRIMARY KEY ([UserID],[RoleID]),
    CONSTRAINT FK_UserLinks_UserInfos FOREIGN KEY ([UserID]) 
        REFERENCES [dbo].[UserInfos]([ID]) 
        ON DELETE CASCADE,
    CONSTRAINT FK_UserLinks_UserRoles FOREIGN KEY ([RoleID]) 
        REFERENCES [dbo].[UserRoles]([ID]) 
        ON DELETE CASCADE
);

-- ===========================================================================
-- Flows  ??????
--
-- ??????
--   * ???= ??????? flow ???chat / manual / schedule / webhook ????
--   * FlowType    : react | dag ??????????????????????
--   * TriggerType : chat | manual | schedule | webhook ?????????????
--   * Definition  : ?? JSON?? { variables, nodes, edges, viewport, ??}
--                   master_data ??????flow_engine ????????
--   * Visibility  : private | shared | public ????????? private
--   * IsEnabled   : ?????????schedule/webhook ????????
--
-- ???DeletedAt IS NULL ???????? soft delete????schedule/webhook
-- ??????ID???????????????????WHERE DeletedAt IS NULL??
--
-- ??????CreatedBy / UpdatedBy / DeletedBy ????UserInfos.ID????
-- ???????? / sso-iuser ???????????FK ???????SQL Server
-- ??????????????NO ACTION ???????
-- ===========================================================================
CREATE TABLE [dbo].[Flows](
    [ID]            [uniqueidentifier]  NOT NULL,
    [Name]          [nvarchar](100)     NOT NULL,
    [Description]   [nvarchar](500)     NULL,
    [FlowType]      [nvarchar](20)      NOT NULL,
    [TriggerType]   [nvarchar](20)      NOT NULL,
    [Visibility]    [nvarchar](20)      NOT NULL CONSTRAINT [DF_Flows_Visibility] DEFAULT 'private',
    [Definition]    [nvarchar](max)     NOT NULL,
    [IsEnabled]     [bit]               NOT NULL CONSTRAINT [DF_Flows_IsEnabled] DEFAULT 1,
    [CreatedBy]     [uniqueidentifier]  NULL,
    [CreatedAt]     [datetime2](7)      NOT NULL,
    [UpdatedBy]     [uniqueidentifier]  NULL,
    [UpdatedAt]     [datetime2](7)      NULL,
    [DeletedBy]     [uniqueidentifier]  NULL,
    [DeletedAt]     [datetime2](7)      NULL,
    CONSTRAINT [PK_Flows] PRIMARY KEY CLUSTERED ([ID] ASC)
        WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
    CONSTRAINT [CK_Flows_FlowType]    CHECK ([FlowType]    IN (N'react', N'dag')),
    CONSTRAINT [CK_Flows_TriggerType] CHECK ([TriggerType] IN (N'chat', N'manual', N'schedule', N'webhook')),
    CONSTRAINT [CK_Flows_Visibility]  CHECK ([Visibility]  IN (N'private', N'shared', N'public')),
    CONSTRAINT [FK_Flows_CreatedBy] FOREIGN KEY ([CreatedBy]) REFERENCES [dbo].[UserInfos]([ID]),
    CONSTRAINT [FK_Flows_UpdatedBy] FOREIGN KEY ([UpdatedBy]) REFERENCES [dbo].[UserInfos]([ID]),
    CONSTRAINT [FK_Flows_DeletedBy] FOREIGN KEY ([DeletedBy]) REFERENCES [dbo].[UserInfos]([ID])
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY];

-- ?? / ??????????filtered index??????????????
CREATE INDEX [IX_Flows_FlowType]    ON [dbo].[Flows]([FlowType])    WHERE [DeletedAt] IS NULL;
CREATE INDEX [IX_Flows_TriggerType] ON [dbo].[Flows]([TriggerType]) WHERE [DeletedAt] IS NULL;
CREATE INDEX [IX_Flows_IsEnabled]   ON [dbo].[Flows]([IsEnabled])   WHERE [DeletedAt] IS NULL;
CREATE INDEX [IX_Flows_CreatedBy]   ON [dbo].[Flows]([CreatedBy])   WHERE [DeletedAt] IS NULL;
-- "?? flow ???????"??????????
CREATE INDEX [IX_Flows_UpdatedAt]   ON [dbo].[Flows]([UpdatedAt] DESC) WHERE [DeletedAt] IS NULL;


-- ===========================================================================
-- Connections  ????????
--
-- ??????
--   * ???= ???????????"?SQL ???? connectionId ????
--   * Kind        : mssql | mysql | oracle ?????????????+ ????????
--   * ?? Visibility ???connection ????????????????private/shared/public
--     ???????????????? IAM?CreatedBy + ??????
--   * IsEnabled   : ????????flow ??SQL ????????????/ ????
--   * PasswordEncrypted : AES ???? base64???? MASTER_DATA_SECRET_KEY ????
--                         ????**API ????????????**??DTO ??????
--                         flow_engine ?????? GET /api/connections/internal/{id}
--                         + X-Internal-Secret ????????
--   * LastTestedAt / LastTestedResult : POST /api/connections/{id}/test ??????
--                                       ?? UI ??"?????? ???? ok"??
--
-- ???DeletedAt IS NULL ??????????????where_used ??Flows.Definition
--   ????????ID????????xx???? cron / webhook flow ????????
--
-- ?????? Flows?CreatedBy / UpdatedBy / DeletedBy ????UserInfos.ID??
-- ===========================================================================
CREATE TABLE [dbo].[Connections](
    [ID]                [uniqueidentifier]  NOT NULL,
    [Name]              [nvarchar](100)     NOT NULL,
    [Description]       [nvarchar](500)     NULL,
    [Kind]              [nvarchar](20)      NOT NULL,
    [Host]              [nvarchar](200)     NOT NULL,
    [Port]              [int]               NOT NULL CONSTRAINT [DF_Connections_Port] DEFAULT 0,
    [Database]          [nvarchar](100)     NULL,
    [ServiceName]       [nvarchar](100)     NULL,
    [Username]          [nvarchar](100)     NOT NULL,
    -- ?????encrypt=false / sslMode=require / ...??JSON ??????????
    [OptionsJson]       [nvarchar](max)     NULL,
    -- AES ???????base64 ?????DTO ??????
    [PasswordEncrypted] [nvarchar](max)     NOT NULL,
    [IsEnabled]         [bit]               NOT NULL CONSTRAINT [DF_Connections_IsEnabled] DEFAULT 1,
    [CreatedBy]         [uniqueidentifier]  NULL,
    [CreatedAt]         [datetime2](7)      NOT NULL,
    [UpdatedBy]         [uniqueidentifier]  NULL,
    [UpdatedAt]         [datetime2](7)      NULL,
    [DeletedBy]         [uniqueidentifier]  NULL,
    [DeletedAt]         [datetime2](7)      NULL,
    -- POST /api/connections/{id}/test ????
    [LastTestedAt]      [datetime2](7)      NULL,
    [LastTestedResult]  [nvarchar](500)     NULL,
    CONSTRAINT [PK_Connections] PRIMARY KEY CLUSTERED ([ID] ASC)
        WITH (PAD_INDEX = OFF, STATISTICS_NORECOMPUTE = OFF, IGNORE_DUP_KEY = OFF, ALLOW_ROW_LOCKS = ON, ALLOW_PAGE_LOCKS = ON, OPTIMIZE_FOR_SEQUENTIAL_KEY = OFF) ON [PRIMARY],
    CONSTRAINT [CK_Connections_Kind]       CHECK ([Kind]       IN (N'mssql', N'mysql', N'oracle')),
    CONSTRAINT [FK_Connections_CreatedBy] FOREIGN KEY ([CreatedBy]) REFERENCES [dbo].[UserInfos]([ID]),
    CONSTRAINT [FK_Connections_UpdatedBy] FOREIGN KEY ([UpdatedBy]) REFERENCES [dbo].[UserInfos]([ID]),
    CONSTRAINT [FK_Connections_DeletedBy] FOREIGN KEY ([DeletedBy]) REFERENCES [dbo].[UserInfos]([ID])
) ON [PRIMARY] TEXTIMAGE_ON [PRIMARY];

-- ?? / ???????filtered index??????????
CREATE INDEX [IX_Connections_Kind]       ON [dbo].[Connections]([Kind])       WHERE [DeletedAt] IS NULL;
CREATE INDEX [IX_Connections_IsEnabled]  ON [dbo].[Connections]([IsEnabled])  WHERE [DeletedAt] IS NULL;
CREATE INDEX [IX_Connections_CreatedBy]  ON [dbo].[Connections]([CreatedBy])  WHERE [DeletedAt] IS NULL;
-- "???????"??/connections ??????????ConnectionService.GetByFilterAsync ??????
CREATE INDEX [IX_Connections_UpdatedAt]  ON [dbo].[Connections]([UpdatedAt] DESC) WHERE [DeletedAt] IS NULL;
-- ??????????/ ConnectionService.ValidatePayload ????????
CREATE INDEX [IX_Connections_Name]       ON [dbo].[Connections]([Name]);


-- ===========================================================================
-- Request_Datasets ?? ????????Dataset pool??
-- ===========================================================================
CREATE TABLE [dbo].[Request_Datasets](
    [ID]                    [uniqueidentifier]  NOT NULL,
    [Code]                  [nvarchar](50)      NOT NULL,
    [Name]                  [nvarchar](200)     NOT NULL,
    [ScConfidentiality]     [nvarchar](10)      NOT NULL,
    [ScIntegrity]           [nvarchar](10)      NOT NULL,
    [ScAvailability]        [nvarchar](10)      NOT NULL,
    [Category]              [nvarchar](50)      NOT NULL,
    [IsEnabled]             [bit]               NOT NULL CONSTRAINT [DF_Request_Datasets_IsEnabled] DEFAULT 1,
    [CreatedAt]             [datetime2](7)      NOT NULL,
    [UpdatedAt]             [datetime2](7)      NULL,
    [DeletedAt]             [datetime2](7)      NULL,
    CONSTRAINT [PK_Request_Datasets] PRIMARY KEY CLUSTERED ([ID] ASC),
    CONSTRAINT [UQ_Request_Datasets_Code] UNIQUE ([Code])
);

CREATE INDEX [IX_Request_Datasets_Category] ON [dbo].[Request_Datasets]([Category]) WHERE [DeletedAt] IS NULL;
CREATE INDEX [IX_Request_Datasets_IsEnabled] ON [dbo].[Request_Datasets]([IsEnabled]) WHERE [DeletedAt] IS NULL;

IF NOT EXISTS (SELECT 1 FROM [dbo].[Request_Datasets] WHERE [Code] = N'ds-mes')
INSERT INTO [dbo].[Request_Datasets]([ID],[Code],[Name],[ScConfidentiality],[ScIntegrity],[ScAvailability],[Category],[IsEnabled],[CreatedAt])
VALUES
    (NEWID(), N'ds-mes',     N'MES Production',        N'C_SC2', N'I_SC2', N'A_SC2', N'OT',           1, SYSUTCDATETIME()),
    (NEWID(), N'ds-wms',     N'WMS Inventory',         N'C_SC2', N'I_SC2', N'A_SC2', N'Logistics',    1, SYSUTCDATETIME()),
    (NEWID(), N'ds-hr',      N'HR Skill Matrix',       N'C_SC3', N'I_SC3', N'A_SC3', N'People',       1, SYSUTCDATETIME()),
    (NEWID(), N'ds-qms',     N'QMS NCR',               N'C_SC3', N'I_SC3', N'A_SC3', N'Quality',      1, SYSUTCDATETIME()),
    (NEWID(), N'ds-finance', N'Cost Center API',       N'C_SC4', N'I_SC4', N'A_SC4', N'Finance',      1, SYSUTCDATETIME()),
    (NEWID(), N'ds-public',  N'Public Spec Catalog',   N'C_SC1', N'I_SC1', N'A_SC1', N'Docs',         1, SYSUTCDATETIME()),
    (NEWID(), N'ds-scada',   N'SCADA Line Telemetry',  N'C_SC2', N'I_SC2', N'A_SC2', N'OT',           1, SYSUTCDATETIME()),
    (NEWID(), N'ds-erp',     N'ERP Order Book',        N'C_SC3', N'I_SC3', N'A_SC3', N'Planning',     1, SYSUTCDATETIME()),
    (NEWID(), N'ds-crm',     N'CRM Case History',      N'C_SC3', N'I_SC3', N'A_SC3', N'Customer',     1, SYSUTCDATETIME()),
    (NEWID(), N'ds-loto',    N'LOTO Permit Log',       N'C_SC3', N'I_SC3', N'A_SC3', N'EHS',          1, SYSUTCDATETIME()),
    (NEWID(), N'ds-energy',  N'Energy Meter Hub',      N'C_SC2', N'I_SC2', N'A_SC2', N'Facilities',   1, SYSUTCDATETIME()),
    (NEWID(), N'ds-plm',     N'PLM Spec Vault',        N'C_SC2', N'I_SC2', N'A_SC2', N'Engineering',  1, SYSUTCDATETIME());


-- ===========================================================================
-- Request_Servers ?? App / DB ???????
-- Type : app | db
-- ===========================================================================
CREATE TABLE [dbo].[Request_Servers](
    [ID]                [uniqueidentifier]  NOT NULL,
    [Code]              [nvarchar](50)      NOT NULL,
    [Type]              [nvarchar](10)      NOT NULL,
    [Name]              [nvarchar](200)     NOT NULL,
    [Description]       [nvarchar](500)     NULL,
    [VramGb]            [decimal](18, 2)    NULL,
    [CacheStorageGb]    [decimal](18, 2)    NULL,
    [CpuCores]          [int]               NULL,
    [PriceMonthly]      [decimal](18, 2)    NULL,
    [PricePerGbMonth]   [decimal](18, 4)    NULL,
    [InstanceMonthly]   [decimal](18, 2)    NULL,
    [IsEnabled]         [bit]               NOT NULL CONSTRAINT [DF_Request_Servers_IsEnabled] DEFAULT 1,
    [CreatedAt]         [datetime2](7)      NOT NULL,
    [UpdatedAt]         [datetime2](7)      NULL,
    [DeletedAt]         [datetime2](7)      NULL,
    CONSTRAINT [PK_Request_Servers] PRIMARY KEY CLUSTERED ([ID] ASC),
    CONSTRAINT [UQ_Request_Servers_Code] UNIQUE ([Code]),
    CONSTRAINT [CK_Request_Servers_Type] CHECK ([Type] IN (N'app', N'db'))
);

CREATE INDEX [IX_Request_Servers_Type] ON [dbo].[Request_Servers]([Type]) WHERE [DeletedAt] IS NULL;

IF NOT EXISTS (SELECT 1 FROM [dbo].[Request_Servers] WHERE [Code] = N'starter')
INSERT INTO [dbo].[Request_Servers]([ID],[Code],[Type],[Name],[Description],[VramGb],[CacheStorageGb],[CpuCores],[PriceMonthly],[PricePerGbMonth],[InstanceMonthly],[IsEnabled],[CreatedAt])
VALUES
    (NEWID(), N'starter',     N'app', N'Starter',     N'Dev / PoC workloads',           2,  20,  4,  180, NULL, NULL, 1, SYSUTCDATETIME()),
    (NEWID(), N'standard',    N'app', N'Standard',    N'Single-agent production',       4,  50,  8,  420, NULL, NULL, 1, SYSUTCDATETIME()),
    (NEWID(), N'performance', N'app', N'Performance', N'Multi-tool / RAG heavy',        8, 100, 16,  780, NULL, NULL, 1, SYSUTCDATETIME()),
    (NEWID(), N'enterprise',  N'app', N'Enterprise',  N'Team / high concurrency',      16, 200, 32, 1450, NULL, NULL, 1, SYSUTCDATETIME()),
    (NEWID(), N'postgresql',  N'db',  N'PostgreSQL',  N'General relational / pgvector', NULL, NULL, NULL, NULL, 0.85, 220, 1, SYSUTCDATETIME()),
    (NEWID(), N'mysql',       N'db',  N'MySQL',       N'OLTP workloads',                NULL, NULL, NULL, NULL, 0.80, 200, 1, SYSUTCDATETIME()),
    (NEWID(), N'mongodb',     N'db',  N'MongoDB',     N'Document / flexible schema',    NULL, NULL, NULL, NULL, 1.10, 320, 1, SYSUTCDATETIME()),
    (NEWID(), N'vector',      N'db',  N'Vector DB',   N'Embedding / ANN store',         NULL, NULL, NULL, NULL, 1.60, 480, 1, SYSUTCDATETIME()),
    (NEWID(), N'redis',       N'db',  N'Redis',       N'Cache / session / queue',       NULL, NULL, NULL, NULL, 2.20, 150, 1, SYSUTCDATETIME());

-- none??Server / DB ????????Code ???????app|db FormServer ????
IF NOT EXISTS (SELECT 1 FROM [dbo].[Request_Servers] WHERE [Code] = N'none')
INSERT INTO [dbo].[Request_Servers]([ID],[Code],[Type],[Name],[Description],[VramGb],[CacheStorageGb],[CpuCores],[PriceMonthly],[PricePerGbMonth],[InstanceMonthly],[IsEnabled],[CreatedAt])
VALUES
    (NEWID(), N'none', N'app', N'None', N'No dedicated server / database', NULL, NULL, NULL, 0, NULL, 0, 1, SYSUTCDATETIME());

IF NOT EXISTS (SELECT 1 FROM [dbo].[Request_Servers] WHERE [Code] = N'redis')
INSERT INTO [dbo].[Request_Servers]([ID],[Code],[Type],[Name],[Description],[VramGb],[CacheStorageGb],[CpuCores],[PriceMonthly],[PricePerGbMonth],[InstanceMonthly],[IsEnabled],[CreatedAt])
VALUES
    (NEWID(), N'redis', N'db', N'Redis', N'Cache / session / queue', NULL, NULL, NULL, NULL, 2.20, 150, 1, SYSUTCDATETIME());


-- ===========================================================================
-- Request_Main ?? ?????????????? + ?? + ??????????
-- ===========================================================================
CREATE TABLE [dbo].[Request_Main](
    [ID]                    [uniqueidentifier]  NOT NULL,
    [Name]                  [nvarchar](200)     NOT NULL CONSTRAINT [DF_Request_Main_Name] DEFAULT N'',
    [Description]           [nvarchar](max)     NULL,
    [Domain]                [nvarchar](100)     NULL,
    [OwnerUserno]           [nvarchar](50)      NULL,
    [OwnerNtAccount]        [nvarchar](50)      NULL,
    [OwnerUsername]         [nvarchar](100)     NULL,
    [OwnerDeptName]         [nvarchar](100)     NULL,
    [PjmUserno]             [nvarchar](50)      NULL,
    [PjmNtAccount]          [nvarchar](50)      NULL,
    [PjmUsername]           [nvarchar](100)     NULL,
    [PjmDeptName]           [nvarchar](100)     NULL,
    [SponsorUserno]         [nvarchar](50)      NULL,
    [SponsorNtAccount]      [nvarchar](50)      NULL,
    [SponsorUsername]       [nvarchar](100)     NULL,
    [SponsorDeptName]       [nvarchar](100)     NULL,
    [Remarks]               [nvarchar](max)     NULL,
    [Status]                [nvarchar](30)      NOT NULL CONSTRAINT [DF_Request_Main_Status] DEFAULT N'draft',
    [PendingApprover]       [nvarchar](100)     NULL,
    [AwaitingMe]            [bit]               NOT NULL CONSTRAINT [DF_Request_Main_AwaitingMe] DEFAULT 0,
    [SecurityMode]          [nvarchar](20)      NOT NULL CONSTRAINT [DF_Request_Main_SecurityMode] DEFAULT N'datasource',
    [DerivedScC]            [nvarchar](10)      NULL,
    [DerivedScI]            [nvarchar](10)      NULL,
    [DerivedScA]            [nvarchar](10)      NULL,
    [ManualScC]             [nvarchar](10)      NULL,
    [ManualScI]             [nvarchar](10)      NULL,
    [ManualScA]             [nvarchar](10)      NULL,
    [OverrideNote]          [nvarchar](max)     NULL,
    [FinalScC]              [nvarchar](10)      NULL,
    [FinalScI]              [nvarchar](10)      NULL,
    [FinalScA]              [nvarchar](10)      NULL,
    [FrequencyPerMonth]     [decimal](18, 2)    NOT NULL CONSTRAINT [DF_Request_Main_Freq] DEFAULT 800,
    [SavingMode]            [nvarchar](20)      NOT NULL CONSTRAINT [DF_Request_Main_SavingMode] DEFAULT N'fte',
    [SavingPerUseMoney]     [decimal](18, 2)    NOT NULL CONSTRAINT [DF_Request_Main_SavingMoney] DEFAULT 0,
    [SavingPerUseFte]       [decimal](18, 4)    NOT NULL CONSTRAINT [DF_Request_Main_SavingFte] DEFAULT 0,
    [EstimatedInvestment]   [decimal](18, 2)    NOT NULL CONSTRAINT [DF_Request_Main_EstInv] DEFAULT 0,
    [CycleStartMonth]       [nvarchar](7)       NOT NULL CONSTRAINT [DF_Request_Main_Cycle] DEFAULT N'',
    [RatioY0]               [decimal](18, 4)    NOT NULL CONSTRAINT [DF_Request_Main_RatioY0] DEFAULT 1,
    [RatioY1]               [decimal](18, 4)    NOT NULL CONSTRAINT [DF_Request_Main_RatioY1] DEFAULT 1,
    [RatioY2]               [decimal](18, 4)    NOT NULL CONSTRAINT [DF_Request_Main_RatioY2] DEFAULT 1,
    [RatioY3]               [decimal](18, 4)    NOT NULL CONSTRAINT [DF_Request_Main_RatioY3] DEFAULT 1,
    [RatioY4]               [decimal](18, 4)    NOT NULL CONSTRAINT [DF_Request_Main_RatioY4] DEFAULT 1,
    [RatioY5]               [decimal](18, 4)    NOT NULL CONSTRAINT [DF_Request_Main_RatioY5] DEFAULT 1,
    [AiLevel]               [int]               NOT NULL CONSTRAINT [DF_Request_Main_AiLevel] DEFAULT 1,
    [TermsAccepted]         [bit]               NOT NULL CONSTRAINT [DF_Request_Main_Terms] DEFAULT 0,
    [InvestmentY0]          [decimal](18, 2)    NOT NULL CONSTRAINT [DF_Request_Main_InvY0] DEFAULT 0,
    [SavingY0]              [decimal](18, 2)    NOT NULL CONSTRAINT [DF_Request_Main_SavY0] DEFAULT 0,
    [SavingNextYear]        [decimal](18, 2)    NOT NULL CONSTRAINT [DF_Request_Main_SavNext] DEFAULT 0,
    [TotalSaving]           [decimal](18, 2)    NOT NULL CONSTRAINT [DF_Request_Main_TotalSav] DEFAULT 0,
    [TotalInvestment]       [decimal](18, 2)    NOT NULL CONSTRAINT [DF_Request_Main_TotalInv] DEFAULT 0,
    [Roi]                   [decimal](18, 2)    NOT NULL CONSTRAINT [DF_Request_Main_Roi] DEFAULT 0,
    [TaxAdjustedRoi]        [decimal](18, 2)    NOT NULL CONSTRAINT [DF_Request_Main_TaxAdjRoi] DEFAULT 0,
    [Npv]                   [decimal](18, 2)    NOT NULL CONSTRAINT [DF_Request_Main_Npv] DEFAULT 0,
    [PbpYears]              [decimal](18, 2)    NULL,
    [PaybackMonths]         [decimal](18, 2)    NULL,
    [IncomeTaxRate]         [decimal](18, 4)    NOT NULL CONSTRAINT [DF_Request_Main_TaxRate] DEFAULT 0.1925,
    [NpvFactor]             [decimal](18, 4)    NOT NULL CONSTRAINT [DF_Request_Main_NpvFactor] DEFAULT 0.08,
    [MetricsFrozen]         [bit]               NOT NULL CONSTRAINT [DF_Request_Main_MetricsFrozen] DEFAULT 0,
    [CreatedBy]             [uniqueidentifier]  NULL,
    [CreatedAt]             [datetime2](7)      NOT NULL,
    [UpdatedBy]             [uniqueidentifier]  NULL,
    [UpdatedAt]             [datetime2](7)      NULL,
    [DeletedBy]             [uniqueidentifier]  NULL,
    [DeletedAt]             [datetime2](7)      NULL,
    CONSTRAINT [PK_Request_Main] PRIMARY KEY CLUSTERED ([ID] ASC),
    CONSTRAINT [CK_Request_Main_Status] CHECK ([Status] IN (
        N'draft', N'submitted', N'checking', N'developing', N'roi_followup',
        N'releasing', N'published', N'rejected')),
    CONSTRAINT [CK_Request_Main_SecurityMode] CHECK ([SecurityMode] IN (N'datasource', N'manual')),
    CONSTRAINT [CK_Request_Main_AiLevel] CHECK ([AiLevel] BETWEEN 1 AND 5),
    CONSTRAINT [FK_Request_Main_CreatedBy] FOREIGN KEY ([CreatedBy]) REFERENCES [dbo].[UserInfos]([ID]),
    CONSTRAINT [FK_Request_Main_UpdatedBy] FOREIGN KEY ([UpdatedBy]) REFERENCES [dbo].[UserInfos]([ID]),
    CONSTRAINT [FK_Request_Main_DeletedBy] FOREIGN KEY ([DeletedBy]) REFERENCES [dbo].[UserInfos]([ID])
);

CREATE INDEX [IX_Request_Main_Status]     ON [dbo].[Request_Main]([Status]) WHERE [DeletedAt] IS NULL;
CREATE INDEX [IX_Request_Main_AwaitingMe] ON [dbo].[Request_Main]([AwaitingMe]) WHERE [DeletedAt] IS NULL;
CREATE INDEX [IX_Request_Main_CreatedBy]  ON [dbo].[Request_Main]([CreatedBy]) WHERE [DeletedAt] IS NULL;
CREATE INDEX [IX_Request_Main_UpdatedAt]  ON [dbo].[Request_Main]([UpdatedAt] DESC) WHERE [DeletedAt] IS NULL;
CREATE INDEX [IX_Request_Main_Name]       ON [dbo].[Request_Main]([Name]) WHERE [DeletedAt] IS NULL;


CREATE TABLE [dbo].[Request_FormDatasets](
    [ID]            [uniqueidentifier]  NOT NULL,
    [RequestID]     [uniqueidentifier]  NOT NULL,
    [DatasetCode]   [nvarchar](50)      NOT NULL,
    [SortOrder]     [int]               NOT NULL CONSTRAINT [DF_Request_FormDatasets_Sort] DEFAULT 0,
    CONSTRAINT [PK_Request_FormDatasets] PRIMARY KEY CLUSTERED ([ID] ASC),
    CONSTRAINT [UQ_Request_FormDatasets] UNIQUE ([RequestID], [DatasetCode]),
    CONSTRAINT [FK_Request_FormDatasets_Request] FOREIGN KEY ([RequestID]) REFERENCES [dbo].[Request_Main]([ID]),
    CONSTRAINT [FK_Request_FormDatasets_Code] FOREIGN KEY ([DatasetCode]) REFERENCES [dbo].[Request_Datasets]([Code])
);
CREATE INDEX [IX_Request_FormDatasets_RequestID] ON [dbo].[Request_FormDatasets]([RequestID]);


-- App / DB ?????ServerCode ???? Request_Servers.Code
CREATE TABLE [dbo].[Request_FormServer](
    [ID]                    [uniqueidentifier]  NOT NULL,
    [RequestID]             [uniqueidentifier]  NOT NULL,
    [Type]                  [nvarchar](10)      NOT NULL,
    [ServerCode]            [nvarchar](50)      NOT NULL,
    [Quantity]              [int]               NOT NULL CONSTRAINT [DF_Request_FormServer_Qty] DEFAULT 1,
    [DbInitialSizeGb]       [decimal](18, 2)    NULL,
    [DbIncrementGbPerYear]  [decimal](18, 2)    NULL,
    [DbRetentionYears]      [int]               NULL,
    [SortOrder]             [int]               NOT NULL CONSTRAINT [DF_Request_FormServer_Sort] DEFAULT 0,
    CONSTRAINT [PK_Request_FormServer] PRIMARY KEY CLUSTERED ([ID] ASC),
    CONSTRAINT [FK_Request_FormServer_Request] FOREIGN KEY ([RequestID]) REFERENCES [dbo].[Request_Main]([ID]),
    CONSTRAINT [FK_Request_FormServer_Code] FOREIGN KEY ([ServerCode]) REFERENCES [dbo].[Request_Servers]([Code]),
    CONSTRAINT [CK_Request_FormServer_Type] CHECK ([Type] IN (N'app', N'db'))
);
CREATE INDEX [IX_Request_FormServer_RequestID] ON [dbo].[Request_FormServer]([RequestID]);


CREATE TABLE [dbo].[Request_FormToken](
    [RequestID]         [uniqueidentifier]  NOT NULL,
    [CallsPerMonth]     [decimal](18, 4)    NOT NULL CONSTRAINT [DF_Request_FormToken_Calls] DEFAULT 800,
    [AvgTokensPerCall]  [decimal](18, 4)    NOT NULL CONSTRAINT [DF_Request_FormToken_Avg] DEFAULT 3500,
    [PricePer1k]        [decimal](18, 4)    NOT NULL CONSTRAINT [DF_Request_FormToken_Price] DEFAULT 0.012,
    [QuotaMode]         [nvarchar](20)      NOT NULL CONSTRAINT [DF_Request_FormToken_QuotaMode] DEFAULT N'money',
    [QuotaLimit]        [decimal](18, 4)    NOT NULL CONSTRAINT [DF_Request_FormToken_QuotaLimit] DEFAULT 0,
    CONSTRAINT [PK_Request_FormToken] PRIMARY KEY CLUSTERED ([RequestID] ASC),
    CONSTRAINT [FK_Request_FormToken_Request] FOREIGN KEY ([RequestID]) REFERENCES [dbo].[Request_Main]([ID])
);


-- Kind: personnel | manual_efficiency | additional | payment_outside
CREATE TABLE [dbo].[Request_FormCostSaving](
    [ID]                [uniqueidentifier]  NOT NULL,
    [RequestID]         [uniqueidentifier]  NOT NULL,
    [Kind]              [nvarchar](30)      NOT NULL,
    [ClientId]          [nvarchar](80)      NOT NULL CONSTRAINT [DF_Request_FormCostSaving_ClientId] DEFAULT N'',
    [Category]          [nvarchar](100)      NULL,
    [CostCenter]        [nvarchar](100)     NULL,
    [Dept]              [nvarchar](100)     NULL,
    [Level]             [nvarchar](20)      NULL,
    [UnitPriceYearly]   [decimal](18, 4)    NULL,
    [Hc]                [decimal](18, 4)    NULL,
    [HcY0]              [decimal](18, 4)    NULL,
    [HcY1]              [decimal](18, 4)    NULL,
    [HcY2]              [decimal](18, 4)    NULL,
    [HcY3]              [decimal](18, 4)    NULL,
    [HcY4]              [decimal](18, 4)    NULL,
    [HcY5]              [decimal](18, 4)    NULL,
    [AmountY0]          [decimal](18, 4)    NULL,
    [AmountY1]          [decimal](18, 4)    NULL,
    [AmountY2]          [decimal](18, 4)    NULL,
    [AmountY3]          [decimal](18, 4)    NULL,
    [AmountY4]          [decimal](18, 4)    NULL,
    [AmountY5]          [decimal](18, 4)    NULL,
    [SortOrder]         [int]               NOT NULL CONSTRAINT [DF_Request_FormCostSaving_Sort] DEFAULT 0,
    CONSTRAINT [PK_Request_FormCostSaving] PRIMARY KEY CLUSTERED ([ID] ASC),
    CONSTRAINT [FK_Request_FormCostSaving_Request] FOREIGN KEY ([RequestID]) REFERENCES [dbo].[Request_Main]([ID]),
    CONSTRAINT [CK_Request_FormCostSaving_Kind] CHECK ([Kind] IN (N'personnel', N'manual_efficiency', N'additional', N'payment_outside'))
);
CREATE INDEX [IX_Request_FormCostSaving_RequestID] ON [dbo].[Request_FormCostSaving]([RequestID]);
CREATE INDEX [IX_Request_FormCostSaving_Kind] ON [dbo].[Request_FormCostSaving]([RequestID], [Kind]);


CREATE TABLE [dbo].[Request_FormRPP](
    [ID]            [uniqueidentifier]  NOT NULL,
    [RequestID]     [uniqueidentifier]  NOT NULL,
    [RppId]         [nvarchar](100)     NOT NULL CONSTRAINT [DF_Request_FormRPP_Id] DEFAULT N'',
    [RppLink]       [nvarchar](500)     NOT NULL CONSTRAINT [DF_Request_FormRPP_Link] DEFAULT N'',
    [SortOrder]     [int]               NOT NULL CONSTRAINT [DF_Request_FormRPP_Sort] DEFAULT 0,
    CONSTRAINT [PK_Request_FormRPP] PRIMARY KEY CLUSTERED ([ID] ASC),
    CONSTRAINT [FK_Request_FormRPP_Request] FOREIGN KEY ([RequestID]) REFERENCES [dbo].[Request_Main]([ID])
);
CREATE INDEX [IX_Request_FormRPP_RequestID] ON [dbo].[Request_FormRPP]([RequestID]);


CREATE TABLE [dbo].[Request_FormAIOptions](
    [RequestID]         [uniqueidentifier]  NOT NULL,
    [HumanInLoop]       [bit]               NOT NULL CONSTRAINT [DF_Request_FormAIOptions_HIL] DEFAULT 1,
    [BoschChinaOnly]    [bit]               NOT NULL CONSTRAINT [DF_Request_FormAIOptions_China] DEFAULT 1,
    [PersonalDataLevel] [int]               NOT NULL CONSTRAINT [DF_Request_FormAIOptions_Personal] DEFAULT 1,
    [ImpactLossLevel]   [int]               NOT NULL CONSTRAINT [DF_Request_FormAIOptions_Impact] DEFAULT 1,
    [NoReputationPhysicalHarm] [bit]         NOT NULL CONSTRAINT [DF_Request_FormAIOptions_Harm] DEFAULT 1,
    [CrossDomain]       [bit]               NOT NULL CONSTRAINT [DF_Request_FormAIOptions_Cross] DEFAULT 0,
    [AutoWriteActions]  [bit]               NOT NULL CONSTRAINT [DF_Request_FormAIOptions_Write] DEFAULT 0,
    [ExternalModel]     [bit]               NOT NULL CONSTRAINT [DF_Request_FormAIOptions_Ext] DEFAULT 0,
    [OutboundData]      [bit]               NOT NULL CONSTRAINT [DF_Request_FormAIOptions_Out] DEFAULT 0,
    CONSTRAINT [CK_Request_FormAIOptions_Personal] CHECK ([PersonalDataLevel] BETWEEN 1 AND 3),
    CONSTRAINT [CK_Request_FormAIOptions_Impact] CHECK ([ImpactLossLevel] BETWEEN 1 AND 3),
    CONSTRAINT [PK_Request_FormAIOptions] PRIMARY KEY CLUSTERED ([RequestID] ASC),
    CONSTRAINT [FK_Request_FormAIOptions_Request] FOREIGN KEY ([RequestID]) REFERENCES [dbo].[Request_Main]([ID])
);


-- ????????Category = basic | check | develop | release | other??Check ???? RefCode
CREATE TABLE [dbo].[Request_Attachments](
    [ID]            [uniqueidentifier]  NOT NULL,
    [RequestID]     [uniqueidentifier]  NOT NULL,
    [Category]      [nvarchar](20)      NOT NULL,
    [RefCode]       [nvarchar](50)      NULL,
    [Uid]           [nvarchar](80)      NOT NULL CONSTRAINT [DF_Request_Attachments_Uid] DEFAULT N'',
    [Name]          [nvarchar](200)     NOT NULL CONSTRAINT [DF_Request_Attachments_Name] DEFAULT N'',
    [Size]          [bigint]            NOT NULL CONSTRAINT [DF_Request_Attachments_Size] DEFAULT 0,
    [Type]          [nvarchar](100)     NULL,
    [UploadedAt]    [nvarchar](40)      NOT NULL CONSTRAINT [DF_Request_Attachments_Uploaded] DEFAULT N'',
    [SortOrder]     [int]               NOT NULL CONSTRAINT [DF_Request_Attachments_Sort] DEFAULT 0,
    CONSTRAINT [PK_Request_Attachments] PRIMARY KEY CLUSTERED ([ID] ASC),
    CONSTRAINT [FK_Request_Attachments_Request] FOREIGN KEY ([RequestID]) REFERENCES [dbo].[Request_Main]([ID]),
    CONSTRAINT [CK_Request_Attachments_Category] CHECK ([Category] IN (N'basic', N'check', N'develop', N'release', N'other'))
);
CREATE INDEX [IX_Request_Attachments_RequestID] ON [dbo].[Request_Attachments]([RequestID]);
CREATE INDEX [IX_Request_Attachments_Cat] ON [dbo].[Request_Attachments]([RequestID], [Category]);


-- ===========================================================================
-- Flow
-- ===========================================================================
CREATE TABLE [dbo].[Request_FlowStages](
    [ID]            [uniqueidentifier]  NOT NULL,
    [RequestID]     [uniqueidentifier]  NOT NULL,
    [Phase]         [nvarchar](20)      NOT NULL,
    [Status]        [nvarchar](20)      NOT NULL CONSTRAINT [DF_Request_FlowStages_Status] DEFAULT N'pending',
    [ConfirmedAt]   [datetime2](7)      NULL,
    [RejectedAt]    [datetime2](7)      NULL,
    [Note]          [nvarchar](max)     NULL,
    [SortOrder]     [int]               NOT NULL CONSTRAINT [DF_Request_FlowStages_Sort] DEFAULT 0,
    CONSTRAINT [PK_Request_FlowStages] PRIMARY KEY CLUSTERED ([ID] ASC),
    CONSTRAINT [UQ_Request_FlowStages_Phase] UNIQUE ([RequestID], [Phase]),
    CONSTRAINT [FK_Request_FlowStages_Request] FOREIGN KEY ([RequestID]) REFERENCES [dbo].[Request_Main]([ID]),
    CONSTRAINT [CK_Request_FlowStages_Phase] CHECK ([Phase] IN (N'check', N'develop', N'roi', N'release', N'publish')),
    CONSTRAINT [CK_Request_FlowStages_Status] CHECK ([Status] IN (N'pending', N'in_progress', N'confirmed', N'rejected'))
);
CREATE INDEX [IX_Request_FlowStages_RequestID] ON [dbo].[Request_FlowStages]([RequestID]);

CREATE TABLE [dbo].[Request_FlowChecks](
    [ID]            [uniqueidentifier]  NOT NULL,
    [RequestID]     [uniqueidentifier]  NOT NULL,
    [Phase]         [nvarchar](20)      NOT NULL,
    [Code]          [nvarchar](50)      NOT NULL,
    [Title]         [nvarchar](200)     NOT NULL,
    [Description]   [nvarchar](max)     NULL,
    [Status]        [nvarchar](20)      NOT NULL CONSTRAINT [DF_Request_FlowChecks_Status] DEFAULT N'pending',
    [Note]          [nvarchar](max)     NULL,
    [SortOrder]     [int]               NOT NULL CONSTRAINT [DF_Request_FlowChecks_Sort] DEFAULT 0,
    CONSTRAINT [PK_Request_FlowChecks] PRIMARY KEY CLUSTERED ([ID] ASC),
    CONSTRAINT [UQ_Request_FlowChecks_Code] UNIQUE ([RequestID], [Phase], [Code]),
    CONSTRAINT [FK_Request_FlowChecks_Request] FOREIGN KEY ([RequestID]) REFERENCES [dbo].[Request_Main]([ID]),
    CONSTRAINT [CK_Request_FlowChecks_Phase] CHECK ([Phase] IN (N'check', N'develop'))
);
CREATE INDEX [IX_Request_FlowChecks_RequestID] ON [dbo].[Request_FlowChecks]([RequestID]);

CREATE TABLE [dbo].[Request_FlowDevelop](
    [RequestID]     [uniqueidentifier]  NOT NULL,
    [DevelopMode]   [nvarchar](20)      NULL,
    [SourceUrl]     [nvarchar](500)     NOT NULL CONSTRAINT [DF_Request_FlowDevelop_Url] DEFAULT N'',
    [SourceRepo]    [nvarchar](200)     NOT NULL CONSTRAINT [DF_Request_FlowDevelop_Repo] DEFAULT N'',
    [SourceBranch]  [nvarchar](100)     NOT NULL CONSTRAINT [DF_Request_FlowDevelop_Branch] DEFAULT N'',
    [GeneratedAt]   [nvarchar](40)      NOT NULL CONSTRAINT [DF_Request_FlowDevelop_Gen] DEFAULT N'',
    CONSTRAINT [PK_Request_FlowDevelop] PRIMARY KEY CLUSTERED ([RequestID] ASC),
    CONSTRAINT [FK_Request_FlowDevelop_Request] FOREIGN KEY ([RequestID]) REFERENCES [dbo].[Request_Main]([ID])
);

CREATE TABLE [dbo].[Request_FlowRoi](
    [RequestID]             [uniqueidentifier]  NOT NULL,
    [FrequencyPerMonth]     [decimal](18, 2)    NOT NULL CONSTRAINT [DF_Request_FlowRoi_Freq] DEFAULT 0,
    [SavingPerUseMoney]     [decimal](18, 2)    NOT NULL CONSTRAINT [DF_Request_FlowRoi_Saving] DEFAULT 0,
    [EstimatedInvestment]   [decimal](18, 2)    NOT NULL CONSTRAINT [DF_Request_FlowRoi_Inv] DEFAULT 0,
    [Note]                  [nvarchar](max)     NOT NULL CONSTRAINT [DF_Request_FlowRoi_Note] DEFAULT N'',
    [ApprovalsJson]         [nvarchar](max)     NOT NULL CONSTRAINT [DF_Request_FlowRoi_Approvals] DEFAULT N'[]',
    CONSTRAINT [PK_Request_FlowRoi] PRIMARY KEY CLUSTERED ([RequestID] ASC),
    CONSTRAINT [FK_Request_FlowRoi_Request] FOREIGN KEY ([RequestID]) REFERENCES [dbo].[Request_Main]([ID])
);

CREATE TABLE [dbo].[Request_FlowRelease](
    [RequestID]         [uniqueidentifier]  NOT NULL,
    [Submitted]         [bit]               NOT NULL CONSTRAINT [DF_Request_FlowRelease_Submitted] DEFAULT 0,
    [Approved]          [bit]               NOT NULL CONSTRAINT [DF_Request_FlowRelease_Approved] DEFAULT 0,
    [ArchiveFileName]   [nvarchar](200)     NOT NULL CONSTRAINT [DF_Request_FlowRelease_File] DEFAULT N'',
    [ArchiveSize]       [bigint]            NOT NULL CONSTRAINT [DF_Request_FlowRelease_Size] DEFAULT 0,
    [ArchiveChangeDate] [nvarchar](40)      NOT NULL CONSTRAINT [DF_Request_FlowRelease_Change] DEFAULT N'',
    [ArchiveNote]       [nvarchar](max)     NOT NULL CONSTRAINT [DF_Request_FlowRelease_Note] DEFAULT N'',
    [ArchiveUploadedAt] [nvarchar](40)      NOT NULL CONSTRAINT [DF_Request_FlowRelease_Uploaded] DEFAULT N'',
    CONSTRAINT [PK_Request_FlowRelease] PRIMARY KEY CLUSTERED ([RequestID] ASC),
    CONSTRAINT [FK_Request_FlowRelease_Request] FOREIGN KEY ([RequestID]) REFERENCES [dbo].[Request_Main]([ID])
);

CREATE TABLE [dbo].[Request_FlowReleaseItems](
    [ID]            [uniqueidentifier]  NOT NULL,
    [RequestID]     [uniqueidentifier]  NOT NULL,
    [Code]          [nvarchar](50)      NOT NULL,
    [Category]      [nvarchar](100)     NOT NULL CONSTRAINT [DF_Request_FlowRelItems_Cat] DEFAULT N'',
    [Title]         [nvarchar](200)     NOT NULL CONSTRAINT [DF_Request_FlowRelItems_Title] DEFAULT N'',
    [AiLevel]       [int]               NOT NULL CONSTRAINT [DF_Request_FlowRelItems_Ai] DEFAULT 1,
    [Content]       [nvarchar](max)     NULL,
    [SortOrder]     [int]               NOT NULL CONSTRAINT [DF_Request_FlowRelItems_Sort] DEFAULT 0,
    CONSTRAINT [PK_Request_FlowReleaseItems] PRIMARY KEY CLUSTERED ([ID] ASC),
    CONSTRAINT [UQ_Request_FlowReleaseItems_Code] UNIQUE ([RequestID], [Code]),
    CONSTRAINT [FK_Request_FlowRelItems_Request] FOREIGN KEY ([RequestID]) REFERENCES [dbo].[Request_Main]([ID])
);
CREATE INDEX [IX_Request_FlowRelItems_RequestID] ON [dbo].[Request_FlowReleaseItems]([RequestID]);


-- ===========================================================================
-- Agent session file tree (flat rows; folders are virtual via FoldPath)
-- ===========================================================================
CREATE TABLE [dbo].[FileTree_Files](
    [ID]            [uniqueidentifier]  NOT NULL,
    [AgentID]       [nvarchar](100)     NOT NULL,
    [SessionID]     [nvarchar](100)     NOT NULL,
    [FoldPath]      [nvarchar](500)     NOT NULL CONSTRAINT [DF_FileTree_Files_FoldPath] DEFAULT N'',
    [Name]          [nvarchar](260)     NOT NULL,
    [Url]           [nvarchar](2000)    NOT NULL,
    [UpdatedAt]     [datetime2](7)      NOT NULL CONSTRAINT [DF_FileTree_Files_UpdatedAt] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_FileTree_Files] PRIMARY KEY CLUSTERED ([ID] ASC),
    CONSTRAINT [UQ_FileTree_Files_Path] UNIQUE ([AgentID], [SessionID], [FoldPath], [Name])
);
CREATE INDEX [IX_FileTree_Files_SessionID] ON [dbo].[FileTree_Files]([SessionID]);
CREATE INDEX [IX_FileTree_Files_AgentID] ON [dbo].[FileTree_Files]([AgentID]);
CREATE INDEX [IX_FileTree_Files_AgentSessionUpdated] ON [dbo].[FileTree_Files]([AgentID], [SessionID], [UpdatedAt] DESC);

-- ===========================================================================
-- User feedback tickets + discussion replies
-- ===========================================================================
CREATE TABLE [dbo].[Feedback_Tickets](
    [ID]             [uniqueidentifier]  NOT NULL,
    [Category]       [nvarchar](20)      NOT NULL CONSTRAINT [DF_Feedback_Tickets_Category] DEFAULT N'bug',
    [Title]          [nvarchar](200)     NOT NULL,
    [Content]        [nvarchar](max)     NOT NULL,
    [PageUrl]        [nvarchar](2000)    NULL,
    [Status]         [nvarchar](20)      NOT NULL CONSTRAINT [DF_Feedback_Tickets_Status] DEFAULT N'open',
    [CreatedBy]      [uniqueidentifier]  NULL,
    [CreatedByName]  [nvarchar](100)     NOT NULL,
    [CreatedByNo]    [nvarchar](50)      NULL,
    [CreatedAt]      [datetime2](7)      NOT NULL CONSTRAINT [DF_Feedback_Tickets_CreatedAt] DEFAULT SYSUTCDATETIME(),
    [UpdatedAt]      [datetime2](7)      NULL,
    CONSTRAINT [PK_Feedback_Tickets] PRIMARY KEY CLUSTERED ([ID] ASC),
    CONSTRAINT [CK_Feedback_Tickets_Category] CHECK ([Category] IN (N'bug', N'suggestion')),
    CONSTRAINT [CK_Feedback_Tickets_Status] CHECK ([Status] IN (N'open', N'processing', N'done'))
);
CREATE INDEX [IX_Feedback_Tickets_Status] ON [dbo].[Feedback_Tickets]([Status]);
CREATE INDEX [IX_Feedback_Tickets_CreatedByNo] ON [dbo].[Feedback_Tickets]([CreatedByNo]);
CREATE INDEX [IX_Feedback_Tickets_UpdatedAt] ON [dbo].[Feedback_Tickets]([UpdatedAt] DESC);

CREATE TABLE [dbo].[Feedback_Replies](
    [ID]          [uniqueidentifier]  NOT NULL,
    [TicketID]    [uniqueidentifier]  NOT NULL,
        [Content]     [nvarchar](max)     NOT NULL,
        [AuthorId]    [uniqueidentifier]  NULL,
    [AuthorName]  [nvarchar](100)     NOT NULL,
    [IsAdmin]     [bit]               NOT NULL CONSTRAINT [DF_Feedback_Replies_IsAdmin] DEFAULT 0,
    [CreatedAt]   [datetime2](7)      NOT NULL CONSTRAINT [DF_Feedback_Replies_CreatedAt] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Feedback_Replies] PRIMARY KEY CLUSTERED ([ID] ASC),
    CONSTRAINT [FK_Feedback_Replies_Ticket] FOREIGN KEY ([TicketID]) REFERENCES [dbo].[Feedback_Tickets]([ID]) ON DELETE CASCADE
);
CREATE INDEX [IX_Feedback_Replies_TicketID] ON [dbo].[Feedback_Replies]([TicketID]);

-- Ticket-level: ReplyID IS NULL. Reply-level: ReplyID set. TicketID always filled.
CREATE TABLE [dbo].[Feedback_Attachments](
    [ID]         [uniqueidentifier]  NOT NULL,
    [TicketID]   [uniqueidentifier]  NOT NULL,
    [ReplyID]    [uniqueidentifier]  NULL,
    [Url]        [nvarchar](2000)    NOT NULL,
    [Name]       [nvarchar](260)     NOT NULL CONSTRAINT [DF_Feedback_Attachments_Name] DEFAULT N'',
    [Type]       [nvarchar](200)     NOT NULL CONSTRAINT [DF_Feedback_Attachments_Type] DEFAULT N'',
    [SortOrder]  [int]               NOT NULL CONSTRAINT [DF_Feedback_Attachments_SortOrder] DEFAULT 0,
    [CreatedAt]  [datetime2](7)      NOT NULL CONSTRAINT [DF_Feedback_Attachments_CreatedAt] DEFAULT SYSUTCDATETIME(),
    CONSTRAINT [PK_Feedback_Attachments] PRIMARY KEY CLUSTERED ([ID] ASC),
    CONSTRAINT [FK_Feedback_Attachments_Ticket] FOREIGN KEY ([TicketID]) REFERENCES [dbo].[Feedback_Tickets]([ID]) ON DELETE CASCADE,
    CONSTRAINT [FK_Feedback_Attachments_Reply] FOREIGN KEY ([ReplyID]) REFERENCES [dbo].[Feedback_Replies]([ID]) ON DELETE NO ACTION
);
CREATE INDEX [IX_Feedback_Attachments_TicketID] ON [dbo].[Feedback_Attachments]([TicketID]);
CREATE INDEX [IX_Feedback_Attachments_ReplyID] ON [dbo].[Feedback_Attachments]([ReplyID]);

-- ===========================================================================
-- LLM token usage by user / day (RMB cost)
-- ===========================================================================
CREATE TABLE [dbo].[LLM_user_token_usage](
    [record_date]  [nvarchar](100)   NULL,
    [user_nt]      [nvarchar](20)    NOT NULL,
    [input_token]  [nvarchar](500)   NULL,
    [output_token] [nvarchar](500)   NULL,
    [usage_type]   [nvarchar](100)   NULL,
    [user_name]    [nvarchar](100)   NULL,
    [user_dept]    [nvarchar](100)   NULL,
    [cost]         [decimal](18, 2)  NOT NULL
);
CREATE INDEX [IX_LLM_user_token_usage_user_nt] ON [dbo].[LLM_user_token_usage]([user_nt]);
CREATE INDEX [IX_LLM_user_token_usage_record_date] ON [dbo].[LLM_user_token_usage]([record_date]);
