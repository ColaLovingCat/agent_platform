IF OBJECT_ID(N'dbo.LLM_user_token_usage', N'U') IS NULL
BEGIN
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
END;

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_LLM_user_token_usage_user_nt'
      AND object_id = OBJECT_ID(N'dbo.LLM_user_token_usage')
)
    CREATE INDEX [IX_LLM_user_token_usage_user_nt] ON [dbo].[LLM_user_token_usage]([user_nt]);

IF NOT EXISTS (
    SELECT 1 FROM sys.indexes
    WHERE name = N'IX_LLM_user_token_usage_record_date'
      AND object_id = OBJECT_ID(N'dbo.LLM_user_token_usage')
)
    CREATE INDEX [IX_LLM_user_token_usage_record_date] ON [dbo].[LLM_user_token_usage]([record_date]);
