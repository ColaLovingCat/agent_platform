using AutoMapper;
using CommonService.Application.DTOs;
using CommonService.Application.Services.Interfaces;
using CommonService.Core.Models;
using CommonService.Core.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CommonService.WebApi.Controllers
{
    [ApiController]
    [Route("api/auth")]
    public class AuthController : ControllerBase
    {
        private readonly IUserInfoService _userService;
        private readonly JwtHelper _jwtHelper;
        private readonly IMapper _mapper;
        private readonly LocalUserStore _localUsers;

        public AuthController(
            IUserInfoService userService,
            JwtHelper jwtHelper,
            IMapper mapper,
            LocalUserStore localUsers)
        {
            _userService = userService;
            _jwtHelper = jwtHelper;
            _mapper = mapper;
            _localUsers = localUsers;
        }

        /// <summary>
        /// 本地用户登录接口 [sso-local]
        /// 优先匹配 Data/local-users.json 中的 userno；未命中再查数据库。
        /// </summary>
        /// <param name="dto">登录信息</param>
        [HttpPost("login")]
        public async Task<ActionResult<ApiResponse<string>>> Login([FromBody] UserLoginDto dto)
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

            // 从数据库查询用户（工号，忽略大小写）
            var user = await _userService.FindByUsernoAsync(dto.Account);

            if (user == null)
                return ApiResponse<string>.Fail("用户不存在");

            if (!user.Status)
                return ApiResponse<string>.Fail("用户已注销");

            var isValid = AesEncryptionHelper.VerifyPassword(dto.Password, user.Password);
            if (!isValid)
                return ApiResponse<string>.Fail("密码不正确");

            await _userService.TouchLastLoginAsync(user.ID);

            var token = _jwtHelper.GenerateToken(user);
            LogHelper.Info("auth/login", $"Login Success: {user.Username}");
            Response.Headers.Add("Authorization", $"Bearer {token}");
            return ApiResponse<string>.Ok(token);
        }

        /// <summary>
        /// 通过 token 获取用户信息
        /// </summary>
        [Authorize]
        [HttpGet("getinfos")]
        public async Task<ActionResult<ApiResponse<UserResponseDto>>> GetUserInfo()
        {
            var userno = User.FindFirstValue("Userno");
            if (!string.IsNullOrEmpty(userno))
            {
                var localUser = _localUsers.FindByUserno(userno);
                if (localUser != null)
                {
                    var localResult = _mapper.Map<UserResponseDto>(localUser);
                    localResult.Roles = _localUsers.GetRoleNames(userno)
                        .Select(name => new RoleDto { RoleName = name, Remark = "" })
                        .ToList();
                    await _userService.AttachMonthUsageAsync(new[] { localResult });
                    return ApiResponse<UserResponseDto>.Ok(localResult);
                }
            }

            UserInfo? user = null;

            // SSO 用户已同步进本地库：优先按 token 中的用户 ID / 工号读库
            var userID = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            if (!string.IsNullOrEmpty(userID) && Guid.TryParse(userID, out var guid))
            {
                user = await _userService.GetByIDAsync(guid);
            }
            else if (!string.IsNullOrEmpty(userno))
            {
                user = await _userService.GetByPropsAsync("Userno", userno);
            }

            if (user == null)
                return ApiResponse<UserResponseDto>.Fail("用户不存在");

            var result = _mapper.Map<UserResponseDto>(user);
            await _userService.AttachMonthUsageAsync(new[] { result });
            return ApiResponse<UserResponseDto>.Ok(result);
        }
    }
}
