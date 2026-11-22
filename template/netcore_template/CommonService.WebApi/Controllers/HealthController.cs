using Microsoft.AspNetCore.Mvc;
using Microsoft.Extensions.Options;
using CommonService.Core.Models;

namespace CommonService.WebApi.Controllers
{
    [ApiController]
    [Route("api/health")]
    public class HealthController : ControllerBase
    {
        private readonly IOptions<AppSettings> _settings;
        public HealthController(IOptions<AppSettings> settings)
        {
            _settings = settings;
        }

        /// <summary>
        /// 健康检测
        /// </summary>
        [HttpGet]
        public ActionResult<ApiResponse<object>> Get()
        {
            var result = new
            {
                AppUrl = $"{_settings.Value.Protocol}://{_settings.Value.Hostname}:{_settings.Value.Port}{Request.Path}",
                RequestUrl = $"{Request.Scheme}://{Request.Host}{Request.Path}",
                RemoteIp = HttpContext.Connection.RemoteIpAddress?.ToString(),
                Timestamp = DateTime.UtcNow
            };
            return ApiResponse<object>.Ok(result);
        }
    }
}
