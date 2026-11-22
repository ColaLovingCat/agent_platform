using AutoMapper;
using CommonService.Application.DTOs;
using CommonService.Application.Services.Interfaces;
using CommonService.Core.Models;
using CommonService.Core.Utils;

namespace CommonService.Application.Services
{
    public class LaunchHandoffService : ILaunchHandoffService
    {
        private static readonly TimeSpan Ttl = TimeSpan.FromMinutes(15);
        private readonly ICacheHelper _cache;
        private readonly IUserInfoService _users;
        private readonly IMapper _mapper;
        private readonly LocalUserStore _localUsers;

        public LaunchHandoffService(
            ICacheHelper cache,
            IUserInfoService users,
            IMapper mapper,
            LocalUserStore localUsers)
        {
            _cache = cache;
            _users = users;
            _mapper = mapper;
            _localUsers = localUsers;
        }

        public async Task<LaunchHandoffIdDto> SaveAsync(LaunchHandoffSaveDto dto, Guid? userId, string? userno)
        {
            var id = Guid.NewGuid();
            var record = new LaunchHandoffRecord
            {
                RequestId = id,
                AgentId = (dto.AgentId ?? "").Trim(),
                Token = (dto.Token ?? "").Trim(),
                NewContent = dto.NewContent ?? "",
                UserId = userId,
                Userno = (userno ?? "").Trim(),
            };
            await _cache.SetAsync(CacheKey(id), record, Ttl);
            return new LaunchHandoffIdDto { RequestId = id };
        }

        public async Task<LaunchHandoffView?> GetInfoAsync(Guid requestId)
        {
            if (requestId == Guid.Empty) return null;
            var record = await _cache.GetAsync<LaunchHandoffRecord>(CacheKey(requestId));
            if (record == null) return null;

            return new LaunchHandoffView
            {
                RequestId = record.RequestId,
                AgentId = record.AgentId,
                Token = record.Token,
                NewContent = record.NewContent,
                UserInfos = await LoadUserAsync(record.UserId, record.Userno),
            };
        }

        private async Task<UserResponseDto?> LoadUserAsync(Guid? userId, string userno)
        {
            if (!string.IsNullOrWhiteSpace(userno))
            {
                var local = _localUsers.FindByUserno(userno);
                if (local != null)
                {
                    var mapped = _mapper.Map<UserResponseDto>(local);
                    mapped.Roles = _localUsers.GetRoleNames(userno)
                        .Select(name => new RoleDto { RoleName = name, Remark = "" })
                        .ToList();
                    await _users.AttachMonthUsageAsync(new[] { mapped });
                    return mapped;
                }
            }

            UserInfo? user = null;
            if (userId is Guid id && id != Guid.Empty)
                user = await _users.GetByIDAsync(id);
            if (user == null && !string.IsNullOrWhiteSpace(userno))
                user = await _users.FindByUsernoAsync(userno);
            if (user == null) return null;

            var result = _mapper.Map<UserResponseDto>(user);
            await _users.AttachMonthUsageAsync(new[] { result });
            return result;
        }

        private static string CacheKey(Guid id) => $"launch:{id:N}";
    }
}
