IF COL_LENGTH('dbo.Request_FlowRoi', 'ApprovalsJson') IS NULL
BEGIN
    ALTER TABLE [dbo].[Request_FlowRoi]
        ADD [ApprovalsJson] [nvarchar](max) NOT NULL
            CONSTRAINT [DF_Request_FlowRoi_Approvals] DEFAULT N'[]';
END;
