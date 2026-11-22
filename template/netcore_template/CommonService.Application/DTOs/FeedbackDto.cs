using System.Text.Json.Serialization;

namespace CommonService.Application.DTOs
{
    public class FeedbackSaveDto
    {
        [JsonPropertyName("category")]
        public string Category { get; set; } = "bug";

        [JsonPropertyName("title")]
        public string? Title { get; set; }

        [JsonPropertyName("content")]
        public string Content { get; set; } = string.Empty;

        [JsonPropertyName("screenshots")]
        public List<FeedbackFileDto>? Screenshots { get; set; }

        [JsonPropertyName("pageUrl")]
        public string? PageUrl { get; set; }
    }

    public class FeedbackListDto
    {
        [JsonPropertyName("scope")]
        public string? Scope { get; set; }

        [JsonPropertyName("status")]
        public string? Status { get; set; }

        [JsonPropertyName("page")]
        public int Page { get; set; } = 1;

        [JsonPropertyName("size")]
        public int Size { get; set; } = 10;
    }

    public class FeedbackInfosDto
    {
        [JsonPropertyName("id")]
        public Guid ID { get; set; }
    }

    public class FeedbackReplyDto
    {
        [JsonPropertyName("id")]
        public Guid ID { get; set; }

        [JsonPropertyName("content")]
        public string Content { get; set; } = string.Empty;

        [JsonPropertyName("screenshots")]
        public List<FeedbackFileDto>? Screenshots { get; set; }
    }

    public class FeedbackStatusDto
    {
        [JsonPropertyName("id")]
        public Guid ID { get; set; }

        [JsonPropertyName("status")]
        public string Status { get; set; } = string.Empty;
    }

    public class FeedbackReplyView
    {
        [JsonPropertyName("id")]
        public Guid ID { get; set; }

        [JsonPropertyName("content")]
        public string Content { get; set; } = string.Empty;

        [JsonPropertyName("authorName")]
        public string AuthorName { get; set; } = string.Empty;

        [JsonPropertyName("isAdmin")]
        public bool IsAdmin { get; set; }

        [JsonPropertyName("screenshots")]
        public List<FeedbackFileDto> Screenshots { get; set; } = new();

        [JsonPropertyName("createdAt")]
        public DateTime CreatedAt { get; set; }
    }

    public class FeedbackFileDto
    {
        [JsonPropertyName("url")]
        public string Url { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("type")]
        public string Type { get; set; } = string.Empty;
    }

    public class FeedbackTicketView
    {
        [JsonPropertyName("id")]
        public Guid ID { get; set; }

        [JsonPropertyName("category")]
        public string Category { get; set; } = string.Empty;

        [JsonPropertyName("title")]
        public string Title { get; set; } = string.Empty;

        [JsonPropertyName("content")]
        public string Content { get; set; } = string.Empty;

        [JsonPropertyName("screenshots")]
        public List<FeedbackFileDto> Screenshots { get; set; } = new();

        [JsonPropertyName("pageUrl")]
        public string? PageUrl { get; set; }

        [JsonPropertyName("status")]
        public string Status { get; set; } = string.Empty;

        [JsonPropertyName("createdByName")]
        public string CreatedByName { get; set; } = string.Empty;

        [JsonPropertyName("createdByNo")]
        public string? CreatedByNo { get; set; }

        [JsonPropertyName("createdAt")]
        public DateTime CreatedAt { get; set; }

        [JsonPropertyName("updatedAt")]
        public DateTime? UpdatedAt { get; set; }

        [JsonPropertyName("replyCount")]
        public int ReplyCount { get; set; }

        [JsonPropertyName("replies")]
        public List<FeedbackReplyView>? Replies { get; set; }
    }

    public class FeedbackCountsView
    {
        [JsonPropertyName("open")]
        public int Open { get; set; }

        [JsonPropertyName("processing")]
        public int Processing { get; set; }
    }
}
