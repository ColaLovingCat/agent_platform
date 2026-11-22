using CommonService.Application.DTOs;
using CommonService.Core.Models;

namespace CommonService.Application.Services.Interfaces
{
    public interface IAgentRequestService
    {
        Task<PagedResult<RequestListItemDto>> GetListAsync(RequestListQueryDto query, Guid? userId = null);
        Task<RequestKpiDto> GetKpiAsync(RequestListQueryDto query, Guid? userId = null);
        Task<RequestServiceResult<RequestRecordDto>> GetInfosAsync(Guid id, Guid? userId = null);
        Task<RequestServiceResult<RequestPublicShowDto>> GetPublicShowAsync(Guid id);
        Task<RequestServiceResult<RequestBasicDto>> GetInfosBasicAsync(Guid id);
        Task<RequestServiceResult<RequestSecurityDto>> GetInfosDataAsync(Guid id);
        Task<RequestServiceResult<RequestCostSectionDto>> GetInfosCostAsync(Guid id);
        Task<RequestServiceResult<RequestSavingSectionDto>> GetInfosSaveAsync(Guid id);
        Task<RequestServiceResult<RequestOptionsDto>> GetInfosOptionsAsync(Guid id);
        Task<RequestServiceResult<RequestReviewDto>> GetInfosReviewAsync(Guid id);
        Task<RequestServiceResult<RequestRecordDto>> SaveAsync(RequestSaveDto dto, Guid? userId);
        Task<RequestServiceResult<string>> DeleteAsync(Guid id, Guid? userId);
        Task<RequestServiceResult<RequestRecordDto>> SubmitAsync(Guid id, Guid? userId);
        Task<List<RequestDatasetDto>> GetDatasetsAsync();
        Task<RequestServiceResult<RequestFlowStatusDto>> GetFlowStatusAsync(Guid id);
        Task<RequestServiceResult<List<RequestStageCheckDto>>> GetFlowCheckAsync(Guid id);
        Task<RequestServiceResult<object>> GetFlowDevelopAsync(Guid id);
        Task<RequestServiceResult<object>> GetFlowRoiAsync(Guid id);
        Task<RequestServiceResult<object>> GetFlowReleaseAsync(Guid id);
        Task<RequestServiceResult<object>> GetFlowPublishAsync(Guid id);
        Task<RequestServiceResult<RequestRecordDto>> SaveFlowAsync(RequestFlowSaveDto dto, Guid? userId);
        Task<RequestServiceResult<RequestRecordDto>> ConfirmPhaseAsync(RequestConfirmPhaseDto dto, Guid? userId);
        /// <summary>Close = freeze ROI/NPV snapshot (rates + results). Open = allow recompute.</summary>
        Task<RequestServiceResult<RequestRecordDto>> CloseMetricsAsync(Guid id, Guid? userId);
        Task<RequestServiceResult<RequestRecordDto>> OpenMetricsAsync(Guid id, Guid? userId);
    }
}
