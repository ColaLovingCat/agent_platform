
using Microsoft.EntityFrameworkCore;
using System.Linq.Dynamic.Core;
using CommonService.Application.DTOs;
using CommonService.Application.Services.Interfaces;
using CommonService.Core.DbContexts;
using CommonService.Core.Models;
using CommonService.Core.Repositories.Interfaces;
using CommonService.Core.Utils;

namespace CommonService.Application.Services
{
    public class UserInfoService : IUserInfoService
    {
        private readonly IUserInfoRepository _repository;
        private readonly AppDbContext _context;

        public UserInfoService(IUserInfoRepository repository, AppDbContext context)
        {
            _repository = repository;
            _context = context;
        }

        public async Task<IEnumerable<UserInfo>> GetAllAsync()
        {
            return await _repository.GetAllWithRolesAsync();
        }

        public async Task<CommonService.Core.Models.PagedResult<UserInfo>> GetByFilterAsync(UserSearchDto dto)
        {
            var query = _context.UserInfos.AsQueryable();

            // Filter get?Username=match:Test&Age:gt:20,lt:50&Address=match:Te
            query = query.ApplyFilters(dto.Filters);

            //  Sorting
            if (!string.IsNullOrWhiteSpace(dto.Sort))
            {
                // 例如 dto.Sort = "UserName:asc,CreatedAt:desc"
                query = query.ApplySorting(dto.Sort);
            }
            else
            {
                query = query.OrderBy(u => u.Username);
            }

            var totalCount = await query.CountAsync();

            var users = await query
                .Skip((dto.Page - 1) * dto.Size)
                .Take(dto.Size)
                .Include(r => r.Roles)
                .ThenInclude(link => link.UserRole)
                .ToListAsync();

            return new CommonService.Core.Models.PagedResult<UserInfo>
            {
                Items = users,
                Pagination = new Pagination
                {
                    PageIndex = dto.Page,
                    PageSize = dto.Size,
                    TotalCount = totalCount
                }
            };
        }

        public async Task<UserInfo?> GetByIDAsync(Guid id)
        {
            return await _repository.GetByIDWithRolesAsync(id);
        }

        public async Task<UserInfo?> GetByPropsAsync(string prop, string value)
        {
            return await _repository.GetByPropsAsync(prop, value);
        }

        public async Task<UserInfo?> FindByUsernoAsync(string userno)
        {
            return await _repository.FindByUsernoAsync(userno);
        }

        public async Task<UserInfo?> FindByNtAccountAsync(string ntAccount)
        {
            return await _repository.FindByNtAccountAsync(ntAccount);
        }

        public async Task<string> AddAsync(UserSaveDto dto)
        {
            // 判断是否已存在
            var isExists = await _repository.ExistsAsync(dto.Userno);
            if (isExists) return "User no already exists.";

            // 增加
            var user = new UserInfo
            {
                ID = Guid.NewGuid(),
                Userno = dto.Userno,
                Username = dto.Username,
                Password = AesEncryptionHelper.HashPassword(dto.Password),
                NtAccount = dto.NtAccount,
                Email = dto.Email,
                DeptName = dto.DeptName,
                Avatar = dto.Avatar,
                Status = true,
                CreatedAt = DateTime.UtcNow
            };
            await _repository.AddAsync(user);

            await _repository.SetUserRolesAsync(user, dto.RoleIDs);
            await _context.SaveChangesAsync();
            return ResultStatus.OK;
        }

        /// <summary>
        /// SSO / iUser 首次落库：默认密码为工号（BCrypt 哈希存储）。
        /// </summary>
        public async Task<string> AddFromSsoAsync(UserInfo profile)
        {
            var userno = NormalizeKey(profile.Userno);
            if (userno.Length == 0)
                return "Userno is required.";

            if (await _repository.ExistsByUsernoAsync(userno))
                return "User no already exists.";

            var ntAccount = NormalizeKey(profile.NtAccount);
            if (ntAccount.Length > 0 && await _repository.ExistsByNtAccountAsync(ntAccount))
                return "NT Account already exists.";

            var user = new UserInfo
            {
                ID = Guid.NewGuid(),
                Userno = userno,
                Username = string.IsNullOrWhiteSpace(profile.Username) ? userno : profile.Username.Trim(),
                NtAccount = ntAccount.Length > 0 ? ntAccount : null,
                Email = profile.Email,
                DeptName = profile.DeptName,
                Avatar = profile.Avatar,
                Password = AesEncryptionHelper.HashPassword(userno),
                Status = true,
                CreatedAt = DateTime.UtcNow,
                LastLoginAt = null,
            };
            try
            {
                await _repository.AddAsync(user);
            }
            catch (DbUpdateException)
            {
                return "User no already exists.";
            }
            return ResultStatus.OK;
        }

