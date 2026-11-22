using System.Text.Json.Serialization;

namespace CommonService.Application.DTOs
{
    public class SessionFileTreeListDto
    {
        [JsonPropertyName("session_id")]
        public string SessionId { get; set; } = string.Empty;
    }

    public class SessionFileAddDto
    {
        [JsonPropertyName("agent_id")]
        public string AgentId { get; set; } = string.Empty;

        [JsonPropertyName("session_id")]
        public string SessionId { get; set; } = string.Empty;

        [JsonPropertyName("fold_path")]
        public string FoldPath { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("url")]
        public string Url { get; set; } = string.Empty;
    }

    public class SessionFileDeleteDto
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;
    }

    public class SessionFileRecordDto
    {
        [JsonPropertyName("id")]
        public string Id { get; set; } = string.Empty;

        [JsonPropertyName("agent_id")]
        public string AgentId { get; set; } = string.Empty;

        [JsonPropertyName("session_id")]
        public string SessionId { get; set; } = string.Empty;

        [JsonPropertyName("fold_path")]
        public string FoldPath { get; set; } = string.Empty;

        [JsonPropertyName("name")]
        public string Name { get; set; } = string.Empty;

        [JsonPropertyName("url")]
        public string Url { get; set; } = string.Empty;

        [JsonPropertyName("updated_at")]
        public string UpdatedAt { get; set; } = string.Empty;
    }

    public class AgentPlatformEnvelope<T>
    {
        public int status { get; set; }
        public T? result { get; set; }
    }
}
