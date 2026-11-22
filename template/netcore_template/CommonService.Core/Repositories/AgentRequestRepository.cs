using CommonService.Core.DbContexts;
using CommonService.Core.Models;
using CommonService.Core.Repositories.Interfaces;
using CommonService.Core.Utils;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.ChangeTracking;

namespace CommonService.Core.Repositories
{
    public class AgentRequestRepository : BasicRepository<AgentRequest>, IAgentRequestRepository
    {
        public AgentRequestRepository(AppDbContext context) : base(context)
        {
        }

        public IQueryable<AgentRequest> QueryActive()
        {
            return _context.AgentRequests.Where(x => x.DeletedAt == null);
        }

        public IQueryable<AgentRequest> QueryActiveWithForm()
        {
            return QueryActive();
        }

        public IQueryable<AgentRequest> QueryActiveForList()
        {
            return QueryActive()
                .Include(x => x.CostSavings)
                .Include(x => x.FormServers)
                .Include(x => x.Token)
                .Include(x => x.AiOptions);
        }

        public async Task<AgentRequest?> GetActiveByIdAsync(Guid id)
        {
            return await QueryActive()
                .Include(x => x.FormDatasets)
                .Include(x => x.FormServers)
                .Include(x => x.Token)
                .Include(x => x.CostSavings)
                .Include(x => x.Rpps)
                .Include(x => x.AiOptions)
                .Include(x => x.Attachments)
                .Include(x => x.Stages)
                .Include(x => x.Checks)
                .Include(x => x.Develop)
                .Include(x => x.FlowRoi)
                .Include(x => x.Release!).ThenInclude(r => r.Items)
                .FirstOrDefaultAsync(x => x.ID == id);
        }

        public async Task<List<AgentRequestDataset>> GetActiveDatasetsAsync()
        {
            return await _context.AgentRequestDatasets
                .Where(x => x.DeletedAt == null && x.IsEnabled)
                .OrderBy(x => x.Category)
                .ThenBy(x => x.Name)
                .ToListAsync();
        }

        public async Task<List<AgentRequestServer>> GetActiveServersAsync()
        {
            return await _context.AgentRequestServers
                .Where(x => x.DeletedAt == null && x.IsEnabled)
                .OrderBy(x => x.Type)
                .ThenBy(x => x.Name)
                .ToListAsync();
        }

        public Task SaveChangesAsync() => _context.SaveChangesAsync();

        public string DescribePendingChanges()
        {
            var pending = _context.ChangeTracker.Entries()
                .Where(e => e.State != EntityState.Unchanged && e.State != EntityState.Detached)
                .Select(DescribeEntry)
                .ToList();
            return pending.Count == 0 ? "(none)" : string.Join(", ", pending);
        }

        private static string DescribeEntry(EntityEntry entry)
        {
            var name = entry.Entity.GetType().Name;
            if (entry.Entity is AgentRequestFormCostSaving cs)
                return $"{name}({entry.State},kind={cs.Kind},client={cs.ClientId})";
            if (entry.Entity is AgentRequestAttachment att)
                return $"{name}({entry.State},category={att.Category},uid={att.Uid},id={att.ID})";
            if (entry.Entity is AgentRequestFormServer fs)
                return $"{name}({entry.State},type={fs.Type},code={fs.ServerCode},id={fs.ID})";
            if (entry.Entity is AgentRequestFormDataset ds)
                return $"{name}({entry.State},code={ds.DatasetCode},id={ds.ID})";
            if (entry.Entity is AgentRequest main)
                return $"{name}({entry.State},id={main.ID})";
            if (entry.Metadata.FindPrimaryKey()?.Properties.FirstOrDefault()?.Name is { } pk)
            {
                var keyVal = entry.Property(pk).CurrentValue;
                return $"{name}({entry.State},{pk}={keyVal})";
            }
            return $"{name}({entry.State})";
        }

        public void EnsureStagesLoaded(AgentRequest entity)
        {
            if (entity.Stages.Count > 0) return;

            var rows = _context.AgentRequestFlowStages
                .Where(s => s.RequestID == entity.ID)
                .OrderBy(s => s.SortOrder)
                .ToList();
            foreach (var row in rows)
                entity.Stages.Add(row);
        }

        private static string RequestLogTag => LogHelper.ScopeTag ?? "request/save";

