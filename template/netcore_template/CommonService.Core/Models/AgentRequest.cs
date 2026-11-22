using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CommonService.Core.Models
{
    [Table("Request_Main")]
    public class AgentRequest
    {
        [Key]
        public Guid ID { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        public string? Description { get; set; }

        [MaxLength(100)]
        public string? Domain { get; set; }

        [MaxLength(50)]
        public string? OwnerUserno { get; set; }
        [MaxLength(50)]
        public string? OwnerNtAccount { get; set; }
        [MaxLength(100)]
        public string? OwnerUsername { get; set; }
        [MaxLength(100)]
        public string? OwnerDeptName { get; set; }

        public string? Remarks { get; set; }

        [MaxLength(50)]
        public string? PjmUserno { get; set; }
        [MaxLength(50)]
        public string? PjmNtAccount { get; set; }
        [MaxLength(100)]
        public string? PjmUsername { get; set; }
        [MaxLength(100)]
        public string? PjmDeptName { get; set; }

        [MaxLength(50)]
        public string? SponsorUserno { get; set; }
        [MaxLength(50)]
        public string? SponsorNtAccount { get; set; }
        [MaxLength(100)]
        public string? SponsorUsername { get; set; }
        [MaxLength(100)]
        public string? SponsorDeptName { get; set; }

        [Required]
        [MaxLength(30)]
        public string Status { get; set; } = "draft";

        [MaxLength(100)]
        public string? PendingApprover { get; set; }

        public bool AwaitingMe { get; set; }

        [Required]
        [MaxLength(20)]
        public string SecurityMode { get; set; } = "datasource";

        [MaxLength(10)]
        public string? DerivedScC { get; set; }
        [MaxLength(10)]
        public string? DerivedScI { get; set; }
        [MaxLength(10)]
        public string? DerivedScA { get; set; }
        [MaxLength(10)]
        public string? ManualScC { get; set; }
        [MaxLength(10)]
        public string? ManualScI { get; set; }
        [MaxLength(10)]
        public string? ManualScA { get; set; }
        public string? OverrideNote { get; set; }
        [MaxLength(10)]
        public string? FinalScC { get; set; }
        [MaxLength(10)]
        public string? FinalScI { get; set; }
        [MaxLength(10)]
        public string? FinalScA { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal FrequencyPerMonth { get; set; } = 800;

        [Required]
        [MaxLength(20)]
        public string SavingMode { get; set; } = "fte";

        [Column(TypeName = "decimal(18,2)")]
        public decimal SavingPerUseMoney { get; set; }

        [Column(TypeName = "decimal(18,4)")]
        public decimal SavingPerUseFte { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal EstimatedInvestment { get; set; }

        [Required]
        [MaxLength(7)]
        public string CycleStartMonth { get; set; } = string.Empty;

        [Column(TypeName = "decimal(18,4)")]
        public decimal RatioY0 { get; set; } = 1;
        [Column(TypeName = "decimal(18,4)")]
        public decimal RatioY1 { get; set; } = 1;
        [Column(TypeName = "decimal(18,4)")]
        public decimal RatioY2 { get; set; } = 1;
        [Column(TypeName = "decimal(18,4)")]
        public decimal RatioY3 { get; set; } = 1;
        [Column(TypeName = "decimal(18,4)")]
        public decimal RatioY4 { get; set; } = 1;
        [Column(TypeName = "decimal(18,4)")]
        public decimal RatioY5 { get; set; } = 1;

        public int AiLevel { get; set; } = 1;
        public bool TermsAccepted { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal InvestmentY0 { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal SavingY0 { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal SavingNextYear { get; set; }
        /// <summary>1+5y total cash in (undiscounted).</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalSaving { get; set; }
        /// <summary>1+5y total cash out (undiscounted).</summary>
        [Column(TypeName = "decimal(18,2)")]
        public decimal TotalInvestment { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal Roi { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal TaxAdjustedRoi { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal Npv { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal? PbpYears { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal? PaybackMonths { get; set; }
        [Column(TypeName = "decimal(18,4)")]
        public decimal IncomeTaxRate { get; set; } = 0.1925m;
        [Column(TypeName = "decimal(18,4)")]
        public decimal NpvFactor { get; set; } = 0.08m;
        public bool MetricsFrozen { get; set; }

        public Guid? CreatedBy { get; set; }
        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public Guid? UpdatedBy { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public Guid? DeletedBy { get; set; }
        public DateTime? DeletedAt { get; set; }

        public ICollection<AgentRequestFormDataset> FormDatasets { get; set; } = new List<AgentRequestFormDataset>();
        public ICollection<AgentRequestFormServer> FormServers { get; set; } = new List<AgentRequestFormServer>();
        public AgentRequestFormToken? Token { get; set; }
        public ICollection<AgentRequestFormCostSaving> CostSavings { get; set; } = new List<AgentRequestFormCostSaving>();
        public ICollection<AgentRequestFormRpp> Rpps { get; set; } = new List<AgentRequestFormRpp>();
        public AgentRequestFormAiOptions? AiOptions { get; set; }
        public ICollection<AgentRequestAttachment> Attachments { get; set; } = new List<AgentRequestAttachment>();
        public ICollection<AgentRequestFlowStage> Stages { get; set; } = new List<AgentRequestFlowStage>();
        public ICollection<AgentRequestFlowCheck> Checks { get; set; } = new List<AgentRequestFlowCheck>();
        public AgentRequestFlowDevelop? Develop { get; set; }
        // KPI column is Roi; FlowRoi is Request_FlowRoi 1:1
        public AgentRequestFlowRoi? FlowRoi { get; set; }
        public AgentRequestFlowRelease? Release { get; set; }
    }

    [Table("Request_Datasets")]
    public class AgentRequestDataset
    {
        [Key]
        public Guid ID { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(50)]
        public string Code { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(10)]
        public string ScConfidentiality { get; set; } = "C_SC1";

        [Required]
        [MaxLength(10)]
        public string ScIntegrity { get; set; } = "I_SC1";

        [Required]
        [MaxLength(10)]
        public string ScAvailability { get; set; } = "A_SC1";

        [Required]
        [MaxLength(50)]
        public string Category { get; set; } = string.Empty;

        public bool IsEnabled { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }
    }

    [Table("Request_Servers")]
    public class AgentRequestServer
    {
        [Key]
        public Guid ID { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(50)]
        public string Code { get; set; } = string.Empty;

        /// <summary>app | db</summary>
        [Required]
        [MaxLength(10)]
        public string Type { get; set; } = "app";

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(500)]
        public string? Description { get; set; }

        public int? VramGb { get; set; }
        public int? CacheStorageGb { get; set; }
        public int? CpuCores { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? PriceMonthly { get; set; }

        [Column(TypeName = "decimal(18,4)")]
        public decimal? PricePerGbMonth { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? InstanceMonthly { get; set; }

        public bool IsEnabled { get; set; } = true;

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }
    }

    [Table("Request_Attachments")]
    public class AgentRequestAttachment
    {
        [Key]
        public Guid ID { get; set; } = Guid.NewGuid();
        public Guid RequestID { get; set; }

        /// <summary>basic | check | develop | release | other</summary>
        [Required]
        [MaxLength(20)]
        public string Category { get; set; } = "other";

        [MaxLength(50)]
        public string? RefCode { get; set; }

        [Required]
        [MaxLength(80)]
        public string Uid { get; set; } = string.Empty;

        [Required]
        [MaxLength(200)]
        public string Name { get; set; } = string.Empty;

        public long Size { get; set; }

        [MaxLength(100)]
        public string? Type { get; set; }

        [Required]
        [MaxLength(40)]
        public string UploadedAt { get; set; } = string.Empty;

        public int SortOrder { get; set; }

        public AgentRequest? Request { get; set; }
    }
}
