using CommonService.Core.Models;

namespace CommonService.Core.Repositories.Interfaces
{
    public interface IFeedbackRepository
    {
        Task AddTicketAsync(FeedbackTicket ticket);
        Task UpdateTicketAsync(FeedbackTicket ticket);
        Task RemoveTicketAsync(Guid id);
        Task AddReplyAsync(FeedbackReply reply);
        Task AddAttachmentsAsync(IEnumerable<FeedbackAttachment> files);
        Task<FeedbackTicket?> GetTicketAsync(Guid id);
        Task<List<FeedbackAttachment>> ListAttachmentsAsync(Guid ticketId);
        Task<(List<FeedbackTicket> items, int total)> ListMineAsync(Guid userId, string? userno, int page, int size);
        Task<(List<FeedbackTicket> items, int total)> ListQueueAsync(string? status, int page, int size);
        Task<int> CountOpenAsync();
        Task<Dictionary<string, int>> CountQueueByStatusAsync();
    }
}