        public void RemoveFormLines(AgentRequest entity)
        {
            var requestId = entity.ID;
            var datasets = RemoveNavLines(entity.FormDatasets, requestId);
            var servers = RemoveNavLines(entity.FormServers, requestId);
            var rpps = RemoveNavLines(entity.Rpps, requestId);
            var costSavings = RemoveNavLines(entity.CostSavings, requestId);

            LogHelper.Info(RequestLogTag,
                $"RemoveFormLines: requestId={requestId} " +
                $"removed datasets={datasets} servers={servers} rpps={rpps} costSavings={costSavings}");
        }

        public void AddFormDataset(AgentRequest entity, AgentRequestFormDataset row)
        {
            row.ID = Guid.NewGuid();
            row.RequestID = entity.ID;
            _context.AgentRequestFormDatasets.Add(row);
            entity.FormDatasets.Add(row);
        }

        public void AddFormServer(AgentRequest entity, AgentRequestFormServer row)
        {
            row.ID = Guid.NewGuid();
            row.RequestID = entity.ID;
            _context.AgentRequestFormServers.Add(row);
            entity.FormServers.Add(row);
        }

        public void AddFormRpp(AgentRequest entity, AgentRequestFormRpp row)
        {
            row.ID = Guid.NewGuid();
            row.RequestID = entity.ID;
            _context.AgentRequestFormRpps.Add(row);
            entity.Rpps.Add(row);
        }

        public void AddCostSaving(AgentRequest entity, AgentRequestFormCostSaving row)
        {
            row.ID = Guid.NewGuid();
            row.RequestID = entity.ID;
            _context.AgentRequestFormCostSavings.Add(row);
            entity.CostSavings.Add(row);
        }

        public void SetCostSavings(AgentRequest entity, IEnumerable<AgentRequestFormCostSaving> rows)
        {
            var list = rows.ToList();
            LogHelper.Info(RequestLogTag,
                $"SetCostSavings: requestId={entity.ID} rows={list.Count} " +
                $"personnel={list.Count(x => x.Kind == "personnel")} manual={list.Count(x => x.Kind == "manual_efficiency")} additional={list.Count(x => x.Kind == "additional")} payment_outside={list.Count(x => x.Kind == "payment_outside")}");

            foreach (var row in list)
                AddCostSaving(entity, row);
        }

        public void AddAttachment(AgentRequest entity, AgentRequestAttachment row)
        {
            row.ID = Guid.NewGuid();
            row.RequestID = entity.ID;
            _context.AgentRequestAttachments.Add(row);
            entity.Attachments.Add(row);
        }

        public void SetBasicAttachments(AgentRequest entity, IEnumerable<AgentRequestAttachment> rows)
        {
            var list = rows.ToList();
            LogHelper.Info(RequestLogTag,
                $"SetBasicAttachments: requestId={entity.ID} rows={list.Count}");
            foreach (var row in list)
                AddAttachment(entity, row);
        }

        public void FinalizeFormLines(AgentRequest entity)
        {
            var requestId = entity.ID;
            var fixedCount = 0;
            var detachedCount = 0;
            fixedCount += EnsureInserted(entity.FormDatasets);
            fixedCount += EnsureInserted(entity.FormServers);
            fixedCount += EnsureInserted(entity.Rpps);
            fixedCount += EnsureInserted(entity.CostSavings);
            fixedCount += EnsureInserted(entity.Attachments);
            detachedCount += DetachOrphanUpdates<AgentRequestFormDataset>(requestId, entity.FormDatasets);
            detachedCount += DetachOrphanUpdates<AgentRequestFormServer>(requestId, entity.FormServers);
            detachedCount += DetachOrphanUpdates<AgentRequestFormRpp>(requestId, entity.Rpps);
            detachedCount += DetachOrphanUpdates<AgentRequestFormCostSaving>(requestId, entity.CostSavings);
            detachedCount += DetachOrphanUpdates<AgentRequestAttachment>(requestId, entity.Attachments);

            if (fixedCount > 0 || detachedCount > 0)
            {
                LogHelper.Info(RequestLogTag,
                    $"FinalizeFormLines: requestId={requestId} reassertAdded={fixedCount} detachedOrphans={detachedCount}");
            }
        }

        public void FinalizeFlowLines(AgentRequest entity)
        {
            var requestId = entity.ID;
            var fixedCount = 0;
            var detachedCount = 0;
            fixedCount += EnsureInserted(entity.Checks);
            if (entity.Release != null)
                fixedCount += EnsureInserted(entity.Release.Items);
            detachedCount += DetachOrphanUpdates<AgentRequestFlowCheck>(requestId, entity.Checks);
            if (entity.Release != null)
                detachedCount += DetachOrphanUpdates<AgentRequestFlowReleaseItem>(requestId, entity.Release.Items);

            if (fixedCount > 0 || detachedCount > 0)
            {
                LogHelper.Info(RequestLogTag,
                    $"FinalizeFlowLines: requestId={requestId} reassertAdded={fixedCount} detachedOrphans={detachedCount}");
            }
        }

