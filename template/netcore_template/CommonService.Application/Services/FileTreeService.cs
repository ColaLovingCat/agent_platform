using CommonService.Application.DTOs;
using CommonService.Application.Services.Interfaces;
using CommonService.Core.Models;
using CommonService.Core.Repositories.Interfaces;
using CommonService.Core.Utils;

namespace CommonService.Application.Services
{
    public class FileTreeService : IFileTreeService
    {
        private const string LogTag = "filetree/service";
        private readonly IFileTreeRepository _repository;

        public FileTreeService(IFileTreeRepository repository)
        {
            _repository = repository;
        }

        public async Task<(bool Ok, string Message, IReadOnlyList<SessionFileRecordDto>? Data)> ListBySessionAsync(string sessionId)
        {
            if (string.IsNullOrWhiteSpace(sessionId))
                return (false, "session_id is required", null);

            try
            {
                var rows = await _repository.ListBySessionAsync(sessionId.Trim());
                var data = rows.Select(ToRecordDto).ToList();
                return (true, string.Empty, data);
            }
            catch (Exception ex)
            {
                LogHelper.Error(LogTag, $"ListBySession failed: session_id={sessionId}", ex);
                return (false, "Failed to load session files", null);
            }
        }

        public async Task<(bool Ok, string Message, SessionFileRecordDto? Data)> AddAsync(SessionFileAddDto dto)
        {
            var agentId = dto.AgentId?.Trim() ?? string.Empty;
            var sessionId = dto.SessionId?.Trim() ?? string.Empty;
            var name = dto.Name?.Trim() ?? string.Empty;
            var url = dto.Url?.Trim() ?? string.Empty;
            var foldPath = NormalizeFoldPath(dto.FoldPath);

            if (string.IsNullOrWhiteSpace(agentId))
                return (false, "agent_id is required", null);
            if (string.IsNullOrWhiteSpace(sessionId))
                return (false, "session_id is required", null);
            if (string.IsNullOrWhiteSpace(name))
                return (false, "name is required", null);
            if (string.IsNullOrWhiteSpace(url))
                return (false, "url is required", null);

            try
            {
                var existing = await _repository.FindByPathAsync(agentId, sessionId, foldPath, name);
                var now = DateTime.UtcNow;

                if (existing != null)
                {
                    existing.Url = url;
                    existing.UpdatedAt = now;
                    await _repository.UpdateAsync(existing);
                    return (true, string.Empty, ToRecordDto(existing));
                }

                var created = new FileTreeFile
                {
                    ID = Guid.NewGuid(),
                    AgentID = agentId,
                    SessionID = sessionId,
                    FoldPath = foldPath,
                    Name = name,
                    Url = url,
                    UpdatedAt = now,
                };
                await _repository.AddAsync(created);
                return (true, string.Empty, ToRecordDto(created));
            }
            catch (Exception ex)
            {
                LogHelper.Error(LogTag, $"Add failed: agent_id={agentId}, session_id={sessionId}, name={name}", ex);
                return (false, "Failed to add session file", null);
            }
        }

        public async Task<(bool Ok, string Message)> DeleteAsync(SessionFileDeleteDto dto)
        {
            var idText = dto.Id?.Trim() ?? string.Empty;
            if (string.IsNullOrWhiteSpace(idText) || !Guid.TryParse(idText, out var id))
                return (false, "id is required");

            try
            {
                var existing = await _repository.GetByIdAsync(id);
                if (existing == null)
                    return (false, "file not found");

                await _repository.DeleteAsync(existing);
                return (true, string.Empty);
            }
            catch (Exception ex)
            {
                LogHelper.Error(LogTag, $"Delete failed: id={idText}", ex);
                return (false, "Failed to delete session file");
            }
        }

        internal static string NormalizeFoldPath(string? foldPath)
        {
            var trimmed = (foldPath ?? string.Empty).Trim().Replace('\\', '/').Trim('/');
            return trimmed.Length == 0 ? string.Empty : $"{trimmed}/";
        }

        private static SessionFileRecordDto ToRecordDto(FileTreeFile row)
        {
            return new SessionFileRecordDto
            {
                Id = row.ID.ToString(),
                AgentId = row.AgentID,
                SessionId = row.SessionID,
                FoldPath = row.FoldPath,
                Name = row.Name,
                Url = row.Url,
                UpdatedAt = row.UpdatedAt.ToString("yyyy-MM-dd HH:mm:ss"),
            };
        }
    }
}
