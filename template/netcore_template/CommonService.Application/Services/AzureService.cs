using System.IdentityModel.Tokens.Jwt;
using System.Net.Http.Headers;
using System.Net;
using System.Text.Json;
using Microsoft.Extensions.Options;
using CommonService.Application.DTOs;
using CommonService.Application.Services.Interfaces;
using CommonService.Core.Models;

namespace CommonService.Application.Services
{
    public class AzureService : IAzureService
    {
        private readonly IOptions<AzureSettings> _azureSettings;

        public AzureService(IOptions<AzureSettings> azureSettings)
        {
            _azureSettings = azureSettings;
        }

        public async Task<string?> GetNTAccountAsync(AzureDto dto)
        {
            var options = _azureSettings.Value;

            var postParams = new FormUrlEncodedContent(new[]
           {
              new KeyValuePair<string,string>("client_id",options.ClientID),
              new KeyValuePair<string,string>("scope",options.Scope),
              new KeyValuePair<string, string>("client_secret",options.ClientSecret),
              new KeyValuePair<string, string>("grant_type","authorization_code"),
              new KeyValuePair<string, string>("code",dto.Code),
              new KeyValuePair<string, string>("redirect_uri",dto.RedirectUri),
            });

            try
            {
                var httpClientHandler = new HttpClientHandler
                {
                    DefaultProxyCredentials = CredentialCache.DefaultCredentials
                };

                using var httpClient = new HttpClient(httpClientHandler)
                {
                    Timeout = TimeSpan.FromSeconds(120)
                };
                httpClient.DefaultRequestHeaders.Accept.Add(new MediaTypeWithQualityHeaderValue("application/json"));

                var result = await httpClient.PostAsync($"{options.Host}/token", postParams);

                if (result.IsSuccessStatusCode)
                {
                    var str = await result.Content.ReadAsStringAsync();

                    if (!string.IsNullOrWhiteSpace(str))
                    {
                        var json = JsonSerializer.Deserialize<Dictionary<string, object>>(str);
                        if (json != null && json.TryGetValue("access_token", out var accessTokenObj))
                        {
                            var accessToken = accessTokenObj.ToString();
                            var handler = new JwtSecurityTokenHandler();
                            var jwtToken = handler.ReadJwtToken(accessToken);

                            var upn = jwtToken.Claims.FirstOrDefault(c => c.Type == "upn")?.Value;
                            var name = jwtToken.Claims.FirstOrDefault(c => c.Type == "name")?.Value;

                            if (!string.IsNullOrEmpty(upn))
                            {
                                return upn.Split('@')[0];
                            }
                        }
                    }
                }
                else
                {
                    var errorContent = await result.Content.ReadAsStringAsync();
                    Console.WriteLine("Azure 返回错误: " + errorContent);
                }
            }
            catch (Exception ex)
            {
            }
            return null;
        }

        public AzureSettings GetSettings()
        {
            return _azureSettings.Value;
        }
    }
}
