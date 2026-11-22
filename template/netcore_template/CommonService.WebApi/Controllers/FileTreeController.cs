using CommonService.Application.DTOs;
using CommonService.Application.Services.Interfaces;
using Microsoft.AspNetCore.Mvc;

namespace CommonService.WebApi.Controllers
{
    /// <summary>
    /// Agent 会话文件树元数据（扁平存储，前端拼树）
    /// </summary>
    [ApiController]
    [Route("api/filetree")]
    public class FileTreeController : ControllerBase
    {
        private readonly IFileTreeService _service;

        public FileTreeController(IFileTreeService service)
        {
            _service = service;
        }

        /// <summary>
        /// 按 session_id 列出文件（扁平数组）
        /// </summary>
        [HttpPost("getlist")]
        public async Task<ActionResult<AgentPlatformEnvelope<IReadOnlyList<SessionFileRecordDto>>>> GetList(
            [FromBody] SessionFileTreeListDto dto)
        {
            var result = await _service.ListBySessionAsync(dto.SessionId);
            if (!result.Ok)
            {
                return Ok(new AgentPlatformEnvelope<IReadOnlyList<SessionFileRecordDto>>
                {
                    status = 0,
                    result = Array.Empty<SessionFileRecordDto>(),
                });
            }

            return Ok(new AgentPlatformEnvelope<IReadOnlyList<SessionFileRecordDto>>
            {
                status = 1,
                result = result.Data ?? Array.Empty<SessionFileRecordDto>(),
            });
        }

        /// <summary>
        /// 新增或更新同路径文件（agent_id + session_id + fold_path + name 唯一）
        /// </summary>
        [HttpPost("add")]
        public async Task<ActionResult<AgentPlatformEnvelope<SessionFileRecordDto>>> Add(
            [FromBody] SessionFileAddDto dto)
        {
            var result = await _service.AddAsync(dto);
            if (!result.Ok || result.Data == null)
            {
                return Ok(new AgentPlatformEnvelope<SessionFileRecordDto>
                {
                    status = 0,
                    result = null,
                });
            }

            return Ok(new AgentPlatformEnvelope<SessionFileRecordDto>
            {
                status = 1,
                result = result.Data,
            });
        }

        /// <summary>
        /// 按 id 删除文件记录
        /// </summary>
        [HttpPost("delete")]
        public async Task<ActionResult<AgentPlatformEnvelope<string>>> Delete(
            [FromBody] SessionFileDeleteDto dto)
        {
            var result = await _service.DeleteAsync(dto);
            return Ok(new AgentPlatformEnvelope<string>
            {
                status = result.Ok ? 1 : 0,
                result = result.Ok ? string.Empty : result.Message,
            });
        }
    }
}
