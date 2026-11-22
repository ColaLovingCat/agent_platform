using CommonService.Application.DTOs;
using CommonService.Application.Services.Interfaces;
using CommonService.Core.Models;
using CommonService.Core.Utils;
using Microsoft.AspNetCore.Mvc;

namespace CommonService.WebApi.Controllers
{
    [Route("api/iusers")]
    [ApiController]
    public class iUserController : ControllerBase
    {
        private readonly IiUserService _iuserService;
        private readonly IUserInfoService _userService;
        private readonly JwtHelper _jwtHelper;
        private readonly LocalUserStore _localUsers;

        public iUserController(
            IiUserService iuserService,
            IUserInfoService userService,
            JwtHelper jwtHelper,
            LocalUserStore localUsers)
        {
            _iuserService = iuserService;
            _userService = userService;
            _jwtHelper = jwtHelper;
            _localUsers = localUsers;
        }


        /// <summary>
        /// 调用iUser接口，登录接口  [sso-iuser]
        /// 优先匹配 Data/local-users.json 中的 userno；未命中再走 iUser。
        /// </summary>
        /// <param name="dto">SSO信息</param>
        [HttpPost("login")]
        public async Task<ApiResponse<string>> Login([FromBody] UserLoginDto dto)
        {
            var (matched, localUser, localError) = _localUsers.TryLogin(dto.Account, dto.Password);
            if (matched)
            {
                if (localError != null || localUser == null)
                    return ApiResponse<string>.Fail(localError ?? "登录失败");

                var localToken = _jwtHelper.GenerateToken(localUser);
                LogHelper.Info("auth/login", $"Login Success (local-users): {localUser.Username}");
                Response.Headers.Add("Authorization", $"Bearer {localToken}");
                return ApiResponse<string>.Ok(localToken);
            }

            var result = await _iuserService.LoginAsync(new iUserLoginDto
            {
                UserNameOrEmailAddress = dto.Account,
                Password = dto.Password,
            });

            if (result == null)
                return ApiResponse<string>.Fail("iUser服务错误");

            if (!result.Success)
                return ApiResponse<string>.Fail("用户名或密码错误");

            var profile = await _iuserService.GetUserInfoAsync(result.Emp, null);

            if (profile == null || string.IsNullOrWhiteSpace(profile.Userno))
                return ApiResponse<string>.Fail("用户不存在");

            if (string.IsNullOrWhiteSpace(profile.NtAccount) && !string.IsNullOrWhiteSpace(result.NTAccount))
                profile.NtAccount = result.NTAccount;

            var user = await _userService.GetOrCreateFromProfileAsync(profile);
            if (user == null)
                return ApiResponse<string>.Fail("用户同步失败");

            if (!user.Status)
                return ApiResponse<string>.Fail("用户已注销");

            await _userService.TouchLastLoginAsync(user.ID);

            var token = _jwtHelper.GenerateToken(new UserInfo
            {
                ID = user.ID,
                Userno = user.Userno,
                NtAccount = user.NtAccount,
            });
            LogHelper.Info("iusers/login", $"Login Success: {user.Username}");
            Response.Headers.Add("Authorization", $"Bearer {token}");
            return ApiResponse<string>.Ok(token);
        }

        /// <summary>
        /// 调用iUser接口，查询用户信息
        /// </summary>
        /// <param name="index">页码，从1开始</param>
        /// <param name="ntAccount">NT账号</param>
        /// <param name="userno">工号</param>
        /// <param name="username">用户名</param>
        [HttpGet("search")]
        public async Task<ApiResponse<iUserResponseDto>> Search([FromQuery] int index, [FromQuery] string? ntAccount, [FromQuery] string? userno, [FromQuery] string? username)
        {
            var result = new iUserResponseDto
            {
                total = 0,
                rows = []
            };

            var data = await _iuserService.SearchAsync(new iUserSearchDto
            {
                index = index,
                ntAccount = ntAccount,
                userno = userno,
                username = username,
            });

            if (data.total > 0 && data.rows != null)
            {
                var userList = data.rows.Select(u => new UserResponseDto
                {
                    ID = new Guid(),
                    Userno = u.SapPNR ?? "",
                    Username = $"{u.LastName} {u.FirstName}",
                    NtAccount = u.NTAccount ?? "",
                    Email = u.EmailAddress ?? "",
                    Avatar = "",
                    DeptName = u.DisplayName ?? "",
                    Status = true,
                    CreatedAt = DateTime.Now,
                    UpdatedAt = null,
                    DeletedAt = null
                }).ToList();

                result.total = data.total;
                result.rows = userList;
            }

            return ApiResponse<iUserResponseDto>.Ok(result);
        }
    }
}
