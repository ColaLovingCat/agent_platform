using CommonService.Application.DTOs;
using CommonService.Application.Services.Interfaces;
using CommonService.Core.Models;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using System.Security.Claims;

namespace CommonService.WebApi.Controllers
{
    [ApiController]
    [Route("api/request")]
    public class RequestController : ControllerBase
    {
        private readonly IAgentRequestService _service;

        public RequestController(IAgentRequestService service)
        {
            _service = service;
        }

        /// <summary>
        /// 列表：Requests / Pending My Approval，含 Investment / Saving / ROI
        /// </summary>
        [HttpGet("get_list")]
        public async Task<ActionResult<ApiResponse<PagedResult<RequestListItemDto>>>> GetList([FromQuery] RequestListQueryDto query)
        {
            var result = await _service.GetListAsync(query, CurrentUserId());
            return ApiResponse<PagedResult<RequestListItemDto>>.Ok(result);
        }

        /// <summary>
        /// KPI 卡片：总数、进行中、Y0 Saving、次年 Saving、Y0 Investment、Avg ROI
        /// </summary>
        [HttpGet("get_kpi")]
        public async Task<ActionResult<ApiResponse<RequestKpiDto>>> GetKpi([FromQuery] RequestListQueryDto query)
        {
            var result = await _service.GetKpiAsync(query, CurrentUserId());
            return ApiResponse<RequestKpiDto>.Ok(result);
        }

        /// <summary>
        /// 创建或保存草稿 / 更新表单。id 为空则新建。
        /// 可提交完整 form，或按 Tab 分片：basic / data / cost / save / options / termsAccepted
        /// </summary>
        [HttpPost("save")]
        public async Task<ActionResult<ApiResponse<RequestRecordDto>>> Save([FromBody] RequestSaveDto dto)
        {
            var result = await _service.SaveAsync(dto, CurrentUserId());
            return result.Ok
                ? ApiResponse<RequestRecordDto>.Ok(result.Data!)
                : ApiResponse<RequestRecordDto>.Fail(result.Message);
        }

        /// <summary>
        /// 软删除
        /// </summary>
        [HttpPost("delete")]
        public async Task<ActionResult<ApiResponse<string>>> Delete([FromBody] GUIDDto dto)
        {
            var result = await _service.DeleteAsync(dto.ID, CurrentUserId());
            return result.Ok
                ? ApiResponse<string>.Ok(result.Message)
                : ApiResponse<string>.Fail(result.Message);
        }

        /// <summary>
        /// 提交进入 Check 阶段
        /// </summary>
        [HttpPost("submit")]
        public async Task<ActionResult<ApiResponse<RequestRecordDto>>> Submit([FromBody] RequestSubmitDto dto)
        {
            var result = await _service.SubmitAsync(dto.Id, CurrentUserId());
            return result.Ok
                ? ApiResponse<RequestRecordDto>.Ok(result.Data!)
                : ApiResponse<RequestRecordDto>.Fail(result.Message);
        }

        /// <summary>
        /// 整单详情（Create Review / Detail Overview）
        /// </summary>
        [HttpGet("get_infos")]
        public async Task<ActionResult<ApiResponse<RequestRecordDto>>> GetInfos([FromQuery] Guid id)
        {
            return await Wrap(_service.GetInfosAsync(id, CurrentUserId()));
        }

        /// <summary>Public read-only request summary for share links.</summary>
        [AllowAnonymous]
        [HttpGet("show")]
        public async Task<ActionResult<ApiResponse<RequestPublicShowDto>>> Show([FromQuery] Guid id)
        {
            return await Wrap(_service.GetPublicShowAsync(id));
        }

        /// <summary>
        /// Basic Infos Tab
        /// </summary>
        [HttpGet("get_infos_basic")]
        public async Task<ActionResult<ApiResponse<RequestBasicDto>>> GetInfosBasic([FromQuery] Guid id)
        {
            return await Wrap(_service.GetInfosBasicAsync(id));
        }

        /// <summary>
        /// Data &amp; Security Tab
        /// </summary>
        [HttpGet("get_infos_data")]
        public async Task<ActionResult<ApiResponse<RequestSecurityDto>>> GetInfosData([FromQuery] Guid id)
        {
            return await Wrap(_service.GetInfosDataAsync(id));
        }

        /// <summary>
        /// Cost &amp; Saving · Investment（Server / DB / Token / Personnel / External）
        /// </summary>
        [HttpGet("get_infos_cost")]
        public async Task<ActionResult<ApiResponse<RequestCostSectionDto>>> GetInfosCost([FromQuery] Guid id)
        {
            return await Wrap(_service.GetInfosCostAsync(id));
        }

        /// <summary>
        /// Cost &amp; Saving · Saving（HC / Additional / RPP）
        /// </summary>
        [HttpGet("get_infos_save")]
        public async Task<ActionResult<ApiResponse<RequestSavingSectionDto>>> GetInfosSave([FromQuery] Guid id)
        {
            return await Wrap(_service.GetInfosSaveAsync(id));
        }

        /// <summary>
        /// AI Options Tab
        /// </summary>
        [HttpGet("get_infos_options")]
        public async Task<ActionResult<ApiResponse<RequestOptionsDto>>> GetInfosOptions([FromQuery] Guid id)
        {
            return await Wrap(_service.GetInfosOptionsAsync(id));
        }