        public void AddFlowCheck(AgentRequest entity, AgentRequestFlowCheck row)
        {
            row.ID = Guid.NewGuid();
            row.RequestID = entity.ID;
            _context.AgentRequestFlowChecks.Add(row);
            entity.Checks.Add(row);
        }

        public void AddReleaseItem(AgentRequest entity, AgentRequestFlowReleaseItem row)
        {
            row.ID = Guid.NewGuid();
            row.RequestID = entity.ID;
            _context.AgentRequestFlowReleaseItems.Add(row);
            entity.Release!.Items.Add(row);
        }

        private int EnsureInserted<T>(ICollection<T> nav) where T : class
        {
            var count = 0;
            foreach (var item in nav)
            {
                var entry = _context.Entry(item);
                if (entry.State == EntityState.Added) continue;
                LogHelper.Info(RequestLogTag,
                    $"EnsureInserted: {typeof(T).Name} state={entry.State} -> Added");
                entry.State = EntityState.Added;
                count++;
            }
            return count;
        }

        private int DetachOrphanUpdates<T>(Guid requestId, ICollection<T> nav) where T : class
        {
            var live = nav.ToHashSet();
            var count = 0;
            foreach (var entry in _context.ChangeTracker.Entries<T>().ToList())
            {
                if (entry.State is EntityState.Detached or EntityState.Added or EntityState.Deleted) continue;
                if (entry.Property("RequestID").CurrentValue is not Guid rid || rid != requestId) continue;
                if (live.Contains(entry.Entity)) continue;

                var id = entry.Property("ID").CurrentValue;
                LogHelper.Info(RequestLogTag,
                    $"DetachOrphanUpdates: {typeof(T).Name} state={entry.State} id={id}");
                entry.State = EntityState.Detached;
                count++;
            }
            return count;
        }

        private int RemoveNavLines<T>(ICollection<T> nav, Guid requestId) where T : class
        {
            var snapshot = nav.ToList();
            if (snapshot.Count > 0)
                _context.RemoveRange(snapshot);
            nav.Clear();
            RemoveTrackedOrphans<T>(requestId, snapshot);
            return snapshot.Count;
        }

        private void RemoveTrackedOrphans<T>(Guid requestId, List<T> alreadyRemoved) where T : class
        {
            foreach (var entry in _context.ChangeTracker.Entries<T>().ToList())
            {
                if (entry.State == EntityState.Detached) continue;
                if (entry.Property("RequestID").CurrentValue is not Guid rid || rid != requestId) continue;
                if (alreadyRemoved.Contains(entry.Entity)) continue;
                _context.Remove(entry.Entity);
            }
        }

        public void RemoveAttachments(AgentRequest entity, string category)
        {
            var requestId = entity.ID;
            var rows = entity.Attachments.Where(a => a.Category == category).ToList();
            if (rows.Count > 0)
                _context.AgentRequestAttachments.RemoveRange(rows);
            foreach (var row in rows)
                entity.Attachments.Remove(row);
            RemoveTrackedAttachmentOrphans(requestId, category, rows);
        }

        private void RemoveTrackedAttachmentOrphans(
            Guid requestId,
            string category,
            List<AgentRequestAttachment> alreadyRemoved)
        {
            foreach (var entry in _context.ChangeTracker.Entries<AgentRequestAttachment>().ToList())
            {
                if (entry.State == EntityState.Detached) continue;
                if (entry.Property("RequestID").CurrentValue is not Guid rid || rid != requestId) continue;
                if (!string.Equals(entry.Entity.Category, category, StringComparison.OrdinalIgnoreCase)) continue;
                if (alreadyRemoved.Contains(entry.Entity)) continue;
                LogHelper.Info(RequestLogTag,
                    $"RemoveTrackedAttachmentOrphans: state={entry.State} id={entry.Entity.ID} category={category}");
                _context.Remove(entry.Entity);
            }
        }

        public void RemoveChecks(IEnumerable<AgentRequestFlowCheck> checks)
        {
            _context.AgentRequestFlowChecks.RemoveRange(checks.ToList());
        }

        public void RemoveReleaseItems(AgentRequestFlowRelease release)
        {
            _context.AgentRequestFlowReleaseItems.RemoveRange(release.Items);
            release.Items.Clear();
        }

        public void RemoveReleaseItem(AgentRequestFlowReleaseItem item)
        {
            _context.AgentRequestFlowReleaseItems.Remove(item);
        }
    }
}
