using CommonService.Core.Models;

namespace CommonService.Core.Repositories.Interfaces
{
    public interface IUserRoleRepository : IBasicRepository<UserRole>
    {
        Task<IEnumerable<UserRole>> GetAllWithUsersAsync();
        Task<UserRole?> GetByIDWithUsersAsync(Guid id);
        Task<bool> ExistsAsync(string value);
    }
}
