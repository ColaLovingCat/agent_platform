using CommonService.Core.Models;
using CommonService.Core.Utils;
using Microsoft.Extensions.Options;
using System.Collections.Concurrent;
using System.Net.WebSockets;
using System.Text.Json;
using System.Text;

namespace CommonService.WebApi.Middlewares
{
    public class WebSocketConnectionManager
    {
        private readonly ConcurrentDictionary<string, WebSocket> _sockets = new();
        private readonly WebSocketSettings _settings;

        public WebSocketConnectionManager(IOptions<WebSocketSettings> settings)
        {
            _settings = settings.Value;
        }

        public async Task SendMessage(WebSocket socket, WsMessage message)
        {
            if (socket.State == WebSocketState.Open)
            {
                await socket.SendAsync(new ArraySegment<byte>(Encoding.UTF8.GetBytes(JsonSerializer.Serialize(message))), WebSocketMessageType.Text, true, CancellationToken.None);
            }
            else
            {
                LogHelper.Error("Websocket", "socket closed");
            }
        }

        public async Task<string> SendMessagebyIDAsync(string to, WsMessage message)
        {
            var result = "None";
            if (string.IsNullOrEmpty(to))
            {
                await BroadcastAsync(message);
                result = "Broadcast";
            }
            else if (to == _settings.ServerID)
            {
                await BroadcastAsync(message);
                result = "Server";
            }
            else if (_sockets.TryGetValue(to, out var socket) && socket.State == WebSocketState.Open)
            {
                await SendMessage(socket, message);
                result = to;
            }
            return result;
        }

        public async Task BroadcastAsync(WsMessage message)
        {
            foreach (var pair in _sockets)
            {
                var socket = pair.Value;
                await SendMessage(socket, message);
            }
        }

        public IEnumerable<string> GetAllSocketIds()
        {
            return _sockets.Keys;
        }

        public WebSocket? GetSocketById(string id)
        {
            _sockets.TryGetValue(id, out var socket);
            return socket;
        }

        public string AddSocket(WebSocket socket)
        {
            var id = Guid.NewGuid().ToString();
            _sockets.TryAdd(id, socket);
            return id;
        }

        public async Task RemoveSocketAsync(string id)
        {
            if (_sockets.TryRemove(id, out var socket))
            {
                await socket.CloseAsync(WebSocketCloseStatus.NormalClosure, "Closed by manager", CancellationToken.None);
            }
        }
    }
}
