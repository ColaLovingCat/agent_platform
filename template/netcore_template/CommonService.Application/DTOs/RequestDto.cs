using CommonService.Core.Models;

namespace CommonService.Application.DTOs
{
    public class RequestPersonDto
    {
        public string Userno { get; set; } = string.Empty;
        public string NtAccount { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string DeptName { get; set; } = string.Empty;
    }

    public class RequestBasicDto
    {
        public string Name { get; set; } = string.Empty;
        public string Domain { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public RequestPersonDto? Owner { get; set; }
        public RequestPersonDto? Pjm { get; set; }
        public RequestPersonDto? Sponsor { get; set; }
    }

    public class RequestSecurityDto
    {
        public string SecurityMode { get; set; } = "datasource";
        public List<string> DataSourceIds { get; set; } = new();
        public string? DerivedScC { get; set; }
        public string? DerivedScI { get; set; }
        public string? DerivedScA { get; set; }
        public string? ManualScC { get; set; }
        public string? ManualScI { get; set; }
        public string? ManualScA { get; set; }
        public string OverrideNote { get; set; } = string.Empty;
        public string? FinalScC { get; set; }
        public string? FinalScI { get; set; }
        public string? FinalScA { get; set; }
    }

    public class RequestInvestmentServerDto
    {
        public string TierId { get; set; } = "none";
        public int Quantity { get; set; } = 1;
    }

    public class RequestInvestmentDbDto
    {
        public string DbTypeId { get; set; } = "none";
        public decimal InitialSizeGb { get; set; } = 50;
        public decimal IncrementGbPerYear { get; set; } = 20;
        public int RetentionYears { get; set; } = 3;
    }

    public class RequestInvestmentTokenDto
    {
        public decimal CallsPerMonth { get; set; } = 0;
        public decimal AvgTokensPerCall { get; set; } = 0;
        public decimal PricePer1kTokens { get; set; } = 0.012m;
        public string QuotaMode { get; set; } = "money";
        public decimal QuotaLimit { get; set; }
    }

    public class RequestPersonnelDto
    {
        public string Id { get; set; } = string.Empty;
        public string Category { get; set; } = "development";
        public string CostCenter { get; set; } = string.Empty;
        public string Level { get; set; } = "4_D";
        public List<decimal> HcByYear { get; set; } = new();
    }

    public class RequestExternalPaymentDto
    {
        public string Id { get; set; } = string.Empty;
        public string Category { get; set; } = "";
        public string CostCenter { get; set; } = string.Empty;
        public List<decimal> AmountByYear { get; set; } = new();
    }

    public class RequestInvestmentDto
    {
        public RequestInvestmentServerDto Server { get; set; } = new();
        public RequestInvestmentDbDto Db { get; set; } = new();
        public RequestInvestmentTokenDto Token { get; set; } = new();
        public List<RequestPersonnelDto> Personnel { get; set; } = new();
        public List<RequestExternalPaymentDto> ExternalPayments { get; set; } = new();
    }

    public class RequestSavingHcDto
    {
        public string Id { get; set; } = string.Empty;
        public string Dept { get; set; } = string.Empty;
        public string CostCenter { get; set; } = string.Empty;
        public string Level { get; set; } = "4_D";
        public List<decimal> HcByYear { get; set; } = new();
        public decimal Hc { get; set; }
        public decimal UnitPriceYearly { get; set; }
    }

    public class RequestAdditionalSavingDto
    {
        public string Id { get; set; } = string.Empty;
        public string Category { get; set; } = "risk_avoid";
        public string CostCenter { get; set; } = string.Empty;
        public List<decimal> AmountByYear { get; set; } = new();
    }

    public class RequestRppDto
    {
        public string Id { get; set; } = string.Empty;
        public string RppId { get; set; } = string.Empty;
        public string RppLink { get; set; } = string.Empty;
    }