        /// <summary>
        /// 按工号 / 域账号查找本地用户；不存在则写入，存在则按需同步域账号。
        /// </summary>
        public async Task<UserInfo?> GetOrCreateFromProfileAsync(UserInfo profile)
        {
            var userno = NormalizeKey(profile.Userno);
            var ntAccount = NormalizeKey(profile.NtAccount);
            if (userno.Length == 0 && ntAccount.Length == 0)
                return null;

            var user = await ResolveUserAsync(userno, ntAccount);
            if (user != null)
            {
                if (ntAccount.Length > 0
                    && !string.Equals(user.NtAccount, ntAccount, StringComparison.OrdinalIgnoreCase))
                {
                    await SyncNtAccountAsync(user.ID, ntAccount);
                    user.NtAccount = ntAccount;
                }
                return user;
            }

            if (userno.Length == 0)
                return null;

            var addResult = await AddFromSsoAsync(profile);
            if (addResult != ResultStatus.OK)
                return await ResolveUserAsync(userno, ntAccount);

            return await ResolveUserAsync(userno, ntAccount);
        }

        private static string NormalizeKey(string? value) => value?.Trim() ?? "";

        private async Task<UserInfo?> ResolveUserAsync(string userno, string ntAccount)
        {
            if (userno.Length > 0)
            {
                var byUserno = await _repository.FindByUsernoAsync(userno);
                if (byUserno != null) return byUserno;
            }

            if (ntAccount.Length > 0)
            {
                var byNtAccount = await _repository.FindByNtAccountAsync(ntAccount);
                if (byNtAccount != null) return byNtAccount;
            }

            return null;
        }

        public async Task<string> UpdateAsync(UserSaveDto dto)
        {
            // 检查
            if (!Guid.TryParse(dto.ID, out var guid))
                return "ID is required.";

            // 判断是否已存在
            var user = await _repository.GetByIDAsync(guid);
            if (user == null) return "User not found.";

            // 更新字段
            user.Userno = dto.Userno;
            user.Username = dto.Username;
            user.NtAccount = dto.NtAccount;
            user.Email = dto.Email;
            user.DeptName = dto.DeptName;
            user.Avatar = dto.Avatar;
            user.Status = dto.Status;
            user.UpdatedAt = DateTime.UtcNow;

            await _repository.UpdateAsync(user);

            await _repository.SetUserRolesAsync(user, dto.RoleIDs);
            await _context.SaveChangesAsync();
            return ResultStatus.OK;
        }

        public async Task<string> UpdatePasswordAsync(Guid id, string newPassword)
        {
            var user = await _repository.GetByIDAsync(id);
            if (user == null) return "User not found.";

            // 检查新密码是否与旧密码相同
            if (AesEncryptionHelper.VerifyPassword(newPassword, user.Password))
                return "New password cannot be the same as the old password.";

            // 生成新密码哈希
            var hashed = AesEncryptionHelper.HashPassword(newPassword);
            await _repository.UpdatePasswordAsync(id, hashed);
            return ResultStatus.OK;
        }

