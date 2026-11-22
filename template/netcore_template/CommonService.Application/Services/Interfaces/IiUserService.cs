using CommonService.Application.DTOs;
using CommonService.Core.Models;
using System;
using System.Collections.Generic;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CommonService.Application.Services.Interfaces
{
    public interface IiUserService
    {
        Task<iUserResultDto> SearchAsync(iUserSearchDto dto);
        Task<UserInfo?> GetUserInfoAsync(string? userno, string? ntAccount);
        Task<iUserLoginResponseDto?> LoginAsync(iUserLoginDto dto);
    }
}