    public class RequestCostDto
    {
        public decimal FrequencyPerMonth { get; set; } = 800;
        public string SavingMode { get; set; } = "fte";
        public decimal SavingPerUseMoney { get; set; }
        public decimal SavingPerUseFte { get; set; }
        public decimal EstimatedInvestment { get; set; }
        public RequestInvestmentDto Investment { get; set; } = new();
        public List<RequestSavingHcDto> SavingEntries { get; set; } = new();
        public List<RequestAdditionalSavingDto> AdditionalSavings { get; set; } = new();
        public List<RequestRppDto> RppEntries { get; set; } = new();
        /// <summary>Deprecated: first of RppEntries.</summary>
        public string RppId { get; set; } = string.Empty;
        /// <summary>Deprecated: first of RppEntries.</summary>
        public string RppLink { get; set; } = string.Empty;
        public string CycleStartMonth { get; set; } = string.Empty;
        public List<decimal> SavingYearRatios { get; set; } = new() { 1, 1, 1, 1, 1, 1 };
        /// <summary>Effective income tax on net benefit (15% + 85%×5% = 19.25%).</summary>
        public decimal IncomeTaxRate { get; set; } = 0.1925m;
    }

    public class RequestSavingSectionDto
    {
        public List<RequestSavingHcDto> SavingEntries { get; set; } = new();
        public List<RequestAdditionalSavingDto> AdditionalSavings { get; set; } = new();
        public List<RequestRppDto> RppEntries { get; set; } = new();
        public string RppId { get; set; } = string.Empty;
        public string RppLink { get; set; } = string.Empty;
        public string CycleStartMonth { get; set; } = string.Empty;
        public List<decimal> SavingYearRatios { get; set; } = new() { 1, 1, 1, 1, 1, 1 };
    }

    public class RequestCostSectionDto
    {
        public RequestInvestmentDto Investment { get; set; } = new();
        public string CycleStartMonth { get; set; } = string.Empty;
        public decimal FrequencyPerMonth { get; set; }
        public decimal EstimatedInvestment { get; set; }
    }

    public class RequestOptionsDto
    {
        public bool HumanInLoop { get; set; } = true;
        public bool BoschChinaOnly { get; set; } = true;
        public int PersonalDataLevel { get; set; } = 1;
        public int ImpactLossLevel { get; set; } = 1;
        public bool NoReputationPhysicalHarm { get; set; } = true;
        public int AiLevel { get; set; } = 1;
    }

    public class RequestFormDto
    {
        public RequestBasicDto Basic { get; set; } = new();
        public RequestSecurityDto Security { get; set; } = new();
        public RequestCostDto Cost { get; set; } = new();
        public RequestOptionsDto Options { get; set; } = new();
        public string Remarks { get; set; } = string.Empty;
        public List<RequestCheckAttachmentDto> Attachments { get; set; } = new();
        public bool TermsAccepted { get; set; }
    }

    public class RequestCheckAttachmentDto
    {
        public string Uid { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public long Size { get; set; }
        public string? Type { get; set; }
        public string UploadedAt { get; set; } = string.Empty;
    }

    public class RequestStageCheckDto
    {
        public string Id { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public string Status { get; set; } = "pending";
        public string? Note { get; set; }
        public List<RequestCheckAttachmentDto>? Attachments { get; set; }
    }

    public class RequestPublicPersonDto
    {
        public string Username { get; set; } = string.Empty;
        public string DeptName { get; set; } = string.Empty;
    }

    public class RequestPublicBasicDto
    {
        public string Name { get; set; } = string.Empty;
        public string Domain { get; set; } = string.Empty;
        public string Description { get; set; } = string.Empty;
        public RequestPublicPersonDto? Owner { get; set; }
        public RequestPublicPersonDto? Pjm { get; set; }
        public RequestPublicPersonDto? Sponsor { get; set; }
    }

    public class RequestPublicShowDto
    {
        public Guid Id { get; set; }
        public string Status { get; set; } = string.Empty;
        public RequestPublicBasicDto Basic { get; set; } = new();
        public int AiLevel { get; set; } = 1;
        public string? FinalScC { get; set; }
        public string? FinalScI { get; set; }
        public string? FinalScA { get; set; }
        public List<RequestStageCheckDto> Checks { get; set; } = new();
    }

