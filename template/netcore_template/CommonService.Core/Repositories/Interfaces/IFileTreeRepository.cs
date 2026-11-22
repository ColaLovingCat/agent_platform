using CommonService.Core.Models;

namespace CommonService.Core.Repositories.Interfaces
{
    public interface IFileTreeRepository
    {
        Task<List<FileTreeFile>> ListBySessionAsync(string sessionId);
        Task<FileTreeFile?> GetByIdAsync(Guid id);
        Task<FileTreeFile?> FindByPathAsync(string agentId, string sessionId, string foldPath, string name);
        Task AddAsync(FileTreeFile entity);
        Task UpdateAsync(FileTreeFile entity);
        Task DeleteAsync(FileTreeFile entity);
    }
}
