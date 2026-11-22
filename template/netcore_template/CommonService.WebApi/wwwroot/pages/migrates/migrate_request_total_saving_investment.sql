-- Request_Main: persist 1+5y TotalSaving / TotalInvestment for KPI cards
IF COL_LENGTH(N'dbo.Request_Main', N'TotalSaving') IS NULL
BEGIN
    ALTER TABLE [dbo].[Request_Main]
        ADD [TotalSaving] [decimal](18, 2) NOT NULL
            CONSTRAINT [DF_Request_Main_TotalSav] DEFAULT 0;
END;

IF COL_LENGTH(N'dbo.Request_Main', N'TotalInvestment') IS NULL
BEGIN
    ALTER TABLE [dbo].[Request_Main]
        ADD [TotalInvestment] [decimal](18, 2) NOT NULL
            CONSTRAINT [DF_Request_Main_TotalInv] DEFAULT 0;
END;
