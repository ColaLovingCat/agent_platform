using CommonService.Application.DTOs;
using CommonService.Core.Models;

namespace CommonService.Application.Services.Interfaces
{
    public interface IAzureService
    {
        Task<string?> GetNTAccountAsync(AzureDto dto);
        AzureSettings GetSettings();
    }
}
