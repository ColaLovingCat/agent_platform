using Microsoft.EntityFrameworkCore;
using CommonService.Core.Models;

namespace CommonService.Core.DbContexts
{
    public class AppDbContext : DbContext
    {
        public AppDbContext(DbContextOptions<AppDbContext> options)
            : base(options)
        {
        }

        public DbSet<UserInfo> UserInfos => Set<UserInfo>();
        public DbSet<UserRole> UserRoles => Set<UserRole>();
        public DbSet<UserLinks> UserLinks => Set<UserLinks>();
        public DbSet<AgentRequest> AgentRequests => Set<AgentRequest>();
        public DbSet<AgentRequestDataset> AgentRequestDatasets => Set<AgentRequestDataset>();
        public DbSet<AgentRequestServer> AgentRequestServers => Set<AgentRequestServer>();
        public DbSet<AgentRequestFormDataset> AgentRequestFormDatasets => Set<AgentRequestFormDataset>();
        public DbSet<AgentRequestFormServer> AgentRequestFormServers => Set<AgentRequestFormServer>();
        public DbSet<AgentRequestFormToken> AgentRequestFormTokens => Set<AgentRequestFormToken>();
        public DbSet<AgentRequestFormCostSaving> AgentRequestFormCostSavings => Set<AgentRequestFormCostSaving>();
        public DbSet<AgentRequestFormRpp> AgentRequestFormRpps => Set<AgentRequestFormRpp>();
        public DbSet<AgentRequestFormAiOptions> AgentRequestFormAiOptions => Set<AgentRequestFormAiOptions>();
        public DbSet<AgentRequestAttachment> AgentRequestAttachments => Set<AgentRequestAttachment>();
        public DbSet<AgentRequestFlowStage> AgentRequestFlowStages => Set<AgentRequestFlowStage>();
        public DbSet<AgentRequestFlowCheck> AgentRequestFlowChecks => Set<AgentRequestFlowCheck>();
        public DbSet<AgentRequestFlowDevelop> AgentRequestFlowDevelop => Set<AgentRequestFlowDevelop>();
        public DbSet<AgentRequestFlowRoi> AgentRequestFlowRoi => Set<AgentRequestFlowRoi>();
        public DbSet<AgentRequestFlowRelease> AgentRequestFlowRelease => Set<AgentRequestFlowRelease>();
        public DbSet<AgentRequestFlowReleaseItem> AgentRequestFlowReleaseItems => Set<AgentRequestFlowReleaseItem>();
        public DbSet<FileTreeFile> FileTreeFiles => Set<FileTreeFile>();
        public DbSet<FeedbackTicket> FeedbackTickets => Set<FeedbackTicket>();
        public DbSet<FeedbackReply> FeedbackReplies => Set<FeedbackReply>();
        public DbSet<FeedbackAttachment> FeedbackAttachments => Set<FeedbackAttachment>();
        public DbSet<LlmUserTokenUsage> LlmUserTokenUsages => Set<LlmUserTokenUsage>();

