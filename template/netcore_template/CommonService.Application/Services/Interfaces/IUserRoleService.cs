using CommonService.Core.Models;
using CommonService.Application.DTOs;

namespace CommonService.Application.Services.Interfaces
{
    public interface IUserRoleService
    {
        Task<IEnumerable<UserRole>> GetAllAsync();
        Task<UserRole> GetByIDAsync(Guid id);

        Task<string> AddAsync(RoleSaveDto dto);
        Task<string> UpdateAsync(RoleSaveDto dto);
        Task<string> DeleteAsync(Guid id);
    }
}
