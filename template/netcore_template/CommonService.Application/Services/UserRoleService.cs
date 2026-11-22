using CommonService.Core.Models;
using CommonService.Core.Repositories.Interfaces;
using CommonService.Application.Services.Interfaces;
using CommonService.Application.DTOs;

namespace CommonService.Application.Services
{
    public class UserRoleService : IUserRoleService
    {
        private readonly IUserRoleRepository _repository;

        public UserRoleService(IUserRoleRepository repository)
        {
            _repository = repository;
        }

        public async Task<IEnumerable<UserRole>> GetAllAsync()
        {
            return await _repository.GetAllWithUsersAsync();
        }

        public async Task<UserRole?> GetByIDAsync(Guid id)
        {
            return await _repository.GetByIDWithUsersAsync(id);
        }

        public async Task<string> AddAsync(RoleSaveDto dto)
        {
            // 检查
            if (string.IsNullOrWhiteSpace(dto.RoleName)) return "Role name is required.";

            // 判断是否已存在
            var isExists = await _repository.ExistsAsync(dto.RoleName);
            if (isExists) return "Role name already exists.";

            // 增加
            var role = new UserRole
            {
                ID = Guid.NewGuid(),
                RoleName = dto.RoleName,
                Remark = dto.Remark
            };
            await _repository.AddAsync(role);
            return ResultStatus.OK;
        }

        public async Task<string> UpdateAsync(RoleSaveDto dto)
        {
            // 检查
            if (!Guid.TryParse(dto.ID, out var guid))
                return "ID is required.";

            // 判断是否已存在
            var role = await _repository.GetByIDAsync(guid);
            if (role == null) return "Role not found.";

            // 更新
            role.RoleName = dto.RoleName;
            role.Remark = dto.Remark;
            await _repository.UpdateAsync(role);
            return ResultStatus.OK;
        }

        public async Task<string> DeleteAsync(Guid id)
        {
            // 检查
            var role = await _repository.GetByIDAsync(id);
            if (role is null) return "Role not found.";

            await _repository.DeleteAsync(id);
            return ResultStatus.OK;
        }
    }
}
