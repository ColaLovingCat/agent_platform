using System.Net.Http.Json;
using System.Text.Json;
using Microsoft.Extensions.Options;
using CommonService.Application.DTOs;
using CommonService.Application.Services.Interfaces;
using CommonService.Core.Models;
using AutoMapper;

namespace CommonService.Application.Services
{
    public class iUserService : IiUserService
    {

        private readonly HttpClient _httpClient;
        private readonly iUserSettings _settings;
        private readonly IMapper _mapper;

        public iUserService(IHttpClientFactory httpClientFactory, IOptions<iUserSettings> settings, IMapper mapper)
        {
            _httpClient = httpClientFactory.CreateClient();
            _settings = settings.Value;
            _mapper = mapper;
        }

        public async Task<iUserResultDto> SearchAsync(iUserSearchDto dto)
        {
            var result = new iUserResultDto();

            try
            {
                var query = new List<string>();
                if (!string.IsNullOrWhiteSpace(dto.ntAccount)) query.Add($"param.nTAcc={Uri.EscapeDataString(dto.ntAccount)}");
                if (!string.IsNullOrWhiteSpace(dto.userno)) query.Add($"param.sapPNR={Uri.EscapeDataString(dto.userno)}");
                if (!string.IsNullOrWhiteSpace(dto.username)) query.Add($"param.userName={Uri.EscapeDataString(dto.username)}");

                query.Add($"param.page={Uri.EscapeDataString(dto.index.ToString())}");

                var url = $"{_settings.Host}/api/User/GetUserInfo?{string.Join("&", query)}";
                var response = await _httpClient.GetAsync(url);
                var responseStr = await response.Content.ReadAsStringAsync();

                return JsonSerializer.Deserialize<iUserResultDto>(responseStr);
            }
            catch { }

            return result;
        }

        public async Task<UserInfo?> GetUserInfoAsync(string? userno, string? ntAccount)
        {
            var iusers = userno != null
                ? await SearchAsync(new iUserSearchDto
                {
                    userno = userno
                })
                : await SearchAsync(new iUserSearchDto
                {
                    ntAccount = ntAccount
                });

            if (iusers.total == 0)
                return null;

            // 转换成user信息
            var iuser = iusers.rows[0];
            var user =  new UserInfo
            {
                ID = Guid.NewGuid(),
                Userno = iuser.SapPNR ?? "",
                Username = $"{iuser.LastName} {iuser.FirstName}",
                NtAccount = iuser.NTAccount ?? "",
                Email = iuser.EmailAddress ?? "",
                Avatar = "",
                DeptName = iuser.DisplayName ?? "",
                Status = true,
                CreatedAt = DateTime.Now,
                UpdatedAt = null,
                DeletedAt = null
            };
            return user;
        }

        public async Task<iUserLoginResponseDto?> LoginAsync(iUserLoginDto dto)
        {
            var url = $"{_settings.Host}/api/Account/NtAccountAndUserName";
            var response = await _httpClient.PostAsJsonAsync(url, dto);
            if (response.IsSuccessStatusCode)
            {
                var responseStr = await response.Content.ReadAsStringAsync();

                return JsonSerializer.Deserialize<iUserLoginResponseDto>(responseStr);
            }

            return null;
        }
    }
}
