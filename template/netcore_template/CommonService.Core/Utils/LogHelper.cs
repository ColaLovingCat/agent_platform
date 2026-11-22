using Serilog;

namespace CommonService.Core.Utils
{
    public static class LogHelper
    {
        private static readonly ILogger _fileLogger;
        private static readonly AsyncLocal<string?> _scopeTag = new();

        /// <summary>When set (e.g. request/save, request/submit), nested logs follow this tag.</summary>
        public static string? ScopeTag
        {
            get => _scopeTag.Value;
            set => _scopeTag.Value = value;
        }

        static LogHelper()
        {
            // 创建只写入文件的 logger，不影响全局日志
            _fileLogger = new LoggerConfiguration()
                .WriteTo.File("Logs/system-.log",
                              rollingInterval: RollingInterval.Day,
                              retainedFileCountLimit: 7,
                              outputTemplate: "[{Timestamp:yyyy-MM-dd HH:mm:ss} {Level:u3}] {Message:lj}{NewLine}{Exception}")
                .CreateLogger();
        }

        public static void Info(string tag, string message)
        {
            _fileLogger.Information("[{Tag}] {Message}", tag, message);
        }

        public static void Error(string tag, string message = null, Exception ex = null)
        {
            _fileLogger.Error(ex, "[{Tag}] {Message}", tag, message ?? ex.Message);
        }

        public static void Warning(string tag, string message)
        {
            _fileLogger.Warning("[{Tag}] {Message}", tag, message);
        }

        public static void Debug(string tag, string message)
        {
            _fileLogger.Debug("[{Tag}] {Message}", tag, message);
        }
    }
}
