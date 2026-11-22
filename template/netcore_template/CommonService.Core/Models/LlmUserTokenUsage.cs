using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CommonService.Core.Models
{
    public class LlmUserTokenUsage
    {
        [Column("record_date")]
        [MaxLength(100)]
        public string? RecordDate { get; set; }

        [Column("user_nt")]
        [MaxLength(20)]
        public string UserNt { get; set; } = string.Empty;

        [Column("input_token")]
        [MaxLength(500)]
        public string? InputToken { get; set; }

        [Column("output_token")]
        [MaxLength(500)]
        public string? OutputToken { get; set; }

        [Column("usage_type")]
        [MaxLength(100)]
        public string? UsageType { get; set; }

        [Column("user_name")]
        [MaxLength(100)]
        public string? UserName { get; set; }

        [Column("user_dept")]
        [MaxLength(100)]
        public string? UserDept { get; set; }

        [Column("cost")]
        public decimal Cost { get; set; }
    }
}
