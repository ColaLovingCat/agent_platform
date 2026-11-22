using CommonService.Application.DTOs;

namespace CommonService.Application.Services.Interfaces
{
    public interface ILaunchHandoffService
    {
        Task<LaunchHandoffIdDto> SaveAsync(LaunchHandoffSaveDto dto, Guid? userId, string? userno);
        Task<LaunchHandoffView?> GetInfoAsync(Guid requestId);
    }
}
