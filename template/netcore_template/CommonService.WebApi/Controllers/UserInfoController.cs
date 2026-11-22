using AutoMapper;
using CommonService.Application.DTOs;
using CommonService.Application.Services;
using CommonService.Application.Services.Interfaces;
using CommonService.Core.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Collections.Generic;
using System.Security.Claims;

namespace CommonService.WebApi.Controllers
{
    [ApiController]
    [Route("api/users")]
    public class UserInfoController : ControllerBase
    {
        private readonly IUserInfoService _service;
        private readonly IMapper _mapper;

        public UserInfoController(IUserInfoService service, IMapper mapper)
        {
            _service = service;
            _mapper = mapper;
        }

        /// <summary>
        /// 获取列表
        /// </summary>
        [HttpGet("getlist")]
        public async Task<ActionResult<ApiResponse<IEnumerable<UserResponseDto>>>> GetAll()
        {
            var list = await _service.GetAllAsync();
            var result = _mapper.Map<List<UserResponseDto>>(list);
            await _service.AttachMonthUsageAsync(result);
            return ApiResponse<IEnumerable<UserResponseDto>>.Ok(result);
        }

        /// <summary>
        /// 查询列表
        /// </summary>
        [HttpGet("search")]
        public async Task<ActionResult<ApiResponse<PagedResult<UserResponseDto>>>> GetAllbyFilter([FromQuery] UserSearchDto dto)
        {
            var filters = HttpContext.Request.Query
                .Where(kvp => !new[] { "Page", "Size", "Sort" }.Contains(kvp.Key, StringComparer.OrdinalIgnoreCase))
                .ToDictionary(kvp => kvp.Key, kvp => kvp.Value.ToString());
            dto.Filters = filters;

            var infos = await _service.GetByFilterAsync(dto);
            var items = _mapper.Map<List<UserResponseDto>>(infos.Items);
            await _service.AttachMonthUsageAsync(items);
            var result = new PagedResult<UserResponseDto>
            {
                Items = items,
                Pagination = infos.Pagination
            };
            return ApiResponse<PagedResult<UserResponseDto>>.Ok(result);
        }

        /// <summary>
        /// 获取信息
        /// </summary>
        [HttpGet("getinfos")]
        public async Task<ActionResult<ApiResponse<UserResponseDto>>> GetInfosByID(Guid id)
        {
            var user = await _service.GetByIDAsync(id);
            if (user == null)
                return ApiResponse<UserResponseDto>.Fail("用户不存在");
            var result = _mapper.Map<UserResponseDto>(user);
            await _service.AttachMonthUsageAsync(new[] { result });
            return ApiResponse<UserResponseDto>.Ok(result);
        }

        /// <summary>
        /// 当前用户本月 LLM 用量（人民币）
        /// </summary>
        [Authorize]
        [HttpPost("get_llm_usage")]
        public async Task<ActionResult<ApiResponse<LlmMonthUsageDto>>> GetLlmUsage()
        {
            var nt = User.FindFirst("NtAccount")?.Value;
            if (string.IsNullOrWhiteSpace(nt))
            {
                var userno = User.FindFirst("Userno")?.Value;
                if (!string.IsNullOrWhiteSpace(userno))
                {
                    var user = await _service.FindByUsernoAsync(userno);
                    nt = user?.NtAccount ?? userno;
                }
            }

            var data = await _service.GetMonthUsageAsync(nt);
            return ApiResponse<LlmMonthUsageDto>.Ok(data);
        }

        /// <summary>
        /// 创建或更新
        /// </summary>
        //[Authorize]
        [HttpPost("save")]
        public async Task<ActionResult<ApiResponse<string>>> AddorUpdate([FromBody] UserSaveDto dto)
        {
            var result = dto.ID != "" ? await _service.UpdateAsync(dto) : await _service.AddAsync(dto);
            return result == ResultStatus.OK ? ApiResponse<string>.Ok(result) : ApiResponse<string>.Fail(result);
        }

        /// <summary>
        /// 更新用户密码
        /// </summary>
        [HttpPost("update_password")]
        public async Task<ActionResult<ApiResponse<string>>> UpdatePassword([FromBody] UpdatePasswordDto dto)
        {
            var result = await _service.UpdatePasswordAsync(dto.ID, dto.NewPassword);
            return result == ResultStatus.OK ? ApiResponse<string>.Ok("密码更新成功") : ApiResponse<string>.Fail(result);
        }

        /// <summary>
        /// 管理员强制重置用户密码（随机生成新密码并返回）
        /// </summary>
        [HttpPost("reset_password")]
        public async Task<ActionResult<ApiResponse<string>>> ForceResetPassword([FromBody] GUIDDto dto)
        {
            var newPassword = await _service.ForceResetPasswordAsync(dto.ID);
            return newPassword != null ? ApiResponse<string>.Ok(newPassword) : ApiResponse<string>.Fail("用户不存在");
        }

        /// <summary>
        /// 删除
        /// </summary>
        [HttpPost("delete")]
        public async Task<ActionResult<ApiResponse<string>>> Delete(GUIDDto dto)
        {
            var result = await _service.DeleteAsync(dto.ID);
            return result == ResultStatus.OK ? ApiResponse<string>.Ok(result) : ApiResponse<string>.Fail(result);
        }
    }
}
