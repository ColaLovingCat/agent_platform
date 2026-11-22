namespace CommonService.Application.DTOs
{
    public class RoleResponseDto
    {
        public Guid ID { get; set; }
        public string RoleName { get; set; }
        public string Remark { get; set; }

        public List<UserDto>? Users { get; set; } = new();
    }

    public class RoleDto
    {
        public Guid ID { get; set; }
        public string RoleName { get; set; }
        public string Remark { get; set; }
    }

    public class RoleSaveDto
    {
        public string ID { get; set; }
        public string RoleName { get; set; }
        public string Remark { get; set; }
    }
}