    public class RequestSourcePackageDto
    {
        public string Url { get; set; } = string.Empty;
        public string Repo { get; set; } = string.Empty;
        public string Branch { get; set; } = string.Empty;
        public string GeneratedAt { get; set; } = string.Empty;
    }

    public class RequestRoiActualDto
    {
        public decimal FrequencyPerMonth { get; set; }
        public decimal SavingPerUseMoney { get; set; }
        public decimal EstimatedInvestment { get; set; }
        public string Note { get; set; } = string.Empty;
    }

    public class RequestRoiApprovalDto
    {
        public string Id { get; set; } = string.Empty;
        public string Step { get; set; } = string.Empty;
        public string Username { get; set; } = string.Empty;
        public string Dept { get; set; } = string.Empty;
        public string Status { get; set; } = "pending";
        public string Remarks { get; set; } = string.Empty;
        public string? ActionAt { get; set; }
    }

    public class RequestReleaseItemDto
    {
        public string Id { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
        public string Title { get; set; } = string.Empty;
        public int AiLevel { get; set; } = 1;
        public string Content { get; set; } = string.Empty;
    }

    public class RequestReleaseArchiveDto
    {
        public string FileName { get; set; } = string.Empty;
        public long Size { get; set; }
        public string ChangeDate { get; set; } = string.Empty;
        public string Note { get; set; } = string.Empty;
        public string UploadedAt { get; set; } = string.Empty;
    }

    public class RequestFlowDto
    {
        public List<RequestStageCheckDto> Checks { get; set; } = new();
        public string? DevelopMode { get; set; }
        public List<RequestStageCheckDto> DevelopChecks { get; set; } = new();
        public RequestSourcePackageDto? SourcePackage { get; set; }
        public RequestRoiActualDto? RoiActual { get; set; }
        public List<RequestRoiApprovalDto> RoiApprovals { get; set; } = new();
        public List<RequestReleaseItemDto> ReleaseChecklist { get; set; } = new();
        public bool ReleaseSubmitted { get; set; }
        public bool ReleaseApproved { get; set; }
        public RequestReleaseArchiveDto? ReleaseArchive { get; set; }
        public bool PublishCompleted { get; set; }
    }

    public class RequestRecordDto
    {
        public Guid Id { get; set; }
        public string Status { get; set; } = "draft";
        public RequestFormDto Form { get; set; } = new();
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
        public string? PendingApprover { get; set; }
        public bool AwaitingMe { get; set; }
        public Guid? CreatedBy { get; set; }
        public bool CanManageDraft { get; set; }
        public List<RequestStageCheckDto> Checks { get; set; } = new();
        public string? DevelopMode { get; set; }
        public List<RequestStageCheckDto> DevelopChecks { get; set; } = new();
        public RequestSourcePackageDto? SourcePackage { get; set; }
        public RequestRoiActualDto? RoiActual { get; set; }
        public List<RequestRoiApprovalDto> RoiApprovals { get; set; } = new();
        public List<RequestReleaseItemDto> ReleaseChecklist { get; set; } = new();
        public bool ReleaseSubmitted { get; set; }
        public bool ReleaseApproved { get; set; }
        public RequestReleaseArchiveDto? ReleaseArchive { get; set; }
        public bool PublishCompleted { get; set; }
        public decimal InvestmentY0 { get; set; }
        public decimal SavingY0 { get; set; }
        public decimal SavingNextYear { get; set; }
        public decimal Roi { get; set; }
        public decimal TaxAdjustedRoi { get; set; }
        public decimal Npv { get; set; }
        public decimal? PbpYears { get; set; }
        public decimal? PaybackMonths { get; set; }
        public decimal IncomeTaxRate { get; set; } = 0.1925m;
        public decimal NpvFactor { get; set; } = 0.08m;
        public bool MetricsFrozen { get; set; }
    }