        /// <summary>
        /// Review Tab（含 terms 与完整 form 汇总）
        /// </summary>
        [HttpGet("get_infos_review")]
        public async Task<ActionResult<ApiResponse<RequestReviewDto>>> GetInfosReview([FromQuery] Guid id)
        {
            return await Wrap(_service.GetInfosReviewAsync(id));
        }

        /// <summary>
        /// 数据源目录（Data &amp; Security Dataset pool）
        /// </summary>
        [HttpGet("dataset/get_list")]
        public async Task<ActionResult<ApiResponse<List<RequestDatasetDto>>>> GetDatasetList()
        {
            var result = await _service.GetDatasetsAsync();
            return ApiResponse<List<RequestDatasetDto>>.Ok(result);
        }

        /// <summary>
        /// 生命周期状态
        /// </summary>
        [HttpGet("flow/get_status")]
        public async Task<ActionResult<ApiResponse<RequestFlowStatusDto>>> GetFlowStatus([FromQuery] Guid id)
        {
            return await Wrap(_service.GetFlowStatusAsync(id));
        }

        /// <summary>
        /// Check 阶段
        /// </summary>
        [HttpGet("flow/get_infos_check")]
        public async Task<ActionResult<ApiResponse<List<RequestStageCheckDto>>>> GetFlowCheck([FromQuery] Guid id)
        {
            return await Wrap(_service.GetFlowCheckAsync(id));
        }

        /// <summary>
        /// Develop 阶段
        /// </summary>
        [HttpGet("flow/get_infos_develop")]
        public async Task<ActionResult<ApiResponse<object>>> GetFlowDevelop([FromQuery] Guid id)
        {
            return await Wrap(_service.GetFlowDevelopAsync(id));
        }

        /// <summary>
        /// ROI Follow-up 阶段
        /// </summary>
        [HttpGet("flow/get_infos_roi")]
        public async Task<ActionResult<ApiResponse<object>>> GetFlowRoi([FromQuery] Guid id)
        {
            return await Wrap(_service.GetFlowRoiAsync(id));
        }

        /// <summary>
        /// Release 阶段
        /// </summary>
        [HttpGet("flow/get_infos_release")]
        public async Task<ActionResult<ApiResponse<object>>> GetFlowRelease([FromQuery] Guid id)
        {
            return await Wrap(_service.GetFlowReleaseAsync(id));
        }

        /// <summary>
        /// Publish 阶段
        /// </summary>
        [HttpGet("flow/get_infos_publish")]
        public async Task<ActionResult<ApiResponse<object>>> GetFlowPublish([FromQuery] Guid id)
        {
            return await Wrap(_service.GetFlowPublishAsync(id));
        }

        /// <summary>
        /// 保存阶段过程数据（checks / develop / roi / release），不推进状态
        /// </summary>
        [HttpPost("flow/save_infos")]
        public async Task<ActionResult<ApiResponse<RequestRecordDto>>> SaveFlow([FromBody] RequestFlowSaveDto dto)
        {
            var result = await _service.SaveFlowAsync(dto, CurrentUserId());
            return result.Ok
                ? ApiResponse<RequestRecordDto>.Ok(result.Data!)
                : ApiResponse<RequestRecordDto>.Fail(result.Message);
        }

        /// <summary>
        /// 确认当前阶段并进入下一阶段。action=confirm|reject
        /// phase: checking | developing | roi_followup | releasing | published
        /// </summary>
        [HttpPost("flow/confirm_phase")]
        public async Task<ActionResult<ApiResponse<RequestRecordDto>>> ConfirmPhase([FromBody] RequestConfirmPhaseDto dto)
        {
            var result = await _service.ConfirmPhaseAsync(dto, CurrentUserId());
            return result.Ok
                ? ApiResponse<RequestRecordDto>.Ok(result.Data!)
                : ApiResponse<RequestRecordDto>.Fail(result.Message);
        }

        /// <summary>冻结 ROI/NPV 快照（税率、折现率与计算结果）</summary>
        [HttpPost("metrics/close")]
        public async Task<ActionResult<ApiResponse<RequestRecordDto>>> CloseMetrics([FromBody] RequestSubmitDto dto)
        {
            var result = await _service.CloseMetricsAsync(dto.Id, CurrentUserId());
            return result.Ok
                ? ApiResponse<RequestRecordDto>.Ok(result.Data!)
                : ApiResponse<RequestRecordDto>.Fail(result.Message);
        }

        /// <summary>解冻并按当前 Cost 重算 ROI/NPV</summary>
        [HttpPost("metrics/open")]
        public async Task<ActionResult<ApiResponse<RequestRecordDto>>> OpenMetrics([FromBody] RequestSubmitDto dto)
        {
            var result = await _service.OpenMetricsAsync(dto.Id, CurrentUserId());
            return result.Ok
                ? ApiResponse<RequestRecordDto>.Ok(result.Data!)
                : ApiResponse<RequestRecordDto>.Fail(result.Message);
        }

        private Guid? CurrentUserId()
        {
            var raw = User.FindFirstValue(ClaimTypes.NameIdentifier);
            return Guid.TryParse(raw, out var id) ? id : null;
        }

        private static async Task<ActionResult<ApiResponse<T>>> Wrap<T>(Task<RequestServiceResult<T>> task)
        {
            var result = await task;
            return result.Ok
                ? ApiResponse<T>.Ok(result.Data!)
                : ApiResponse<T>.Fail(result.Message);
        }
    }
}