        protected override void OnModelCreating(ModelBuilder modelBuilder)
        {
            modelBuilder.Entity<UserLinks>(entity =>
            {
                entity.HasKey(e => new { e.UserID, e.RoleID });
                entity.HasOne(e => e.UserInfo)
                      .WithMany(u => u.Roles)
                      .HasForeignKey(e => e.UserID);
                entity.HasOne(e => e.UserRole)
                      .WithMany(r => r.Users)
                      .HasForeignKey(e => e.RoleID);
                entity.ToTable("UserLinks");
            });

            modelBuilder.Entity<AgentRequest>(entity =>
            {
                entity.ToTable("Request_Main");
                entity.HasMany(x => x.FormDatasets)
                    .WithOne(x => x.Request)
                    .HasForeignKey(x => x.RequestID)
                    .OnDelete(DeleteBehavior.Restrict);
                entity.HasMany(x => x.FormServers)
                    .WithOne(x => x.Request)
                    .HasForeignKey(x => x.RequestID)
                    .OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(x => x.Token)
                    .WithOne(x => x.Request)
                    .HasForeignKey<AgentRequestFormToken>(x => x.RequestID)
                    .OnDelete(DeleteBehavior.Restrict);
                entity.HasMany(x => x.CostSavings)
                    .WithOne(x => x.Request)
                    .HasForeignKey(x => x.RequestID)
                    .OnDelete(DeleteBehavior.Restrict);
                entity.HasMany(x => x.Rpps)
                    .WithOne(x => x.Request)
                    .HasForeignKey(x => x.RequestID)
                    .OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(x => x.AiOptions)
                    .WithOne(x => x.Request)
                    .HasForeignKey<AgentRequestFormAiOptions>(x => x.RequestID)
                    .OnDelete(DeleteBehavior.Restrict);
                entity.HasMany(x => x.Attachments)
                    .WithOne(x => x.Request)
                    .HasForeignKey(x => x.RequestID)
                    .OnDelete(DeleteBehavior.Restrict);
                entity.HasMany(x => x.Stages)
                    .WithOne(x => x.Request)
                    .HasForeignKey(x => x.RequestID)
                    .OnDelete(DeleteBehavior.Restrict);
                entity.HasMany(x => x.Checks)
                    .WithOne(x => x.Request)
                    .HasForeignKey(x => x.RequestID)
                    .OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(x => x.Develop)
                    .WithOne(x => x.Request)
                    .HasForeignKey<AgentRequestFlowDevelop>(x => x.RequestID)
                    .OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(x => x.FlowRoi)
                    .WithOne(x => x.Request)
                    .HasForeignKey<AgentRequestFlowRoi>(x => x.RequestID)
                    .OnDelete(DeleteBehavior.Restrict);
                entity.HasOne(x => x.Release)
                    .WithOne(x => x.Request)
                    .HasForeignKey<AgentRequestFlowRelease>(x => x.RequestID)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<AgentRequestDataset>(entity =>
            {
                entity.ToTable("Request_Datasets");
                entity.HasIndex(e => e.Code).IsUnique();
            });

            modelBuilder.Entity<AgentRequestServer>(entity =>
            {
                entity.ToTable("Request_Servers");
                entity.HasIndex(e => e.Code).IsUnique();
            });

            modelBuilder.Entity<AgentRequestFormDataset>(entity =>
            {
                entity.ToTable("Request_FormDatasets");
            });

            modelBuilder.Entity<AgentRequestFormServer>(entity =>
            {
                entity.ToTable("Request_FormServer");
            });

            modelBuilder.Entity<AgentRequestFormToken>(entity =>
            {
                entity.ToTable("Request_FormToken");
            });

            modelBuilder.Entity<AgentRequestFormCostSaving>(entity =>
            {
                entity.ToTable("Request_FormCostSaving");
            });

            modelBuilder.Entity<AgentRequestFormRpp>(entity =>
            {
                entity.ToTable("Request_FormRPP");
            });

            modelBuilder.Entity<AgentRequestFormAiOptions>(entity =>
            {
                entity.ToTable("Request_FormAIOptions");
            });

            modelBuilder.Entity<AgentRequestAttachment>(entity =>
            {
                entity.ToTable("Request_Attachments");
            });

            modelBuilder.Entity<AgentRequestFlowStage>(entity =>
            {
                entity.ToTable("Request_FlowStages");
            });

            modelBuilder.Entity<AgentRequestFlowCheck>(entity =>
            {
                entity.ToTable("Request_FlowChecks");
            });

            modelBuilder.Entity<AgentRequestFlowDevelop>(entity =>
            {
                entity.ToTable("Request_FlowDevelop");
            });

            modelBuilder.Entity<AgentRequestFlowRoi>(entity =>
            {
                entity.ToTable("Request_FlowRoi");
            });

            modelBuilder.Entity<AgentRequestFlowRelease>(entity =>
            {
                entity.ToTable("Request_FlowRelease");
                entity.HasMany(x => x.Items)
                    .WithOne(x => x.Release)
                    .HasForeignKey(x => x.RequestID)
                    .OnDelete(DeleteBehavior.Restrict);
            });

            modelBuilder.Entity<AgentRequestFlowReleaseItem>(entity =>
            {
                entity.ToTable("Request_FlowReleaseItems");
            });

            modelBuilder.Entity<FileTreeFile>(entity =>
            {
                entity.ToTable("FileTree_Files");
                entity.HasIndex(e => new { e.AgentID, e.SessionID, e.FoldPath, e.Name }).IsUnique();
                entity.HasIndex(e => e.SessionID);
                entity.HasIndex(e => e.AgentID);
            });

            modelBuilder.Entity<FeedbackTicket>(entity =>
            {
                entity.ToTable("Feedback_Tickets");
                entity.HasMany(x => x.Replies)
                    .WithOne(x => x.Ticket)
                    .HasForeignKey(x => x.TicketID)
                    .OnDelete(DeleteBehavior.Cascade);
                entity.HasIndex(e => e.Status);
                entity.HasIndex(e => e.CreatedByNo);
            });

            modelBuilder.Entity<FeedbackReply>(entity =>
            {
                entity.ToTable("Feedback_Replies");
                entity.HasIndex(e => e.TicketID);
            });

            modelBuilder.Entity<FeedbackAttachment>(entity =>
            {
                entity.ToTable("Feedback_Attachments");
                entity.HasOne(x => x.Ticket)
                    .WithMany(x => x.Attachments)
                    .HasForeignKey(x => x.TicketID)
                    .OnDelete(DeleteBehavior.Cascade);
                entity.HasOne(x => x.Reply)
                    .WithMany(x => x.Attachments)
                    .HasForeignKey(x => x.ReplyID)
                    .OnDelete(DeleteBehavior.NoAction);
                entity.HasIndex(e => e.TicketID);
                entity.HasIndex(e => e.ReplyID);
            });

            modelBuilder.Entity<LlmUserTokenUsage>(entity =>
            {
                entity.HasNoKey();
                entity.ToTable("LLM_user_token_usage");
            });
        }
    }
}
