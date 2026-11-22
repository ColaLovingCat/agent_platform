using CommonService.Core.Models;
using CommonService.Core.Utils;
using Microsoft.Extensions.Options;
using System.Net.WebSockets;
using System.Text.Json;
using System.Text;

namespace CommonService.WebApi.Middlewares
{
    public class WsMessage
    {
        public string connectionID { get; set; }
        public string from { get; set; }
        public string to { get; set; }
        public string category { get; set; }
        public string message { get; set; }
        public string remarks { get; set; }
        public DateTime timestamp { get; set; } = DateTime.UtcNow;
    }

    public class WebSocketMiddleware
    {
        private readonly RequestDelegate _next;
        private readonly WebSocketConnectionManager _manager;
        private readonly WebSocketSettings _settings;

        public WebSocketMiddleware(RequestDelegate next, WebSocketConnectionManager manager, IOptions<WebSocketSettings> settings)
        {
            _next = next;
            _manager = manager;
            _settings = settings.Value;
        }

        public async Task InvokeAsync(HttpContext context)
        {
            // 判断路径和是否是 WebSocket 请求
            if (context.Request.Path == _settings.Path && context.WebSockets.IsWebSocketRequest)
            {
                LogHelper.Info("WebSocket", $"New WebSocket at {_settings.Path}");

                try
                {
                    using var webSocket = await context.WebSockets.AcceptWebSocketAsync();
                    LogHelper.Info("WebSocket", "WebSocket connection established.");
                    await HandleWebSocketAsync(webSocket);
                }
                catch (Exception ex)
                {
                    LogHelper.Error("WebSocket", $"Exception during WebSocket handling: {ex.Message}", ex);
                    context.Response.StatusCode = 500;
                }
            }
            else
            {
                await _next(context);
            }
        }

        private async Task HandleWebSocketAsync(WebSocket webSocket)
        {
            // 注册连接
            var socketID = _manager.AddSocket(webSocket);
            LogHelper.Info("WebSocket", $"[{socketID}] connected.");

            // 返回该连接的唯一标识给客户端
            var initMsg = new WsMessage
            {
                category = "init",
                message = JsonSerializer.Serialize(new
                {
                    socketID = socketID,
                    serverID = _settings.ServerID
                })
            };
            await _manager.SendMessage(webSocket, initMsg);

            // 处理接收到的信息（需循环拼帧：单次 buffer 仅 4KB，大消息会分片）
            var buffer = new byte[1024 * 4];
            const long maxMessageBytes = 10 * 1024 * 1024; // 单条消息上限 10MB，防 OOM
            while (webSocket.State == WebSocketState.Open)
            {
                WebSocketReceiveResult result;
                string? json = null;
                try
                {
                    (result, json) = await ReceiveFullTextAsync(webSocket, buffer, maxMessageBytes);
                }
                catch (InvalidOperationException ex)
                {
                    LogHelper.Error("WebSocket", ex.Message, ex);
                    break;
                }
                catch (Exception ex)
                {
                    LogHelper.Error("WebSocket", $"Error receiving data: {ex.Message}", ex);
                    break;
                }

                if (result.MessageType == WebSocketMessageType.Close)
                {
                    LogHelper.Info("WebSocket", "Client initiated WebSocket close.");
                    break;
                }

                if (result.MessageType == WebSocketMessageType.Text && json != null)
                {
                    try
                    {
                        var options = new JsonSerializerOptions { PropertyNameCaseInsensitive = true };
                        var msg = JsonSerializer.Deserialize<WsMessage>(json, options);
                        if (msg != null)
                        {
                            await _manager.SendMessagebyIDAsync(msg.to, msg);
                        }
                        else
                        {
                            LogHelper.Warning("WebSocket", "Deserialized message is null.");
                        }
                    }
                    catch (Exception ex)
                    {
                        LogHelper.Error("WebSocket", $"Failed to deserialize message: {ex.Message}", ex);
                    }
                }
                else if (result.MessageType != WebSocketMessageType.Text)
                {
                    LogHelper.Warning("WebSocket", $"Unsupported message type: {result.MessageType}");
                }
            }

            try
            {
                await _manager.RemoveSocketAsync(socketID); // ✅ 从连接管理器移除
                LogHelper.Info("WebSocket", $"[{socketID}] disconnected and removed.");
            }
            catch (Exception ex)
            {
                LogHelper.Error("WebSocket", $"Failed to remove socket [{socketID}]: {ex.Message}", ex);
            }

            LogHelper.Info("WebSocket", "WebSocket connection closed.");
        }

        /// <summary>
        /// 循环 ReceiveAsync 直到 EndOfMessage，拼出完整文本帧。
        /// </summary>
        private static async Task<(WebSocketReceiveResult result, string? text)> ReceiveFullTextAsync(
            WebSocket webSocket,
            byte[] buffer,
            long maxMessageBytes)
        {
            using var ms = new MemoryStream();
            WebSocketReceiveResult result;
            do
            {
                result = await webSocket.ReceiveAsync(new ArraySegment<byte>(buffer), CancellationToken.None);
                if (result.MessageType == WebSocketMessageType.Close)
                {
                    return (result, null);
                }

                ms.Write(buffer, 0, result.Count);
                if (ms.Length > maxMessageBytes)
                {
                    throw new InvalidOperationException(
                        $"WebSocket message exceeds limit ({maxMessageBytes} bytes).");
                }
            }
            while (!result.EndOfMessage);

            if (result.MessageType != WebSocketMessageType.Text)
            {
                return (result, null);
            }

            return (result, Encoding.UTF8.GetString(ms.ToArray()));
        }
    }
}
