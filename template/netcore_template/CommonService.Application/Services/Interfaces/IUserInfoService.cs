using CommonService.Application.DTOs;
using CommonService.Core.Models;

namespace CommonService.Application.Services.Interfaces
{
    public interface IUserInfoService
    {
        Task<IEnumerable<UserInfo>> GetAllAsync();
        Task<PagedResult<UserInfo>> GetByFilterAsync(UserSearchDto dto);

        Task<UserInfo?> GetByIDAsync(Guid id);
        Task<UserInfo?> GetByPropsAsync(string prop, string value);
        Task<UserInfo?> FindByUsernoAsync(string userno);
        Task<UserInfo?> FindByNtAccountAsync(string ntAccount);

        Task<string> AddAsync(UserSaveDto dto);
        Task<string> AddFromSsoAsync(UserInfo profile);
        Task<UserInfo?> GetOrCreateFromProfileAsync(UserInfo profile);
        Task<string> UpdateAsync(UserSaveDto dto);
        Task<string> UpdatePasswordAsync(Guid id, string newPassword);
        Task<string?> ForceResetPasswordAsync(Guid id);
        Task<string> SyncNtAccountAsync(Guid id, string ntAccount);
        Task<string> TouchLastLoginAsync(Guid id);
        Task<string> DeleteAsync(Guid id);
        Task AttachMonthUsageAsync(IEnumerable<UserResponseDto> users);
        Task<LlmMonthUsageDto> GetMonthUsageAsync(string? ntAccount);
    }
}
