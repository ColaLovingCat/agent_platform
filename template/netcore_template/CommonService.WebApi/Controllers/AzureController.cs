using CommonService.Application.DTOs;
using CommonService.Application.Services.Interfaces;
using CommonService.Core.Models;
using CommonService.Core.Utils;
using Microsoft.AspNetCore.Mvc;

namespace CommonService.WebApi.Controllers
{
    [ApiController]
    [Route("api/azure")]
    public class AzureController : ControllerBase
    {
        private readonly IAzureService _azureService;
        private readonly IUserInfoService _userService;
        private readonly IiUserService _iuserService;
        private readonly JwtHelper _jwtHelper;

        public AzureController(
            IAzureService azureService,
            IUserInfoService userService,
            IiUserService iuserService,
            JwtHelper jwtHelper)
        {
            _azureService = azureService;
            _userService = userService;
            _iuserService = iuserService;
            _jwtHelper = jwtHelper;
        }

        /// <summary>
        /// SSO 登录：
        /// 1) Azure 换取 NtAccount；
        /// 2) 先按 NtAccount 查本地库，命中则直接登录；
        /// 3) 未命中再调 iUser 取资料并写入本地库后登录。
        /// </summary>
        [HttpPost("login")]
        public async Task<ActionResult<ApiResponse<string>>> Login([FromBody] AzureDto dto)
        {
            var ntAccount = await _azureService.GetNTAccountAsync(dto);
            if (string.IsNullOrWhiteSpace(ntAccount))
                return ApiResponse<string>.Fail("域账号不存在");

            // 1) 先查本地（NtAccount）
            var user = await _userService.FindByNtAccountAsync(ntAccount);

            // 2) 没有 → iUser 取资料并入库
            if (user == null)
            {
                var profile = await _iuserService.GetUserInfoAsync(null, ntAccount);
                if (profile == null || string.IsNullOrWhiteSpace(profile.Userno))
                    return ApiResponse<string>.Fail("用户不存在");

                if (string.IsNullOrWhiteSpace(profile.NtAccount))
                    profile.NtAccount = ntAccount;

                user = await _userService.GetOrCreateFromProfileAsync(profile);
            }

            if (user == null)
                return ApiResponse<string>.Fail("用户不存在");

            if (!user.Status)
                return ApiResponse<string>.Fail("用户已注销");

            await _userService.TouchLastLoginAsync(user.ID);

            var token = _jwtHelper.GenerateToken(new UserInfo
            {
                ID = user.ID,
                Userno = user.Userno,
                NtAccount = user.NtAccount,
            });
            LogHelper.Info("azure/login", $"Login Success: {user.Username}");
            Response.Headers.Add("Authorization", $"Bearer {token}");
            return ApiResponse<string>.Ok(token);
        }

        /// <summary>
        /// 获取SSO配置
        /// </summary>
        [HttpGet("configs")]
        public ActionResult<ApiResponse<AzureSettings>> GetConfigs()
        {
            var config = _azureService.GetSettings();
            var sanitized = new AzureSettings
            {
                Host = config.Host + "/authorize",
                ClientID = config.ClientID,
                Scope = config.Scope,
                ResponseType = config.ResponseType,
                ClientSecret = "*"
            };
            return ApiResponse<AzureSettings>.Ok(sanitized);
        }
    }
}
