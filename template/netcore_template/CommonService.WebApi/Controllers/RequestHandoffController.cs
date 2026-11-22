using System.Security.Claims;
using CommonService.Application.DTOs;
using CommonService.Application.Services.Interfaces;
using CommonService.Core.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CommonService.WebApi.Controllers
{
    [ApiController]
    [Route("api/request")]
    public class RequestHandoffController : ControllerBase
    {
        private readonly ILaunchHandoffService _service;

        public RequestHandoffController(ILaunchHandoffService service)
        {
            _service = service;
        }

        [Authorize]
        [HttpPost("save_handoff")]
        public async Task<ActionResult<ApiResponse<LaunchHandoffIdDto>>> SaveHandoff([FromBody] LaunchHandoffSaveDto dto)
        {
            var token = (dto.Token ?? "").Trim();
            if (token.Length == 0)
                token = Request.Headers.Authorization.ToString().Trim();

            var saved = await _service.SaveAsync(
                new LaunchHandoffSaveDto
                {
                    AgentId = dto.AgentId,
                    Token = token,
                    NewContent = dto.NewContent,
                },
                CurrentUserId(),
                User.FindFirstValue("Userno"));
            return ApiResponse<LaunchHandoffIdDto>.Ok(saved);
        }

        [AllowAnonymous]
        [HttpGet("getinfo")]
        public Task<ActionResult<ApiResponse<LaunchHandoffView>>> GetInfoGet(
            [FromQuery] Guid? request_id,
            [FromQuery] Guid? id)
        {
            return GetInfoCore(request_id ?? id ?? Guid.Empty);
        }

        [AllowAnonymous]
        [HttpPost("getinfo")]
        public Task<ActionResult<ApiResponse<LaunchHandoffView>>> GetInfoPost([FromBody] LaunchHandoffGetDto? dto)
        {
            var id = dto?.RequestId ?? Guid.Empty;
            if (id == Guid.Empty) id = dto?.ID ?? Guid.Empty;
            return GetInfoCore(id);
        }

        private async Task<ActionResult<ApiResponse<LaunchHandoffView>>> GetInfoCore(Guid requestId)
        {
            var data = await _service.GetInfoAsync(requestId);
            if (data == null)
                return ApiResponse<LaunchHandoffView>.Fail("Not found.");
            return ApiResponse<LaunchHandoffView>.Ok(data);
        }

        private Guid? CurrentUserId()
        {
            var raw = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(raw, out var id) ? id : null;
        }
    }
}
