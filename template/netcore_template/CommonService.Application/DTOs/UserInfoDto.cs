namespace CommonService.Application.DTOs
{
    public class UserResponseDto
    {
        public Guid ID { get; set; }

        public string Userno { get; set; }
        public string Username { get; set; }
        public string NtAccount { get; set; }

        public string Email { get; set; }
        public string DeptName { get; set; }
        public string Avatar { get; set; }

        public bool Status { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }
        public DateTime? LastLoginAt { get; set; }

        public List<RoleDto>? Roles { get; set; } = new();

        public decimal MonthCost { get; set; }
        public decimal MonthQuota { get; set; } = 120;
    }

    public class LlmMonthUsageDto
    {
        public decimal MonthCost { get; set; }
        public decimal MonthQuota { get; set; } = 120;
    }

    public class UserDto
    {
        public Guid ID { get; set; }

        public string Userno { get; set; }
        public string Username { get; set; }
        public string NtAccount { get; set; }

        public string Email { get; set; }
        public string DeptName { get; set; }
        public string Avatar { get; set; }

        public bool Status { get; set; }

        public DateTime CreatedAt { get; set; }
        public DateTime? UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }
        public DateTime? LastLoginAt { get; set; }
    }

    public class UserLoginDto
    {
        public string Account { get; set; }
        public string Password { get; set; }
    }

    public class UserSearchDto
    {
        // Filter
        public Dictionary<string, string>? Filters { get; set; }
        
        // Pagination
        public int Page { get; set; } = 1;
        public int Size { get; set; } = 10;

        // Sorting sort=name:asc,age:desc
        public string? Sort { get; set; }
    }

    public class UserSaveDto
    {
        public string ID { get; set; }

        public string Userno { get; set; }
        public string Username { get; set; }
        public string NtAccount { get; set; }
        public string? Password { get; set; }

        public string Email { get; set; }
        public string DeptName { get; set; }
        public string Avatar { get; set; }

        public bool Status { get; set; }

        public List<string> RoleIDs { get; set; } = new();
    }

    public class UpdatePasswordDto
    {
        public Guid ID { get; set; }
        public string NewPassword { get; set; }
    }

    public class AzureDto
    {
        public string Code { get; set; }
        public string RedirectUri { get; set; }
    }
}
