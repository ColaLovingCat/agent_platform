namespace CommonService.Application.DTOs
{
    public class iUserLoginDto
    {
        public string UserNameOrEmailAddress { get; set; }
        public string Password { get; set; }
        public bool RememberClient { get; set; } = true;
        public bool AEMG { get; set; } = true;
        public bool AEUserArea { get; set; } = true;
    }

    public class iUserLoginResponseDto
    {
        public bool Success { get; set; }
        public string Emp { get; set; }
        public string NTAccount { get; set; }
        public string AccessToken { get; set; }
    }

    public class iUserSearchDto
    {
        public int index { get; set; } = 1;

        public string ntAccount { get; set; }
        public string userno { get; set; }
        public string username { get; set; }
    }

    public class iUserResultDto
    {
        public int total { get; set; }
        public List<iUserDto> rows { get; set; }
    }

    public class iUserDto
    {
        public string? SapPNR { get; set; }
        public string? NTAccount { get; set; }
        public string? LastName { get; set; }
        public string? FirstName { get; set; }
        public string? EmailAddress { get; set; }
        public string? CostCenter { get; set; }
        public string? DisplayName { get; set; }
    }

    public class iUserResponseDto
    {
        public int total { get; set; } = 0;
        public List<UserResponseDto> rows { get; set; } = [];
    }
}
