using CommonService.Application.DTOs;
using CommonService.Application.Services;
using Microsoft.AspNetCore.Mvc;

namespace CommonService.WebApi.Controllers
{
    [ApiController]
    [Route("api/bridge")]
    public class HttpBridgeController : ControllerBase
    {
        private readonly IHttpBridgeService _bridgeService;

        public HttpBridgeController(IHttpBridgeService bridgeService)
        {
            _bridgeService = bridgeService;
        }

        /// <summary>
        /// 通用转发接口
        /// </summary>
        [HttpPost("execute")]
        public async Task<IActionResult> Execute([FromBody] ExternalRequestDto request)
        {
            if (string.IsNullOrEmpty(request.Url))
                return BadRequest("URL 不能为空");

            try
            {
                var result = await _bridgeService.SendAsync(request);
                return Ok(result);
            }
            catch (Exception ex)
            {
                return StatusCode(500, new { error = ex.Message });
            }
        }
    }
}
