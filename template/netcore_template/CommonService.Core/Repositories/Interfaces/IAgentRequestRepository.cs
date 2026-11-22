using CommonService.Core.Models;

namespace CommonService.Core.Repositories.Interfaces
{
    public interface IAgentRequestRepository : IBasicRepository<AgentRequest>
    {
        Task<AgentRequest?> GetActiveByIdAsync(Guid id);
        IQueryable<AgentRequest> QueryActive();
        IQueryable<AgentRequest> QueryActiveWithForm();
        IQueryable<AgentRequest> QueryActiveForList();
        Task<List<AgentRequestDataset>> GetActiveDatasetsAsync();
        Task<List<AgentRequestServer>> GetActiveServersAsync();
        Task SaveChangesAsync();
        string DescribePendingChanges();
        void EnsureStagesLoaded(AgentRequest entity);
        void RemoveFormLines(AgentRequest entity);
        void AddFormDataset(AgentRequest entity, AgentRequestFormDataset row);
        void AddFormServer(AgentRequest entity, AgentRequestFormServer row);
        void AddFormRpp(AgentRequest entity, AgentRequestFormRpp row);
        void AddCostSaving(AgentRequest entity, AgentRequestFormCostSaving row);
        void SetCostSavings(AgentRequest entity, IEnumerable<AgentRequestFormCostSaving> rows);
        void AddAttachment(AgentRequest entity, AgentRequestAttachment row);
        void SetBasicAttachments(AgentRequest entity, IEnumerable<AgentRequestAttachment> rows);
        void FinalizeFormLines(AgentRequest entity);
        void FinalizeFlowLines(AgentRequest entity);
        void AddFlowCheck(AgentRequest entity, AgentRequestFlowCheck row);
        void AddReleaseItem(AgentRequest entity, AgentRequestFlowReleaseItem row);
        void RemoveAttachments(AgentRequest entity, string category);
        void RemoveChecks(IEnumerable<AgentRequestFlowCheck> checks);
        void RemoveReleaseItems(AgentRequestFlowRelease release);
        void RemoveReleaseItem(AgentRequestFlowReleaseItem item);
    }
}
