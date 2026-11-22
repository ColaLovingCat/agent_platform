using CommonService.Core.DbContexts;
using CommonService.Core.Models;
using CommonService.Core.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace CommonService.Core.Repositories
{
    public class UserRoleRepository : BasicRepository<UserRole>, IUserRoleRepository
    {
        public UserRoleRepository(AppDbContext context) : base(context)
        {
        }

        public async Task<IEnumerable<UserRole>> GetAllWithUsersAsync()
        {
            return await _context.UserRoles
                .Include(r => r.Users)
                .ThenInclude(link => link.UserInfo)
                .ToListAsync();
        }

        public async Task<UserRole?> GetByIDWithUsersAsync(Guid id)
        {
            return await _context.UserRoles
                .Include(r => r.Users)
                .ThenInclude(link => link.UserInfo)
                .FirstOrDefaultAsync(r => r.ID == id);
        }

        public async Task<bool> ExistsAsync(string value)
        {
            return await _context.UserRoles.AnyAsync(u => u.RoleName == value);
        }
    }
}
