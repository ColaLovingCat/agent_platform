using CommonService.Application.DTOs;

namespace CommonService.Application.Services.Interfaces
{
    public interface IFileTreeService
    {
        Task<(bool Ok, string Message, IReadOnlyList<SessionFileRecordDto>? Data)> ListBySessionAsync(string sessionId);
        Task<(bool Ok, string Message, SessionFileRecordDto? Data)> AddAsync(SessionFileAddDto dto);
        Task<(bool Ok, string Message)> DeleteAsync(SessionFileDeleteDto dto);
    }
}