        public async Task<string?> ForceResetPasswordAsync(Guid id)
        {
            var user = await _repository.GetByIDAsync(id);
            if (user == null) return null;

            // 生成随机密码
            string newPassword = GenerateRandomPassword(12);
            user.Password = AesEncryptionHelper.HashPassword(newPassword);
            await _repository.UpdateAsync(user);

            // 返回明文密码给调用方（用于通知用户）
            return newPassword;
        }
        private string GenerateRandomPassword(int length)
        {
            const string numbers = "0123456789";
            const string lowercase = "abcdefghijklmnopqrstuvwxyz";
            const string uppercase = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const string special = "!@#$*_=?";

            string allChars = numbers + lowercase + uppercase + special;
            var random = new Random();

            // 确保至少包含一种类型
            var password = new List<char>
        {
            numbers[random.Next(numbers.Length)],
            lowercase[random.Next(lowercase.Length)],
            uppercase[random.Next(uppercase.Length)],
            special[random.Next(special.Length)]
        };

            // 补足剩余长度
            for (int i = password.Count; i < length; i++)
            {
                password.Add(allChars[random.Next(allChars.Length)]);
            }

            // 打乱顺序
            return new string(password.OrderBy(_ => random.Next()).ToArray());
        }

        public async Task<string> SyncNtAccountAsync(Guid id, string ntAccount)
        {
            var user = await _repository.GetByIDAsync(id);
            if (user == null) return "User not found.";

            user.NtAccount = ntAccount?.Trim();
            user.UpdatedAt = DateTime.UtcNow;
            await _repository.UpdateAsync(user);
            return ResultStatus.OK;
        }

        public async Task<string> TouchLastLoginAsync(Guid id)
        {
            var user = await _repository.GetByIDAsync(id);
            if (user == null) return "User not found.";

            user.LastLoginAt = DateTime.UtcNow;
            user.UpdatedAt = DateTime.UtcNow;
            await _repository.UpdateAsync(user);
            return ResultStatus.OK;
        }

        public async Task<string> DeleteAsync(Guid id)
        {
            // 检查
            var user = await _repository.GetByIDAsync(id);
            if (user is null) return "User not found.";

            await _repository.DeleteAsync(id);
            return ResultStatus.OK;
        }

        public const decimal LlmMonthQuota = 120m;

        public async Task AttachMonthUsageAsync(IEnumerable<UserResponseDto> users)
        {
            var list = users?.ToList() ?? new List<UserResponseDto>();
            if (list.Count == 0) return;

            var nts = list
                .Select(x => (x.NtAccount ?? "").Trim())
                .Where(x => x.Length > 0)
                .Distinct(StringComparer.OrdinalIgnoreCase)
                .ToList();
            var map = nts.Count == 0
                ? new Dictionary<string, decimal>(StringComparer.OrdinalIgnoreCase)
                : await SumMonthCostAsync(nts);

            foreach (var user in list)
            {
                user.MonthQuota = LlmMonthQuota;
                var nt = (user.NtAccount ?? "").Trim();
                user.MonthCost = nt.Length > 0 && map.TryGetValue(nt, out var cost) ? cost : 0;
            }
        }

        public Task<LlmMonthUsageDto> GetMonthUsageAsync(string? ntAccount)
        {
            return SumOneAsync(ntAccount);
        }

        private async Task<LlmMonthUsageDto> SumOneAsync(string? ntAccount)
        {
            var nt = (ntAccount ?? "").Trim();
            if (nt.Length == 0)
                return new LlmMonthUsageDto { MonthCost = 0, MonthQuota = LlmMonthQuota };

            var map = await SumMonthCostAsync(new[] { nt });
            map.TryGetValue(nt, out var cost);
            return new LlmMonthUsageDto { MonthCost = cost, MonthQuota = LlmMonthQuota };
        }

        private async Task<Dictionary<string, decimal>> SumMonthCostAsync(IReadOnlyList<string> nts)
        {
            var prefix = DateTime.Now.ToString("yyyy-MM");
            var rows = await _context.LlmUserTokenUsages.AsNoTracking()
                .Where(x => x.RecordDate != null
                    && x.RecordDate.StartsWith(prefix)
                    && nts.Contains(x.UserNt))
                .GroupBy(x => x.UserNt)
                .Select(g => new { Nt = g.Key, Cost = g.Sum(x => x.Cost) })
                .ToListAsync();

            return rows.ToDictionary(x => x.Nt, x => x.Cost, StringComparer.OrdinalIgnoreCase);
        }

    }
}
