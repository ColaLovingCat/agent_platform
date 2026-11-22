using CommonService.Application.DTOs;
using CommonService.Core.Models;

namespace CommonService.Application.Services.Interfaces
{
    public interface IFeedbackService
    {
        Task<FeedbackTicketView> SaveAsync(FeedbackSaveDto dto, FeedbackActor actor);
        Task<PagedResult<FeedbackTicketView>> GetListAsync(FeedbackListDto dto, FeedbackActor actor);
        Task<FeedbackTicketView?> GetInfosAsync(Guid id, FeedbackActor actor);
        Task<FeedbackTicketView?> ReplyAsync(FeedbackReplyDto dto, FeedbackActor actor);
        Task<FeedbackTicketView?> SaveStatusAsync(FeedbackStatusDto dto, FeedbackActor actor);
        Task<bool> RemoveAsync(Guid id, FeedbackActor actor);
        Task<int> PendingCountAsync(FeedbackActor actor);
        Task<FeedbackCountsView> GetCountsAsync(FeedbackActor actor);
    }

    public class FeedbackActor
    {
        public Guid UserId { get; set; }
        public string Userno { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public bool IsAdmin { get; set; }
    }
}
