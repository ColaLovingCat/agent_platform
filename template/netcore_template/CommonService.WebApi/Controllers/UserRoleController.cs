using AutoMapper;
using Microsoft.AspNetCore.Mvc;
using CommonService.Application.DTOs;
using CommonService.Application.Services.Interfaces;
using CommonService.Core.Models;

namespace CommonService.WebApi.Controllers
{
    [ApiController]
    [Route("api/roles")]
    public class UserRoleController : ControllerBase
    {

        private readonly IUserRoleService _service;
        private readonly IMapper _mapper;

        public UserRoleController(IUserRoleService service, IMapper mapper)
        {
            _service = service;
            _mapper = mapper;
        }

        /// <summary>
        /// 获取列表
        /// </summary>
        [HttpGet("getlist")]
        public async Task<ActionResult<ApiResponse<IEnumerable<RoleResponseDto>>>> GetAll()
        {
            var list = await _service.GetAllAsync();
            var result = _mapper.Map<IEnumerable<RoleResponseDto>>(list);
            return ApiResponse<IEnumerable<RoleResponseDto>>.Ok(result);
        }

        /// <summary>
        /// 获取信息
        /// </summary>
        [HttpGet("getinfos")]
        public async Task<ActionResult<ApiResponse<RoleResponseDto>>> GetInfosByID(Guid id)
        {
            var role = await _service.GetByIDAsync(id);
            var result = _mapper.Map<RoleResponseDto>(role);
            return role == null ? ApiResponse<RoleResponseDto>.Fail("角色不存在") : ApiResponse<RoleResponseDto>.Ok(result);
        }

        /// <summary>
        /// 创建或更新
        /// </summary>
        [HttpPost("save")]
        public async Task<ActionResult<ApiResponse<string>>> AddorUpdate([FromBody] RoleSaveDto dto)
        {
            var result = dto.ID != "" ? await _service.UpdateAsync(dto) : await _service.AddAsync(dto);
            return result == ResultStatus.OK ? ApiResponse<string>.Ok(result) : ApiResponse<string>.Fail(result);
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
