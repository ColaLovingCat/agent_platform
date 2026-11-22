using CommonService.Core.DbContexts;
using CommonService.Core.Models;
using CommonService.Core.Repositories.Interfaces;
using Microsoft.EntityFrameworkCore;

namespace CommonService.Core.Repositories
{
    public class FeedbackRepository : IFeedbackRepository
    {
        private readonly AppDbContext _context;

        public FeedbackRepository(AppDbContext context)
        {
            _context = context;
        }

        public async Task AddTicketAsync(FeedbackTicket ticket)
        {
            _context.FeedbackTickets.Add(ticket);
            await _context.SaveChangesAsync();
        }

        public async Task UpdateTicketAsync(FeedbackTicket ticket)
        {
            _context.FeedbackTickets.Update(ticket);
            await _context.SaveChangesAsync();
        }

        public async Task RemoveTicketAsync(Guid id)
        {
            var files = await _context.FeedbackAttachments.Where(x => x.TicketID == id).ToListAsync();
            if (files.Count > 0)
                _context.FeedbackAttachments.RemoveRange(files);

            var replies = await _context.FeedbackReplies.Where(x => x.TicketID == id).ToListAsync();
            if (replies.Count > 0)
                _context.FeedbackReplies.RemoveRange(replies);

            var ticket = await _context.FeedbackTickets.FindAsync(id);
            if (ticket != null)
                _context.FeedbackTickets.Remove(ticket);

            await _context.SaveChangesAsync();
        }

        public async Task AddReplyAsync(FeedbackReply reply)
        {
            _context.FeedbackReplies.Add(reply);
            await _context.SaveChangesAsync();
        }

        public async Task AddAttachmentsAsync(IEnumerable<FeedbackAttachment> files)
        {
            var rows = files.ToList();
            if (rows.Count == 0) return;
            _context.FeedbackAttachments.AddRange(rows);
            await _context.SaveChangesAsync();
        }

        public Task<FeedbackTicket?> GetTicketAsync(Guid id)
        {
            return _context.FeedbackTickets
                .Include(x => x.Replies)
                .FirstOrDefaultAsync(x => x.ID == id);
        }

        public Task<List<FeedbackAttachment>> ListAttachmentsAsync(Guid ticketId)
        {
            return _context.FeedbackAttachments
                .AsNoTracking()
                .Where(x => x.TicketID == ticketId)
                .OrderBy(x => x.SortOrder)
                .ThenBy(x => x.CreatedAt)
                .ToListAsync();
        }

        public async Task<(List<FeedbackTicket> items, int total)> ListMineAsync(Guid userId, string? userno, int page, int size)
        {
            var no = (userno ?? "").Trim();
            var query = _context.FeedbackTickets.AsNoTracking().Where(x =>
                (userId != Guid.Empty && x.CreatedBy == userId)
                || (no.Length > 0 && x.CreatedByNo == no));
            return await PageAsync(query, page, size);
        }

        public async Task<(List<FeedbackTicket> items, int total)> ListQueueAsync(string? status, int page, int size)
        {
            var query = _context.FeedbackTickets.AsNoTracking().AsQueryable();
            if (!string.IsNullOrWhiteSpace(status))
            {
                var key = status.Trim().ToLower();
                query = key == "active"
                    ? query.Where(x => x.Status != "done")
                    : query.Where(x => x.Status == key);
            }
            return await PageAsync(query, page, size);
        }

        private static async Task<(List<FeedbackTicket> items, int total)> PageAsync(
            IQueryable<FeedbackTicket> query, int page, int size)
        {
            var total = await query.CountAsync();
            var items = await query
                .Include(x => x.Replies)
                .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
                .Skip((page - 1) * size)
                .Take(size)
                .ToListAsync();
            return (items, total);
        }

        public Task<int> CountOpenAsync()
        {
            return _context.FeedbackTickets.CountAsync(x => x.Status == "open");
        }

        public async Task<Dictionary<string, int>> CountQueueByStatusAsync()
        {
            var rows = await _context.FeedbackTickets.AsNoTracking()
                .GroupBy(x => x.Status)
                .Select(g => new { g.Key, Count = g.Count() })
                .ToListAsync();
            return rows.ToDictionary(x => x.Key, x => x.Count, StringComparer.OrdinalIgnoreCase);
        }
    }
}
