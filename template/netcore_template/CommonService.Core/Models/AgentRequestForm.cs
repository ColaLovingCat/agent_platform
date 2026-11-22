using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CommonService.Core.Models
{
    [Table("Request_FormDatasets")]
    public class AgentRequestFormDataset
    {
        [Key]
        public Guid ID { get; set; } = Guid.NewGuid();
        public Guid RequestID { get; set; }

        [Required]
        [MaxLength(50)]
        public string DatasetCode { get; set; } = string.Empty;

        public int SortOrder { get; set; }
        public AgentRequest? Request { get; set; }
    }

    [Table("Request_FormServer")]
    public class AgentRequestFormServer
    {
        [Key]
        public Guid ID { get; set; } = Guid.NewGuid();
        public Guid RequestID { get; set; }

        /// <summary>app | db</summary>
        [Required]
        [MaxLength(10)]
        public string Type { get; set; } = "app";

        [Required]
        [MaxLength(50)]
        public string ServerCode { get; set; } = string.Empty;

        public int Quantity { get; set; } = 1;

        [Column(TypeName = "decimal(18,2)")]
        public decimal? DbInitialSizeGb { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? DbIncrementGbPerYear { get; set; }

        public int? DbRetentionYears { get; set; }

        public int SortOrder { get; set; }
        public AgentRequest? Request { get; set; }
    }

    [Table("Request_FormToken")]
    public class AgentRequestFormToken
    {
        [Key]
        public Guid RequestID { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal CallsPerMonth { get; set; } = 800;

        [Column(TypeName = "decimal(18,2)")]
        public decimal AvgTokensPerCall { get; set; } = 3500;

        [Column(TypeName = "decimal(18,4)")]
        public decimal PricePer1k { get; set; } = 0.012m;

        [Required]
        [MaxLength(20)]
        public string QuotaMode { get; set; } = "money";

        [Column(TypeName = "decimal(18,2)")]
        public decimal QuotaLimit { get; set; }

        public AgentRequest? Request { get; set; }
    }

    [Table("Request_FormCostSaving")]
    public class AgentRequestFormCostSaving
    {
        [Key]
        public Guid ID { get; set; } = Guid.NewGuid();
        public Guid RequestID { get; set; }

        /// <summary>personnel | manual_efficiency | additional | payment_outside</summary>
        [Required]
        [MaxLength(30)]
        public string Kind { get; set; } = "personnel";

        [Required]
        [MaxLength(80)]
        public string ClientId { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? Category { get; set; }

        [MaxLength(100)]
        public string? CostCenter { get; set; }

        [MaxLength(100)]
        public string? Dept { get; set; }

        [MaxLength(20)]
        public string? Level { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? UnitPriceYearly { get; set; }

        [Column(TypeName = "decimal(18,4)")]
        public decimal? Hc { get; set; }

        [Column(TypeName = "decimal(18,4)")]
        public decimal? HcY0 { get; set; }
        [Column(TypeName = "decimal(18,4)")]
        public decimal? HcY1 { get; set; }
        [Column(TypeName = "decimal(18,4)")]
        public decimal? HcY2 { get; set; }
        [Column(TypeName = "decimal(18,4)")]
        public decimal? HcY3 { get; set; }
        [Column(TypeName = "decimal(18,4)")]
        public decimal? HcY4 { get; set; }
        [Column(TypeName = "decimal(18,4)")]
        public decimal? HcY5 { get; set; }

        [Column(TypeName = "decimal(18,2)")]
        public decimal? AmountY0 { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal? AmountY1 { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal? AmountY2 { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal? AmountY3 { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal? AmountY4 { get; set; }
        [Column(TypeName = "decimal(18,2)")]
        public decimal? AmountY5 { get; set; }

        public int SortOrder { get; set; }
        public AgentRequest? Request { get; set; }
    }

    [Table("Request_FormRPP")]
    public class AgentRequestFormRpp
    {
        [Key]
        public Guid ID { get; set; } = Guid.NewGuid();
        public Guid RequestID { get; set; }

        [Required]
        [MaxLength(100)]
        public string RppId { get; set; } = string.Empty;

        [Required]
        [MaxLength(500)]
        public string RppLink { get; set; } = string.Empty;

        public int SortOrder { get; set; }
        public AgentRequest? Request { get; set; }
    }

    [Table("Request_FormAIOptions")]
    public class AgentRequestFormAiOptions
    {
        [Key]
        public Guid RequestID { get; set; }

        public bool HumanInLoop { get; set; } = true;
        public bool BoschChinaOnly { get; set; } = true;
        public int PersonalDataLevel { get; set; } = 1;
        public int ImpactLossLevel { get; set; } = 1;
        public bool NoReputationPhysicalHarm { get; set; } = true;

        // Legacy option fields retained for existing database compatibility.
        public bool CrossDomain { get; set; }
        public bool AutoWriteActions { get; set; }
        public bool ExternalModel { get; set; }
        public bool OutboundData { get; set; }

        public AgentRequest? Request { get; set; }
    }
}
