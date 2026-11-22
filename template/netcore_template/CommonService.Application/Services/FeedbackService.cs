using CommonService.Application.DTOs;
using CommonService.Application.Services.Interfaces;
using CommonService.Core.Models;
using CommonService.Core.Repositories.Interfaces;

namespace CommonService.Application.Services
{
    public class FeedbackService : IFeedbackService
    {
        private static readonly HashSet<string> Categories = new(StringComparer.OrdinalIgnoreCase)
        {
            "bug", "suggestion"
        };

        private static readonly HashSet<string> Statuses = new(StringComparer.OrdinalIgnoreCase)
        {
            "open", "processing", "done"
        };

        private readonly IFeedbackRepository _repository;

        public FeedbackService(IFeedbackRepository repository)
        {
            _repository = repository;
        }

        public async Task<FeedbackTicketView> SaveAsync(FeedbackSaveDto dto, FeedbackActor actor)
        {
            var content = (dto.Content ?? "").Trim();
            if (content.Length == 0)
                throw new InvalidOperationException("Content is required.");

            var category = Categories.Contains(dto.Category ?? "") ? dto.Category!.Trim().ToLower() : "bug";
            var title = (dto.Title ?? "").Trim();
            if (title.Length == 0)
                title = content.Length > 40 ? content[..40] : content;
            if (title.Length > 200) title = title[..200];

            var shots = NormalizeFiles(dto.Screenshots);

            var pageUrl = (dto.PageUrl ?? "").Trim();
            if (pageUrl.Length > 2000) pageUrl = pageUrl[..2000];

            var ticket = new FeedbackTicket
            {
                Category = category,
                Title = title,
                Content = content,
                PageUrl = pageUrl.Length == 0 ? null : pageUrl,
                Status = "open",
                CreatedBy = actor.UserId == Guid.Empty ? null : actor.UserId,
                CreatedByName = actor.Name,
                CreatedByNo = actor.Userno,
                CreatedAt = DateTime.UtcNow,
            };

            await _repository.AddTicketAsync(ticket);
            var files = ToAttachments(ticket.ID, null, shots);
            await _repository.AddAttachmentsAsync(files);
            return ToView(ticket, files, includeReplies: false);
        }

        public async Task<PagedResult<FeedbackTicketView>> GetListAsync(FeedbackListDto dto, FeedbackActor actor)
        {
            var scope = (dto.Scope ?? "mine").Trim().ToLower();
            var page = dto.Page < 1 ? 1 : dto.Page;
            var size = dto.Size < 1 ? 10 : Math.Min(dto.Size, 50);

            List<FeedbackTicket> rows;
            int total;
            if (scope == "queue")
            {
                if (!actor.IsAdmin)
                    throw new UnauthorizedAccessException("Admin only.");
                (rows, total) = await _repository.ListQueueAsync(dto.Status, page, size);
            }
            else
            {
                (rows, total) = await _repository.ListMineAsync(actor.UserId, actor.Userno, page, size);
            }

            return new PagedResult<FeedbackTicketView>
            {
                Items = rows.Select(x => ToView(x, Array.Empty<FeedbackAttachment>(), includeReplies: false)).ToList(),
                Pagination = new Pagination
                {
                    PageIndex = page,
                    PageSize = size,
                    TotalCount = total,
                },
            };
        }

        public async Task<FeedbackTicketView?> GetInfosAsync(Guid id, FeedbackActor actor)
        {
            var ticket = await _repository.GetTicketAsync(id);
            if (ticket == null) return null;
            if (!CanRead(ticket, actor))
                throw new UnauthorizedAccessException("Forbidden.");
            var files = await _repository.ListAttachmentsAsync(ticket.ID);
            return ToView(ticket, files, includeReplies: true);
        }

        public async Task<FeedbackTicketView?> ReplyAsync(FeedbackReplyDto dto, FeedbackActor actor)
        {
            var content = (dto.Content ?? "").Trim();
            var shots = NormalizeFiles(dto.Screenshots);
            if (content.Length == 0 && shots.Count == 0)
                throw new InvalidOperationException("Content is required.");

            var ticket = await _repository.GetTicketAsync(dto.ID);
            if (ticket == null) return null;
            if (!CanRead(ticket, actor))
                throw new UnauthorizedAccessException("Forbidden.");

            var reply = new FeedbackReply
            {
                TicketID = ticket.ID,
                Content = content,
                AuthorId = actor.UserId == Guid.Empty ? null : actor.UserId,
                AuthorName = actor.Name,
                IsAdmin = actor.IsAdmin,
                CreatedAt = DateTime.UtcNow,
            };
            await _repository.AddReplyAsync(reply);
            await _repository.AddAttachmentsAsync(ToAttachments(ticket.ID, reply.ID, shots));

            if (actor.IsAdmin)
                ticket.Status = "processing";
            ticket.UpdatedAt = DateTime.UtcNow;
            await _repository.UpdateTicketAsync(ticket);

            var fresh = await _repository.GetTicketAsync(ticket.ID);
            if (fresh == null) return null;
            var files = await _repository.ListAttachmentsAsync(ticket.ID);
            return ToView(fresh, files, includeReplies: true);
        }

