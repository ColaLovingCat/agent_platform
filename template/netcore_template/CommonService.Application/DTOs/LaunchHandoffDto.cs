using System.Text.Json.Serialization;

namespace CommonService.Application.DTOs
{
    public class LaunchHandoffSaveDto
    {
        [JsonPropertyName("agent_id")]
        public string? AgentId { get; set; }

        [JsonPropertyName("token")]
        public string? Token { get; set; }

        [JsonPropertyName("new_content")]
        public string? NewContent { get; set; }
    }

    public class LaunchHandoffGetDto
    {
        [JsonPropertyName("request_id")]
        public Guid RequestId { get; set; }

        [JsonPropertyName("id")]
        public Guid ID { get; set; }
    }

    public class LaunchHandoffIdDto
    {
        [JsonPropertyName("request_id")]
        public Guid RequestId { get; set; }
    }

    public class LaunchHandoffView
    {
        [JsonPropertyName("request_id")]
        public Guid RequestId { get; set; }

        [JsonPropertyName("agent_id")]
        public string AgentId { get; set; } = string.Empty;

        [JsonPropertyName("token")]
        public string Token { get; set; } = string.Empty;

        [JsonPropertyName("new_content")]
        public string NewContent { get; set; } = string.Empty;

        [JsonPropertyName("userinfos")]
        public UserResponseDto? UserInfos { get; set; }
    }

    public class LaunchHandoffRecord
    {
        public Guid RequestId { get; set; }
        public string AgentId { get; set; } = string.Empty;
        public string Token { get; set; } = string.Empty;
        public string NewContent { get; set; } = string.Empty;
        public Guid? UserId { get; set; }
        public string Userno { get; set; } = string.Empty;
    }
}
