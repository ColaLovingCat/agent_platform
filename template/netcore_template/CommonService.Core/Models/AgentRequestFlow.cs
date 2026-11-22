using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CommonService.Core.Models
{
    [Table("Request_FlowStages")]
    public class AgentRequestFlowStage
    {
        [Key]
        public Guid ID { get; set; } = Guid.NewGuid();
        public Guid RequestID { get; set; }

        [Required]
        [MaxLength(20)]
        public string Phase { get; set; } = string.Empty;

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "pending";

        public DateTime? ConfirmedAt { get; set; }
        public DateTime? RejectedAt { get; set; }
        public string? Note { get; set; }
        public int SortOrder { get; set; }

        public AgentRequest? Request { get; set; }
    }

    [Table("Request_FlowChecks")]
    public class AgentRequestFlowCheck
    {
        [Key]
        public Guid ID { get; set; } = Guid.NewGuid();
        public Guid RequestID { get; set; }

        [Required]
        [MaxLength(20)]
        public string Phase { get; set; } = "check";

        [Required]
        [MaxLength(50)]
        public string Code { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        public string? Description { get; set; }

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "pending";

        public string? Note { get; set; }
        public int SortOrder { get; set; }

        public AgentRequest? Request { get; set; }
    }

    [Table("Request_FlowDevelop")]
    public class AgentRequestFlowDevelop
    {
        [Key]
        public Guid RequestID { get; set; }

        [MaxLength(20)]
        public string? DevelopMode { get; set; }

        [Required]
        [MaxLength(500)]
        public string SourceUrl { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string SourceRepo { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string SourceBranch { get; set; } = string.Empty;

        [Required]
        [MaxLength(40)]
        public string GeneratedAt { get; set; } = string.Empty;

        public AgentRequest? Request { get; set; }
    }

    [Table("Request_FlowRoi")]
    public class AgentRequestFlowRoi
    {
        [Key]
        public Guid RequestID { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal FrequencyPerMonth { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal SavingPerUseMoney { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal EstimatedInvestment { get; set; }

        [Required]
        public string Note { get; set; } = string.Empty;

        [Required]
        public string ApprovalsJson { get; set; } = "[]";

        public AgentRequest? Request { get; set; }
    }

    [Table("Request_FlowRelease")]
    public class AgentRequestFlowRelease
    {
        [Key]
        public Guid RequestID { get; set; }

        public bool Submitted { get; set; }
        public bool Approved { get; set; }

        [Required]
        [MaxLength(200)]
        public string ArchiveFileName { get; set; } = string.Empty;

        public long ArchiveSize { get; set; }

        [Required]
        [MaxLength(40)]
        public string ArchiveChangeDate { get; set; } = string.Empty;

        [Required]
        public string ArchiveNote { get; set; } = string.Empty;

        [Required]
        [MaxLength(40)]
        public string ArchiveUploadedAt { get; set; } = string.Empty;

        public AgentRequest? Request { get; set; }
        public ICollection<AgentRequestFlowReleaseItem> Items { get; set; } = new List<AgentRequestFlowReleaseItem>();
    }

    [Table("Request_FlowReleaseItems")]
    public class AgentRequestFlowReleaseItem
    {
        [Key]
        public Guid ID { get; set; } = Guid.NewGuid();
        public Guid RequestID { get; set; }

        [Required]
        [MaxLength(50)]
        public string Code { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string Category { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        public int AiLevel { get; set; } = 1;
        public string? Content { get; set; }
        public int SortOrder { get; set; }

        public AgentRequestFlowRelease? Release { get; set; }
    }
}
