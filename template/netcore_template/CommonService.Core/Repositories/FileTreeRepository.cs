using CommonService.Core.DbContexts;
using CommonService.Core.Models;
using CommonService.Core.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace CommonService.Core.Repositories
{
    public class FileTreeRepository : IFileTreeRepository
    {
        private readonly AppDbContext _context;

        public FileTreeRepository(AppDbContext context)
        {
            _context = context;
        }

        public Task<List<FileTreeFile>> ListBySessionAsync(string sessionId)
        {
            return _context.FileTreeFiles
                .AsNoTracking()
                .Where(x => x.SessionID == sessionId)
                .OrderByDescending(x => x.UpdatedAt)
                .ThenBy(x => x.FoldPath)
                .ThenBy(x => x.Name)
                .ToListAsync();
        }

        public Task<FileTreeFile?> GetByIdAsync(Guid id)
        {
            return _context.FileTreeFiles.FirstOrDefaultAsync(x => x.ID == id);
        }

        public Task<FileTreeFile?> FindByPathAsync(string agentId, string sessionId, string foldPath, string name)
        {
            return _context.FileTreeFiles
                .FirstOrDefaultAsync(x =>
                    x.AgentID == agentId
                    && x.SessionID == sessionId
                    && x.FoldPath == foldPath
                    && x.Name == name);
        }

        public async Task AddAsync(FileTreeFile entity)
        {
            _context.FileTreeFiles.Add(entity);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateAsync(FileTreeFile entity)
        {
            _context.FileTreeFiles.Update(entity);
            await _context.SaveChangesAsync();
        }

        public async Task DeleteAsync(FileTreeFile entity)
        {
            _context.FileTreeFiles.Remove(entity);
            await _context.SaveChangesAsync();
        }
    }
}
