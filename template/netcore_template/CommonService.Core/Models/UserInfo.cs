using System.ComponentModel.DataAnnotations;

namespace CommonService.Core.Models
{
    public class UserInfo
    {
        [Key]
        public Guid ID { get; set; } = Guid.NewGuid();

        [Required]
        [MaxLength(50)]
        public string Userno { get; set; }
        [Required]
        [MaxLength(100)]
        public string Username { get; set; }
        [MaxLength(20)]
        public string? NtAccount { get; set; }

        [Required]
        public string Password { get; set; }

        [MaxLength(100)]
        public string? Email { get; set; }
        public string? DeptName { get; set; }
        public string? Avatar { get; set; }

        public bool Status { get; set; }

        public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
        public DateTime? UpdatedAt { get; set; }
        public DateTime? DeletedAt { get; set; }
        /// <summary>最近登录时间（SSO / 本地登录成功后更新）</summary>
        public DateTime? LastLoginAt { get; set; }

        // 多对多导航属性
        public ICollection<UserLinks> Roles { get; set; } = new List<UserLinks>();
    }

    public class UserRole
    {
        [Key]
        public Guid ID { get; set; } = Guid.NewGuid();

        [Required]
        public string RoleName { get; set; }

        public string Remark { get; set; }

        // 反向导航
        public ICollection<UserLinks> Users { get; set; } = new List<UserLinks>();
    }

    public class UserLinks
    {
        public Guid UserID { get; set; }
        public UserInfo UserInfo { get; set; }

        public Guid RoleID { get; set; }
        public UserRole UserRole { get; set; }
    }
}
