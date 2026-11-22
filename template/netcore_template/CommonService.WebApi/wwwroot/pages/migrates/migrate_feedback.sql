IF OBJECT_ID(N'dbo.Feedback_Tickets', N'U') IS NULL
BEGIN
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
END;

IF OBJECT_ID(N'dbo.Feedback_Replies', N'U') IS NULL
BEGIN
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
END;

IF OBJECT_ID(N'dbo.Feedback_Attachments', N'U') IS NULL
BEGIN
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
END;

-- Backfill only if legacy JSON columns still exist.
IF COL_LENGTH(N'dbo.Feedback_Tickets', N'Screenshots') IS NOT NULL
BEGIN
    INSERT INTO [dbo].[Feedback_Attachments]([ID], [TicketID], [ReplyID], [Url], [Name], [Type], [SortOrder], [CreatedAt])
    SELECT NEWID(), t.[ID], NULL,
        LEFT(CASE WHEN j.[type] = 5 THEN ISNULL(JSON_VALUE(j.[value], '$.url'), N'') ELSE ISNULL(j.[value], N'') END, 2000),
        LEFT(ISNULL(CASE WHEN j.[type] = 5 THEN JSON_VALUE(j.[value], '$.name') END, N''), 260),
        LEFT(ISNULL(CASE WHEN j.[type] = 5 THEN JSON_VALUE(j.[value], '$.type') END, N''), 200),
        ISNULL(TRY_CONVERT(int, j.[key]), 0),
        ISNULL(t.[CreatedAt], SYSUTCDATETIME())
    FROM [dbo].[Feedback_Tickets] t
    CROSS APPLY OPENJSON(t.[Screenshots]) j
    WHERE ISJSON(t.[Screenshots]) = 1
      AND NOT EXISTS (
          SELECT 1 FROM [dbo].[Feedback_Attachments] a
          WHERE a.[TicketID] = t.[ID] AND a.[ReplyID] IS NULL
      )
      AND LEN(CASE WHEN j.[type] = 5 THEN ISNULL(JSON_VALUE(j.[value], '$.url'), N'') ELSE ISNULL(j.[value], N'') END) > 0;
END;

IF COL_LENGTH(N'dbo.Feedback_Replies', N'Screenshots') IS NOT NULL
BEGIN
    INSERT INTO [dbo].[Feedback_Attachments]([ID], [TicketID], [ReplyID], [Url], [Name], [Type], [SortOrder], [CreatedAt])
    SELECT NEWID(), r.[TicketID], r.[ID],
        LEFT(CASE WHEN j.[type] = 5 THEN ISNULL(JSON_VALUE(j.[value], '$.url'), N'') ELSE ISNULL(j.[value], N'') END, 2000),
        LEFT(ISNULL(CASE WHEN j.[type] = 5 THEN JSON_VALUE(j.[value], '$.name') END, N''), 260),
        LEFT(ISNULL(CASE WHEN j.[type] = 5 THEN JSON_VALUE(j.[value], '$.type') END, N''), 200),
        ISNULL(TRY_CONVERT(int, j.[key]), 0),
        ISNULL(r.[CreatedAt], SYSUTCDATETIME())
    FROM [dbo].[Feedback_Replies] r
    CROSS APPLY OPENJSON(r.[Screenshots]) j
    WHERE ISJSON(r.[Screenshots]) = 1
      AND NOT EXISTS (
          SELECT 1 FROM [dbo].[Feedback_Attachments] a
          WHERE a.[ReplyID] = r.[ID]
      )
      AND LEN(CASE WHEN j.[type] = 5 THEN ISNULL(JSON_VALUE(j.[value], '$.url'), N'') ELSE ISNULL(j.[value], N'') END) > 0;
END;