    public class RequestListItemDto
    {
        public Guid Id { get; set; }
        public string Name { get; set; } = string.Empty;
        public string Status { get; set; } = "draft";
        public string? FinalScC { get; set; }
        public string? FinalScI { get; set; }
        public string? FinalScA { get; set; }
        public int AiLevel { get; set; }
        public string? Owner { get; set; }
        public string? Department { get; set; }
        public bool CanManageDraft { get; set; }
        public decimal InvestmentY0 { get; set; }
        public decimal SavingY0 { get; set; }
        public decimal SavingNextYear { get; set; }
        public decimal Roi { get; set; }
        public decimal TaxAdjustedRoi { get; set; }
        public decimal Npv { get; set; }
        public decimal? PbpYears { get; set; }
        public decimal? PaybackMonths { get; set; }
        public string? PendingApprover { get; set; }
        public bool AwaitingMe { get; set; }
        public DateTime CreatedAt { get; set; }
        public DateTime UpdatedAt { get; set; }
    }

    public class RequestKpiDto
    {
        public int Total { get; set; }
        public int ActiveCount { get; set; }
        public decimal SavingY0 { get; set; }
        public decimal SavingNextYear { get; set; }
        public decimal InvestmentY0 { get; set; }
        public decimal TotalSaving { get; set; }
        public decimal TotalInvestment { get; set; }
        public decimal AvgRoi { get; set; }
        public bool HasInvestment { get; set; }
        /// <summary>Average PbpYears among rows with a defined PBP.</summary>
        public decimal? AvgPbpYears { get; set; }
        public bool HasPbp { get; set; }
    }

    public class RequestDatasetDto
    {
        public string Id { get; set; } = string.Empty;
        public string Name { get; set; } = string.Empty;
        public string ScConfidentiality { get; set; } = string.Empty;
        public string ScIntegrity { get; set; } = string.Empty;
        public string ScAvailability { get; set; } = string.Empty;
        public string Category { get; set; } = string.Empty;
    }

    public class RequestFlowStatusDto
    {
        public Guid Id { get; set; }
        public string Status { get; set; } = "draft";
        public string? PendingApprover { get; set; }
        public bool AwaitingMe { get; set; }
        public List<string> Timeline { get; set; } = new();
        public int CurrentIndex { get; set; }
        public bool PublishCompleted { get; set; }
    }

    public class RequestListQueryDto
    {
        public string Tab { get; set; } = "mine";
        /// <summary>all = 全部申请；mine = 仅本人（CreatedBy 或 Owner）</summary>
        public string Scope { get; set; } = "all";
        public string? Q { get; set; }
        public int Page { get; set; } = 1;
        public int Size { get; set; } = 8;
    }

    public class RequestSaveDto
    {
        public string? Id { get; set; }
        public RequestFormDto? Form { get; set; }
        public RequestBasicDto? Basic { get; set; }
        public RequestSecurityDto? Data { get; set; }
        public RequestCostDto? Cost { get; set; }
        public RequestSavingSectionDto? Save { get; set; }
        public RequestOptionsDto? Options { get; set; }
        public bool? TermsAccepted { get; set; }
    }

    public class RequestSubmitDto
    {
        public Guid Id { get; set; }
    }

    public class RequestFlowSaveDto
    {
        public Guid Id { get; set; }
        public RequestFlowDto Flow { get; set; } = new();
    }

    public class RequestConfirmPhaseDto
    {
        public Guid Id { get; set; }
        public string Phase { get; set; } = string.Empty;
        public string Action { get; set; } = "confirm";
        public RequestFlowDto? Flow { get; set; }
    }

    public class RequestReviewDto
    {
        public bool TermsAccepted { get; set; }
        public RequestFormDto Form { get; set; } = new();
    }

    public class RequestServiceResult<T>
    {
        public bool Ok { get; set; }
        public string Message { get; set; } = string.Empty;
        public T? Data { get; set; }

        public static RequestServiceResult<T> Success(T data, string message = ResultStatus.OK)
            => new() { Ok = true, Data = data, Message = message };

        public static RequestServiceResult<T> Fail(string message)
            => new() { Ok = false, Message = message };
    }
}
