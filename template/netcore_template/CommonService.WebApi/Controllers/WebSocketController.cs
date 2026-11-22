using CommonService.Core.Models;
using CommonService.WebApi.Middlewares;
using Microsoft.AspNetCore.Mvc;

namespace CommonService.WebApi.Controllers
{
    [ApiController]
    [Route("api/ws")]
    public class WebSocketController : ControllerBase
    {
        private readonly WebSocketConnectionManager _manager;

        public WebSocketController(WebSocketConnectionManager manager)
        {
            _manager = manager;
        }

        /// <summary>
        /// 发送通讯信息 to > socketID：单一通讯 serverID或留空：广播
        /// </summary>
        [HttpPost("send")]
        public async Task<ApiResponse<string>> SendToSocket([FromBody] WsMessage dto)
        {
            var result = await _manager.SendMessagebyIDAsync(dto.to, dto);
            if (result != "None") { return ApiResponse<string>.Ok(result); }
            else { return ApiResponse<string>.Fail(result); }
        }

        /// <summary>
        /// 获取所有已连接的 socketID列表
        /// </summary>
        [HttpGet("list")]
        public ApiResponse<IEnumerable<string>> GetSocketList()
        {
            var list = _manager.GetAllSocketIds();
            return ApiResponse<IEnumerable<string>>.Ok(list);
        }
    }
}
