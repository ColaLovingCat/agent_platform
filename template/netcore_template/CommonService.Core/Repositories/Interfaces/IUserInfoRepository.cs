using CommonService.Core.Models;

namespace CommonService.Core.Repositories.Interfaces
{
    public interface IUserInfoRepository : IBasicRepository<UserInfo>
    {
        Task<IEnumerable<UserInfo>> GetAllWithRolesAsync();
        Task<UserInfo?> GetByIDWithRolesAsync(Guid id);
        Task<UserInfo?> GetByPropsAsync(string propName, object value);
        Task<UserInfo?> FindByUsernoAsync(string userno);
        Task<UserInfo?> FindByNtAccountAsync(string ntAccount);
        Task<bool> ExistsByUsernoAsync(string userno);
        Task<bool> ExistsByNtAccountAsync(string ntAccount);
        Task<bool> ExistsAsync(string value);
        Task SetUserRolesAsync(UserInfo user, List<string> roleIds);
        Task UpdatePasswordAsync(Guid id, string hashedPassword);
    }
}
