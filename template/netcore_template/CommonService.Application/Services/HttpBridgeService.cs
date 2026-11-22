using CommonService.Application.DTOs;
using System.Text;
using System.Text.Json;

namespace CommonService.Application.Services
{
    public interface IHttpBridgeService
    {
        Task<object?> SendAsync(ExternalRequestDto requestModel);
    }

    public class HttpBridgeService : IHttpBridgeService
    {
        private readonly HttpClient _httpClient;

        public HttpBridgeService(HttpClient httpClient)
        {
            _httpClient = httpClient;
        }

        public async Task<object?> SendAsync(ExternalRequestDto requestModel)
        {
            // 1. 创建请求消息
            var method = new HttpMethod(requestModel.Method.ToUpper());
            var request = new HttpRequestMessage(method, requestModel.Url);

            // 2. 如果是 POST/PUT 且有 Body，序列化并添加内容
            if (requestModel.Body != null && (method == HttpMethod.Post || method == HttpMethod.Put))
            {
                var json = JsonSerializer.Serialize(requestModel.Body);
                request.Content = new StringContent(json, Encoding.UTF8, "application/json");
            }

            // 3. 发送请求
            var response = await _httpClient.SendAsync(request);

            // 4. 读取结果
            var content = await response.Content.ReadAsStringAsync();

            // 如果返回的是 JSON，尝试解析成对象返回，否则直接返回字符串
            try
            {
                return JsonSerializer.Deserialize<object>(content);
            }
            catch
            {
                return content;
            }
        }
    }
}
