using System.Text.Json;
using System.Text.Json.Serialization;
using CommonService.Core.Models;

namespace CommonService.Core.Utils
{
    /// <summary>
    /// 独立维护的本地用户列表（Data/local-users.json）。
    /// 登录时若 Account 命中 userno，则走本地密码校验并签发 token。
    /// </summary>
    public class LocalUserStore
    {
        private static readonly JsonSerializerOptions JsonOptions = new()
        {
            PropertyNameCaseInsensitive = true,
            ReadCommentHandling = JsonCommentHandling.Skip,
            AllowTrailingCommas = true,
        };

        private readonly string _filePath;
        private readonly object _lock = new();

        public LocalUserStore(string filePath)
        {
            _filePath = filePath;
        }

        /// <summary>
        /// 尝试用本地用户列表登录。
        /// matched=false：未命中 JSON，调用方应继续原有 DB/iUser 流程。
        /// matched=true 且 error 非空：已命中但校验失败，应直接返回错误。
        /// matched=true 且 user 非空：登录成功。
        /// </summary>
        public (bool matched, UserInfo? user, string? error) TryLogin(string account, string password)
        {
            if (string.IsNullOrWhiteSpace(account))
                return (false, null, null);

            var record = FindRecordByUserno(account);
            if (record == null)
                return (false, null, null);

            if (!record.Status)
                return (true, null, "用户已注销");

            if (!VerifyPassword(password, record.Password))
                return (true, null, "密码不正确");

            return (true, ToUserInfo(record), null);
        }

        public UserInfo? FindByUserno(string userno)
        {
            var record = FindRecordByUserno(userno);
            return record == null ? null : ToUserInfo(record);
        }

        public IReadOnlyList<string> GetRoleNames(string userno)
        {
            var record = FindRecordByUserno(userno);
            return record?.Roles ?? [];
        }

        public UserInfo? FindById(Guid id)
        {
            var record = Load().FirstOrDefault(u =>
                Guid.TryParse(u.Id, out var guid) && guid == id);
            return record == null ? null : ToUserInfo(record);
        }

        private LocalUserRecord? FindRecordByUserno(string userno)
        {
            return Load().FirstOrDefault(u =>
                string.Equals(u.Userno, userno, StringComparison.OrdinalIgnoreCase));
        }

        private List<LocalUserRecord> Load()
        {
            lock (_lock)
            {
                if (!File.Exists(_filePath))
                    return [];

                var json = File.ReadAllText(_filePath);
                if (string.IsNullOrWhiteSpace(json))
                    return [];

                return JsonSerializer.Deserialize<List<LocalUserRecord>>(json, JsonOptions) ?? [];
            }
        }

        private static bool VerifyPassword(string password, string? stored)
        {
            if (string.IsNullOrEmpty(stored))
                return false;

            // BCrypt 哈希（与本地 DB 用户一致）
            if (stored.StartsWith("$2a$", StringComparison.Ordinal)
                || stored.StartsWith("$2b$", StringComparison.Ordinal)
                || stored.StartsWith("$2y$", StringComparison.Ordinal))
            {
                return AesEncryptionHelper.VerifyPassword(password, stored);
            }

            // 明文（便于独立维护 JSON）
            return string.Equals(password, stored, StringComparison.Ordinal);
        }

        private static UserInfo ToUserInfo(LocalUserRecord record)
        {
            var id = Guid.TryParse(record.Id, out var guid) ? guid : Guid.NewGuid();
            return new UserInfo
            {
                ID = id,
                Userno = record.Userno ?? "",
                Username = record.Username ?? record.Userno ?? "",
                NtAccount = record.NtAccount,
                Password = record.Password ?? "",
                Email = record.Email,
                DeptName = record.DeptName,
                Avatar = record.Avatar,
                Status = record.Status,
                CreatedAt = record.CreatedAt ?? DateTime.UtcNow,
                UpdatedAt = record.UpdatedAt,
                DeletedAt = record.DeletedAt,
                Roles = new List<UserLinks>(),
            };
        }

        private sealed class LocalUserRecord
        {
            [JsonPropertyName("id")]
            public string? Id { get; set; }

            [JsonPropertyName("userno")]
            public string? Userno { get; set; }

            [JsonPropertyName("username")]
            public string? Username { get; set; }

            [JsonPropertyName("ntAccount")]
            public string? NtAccount { get; set; }

            [JsonPropertyName("password")]
            public string? Password { get; set; }

            [JsonPropertyName("email")]
            public string? Email { get; set; }

            [JsonPropertyName("deptName")]
            public string? DeptName { get; set; }

            [JsonPropertyName("avatar")]
            public string? Avatar { get; set; }

            [JsonPropertyName("status")]
            public bool Status { get; set; } = true;

            [JsonPropertyName("createdAt")]
            public DateTime? CreatedAt { get; set; }

            [JsonPropertyName("updatedAt")]
            public DateTime? UpdatedAt { get; set; }

            [JsonPropertyName("deletedAt")]
            public DateTime? DeletedAt { get; set; }

            [JsonPropertyName("roles")]
            public List<string>? Roles { get; set; }
        }
    }
}