        public async Task<FeedbackTicketView?> SaveStatusAsync(FeedbackStatusDto dto, FeedbackActor actor)
        {
            if (!actor.IsAdmin)
                throw new UnauthorizedAccessException("Admin only.");
            if (!Statuses.Contains(dto.Status ?? ""))
                throw new InvalidOperationException("Invalid status.");

            var ticket = await _repository.GetTicketAsync(dto.ID);
            if (ticket == null) return null;

            ticket.Status = dto.Status.Trim().ToLower();
            ticket.UpdatedAt = DateTime.UtcNow;
            await _repository.UpdateTicketAsync(ticket);

            var fresh = await _repository.GetTicketAsync(ticket.ID);
            if (fresh == null) return null;
            var files = await _repository.ListAttachmentsAsync(ticket.ID);
            return ToView(fresh, files, includeReplies: true);
        }

        public async Task<bool> RemoveAsync(Guid id, FeedbackActor actor)
        {
            var ticket = await _repository.GetTicketAsync(id);
            if (ticket == null) return false;
            if (!CanOwn(ticket, actor))
                throw new UnauthorizedAccessException("Forbidden.");
            await _repository.RemoveTicketAsync(id);
            return true;
        }

        public async Task<int> PendingCountAsync(FeedbackActor actor)
        {
            if (!actor.IsAdmin) return 0;
            return await _repository.CountOpenAsync();
        }

        public async Task<FeedbackCountsView> GetCountsAsync(FeedbackActor actor)
        {
            if (!actor.IsAdmin)
                throw new UnauthorizedAccessException("Admin only.");
            var map = await _repository.CountQueueByStatusAsync();
            map.TryGetValue("open", out var open);
            map.TryGetValue("processing", out var processing);
            return new FeedbackCountsView
            {
                Open = open,
                Processing = processing,
            };
        }

        private static bool CanRead(FeedbackTicket ticket, FeedbackActor actor)
        {
            if (actor.IsAdmin) return true;
            return CanOwn(ticket, actor);
        }

        private static bool CanOwn(FeedbackTicket ticket, FeedbackActor actor)
        {
            if (actor.UserId != Guid.Empty && ticket.CreatedBy == actor.UserId) return true;
            if (!string.IsNullOrWhiteSpace(actor.Userno) && ticket.CreatedByNo == actor.Userno) return true;
            return false;
        }

        private static List<FeedbackFileDto> NormalizeFiles(List<FeedbackFileDto>? files)
        {
            return (files ?? new List<FeedbackFileDto>())
                .Where(x => !string.IsNullOrWhiteSpace(x.Url))
                .Select(x => new FeedbackFileDto
                {
                    Url = x.Url.Trim(),
                    Name = (x.Name ?? "").Trim(),
                    Type = (x.Type ?? "").Trim(),
                })
                .Take(6)
                .ToList();
        }

        private static List<FeedbackAttachment> ToAttachments(Guid ticketId, Guid? replyId, List<FeedbackFileDto> files)
        {
            return files.Select((x, i) => new FeedbackAttachment
            {
                TicketID = ticketId,
                ReplyID = replyId,
                Url = x.Url.Length > 2000 ? x.Url[..2000] : x.Url,
                Name = x.Name.Length > 260 ? x.Name[..260] : x.Name,
                Type = x.Type.Length > 200 ? x.Type[..200] : x.Type,
                SortOrder = i,
                CreatedAt = DateTime.UtcNow,
            }).ToList();
        }

        private static List<FeedbackFileDto> MapFiles(IEnumerable<FeedbackAttachment> files)
        {
            return files
                .OrderBy(x => x.SortOrder)
                .ThenBy(x => x.CreatedAt)
                .Select(x => new FeedbackFileDto
                {
                    Url = x.Url,
                    Name = x.Name,
                    Type = x.Type,
                })
                .ToList();
        }

        private static FeedbackTicketView ToView(
            FeedbackTicket ticket,
            IReadOnlyList<FeedbackAttachment> files,
            bool includeReplies)
        {
            var shots = MapFiles(files.Where(x => x.ReplyID == null));

            var replies = (ticket.Replies ?? new List<FeedbackReply>())
                .OrderBy(x => x.CreatedAt)
                .Select(x => new FeedbackReplyView
                {
                    ID = x.ID,
                    Content = x.Content,
                    AuthorName = x.AuthorName,
                    IsAdmin = x.IsAdmin,
                    Screenshots = MapFiles(files.Where(f => f.ReplyID == x.ID)),
                    CreatedAt = x.CreatedAt,
                })
                .ToList();

            return new FeedbackTicketView
            {
                ID = ticket.ID,
                Category = ticket.Category,
                Title = ticket.Title,
                Content = ticket.Content,
                Screenshots = shots,
                PageUrl = ticket.PageUrl,
                Status = ticket.Status,
                CreatedByName = ticket.CreatedByName,
                CreatedByNo = ticket.CreatedByNo,
                CreatedAt = ticket.CreatedAt,
                UpdatedAt = ticket.UpdatedAt,
                ReplyCount = replies.Count,
                Replies = includeReplies ? replies : null,
            };
        }
    }
}
