using CommonService.Core.Utils;
using Microsoft.AspNetCore.Mvc;

namespace CommonService.WebApi.Controllers
{
    [ApiController]
    [Route("api/logs")]
    public class LogsController : ControllerBase
    {
        public class LogsDto
        {
            public string Level { get; set; } = "Info"; // 默认级别
            public string Tag { get; set; } = "";
            public string Message { get; set; } = "";
        }

        private readonly string _logDirectory = Path.Combine(Directory.GetCurrentDirectory(), "Logs");

        /// <summary>
        /// 添加日志
        /// </summary>
        /// <param name="dto">日志信息</param>
        /// <remarks>
        /// 示例：
        /// { "level": "info", "tag": "login", "message": "success" }
        /// 结果：
        /// [2025-05-28 13:59:58 INF] [login] success
        /// </remarks>
        [HttpPost]
        public IActionResult Post([FromBody] LogsDto dto)
        {
            switch (dto.Level.ToLower())
            {
                case "info":
                    LogHelper.Info(dto.Tag, dto.Message);
                    break;
                case "warn":
                case "warning":
                    LogHelper.Warning(dto.Tag, dto.Message);
                    break;
                case "error":
                    LogHelper.Error(dto.Tag, dto.Message);
                    break;
                default:
                    LogHelper.Info(dto.Tag, dto.Message);
                    break;
            }

            return Ok(new { status = true });
        }

        /// <summary>
        /// 基于日期查询日志
        /// </summary>
        /// <param name="date">日志日期</param>
        /// <remarks>
        /// 示例：
        /// 20250501
        /// </remarks>
        [HttpGet("{date}")]
        public IActionResult GetLog(string date)
        {
            var fileName = $"system-{date}.log";
            var filePath = Path.Combine(_logDirectory, fileName);

            if (!System.IO.File.Exists(filePath))
                return NotFound($"Log file for {date} not found.");

            try
            {
                using var stream = new FileStream(filePath, FileMode.Open, FileAccess.Read, FileShare.ReadWrite);
                using var reader = new StreamReader(stream);
                var logContent = reader.ReadToEnd();
                return Content(logContent, "text/plain");
            }
            catch (IOException ex)
            {
                return StatusCode(500, $"Error reading log file: {ex.Message}");
            }
        }
    }
}
