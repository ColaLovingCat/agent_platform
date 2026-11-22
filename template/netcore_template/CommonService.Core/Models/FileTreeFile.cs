using System.ComponentModel.DataAnnotations;

namespace CommonService.Core.Models
{
    public class FileTreeFile
    {
        [Key]
        public Guid ID { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(100)]
        public string AgentID { get; set; } = string.Empty;

        [Required]
        [MaxLength(100)]
        public string SessionID { get; set; } = string.Empty;

        [Required]
        [MaxLength(500)]
        public string FoldPath { get; set; } = string.Empty;

        [Required]
        [MaxLength(260)]
        public string Name { get; set; } = string.Empty;

        [Required]
        [MaxLength(2000)]
        public string Url { get; set; } = string.Empty;

        public DateTime UpdatedAt { get; set; } = DateTime.UtcNow;
    }
}
