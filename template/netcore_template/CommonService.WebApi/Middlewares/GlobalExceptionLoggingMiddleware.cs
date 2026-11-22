using System.Diagnostics;
using System.Text.Json;
using CommonService.Core.Models;
using CommonService.Core.Utils;

namespace CommonService.WebApi.Middlewares
{
    public class GlobalExceptionLoggingMiddleware
    {
        private readonly RequestDelegate _next;

        public GlobalExceptionLoggingMiddleware(RequestDelegate next)
        {
            _next = next;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            var stopwatch = Stopwatch.StartNew();
            try
            {
                await _next(context);

                if (context.Response.StatusCode >= StatusCodes.Status500InternalServerError)
                {
                    LogHelper.Error(
                        "http/500",
                        $"Request returned {context.Response.StatusCode}: " +
                        $"{context.Request.Method} {context.Request.Path}; " +
                        $"traceId={context.TraceIdentifier}; elapsedMs={stopwatch.ElapsedMilliseconds}");
                }
            }
            catch (Exception ex)
            {
                var traceId = context.TraceIdentifier;
                LogHelper.Error(
                    "http/exception",
                    $"Unhandled exception: {context.Request.Method} {context.Request.Path}; " +
                    $"traceId={traceId}; elapsedMs={stopwatch.ElapsedMilliseconds}; " +
                    $"message={ex.Message}",
                    ex);

                if (context.Response.HasStarted) throw;

                context.Response.Clear();
                context.Response.StatusCode = StatusCodes.Status500InternalServerError;
                context.Response.ContentType = "application/json; charset=utf-8";
                await context.Response.WriteAsync(JsonSerializer.Serialize(
                    ApiResponse<object>.Fail($"Internal server error. TraceId: {traceId}")));
            }
        }
    }
}
