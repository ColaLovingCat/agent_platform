using CommonService.Application.DTOs;

namespace CommonService.Application.Services.Interfaces
{
    public interface IPortalAppsService
    {
        Task<IReadOnlyList<PortalAppDto>> GetListAsync();
        Task<string> AddAsync(PortalAppAddDto dto);
        Task<string> PublishAsync(
            string id,
            string version,
            string? name,
            string? description,
            string? icon,
            string? color,
            Stream zipStream,
            string zipFileName);
        Task<string> RollbackAsync(string id, string version);
        Task<string> DeleteAsync(string id, bool force);
    }
}
