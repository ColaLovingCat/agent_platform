using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace CommonService.Core.Models
{
    public class FeedbackTicket
    {
        [Key]
        public Guid ID { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(20)]
        public string Category { get; set; } = "bug";

        [Required]
        [MaxLength(200)]
        public string Title { get; set; } = string.Empty;

        [Required]
        public string Content { get; set; } = string.Empty;

        [MaxLength(2000)]
        public string? PageUrl { get; set; }

        [Required]
        [MaxLength(20)]
        public string Status { get; set; } = "open";

        public Guid? CreatedBy { get; set; }

        [Required]
        [MaxLength(100)]
        public string CreatedByName { get; set; } = string.Empty;

        [MaxLength(50)]
        public string? CreatedByNo { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }

        public ICollection<FeedbackReply> Replies { get; set; } = new List<FeedbackReply>();
        public ICollection<FeedbackAttachment> Attachments { get; set; } = new List<FeedbackAttachment>();
    }

    public class FeedbackReply
    {
        [Key]
        public Guid ID { get; set; } = Guid.NewGuid();

        public Guid TicketID { get; set; }

        [ForeignKey(nameof(TicketID))]
        public FeedbackTicket? Ticket { get; set; }

        [Required]
        public string Content { get; set; } = string.Empty;

        public Guid? AuthorId { get; set; }

        [Required]
        [MaxLength(100)]
        public string AuthorName { get; set; } = string.Empty;

        public bool IsAdmin { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;

        public ICollection<FeedbackAttachment> Attachments { get; set; } = new List<FeedbackAttachment>();
    }

    public class FeedbackAttachment
    {
        [Key]
        public Guid ID { get; set; } = Guid.NewGuid();

        public Guid TicketID { get; set; }

        [ForeignKey(nameof(TicketID))]
        public FeedbackTicket? Ticket { get; set; }

        public Guid? ReplyID { get; set; }

        [ForeignKey(nameof(ReplyID))]
        public FeedbackReply? Reply { get; set; }

        [Required]
        [MaxLength(2000)]
        public string Url { get; set; } = string.Empty;

        [MaxLength(260)]
        public string Name { get; set; } = string.Empty;

        [MaxLength(200)]
        public string Type { get; set; } = string.Empty;

        public int SortOrder { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    }
}
