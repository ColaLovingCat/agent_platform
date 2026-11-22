using CommonService.Core.DbContexts;
using CommonService.Core.Models;
using CommonService.Core.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;
using System.Linq.Expressions;

namespace CommonService.Core.Repositories
{
    public class UserInfoRepository : BasicRepository<UserInfo>, IUserInfoRepository
    {
        public UserInfoRepository(AppDbContext context) : base(context)
        {
        }

        public async Task<IEnumerable<UserInfo>> GetAllWithRolesAsync()
        {
            return await _context.UserInfos
                .Include(r => r.Roles)
                .ThenInclude(link => link.UserRole)
                .ToListAsync();
        }

        public async Task<UserInfo?> GetByIDWithRolesAsync(Guid id)
        {
            return await _context.UserInfos
                .Include(r => r.Roles)
                .ThenInclude(link => link.UserRole)
                .FirstOrDefaultAsync(r => r.ID == id);
        }

        public async Task<UserInfo?> GetByPropsAsync(string propName, object value)
        {
            var parameter = Expression.Parameter(typeof(UserInfo), "x");
            var property = Expression.PropertyOrField(parameter, propName);

            var constant = Expression.Constant(value);

            // 自动转换类型（如字符串转 Guid 等）
            var convertedConstant = Expression.Convert(constant, property.Type);

            var equal = Expression.Equal(property, convertedConstant);
            var lambda = Expression.Lambda<Func<UserInfo, bool>>(equal, parameter);

            return await _context.UserInfos
                .Include(r => r.Roles)
                .ThenInclude(link => link.UserRole)
                .FirstOrDefaultAsync(lambda);
        }

        public async Task<UserInfo?> FindByUsernoAsync(string userno)
        {
            var key = userno.Trim();
            if (key.Length == 0) return null;

            return await _context.UserInfos
                .Include(r => r.Roles)
                .ThenInclude(link => link.UserRole)
                .FirstOrDefaultAsync(u => u.Userno.Trim().ToLower() == key.ToLower());
        }

        public async Task<UserInfo?> FindByNtAccountAsync(string ntAccount)
        {
            var key = ntAccount.Trim();
            if (key.Length == 0) return null;

            return await _context.UserInfos
                .Include(r => r.Roles)
                .ThenInclude(link => link.UserRole)
                .FirstOrDefaultAsync(u =>
                    u.NtAccount != null
                    && u.NtAccount.Trim().ToLower() == key.ToLower());
        }

        public async Task<bool> ExistsByUsernoAsync(string userno)
        {
            var key = userno.Trim();
            if (key.Length == 0) return false;

            return await _context.UserInfos.AnyAsync(u => u.Userno.Trim().ToLower() == key.ToLower());
        }

        public async Task<bool> ExistsByNtAccountAsync(string ntAccount)
        {
            var key = ntAccount.Trim();
            if (key.Length == 0) return false;

            return await _context.UserInfos.AnyAsync(u =>
                u.NtAccount != null
                && u.NtAccount.Trim().ToLower() == key.ToLower());
        }

        public async Task<bool> ExistsAsync(string value)
        {
            return await ExistsByUsernoAsync(value);
        }

        public async Task SetUserRolesAsync(UserInfo user, List<string> roleIds)
        {
            // 先加载现有关联
            await _context.Entry(user).Collection(u => u.Roles).LoadAsync();
            // 清空当前关联
            user.Roles.Clear();

            // 加载新的目标角色
            var guidRoleIds = roleIds.Select(Guid.Parse).ToList();
            var newRoles = await _context.UserRoles
                .Where(r => guidRoleIds.Contains(r.ID))
                .ToListAsync();

            // 添加新的关联
            foreach (var role in newRoles)
            {
                user.Roles.Add(new UserLinks
                {
                    UserID = user.ID,
                    UserInfo = user,
                    RoleID = role.ID,
                    UserRole = role
                });
            }
        }

        public async Task UpdatePasswordAsync(Guid id, string hashedPassword)
        {
            var user = await _context.UserInfos.FindAsync(id);
            if (user != null)
            {
                user.Password = hashedPassword;
                _context.UserInfos.Update(user);
                await _context.SaveChangesAsync();
            }
        }
    }
}
