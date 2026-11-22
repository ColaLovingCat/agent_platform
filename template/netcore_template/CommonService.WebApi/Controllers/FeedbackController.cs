using System.Security.Claims;
using CommonService.Application.DTOs;
using CommonService.Application.Services.Interfaces;
using CommonService.Core.Models;
using CommonService.Core.Utils;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;

namespace CommonService.WebApi.Controllers
{
    [ApiController]
    [Authorize]
    [Route("api/feedback")]
    public class FeedbackController : ControllerBase
    {
        private const string AdminRole = "SystemAdmin";
        private readonly IFeedbackService _service;
        private readonly IUserInfoService _users;
        private readonly LocalUserStore _localUsers;

        public FeedbackController(
            IFeedbackService service,
            IUserInfoService users,
            LocalUserStore localUsers)
        {
            _service = service;
            _users = users;
            _localUsers = localUsers;
        }

        [HttpPost("save")]
        public async Task<IActionResult> Save([FromBody] FeedbackSaveDto dto)
        {
            try
            {
                var data = await _service.SaveAsync(dto, await BuildActorAsync());
                return Ok(ApiResponse<FeedbackTicketView>.Ok(data));
            }
            catch (Exception ex)
            {
                return Ok(ApiResponse<FeedbackTicketView>.Fail(ex.Message));
            }
        }

        [HttpPost("get_list")]
        public async Task<IActionResult> GetList([FromBody] FeedbackListDto? dto)
        {
            try
            {
                var data = await _service.GetListAsync(dto ?? new FeedbackListDto(), await BuildActorAsync());
                return Ok(ApiResponse<PagedResult<FeedbackTicketView>>.Ok(data));
            }
            catch (UnauthorizedAccessException ex)
            {
                return Ok(ApiResponse<PagedResult<FeedbackTicketView>>.Fail(ex.Message));
            }
            catch (Exception ex)
            {
                return Ok(ApiResponse<PagedResult<FeedbackTicketView>>.Fail(ex.Message));
            }
        }

        [HttpPost("get_infos")]
        public async Task<IActionResult> GetInfos([FromBody] FeedbackInfosDto dto)
        {
            try
            {
                var data = await _service.GetInfosAsync(dto.ID, await BuildActorAsync());
                if (data == null)
                    return Ok(ApiResponse<FeedbackTicketView>.Fail("Not found."));
                return Ok(ApiResponse<FeedbackTicketView>.Ok(data));
            }
            catch (UnauthorizedAccessException ex)
            {
                return Ok(ApiResponse<FeedbackTicketView>.Fail(ex.Message));
            }
            catch (Exception ex)
            {
                return Ok(ApiResponse<FeedbackTicketView>.Fail(ex.Message));
            }
        }

        [HttpPost("reply")]
        public async Task<IActionResult> Reply([FromBody] FeedbackReplyDto dto)
        {
            try
            {
                var data = await _service.ReplyAsync(dto, await BuildActorAsync());
                if (data == null)
                    return Ok(ApiResponse<FeedbackTicketView>.Fail("Not found."));
                return Ok(ApiResponse<FeedbackTicketView>.Ok(data));
            }
            catch (UnauthorizedAccessException ex)
            {
                return Ok(ApiResponse<FeedbackTicketView>.Fail(ex.Message));
            }
            catch (Exception ex)
            {
                return Ok(ApiResponse<FeedbackTicketView>.Fail(ex.Message));
            }
        }

        [HttpPost("save_status")]
        public async Task<IActionResult> SaveStatus([FromBody] FeedbackStatusDto dto)
        {
            try
            {
                var data = await _service.SaveStatusAsync(dto, await BuildActorAsync());
                if (data == null)
                    return Ok(ApiResponse<FeedbackTicketView>.Fail("Not found."));
                return Ok(ApiResponse<FeedbackTicketView>.Ok(data));
            }
            catch (UnauthorizedAccessException ex)
            {
                return Ok(ApiResponse<FeedbackTicketView>.Fail(ex.Message));
            }
            catch (Exception ex)
            {
                return Ok(ApiResponse<FeedbackTicketView>.Fail(ex.Message));
            }
        }

        [HttpPost("save_remove")]
        public async Task<IActionResult> SaveRemove([FromBody] FeedbackInfosDto dto)
        {
            try
            {
                var ok = await _service.RemoveAsync(dto.ID, await BuildActorAsync());
                if (!ok)
                    return Ok(ApiResponse<bool>.Fail("Not found."));
                return Ok(ApiResponse<bool>.Ok(true));
            }
            catch (UnauthorizedAccessException ex)
            {
                return Ok(ApiResponse<bool>.Fail(ex.Message));
            }
            catch (Exception ex)
            {
                return Ok(ApiResponse<bool>.Fail(ex.Message));
            }
        }

        [HttpPost("pending_count")]
        public async Task<IActionResult> PendingCount()
        {
            var count = await _service.PendingCountAsync(await BuildActorAsync());
            return Ok(ApiResponse<int>.Ok(count));
        }

        [HttpPost("get_counts")]
        public async Task<IActionResult> GetCounts()
        {
            try
            {
                var data = await _service.GetCountsAsync(await BuildActorAsync());
                return Ok(ApiResponse<FeedbackCountsView>.Ok(data));
            }
            catch (UnauthorizedAccessException ex)
            {
                return Ok(ApiResponse<FeedbackCountsView>.Fail(ex.Message));
            }
            catch (Exception ex)
            {
                return Ok(ApiResponse<FeedbackCountsView>.Fail(ex.Message));
            }
        }

        private async Task<FeedbackActor> BuildActorAsync()
        {
            var userno = User.FindFirst("Userno")?.Value
                ?? User.FindFirst(ClaimTypes.Name)?.Value
                ?? "";
            var idRaw = User.FindFirst(ClaimTypes.NameIdentifier)?.Value;
            Guid.TryParse(idRaw, out var userId);

            UserInfo? dbUser = null;
            if (userId != Guid.Empty)
                dbUser = await _users.GetByIDAsync(userId);
            if (dbUser == null && !string.IsNullOrWhiteSpace(userno))
                dbUser = await _users.FindByUsernoAsync(userno);
            var local = string.IsNullOrWhiteSpace(userno) ? null : _localUsers.FindByUserno(userno);

            var name = dbUser?.Username
                ?? local?.Username
                ?? userno;
            var isAdmin = (dbUser?.Roles ?? new List<UserLinks>())
                    .Any(x => string.Equals(x.UserRole?.RoleName, AdminRole, StringComparison.OrdinalIgnoreCase))
                || _localUsers.GetRoleNames(userno)
                    .Any(x => string.Equals(x, AdminRole, StringComparison.OrdinalIgnoreCase))
                || User.IsInRole(AdminRole);

            return new FeedbackActor
            {
                UserId = dbUser?.ID ?? (userId == Guid.Empty ? Guid.Empty : userId),
                Userno = userno,
                Name = string.IsNullOrWhiteSpace(name) ? userno : name,
                IsAdmin = isAdmin,
            };
        }
    }
}
