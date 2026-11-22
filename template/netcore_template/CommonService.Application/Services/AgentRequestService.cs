using CommonService.Application.DTOs;
using CommonService.Application.Services.Interfaces;
using CommonService.Core.Models;
using CommonService.Core.Repositories.Interfaces;
using CommonService.Core.Utils;
using Microsoft.EntityFrameworkCore;

namespace CommonService.Application.Services
{
    public class AgentRequestService : IAgentRequestService
    {
        private static readonly HashSet<string> TerminalOrDraft = new() { "draft", "published", "rejected" };
        private static readonly AsyncLocal<string> _pipelineLastStep = new();

        private const string SaveLogTag = "request/save";
        private const string SubmitLogTag = "request/submit";

        private readonly IAgentRequestRepository _repository;
        private readonly IUserInfoRepository _userRepository;

        public AgentRequestService(IAgentRequestRepository repository, IUserInfoRepository userRepository)
        {
            _repository = repository;
            _userRepository = userRepository;
        }

        public async Task<PagedResult<RequestListItemDto>> GetListAsync(RequestListQueryDto query, Guid? userId = null)
        {
            var page = Math.Max(1, query.Page);
            var size = Math.Clamp(query.Size <= 0 ? 8 : query.Size, 1, 100);
            var q = await BuildListQueryAsync(query, userId);
            var total = await q.CountAsync();
            var items = await q
                .OrderByDescending(x => x.UpdatedAt ?? x.CreatedAt)
                .Skip((page - 1) * size)
                .Take(size)
                .ToListAsync();

            var (userno, ntAccount) = await ResolveUserKeysAsync(userId);

            return new PagedResult<RequestListItemDto>
            {
                Items = items.Select(e => ToListItem(e, userId, userno, ntAccount)).ToList(),
                Pagination = new Pagination
                {
                    PageIndex = page,
                    PageSize = size,
                    TotalCount = total,
                },
            };
        }

        public async Task<RequestKpiDto> GetKpiAsync(RequestListQueryDto query, Guid? userId = null)
        {
            var rows = await (await BuildListQueryAsync(query, userId)).ToListAsync();
            var metricsRows = rows.Select(ResolveListDisplayMetrics).ToList();
            var withInvestment = metricsRows.Where(x => x.InvestmentY0 > 0).ToList();
            var withPbp = metricsRows.Where(x => x.PbpYears != null).ToList();
            return new RequestKpiDto
            {
                Total = rows.Count,
                ActiveCount = rows.Count(x => !TerminalOrDraft.Contains(x.Status)),
                SavingY0 = metricsRows.Sum(x => x.SavingY0),
                SavingNextYear = metricsRows.Sum(x => x.SavingNextYear),
                InvestmentY0 = metricsRows.Sum(x => x.InvestmentY0),
                TotalSaving = metricsRows.Sum(x => x.TotalCashIn),
                TotalInvestment = metricsRows.Sum(x => x.TotalCashOut),
                AvgRoi = withInvestment.Count == 0 ? 0 : Math.Round(withInvestment.Average(x => x.Roi), 1),
                HasInvestment = withInvestment.Count > 0,
                AvgPbpYears = withPbp.Count == 0
                    ? null
                    : Math.Round(withPbp.Average(x => x.PbpYears!.Value), 2),
                HasPbp = withPbp.Count > 0,
            };
        }

        public async Task<RequestServiceResult<RequestRecordDto>> GetInfosAsync(Guid id, Guid? userId = null)
        {
            var entity = await _repository.GetActiveByIdAsync(id);
            if (entity == null) return RequestServiceResult<RequestRecordDto>.Fail("Request not found.");
            var canManage = await CanManageDraftAsync(entity, userId);
            return RequestServiceResult<RequestRecordDto>.Success(ToRecord(entity, canManage));
        }

        public async Task<RequestServiceResult<RequestPublicShowDto>> GetPublicShowAsync(Guid id)
        {
            var entity = await _repository.GetActiveByIdAsync(id);
            if (entity == null) return RequestServiceResult<RequestPublicShowDto>.Fail("Request not found.");

            var form = RequestGraphMapper.ToForm(entity);
            var existingChecks = RequestGraphMapper.ToFlow(entity).Checks
                .ToDictionary(x => x.Id, StringComparer.OrdinalIgnoreCase);
            var checks = RequestFlowDefaults.DefaultChecks()
                .Select(item => existingChecks.TryGetValue(item.Id, out var existing) ? existing : item)
                .ToList();

            static RequestPublicPersonDto? ToPublicPerson(RequestPersonDto? person) =>
                person == null
                    ? null
                    : new RequestPublicPersonDto
                    {
                        Username = person.Username,
                        DeptName = person.DeptName,
                    };

            return RequestServiceResult<RequestPublicShowDto>.Success(new RequestPublicShowDto
            {
                Id = entity.ID,
                Status = entity.Status,
                Basic = new RequestPublicBasicDto
                {
                    Name = form.Basic.Name,
                    Domain = form.Basic.Domain,
                    Description = form.Basic.Description,
                    Owner = ToPublicPerson(form.Basic.Owner),
                    Pjm = ToPublicPerson(form.Basic.Pjm),
                    Sponsor = ToPublicPerson(form.Basic.Sponsor),
                },
                AiLevel = form.Options.AiLevel,
                FinalScC = form.Security.FinalScC,
                FinalScI = form.Security.FinalScI,
                FinalScA = form.Security.FinalScA,
                Checks = checks,
            });
        }

        public async Task<RequestServiceResult<RequestBasicDto>> GetInfosBasicAsync(Guid id)
        {
            var entity = await _repository.GetActiveByIdAsync(id);
            if (entity == null) return RequestServiceResult<RequestBasicDto>.Fail("Request not found.");
            return RequestServiceResult<RequestBasicDto>.Success(RequestGraphMapper.ToForm(entity).Basic);
        }

        public async Task<RequestServiceResult<RequestSecurityDto>> GetInfosDataAsync(Guid id)
        {
            var entity = await _repository.GetActiveByIdAsync(id);
            if (entity == null) return RequestServiceResult<RequestSecurityDto>.Fail("Request not found.");
            return RequestServiceResult<RequestSecurityDto>.Success(RequestGraphMapper.ToForm(entity).Security);
        }

        public async Task<RequestServiceResult<RequestCostSectionDto>> GetInfosCostAsync(Guid id)
        {
            var entity = await _repository.GetActiveByIdAsync(id);
            if (entity == null) return RequestServiceResult<RequestCostSectionDto>.Fail("Request not found.");
            var cost = RequestGraphMapper.ToForm(entity).Cost;
            return RequestServiceResult<RequestCostSectionDto>.Success(new RequestCostSectionDto
            {
                Investment = cost.Investment,
                CycleStartMonth = cost.CycleStartMonth,
                FrequencyPerMonth = cost.FrequencyPerMonth,
                EstimatedInvestment = cost.EstimatedInvestment,
            });
        }

        public async Task<RequestServiceResult<RequestSavingSectionDto>> GetInfosSaveAsync(Guid id)
        {
            var entity = await _repository.GetActiveByIdAsync(id);
            if (entity == null) return RequestServiceResult<RequestSavingSectionDto>.Fail("Request not found.");
            var cost = RequestGraphMapper.ToForm(entity).Cost;
            return RequestServiceResult<RequestSavingSectionDto>.Success(new RequestSavingSectionDto
            {
                SavingEntries = cost.SavingEntries,
                AdditionalSavings = cost.AdditionalSavings,
                RppEntries = cost.RppEntries,
                RppId = cost.RppId,
                RppLink = cost.RppLink,
                CycleStartMonth = cost.CycleStartMonth,
                SavingYearRatios = cost.SavingYearRatios,
            });
        }

        public async Task<RequestServiceResult<RequestOptionsDto>> GetInfosOptionsAsync(Guid id)
        {
            var entity = await _repository.GetActiveByIdAsync(id);
            if (entity == null) return RequestServiceResult<RequestOptionsDto>.Fail("Request not found.");
            return RequestServiceResult<RequestOptionsDto>.Success(RequestGraphMapper.ToForm(entity).Options);
        }

        public async Task<RequestServiceResult<RequestReviewDto>> GetInfosReviewAsync(Guid id)
        {
            var entity = await _repository.GetActiveByIdAsync(id);
            if (entity == null) return RequestServiceResult<RequestReviewDto>.Fail("Request not found.");
            var form = RequestGraphMapper.ToForm(entity);
            return RequestServiceResult<RequestReviewDto>.Success(new RequestReviewDto
            {
                TermsAccepted = form.TermsAccepted,
                Form = form,
            });
        }

        public async Task<RequestServiceResult<RequestRecordDto>> SaveAsync(RequestSaveDto dto, Guid? userId)
        {
            LogHelper.ScopeTag = SaveLogTag;
            LogRequestStep(SaveLogTag, "start", $"requestId={dto.Id}");
            try
            {
                return await SaveCoreAsync(dto, userId);
            }
            catch (DbUpdateConcurrencyException ex)
            {
                var step = PipelineLastStep;
                var entities = string.Join(", ",
                    ex.Entries.Select(e => $"{e.Entity.GetType().Name}:{e.State}"));
                var detail = ex.InnerException?.Message ?? ex.Message;
                LogRequestFail(SaveLogTag, step, ex, entities);
                return RequestServiceResult<RequestRecordDto>.Fail(
                    $"Save failed at [{step}]: {detail} [{entities}]");
            }
            catch (DbUpdateException ex)
            {
                var step = PipelineLastStep;
                var detail = ex.InnerException?.Message ?? ex.Message;
                LogRequestFail(SaveLogTag, step, ex, detail);
                return RequestServiceResult<RequestRecordDto>.Fail(
                    $"Save failed at [{step}]: {detail}");
            }
            catch (Exception ex)
            {
                var step = PipelineLastStep;
                LogRequestFail(SaveLogTag, step, ex);
                return RequestServiceResult<RequestRecordDto>.Fail(
                    $"Save failed at [{step}]: {ex.Message}");
            }
            finally
            {
                LogHelper.ScopeTag = null;
            }
        }

        private async Task<RequestServiceResult<RequestRecordDto>> SaveCoreAsync(RequestSaveDto dto, Guid? userId)
        {
            AgentRequest entity;
            Guid guid = Guid.Empty;
            var isNew = string.IsNullOrWhiteSpace(dto.Id) || !Guid.TryParse(dto.Id, out guid);
            if (isNew)
            {
                LogRequestStep(SaveLogTag,"create-entity");
                entity = new AgentRequest
                {
                    ID = Guid.NewGuid(),
                    Status = "draft",
                    CreatedBy = userId,
                    CreatedAt = DateTime.UtcNow,
                };
                RequestGraphMapper.EnsureGraph(entity);
                RequestGraphMapper.SeedDefaultChecks(entity);
            }
            else
            {
                LogRequestStep(SaveLogTag,"load-entity", $"id={guid}");
                var found = await _repository.GetActiveByIdAsync(guid);
                if (found == null) return RequestServiceResult<RequestRecordDto>.Fail("Request not found.");
                if (!await CanManageDraftAsync(found, userId))
                {
                    return RequestServiceResult<RequestRecordDto>.Fail(
                        "You do not have permission to update this request.");
                }
                entity = found;
                LogRequestStep(SaveLogTag,"load-entity:done",
                    $"formServers={entity.FormServers.Count} datasets={entity.FormDatasets.Count} " +
                    $"costSavings={entity.CostSavings.Count} stages={entity.Stages.Count} token={(entity.Token != null)}");
            }

            LogRequestStep(SaveLogTag,"merge-form");
            var form = isNew ? RequestFormFactory.CreateDefault() : RequestGraphMapper.ToForm(entity);
            if (dto.Form != null) form = dto.Form;
            if (dto.Basic != null) form.Basic = dto.Basic;
            if (dto.Data != null) form.Security = NormalizeSecurity(dto.Data);
            if (dto.Cost != null)
            {
                form.Cost.Investment = dto.Cost.Investment;
                form.Cost.FrequencyPerMonth = dto.Cost.FrequencyPerMonth;
                form.Cost.SavingMode = dto.Cost.SavingMode;
                form.Cost.SavingPerUseMoney = dto.Cost.SavingPerUseMoney;
                form.Cost.SavingPerUseFte = dto.Cost.SavingPerUseFte;
                form.Cost.EstimatedInvestment = dto.Cost.EstimatedInvestment;
                if (!string.IsNullOrWhiteSpace(dto.Cost.CycleStartMonth))
                    form.Cost.CycleStartMonth = dto.Cost.CycleStartMonth;
                if (dto.Cost.IncomeTaxRate > 0)
                    form.Cost.IncomeTaxRate = dto.Cost.IncomeTaxRate;
                if (dto.Cost.SavingEntries.Count > 0 || dto.Form != null)
                    form.Cost.SavingEntries = dto.Cost.SavingEntries;
                if (dto.Cost.AdditionalSavings.Count > 0 || dto.Form != null)
                    form.Cost.AdditionalSavings = dto.Cost.AdditionalSavings;
                if (dto.Cost.RppEntries.Count > 0 || dto.Form != null)
                    form.Cost.RppEntries = dto.Cost.RppEntries;
                if (!string.IsNullOrWhiteSpace(dto.Cost.RppId)) form.Cost.RppId = dto.Cost.RppId;
                if (!string.IsNullOrWhiteSpace(dto.Cost.RppLink)) form.Cost.RppLink = dto.Cost.RppLink;
            }
            if (dto.Save != null)
            {
                form.Cost.SavingEntries = dto.Save.SavingEntries;
                form.Cost.AdditionalSavings = dto.Save.AdditionalSavings;
                form.Cost.RppEntries = dto.Save.RppEntries;
                form.Cost.RppId = dto.Save.RppId;
                form.Cost.RppLink = dto.Save.RppLink;
                if (!string.IsNullOrWhiteSpace(dto.Save.CycleStartMonth))
                    form.Cost.CycleStartMonth = dto.Save.CycleStartMonth;
                if (dto.Save.SavingYearRatios.Count > 0)
                    form.Cost.SavingYearRatios = dto.Save.SavingYearRatios;
            }
            if (dto.Options != null) form.Options = dto.Options;
            if (dto.TermsAccepted.HasValue) form.TermsAccepted = dto.TermsAccepted.Value;

            form.Security = await ResolveSecurityAsync(form.Security);
            LogRequestStep(SaveLogTag,"apply-form",
                $"personnel={form.Cost.Investment.Personnel.Count} saving={form.Cost.SavingEntries.Count} additional={form.Cost.AdditionalSavings.Count}");
            RequestGraphMapper.ApplyForm(entity, form, _repository);
            LogRequestStep(SaveLogTag,"apply-form-done");
            Touch(entity, userId);

            _repository.FinalizeFormLines(entity);
            LogRequestStep(SaveLogTag,"pending-changes", _repository.DescribePendingChanges());
            if (isNew)
            {
                LogRequestStep(SaveLogTag,"save-changes", "AddAsync");
                await _repository.AddAsync(entity);
            }
            else
            {
                LogRequestStep(SaveLogTag,"save-changes", "SaveChangesAsync");
                try
                {
                    await _repository.SaveChangesAsync();
                }
                catch (DbUpdateConcurrencyException ex)
                {
                    var pending = _repository.DescribePendingChanges();
                    var entities = string.Join(", ",
                        ex.Entries.Select(e => $"{e.Entity.GetType().Name}:{e.State}"));
                    LogRequestFail(SaveLogTag, "save-changes", ex, $"{entities} | pending={pending}");
                    throw;
                }
            }
            LogRequestStep(SaveLogTag,"save-done", entity.ID.ToString());

            var canManage = await CanManageDraftAsync(entity, userId);
            return RequestServiceResult<RequestRecordDto>.Success(ToRecord(entity, canManage));
        }

        public async Task<RequestServiceResult<string>> DeleteAsync(Guid id, Guid? userId)
        {
            var entity = await _repository.GetActiveByIdAsync(id);
            if (entity == null) return RequestServiceResult<string>.Fail("Request not found.");
            entity.DeletedAt = DateTime.UtcNow;
            entity.DeletedBy = userId;
            Touch(entity, userId);
            await _repository.SaveChangesAsync();
            return RequestServiceResult<string>.Success(ResultStatus.OK);
        }

        public async Task<RequestServiceResult<RequestRecordDto>> SubmitAsync(Guid id, Guid? userId)
        {
            LogHelper.ScopeTag = SubmitLogTag;
            LogRequestStep(SubmitLogTag, "start", $"requestId={id}");
            try
            {
                return await SubmitCoreAsync(id, userId);
            }
            catch (DbUpdateConcurrencyException ex)
            {
                var step = PipelineLastStep;
                var entities = string.Join(", ",
                    ex.Entries.Select(e => $"{e.Entity.GetType().Name}:{e.State}"));
                var pending = _repository.DescribePendingChanges();
                LogRequestFail(SubmitLogTag, step, ex, $"{entities} | pending={pending}");
                return RequestServiceResult<RequestRecordDto>.Fail(
                    $"Submit failed at [{step}]: {ex.InnerException?.Message ?? ex.Message} [{entities}]");
            }
            catch (DbUpdateException ex)
            {
                var step = PipelineLastStep;
                var detail = ex.InnerException?.Message ?? ex.Message;
                LogRequestFail(SubmitLogTag, step, ex, detail);
                return RequestServiceResult<RequestRecordDto>.Fail(
                    $"Submit failed at [{step}]: {detail}");
            }
            catch (Exception ex)
            {
                var step = PipelineLastStep;
                LogRequestFail(SubmitLogTag, step, ex);
                return RequestServiceResult<RequestRecordDto>.Fail(
                    $"Submit failed at [{step}]: {ex.Message}");
            }
            finally
            {
                LogHelper.ScopeTag = null;
            }
        }

        private async Task<RequestServiceResult<RequestRecordDto>> SubmitCoreAsync(Guid id, Guid? userId)
        {
            LogRequestStep(SubmitLogTag, "load-entity", $"id={id}");
            var entity = await _repository.GetActiveByIdAsync(id);
            if (entity == null)
            {
                LogRequestStep(SubmitLogTag, "blocked", "Request not found.");
                return RequestServiceResult<RequestRecordDto>.Fail("Request not found.");
            }
            LogRequestStep(SubmitLogTag, "load-entity:done",
                $"status={entity.Status} formServers={entity.FormServers.Count} datasets={entity.FormDatasets.Count} " +
                $"costSavings={entity.CostSavings.Count} stages={entity.Stages.Count} checks={entity.Checks.Count}");

            if (entity.Status != "draft")
            {
                LogRequestStep(SubmitLogTag, "blocked", $"status={entity.Status}");
                return RequestServiceResult<RequestRecordDto>.Fail("Only draft requests can be submitted.");
            }

            if (!await CanManageDraftAsync(entity, userId))
            {
                LogRequestStep(SubmitLogTag, "blocked", "permission-denied");
                return RequestServiceResult<RequestRecordDto>.Fail(
                    "You do not have permission to submit this request.");
            }

            LogRequestStep(SubmitLogTag, "to-form");
            var form = RequestGraphMapper.ToForm(entity);
            LogRequestStep(SubmitLogTag, "resolve-security");
            form.Security = await ResolveSecurityAsync(form.Security);

            LogRequestStep(SubmitLogTag, "validate",
                $"name={form.Basic.Name?.Trim()} terms={form.TermsAccepted} " +
                $"saving={form.Cost.SavingEntries.Count} additional={form.Cost.AdditionalSavings.Count} " +
                $"datasets={form.Security.DataSourceIds.Count}");
            var blocker = GetSubmitBlocker(form);
            if (blocker != null)
            {
                LogRequestStep(SubmitLogTag, "blocked", blocker);
                return RequestServiceResult<RequestRecordDto>.Fail(blocker);
            }

            RequestGraphMapper.EnsureGraph(entity);
            if (entity.Checks.Count == 0)
            {
                LogRequestStep(SubmitLogTag, "seed-checks");
                RequestGraphMapper.SeedDefaultChecks(entity);
            }

            LogRequestStep(SubmitLogTag, "set-status", "checking");
            entity.Status = "checking";
            entity.PendingApprover = "Check Team";
            entity.AwaitingMe = false;

            LogRequestStep(SubmitLogTag, "set-stages");
            RequestGraphMapper.SetStage(entity, "check", "in_progress");
            RequestGraphMapper.SetStage(entity, "develop", "pending");
            RequestGraphMapper.SetStage(entity, "roi", "pending");
            RequestGraphMapper.SetStage(entity, "release", "pending");
            RequestGraphMapper.SetStage(entity, "publish", "pending");

            Touch(entity, userId);
            LogRequestStep(SubmitLogTag, "pending-changes", _repository.DescribePendingChanges());

            LogRequestStep(SubmitLogTag, "save-changes", "SaveChangesAsync");
            await _repository.SaveChangesAsync();
            LogRequestStep(SubmitLogTag, "submit-done", entity.ID.ToString());

            return RequestServiceResult<RequestRecordDto>.Success(
                ToRecord(entity, await CanManageDraftAsync(entity, userId)));
        }

        public async Task<List<RequestDatasetDto>> GetDatasetsAsync()
        {
            var rows = await _repository.GetActiveDatasetsAsync();
            return rows.Select(x => new RequestDatasetDto
            {
                Id = x.Code,
                Name = x.Name,
                ScConfidentiality = x.ScConfidentiality,
                ScIntegrity = x.ScIntegrity,
                ScAvailability = x.ScAvailability,
                Category = x.Category,
            }).ToList();
        }

        public async Task<RequestServiceResult<RequestFlowStatusDto>> GetFlowStatusAsync(Guid id)
        {
            var entity = await _repository.GetActiveByIdAsync(id);
            if (entity == null) return RequestServiceResult<RequestFlowStatusDto>.Fail("Request not found.");
            var flow = RequestGraphMapper.ToFlow(entity);
            return RequestServiceResult<RequestFlowStatusDto>.Success(new RequestFlowStatusDto
            {
                Id = entity.ID,
                Status = entity.Status,
                PendingApprover = entity.PendingApprover,
                AwaitingMe = entity.AwaitingMe,
                Timeline = RequestFlowDefaults.Timeline.ToList(),
                CurrentIndex = RequestFlowDefaults.StatusIndex(entity.Status),
                PublishCompleted = flow.PublishCompleted,
            });
        }

        public async Task<RequestServiceResult<List<RequestStageCheckDto>>> GetFlowCheckAsync(Guid id)
        {
            var entity = await _repository.GetActiveByIdAsync(id);
            if (entity == null) return RequestServiceResult<List<RequestStageCheckDto>>.Fail("Request not found.");
            return RequestServiceResult<List<RequestStageCheckDto>>.Success(RequestGraphMapper.ToFlow(entity).Checks);
        }

        public async Task<RequestServiceResult<object>> GetFlowDevelopAsync(Guid id)
        {
            var entity = await _repository.GetActiveByIdAsync(id);
            if (entity == null) return RequestServiceResult<object>.Fail("Request not found.");
            var flow = RequestGraphMapper.ToFlow(entity);
            return RequestServiceResult<object>.Success(new
            {
                developMode = flow.DevelopMode,
                developChecks = flow.DevelopChecks,
                sourcePackage = flow.SourcePackage,
            });
        }

        public async Task<RequestServiceResult<object>> GetFlowRoiAsync(Guid id)
        {
            var entity = await _repository.GetActiveByIdAsync(id);
            if (entity == null) return RequestServiceResult<object>.Fail("Request not found.");
            var form = RequestGraphMapper.ToForm(entity);
            var incomeTaxRate = RequestGraphMapper.ResolveIncomeTaxRate(entity, form);
            var npvFactor = entity.NpvFactor > 0 ? entity.NpvFactor : RoiCalculator.DefaultNpvFactor;
            var metrics = RequestMetrics.Compute(form.Cost, incomeTaxRate, npvFactor);
            return RequestServiceResult<object>.Success(new
            {
                planned = new
                {
                    investmentY0 = metrics.InvestmentY0,
                    savingY0 = metrics.SavingY0,
                    roi = metrics.Roi,
                    taxAdjustedRoi = metrics.TaxAdjustedRoi,
                    npv = metrics.Npv,
                    pbpYears = metrics.PbpYears,
                    paybackMonths = metrics.PaybackMonths,
                    incomeTaxRate = metrics.IncomeTaxRate,
                    npvFactor = metrics.NpvFactor,
                },
                snapshot = new
                {
                    roi = entity.Roi,
                    taxAdjustedRoi = entity.TaxAdjustedRoi,
                    npv = entity.Npv,
                    pbpYears = entity.PbpYears,
                    paybackMonths = entity.PaybackMonths,
                    incomeTaxRate = entity.IncomeTaxRate,
                    npvFactor = entity.NpvFactor,
                    metricsFrozen = entity.MetricsFrozen,
                },
                roiActual = RequestGraphMapper.ToFlow(entity).RoiActual,
                roiApprovals = RequestGraphMapper.ToFlow(entity).RoiApprovals,
            });
        }

        public async Task<RequestServiceResult<object>> GetFlowReleaseAsync(Guid id)
        {
            var entity = await _repository.GetActiveByIdAsync(id);
            if (entity == null) return RequestServiceResult<object>.Fail("Request not found.");
            var flow = RequestGraphMapper.ToFlow(entity);
            return RequestServiceResult<object>.Success(new
            {
                releaseChecklist = flow.ReleaseChecklist,
                releaseSubmitted = flow.ReleaseSubmitted,
                releaseApproved = flow.ReleaseApproved,
                releaseArchive = flow.ReleaseArchive,
            });
        }

        public async Task<RequestServiceResult<object>> GetFlowPublishAsync(Guid id)
        {
            var entity = await _repository.GetActiveByIdAsync(id);
            if (entity == null) return RequestServiceResult<object>.Fail("Request not found.");
            var flow = RequestGraphMapper.ToFlow(entity);
            return RequestServiceResult<object>.Success(new
            {
                publishCompleted = flow.PublishCompleted,
                sourcePackage = flow.SourcePackage,
            });
        }

        public async Task<RequestServiceResult<RequestRecordDto>> SaveFlowAsync(RequestFlowSaveDto dto, Guid? userId)
        {
            var entity = await _repository.GetActiveByIdAsync(dto.Id);
            if (entity == null) return RequestServiceResult<RequestRecordDto>.Fail("Request not found.");
            var flow = MergeFlow(RequestGraphMapper.ToFlow(entity), dto.Flow);
            RequestGraphMapper.ApplyFlow(
                entity, flow, _repository,
                dto.Flow.Checks.Count > 0,
                dto.Flow.DevelopChecks.Count > 0,
                dto.Flow.ReleaseChecklist.Count > 0);
            Touch(entity, userId);
            await _repository.SaveChangesAsync();
            return RequestServiceResult<RequestRecordDto>.Success(
                ToRecord(entity, await CanManageDraftAsync(entity, userId)));
        }

        public async Task<RequestServiceResult<RequestRecordDto>> ConfirmPhaseAsync(RequestConfirmPhaseDto dto, Guid? userId)
        {
            var entity = await _repository.GetActiveByIdAsync(dto.Id);
            if (entity == null) return RequestServiceResult<RequestRecordDto>.Fail("Request not found.");

            var form = RequestGraphMapper.ToForm(entity);
            var flow = dto.Flow == null
                ? RequestGraphMapper.ToFlow(entity)
                : MergeFlow(RequestGraphMapper.ToFlow(entity), dto.Flow);
            var action = string.IsNullOrWhiteSpace(dto.Action) ? "confirm" : dto.Action.Trim().ToLowerInvariant();
            var phase = (dto.Phase ?? entity.Status).Trim().ToLowerInvariant();
            var replaceRelease = dto.Flow?.ReleaseChecklist.Count > 0;

            if (action == "skip")
            {
                switch (phase)
                {
                    case "checking":
                    case "submitted":
                        entity.Status = "roi_followup";
                        entity.PendingApprover = form.Basic.Owner?.Username ?? entity.OwnerUsername;
                        RequestGraphMapper.ApplyFlow(entity, flow, _repository, false, false, replaceRelease);
                        RequestGraphMapper.SetStage(entity, "check", "confirmed", "Skipped (Test)");
                        RequestGraphMapper.SetStage(entity, "roi", "in_progress");
                        break;
                    case "roi_followup":
                        entity.Status = "developing";
                        entity.PendingApprover = "Dev Team";
                        RequestGraphMapper.ApplyFlow(entity, flow, _repository, false, false, replaceRelease);
                        RequestGraphMapper.SetStage(entity, "roi", "confirmed", "Skipped (Test)");
                        RequestGraphMapper.SetStage(entity, "develop", "in_progress");
                        break;
                    case "developing":
                        entity.Status = "releasing";
                        entity.PendingApprover = null;
                        RequestGraphMapper.ApplyFlow(entity, flow, _repository, false, false, replaceRelease);
                        RequestGraphMapper.SetStage(entity, "develop", "confirmed", "Skipped (Test)");
                        RequestGraphMapper.SetStage(entity, "release", "in_progress");
                        break;
                    case "releasing":
                        flow.ReleaseSubmitted = true;
                        flow.ReleaseApproved = true;
                        entity.Status = "published";
                        entity.PendingApprover = null;
                        RequestGraphMapper.ApplyFlow(entity, flow, _repository, false, false, replaceRelease);
                        RequestGraphMapper.SetStage(entity, "release", "confirmed", "Skipped (Test)");
                        RequestGraphMapper.SetStage(entity, "publish", "in_progress");
                        break;
                    default:
                        return RequestServiceResult<RequestRecordDto>.Fail($"Phase cannot be skipped: {phase}");
                }
                entity.AwaitingMe = false;
                return await Persist(entity, userId);
            }

            if (action == "reject")
            {
                entity.Status = "rejected";
                entity.AwaitingMe = false;
                entity.PendingApprover = null;
                flow.ReleaseSubmitted = false;
                var flowPhase = RequestGraphMapper.ToFlowPhase(phase) ?? "check";
                RequestGraphMapper.ApplyFlow(entity, flow, _repository, dto.Flow?.Checks.Count > 0, dto.Flow?.DevelopChecks.Count > 0, replaceRelease);
                RequestGraphMapper.SetStage(entity, flowPhase, "rejected");
                return await Persist(entity, userId);
            }

            switch (phase)
            {
                case "checking":
                case "submitted":
                    if (flow.Checks.Count == 0 || flow.Checks.Any(c => c.Status != "pass"))
                        return RequestServiceResult<RequestRecordDto>.Fail("All check items must be Pass.");
                    entity.Status = "roi_followup";
                    entity.PendingApprover = form.Basic.Owner?.Username ?? entity.OwnerUsername;
                    entity.AwaitingMe = false;
                    RequestGraphMapper.ApplyFlow(entity, flow, _repository, true, dto.Flow?.DevelopChecks.Count > 0, replaceRelease);
                    RequestGraphMapper.SetStage(entity, "check", "confirmed");
                    RequestGraphMapper.SetStage(entity, "roi", "in_progress");
                    break;
                case "developing":
                    if (string.IsNullOrWhiteSpace(flow.SourcePackage?.Url))
                        return RequestServiceResult<RequestRecordDto>.Fail("Source package is required.");
                    if (flow.DevelopChecks.Any(c => c.Status is not ("pass" or "waived")))
                        return RequestServiceResult<RequestRecordDto>.Fail("All develop checks must be Pass or Waived.");
                    var datasets = await GetDatasetsAsync();
                    flow.ReleaseChecklist = RequestFlowDefaults.BuildReleaseChecklist(form, datasets, flow.RoiActual);
                    flow.ReleaseSubmitted = false;
                    entity.Status = "releasing";
                    entity.PendingApprover = null;
                    entity.AwaitingMe = false;
                    RequestGraphMapper.ApplyFlow(entity, flow, _repository, false, true, true);
                    RequestGraphMapper.SetStage(entity, "develop", "confirmed");
                    RequestGraphMapper.SetStage(entity, "release", "in_progress");
                    break;
                case "roi_followup":
                    if (flow.RoiApprovals.Count == 0 || flow.RoiApprovals.Any(x => x.Status != "approved"))
                        return RequestServiceResult<RequestRecordDto>.Fail("All ROI approval steps must be Approved.");
                    entity.Status = "developing";
                    entity.PendingApprover = "Dev Team";
                    entity.AwaitingMe = false;
                    RequestGraphMapper.ApplyFlow(entity, flow, _repository, false, false, replaceRelease);
                    RequestGraphMapper.SetStage(entity, "roi", "confirmed");
                    RequestGraphMapper.SetStage(entity, "develop", "in_progress");
                    break;
                case "releasing":
                    flow.ReleaseApproved = true;
                    flow.ReleaseSubmitted = true;
                    flow.PublishCompleted = false;
                    entity.Status = "published";
                    entity.PendingApprover = null;
                    entity.AwaitingMe = false;
                    FreezeMetrics(entity, form);
                    RequestGraphMapper.ApplyFlow(entity, flow, _repository, false, false, replaceRelease);
                    RequestGraphMapper.SetStage(entity, "release", "confirmed");
                    RequestGraphMapper.SetStage(entity, "publish", "in_progress");
                    break;
                case "published":
                    flow.PublishCompleted = true;
                    entity.PendingApprover = null;
                    entity.AwaitingMe = false;
                    RequestGraphMapper.ApplyFlow(entity, flow, _repository, false, false, replaceRelease);
                    RequestGraphMapper.SetStage(entity, "publish", "confirmed");
                    break;
                default:
                    return RequestServiceResult<RequestRecordDto>.Fail($"Unknown phase: {phase}");
            }

            return await Persist(entity, userId);
        }

        private async Task<RequestServiceResult<RequestRecordDto>> Persist(AgentRequest entity, Guid? userId)
        {
            Touch(entity, userId);
            await _repository.SaveChangesAsync();
            return RequestServiceResult<RequestRecordDto>.Success(
                ToRecord(entity, await CanManageDraftAsync(entity, userId)));
        }

        private async Task<IQueryable<AgentRequest>> BuildListQueryAsync(RequestListQueryDto dto, Guid? userId)
        {
            var query = ApplyListFilter(_repository.QueryActiveForList(), dto);
            if (!IsMineScope(dto)) return query;
            if (!userId.HasValue) return query.Where(_ => false);

            var user = await _userRepository.GetByPropsAsync(nameof(UserInfo.ID), userId.Value);
            var userno = user?.Userno?.Trim() ?? string.Empty;
            var ntAccount = user?.NtAccount?.Trim() ?? string.Empty;

            return query.Where(x =>
                x.CreatedBy == userId
                || (!string.IsNullOrEmpty(userno) && x.OwnerUserno == userno)
                || (!string.IsNullOrEmpty(ntAccount) && x.OwnerNtAccount == ntAccount));
        }

        private static bool IsMineScope(RequestListQueryDto dto) =>
            string.Equals(dto.Scope, "mine", StringComparison.OrdinalIgnoreCase);

        private static IQueryable<AgentRequest> ApplyListFilter(IQueryable<AgentRequest> query, RequestListQueryDto dto)
        {
            if (string.Equals(dto.Tab, "pending", StringComparison.OrdinalIgnoreCase))
                query = query.Where(x => x.AwaitingMe);
            var needle = dto.Q?.Trim();
            if (!string.IsNullOrEmpty(needle))
                query = query.Where(x => x.Name.Contains(needle));
            return query;
        }

        private static void Touch(AgentRequest entity, Guid? userId)
        {
            entity.UpdatedAt = DateTime.UtcNow;
            entity.UpdatedBy = userId;
        }

        private async Task<RequestSecurityDto> ResolveSecurityAsync(RequestSecurityDto security)
        {
            security = NormalizeSecurity(security);
            if (security.SecurityMode != "manual" && security.DataSourceIds.Count > 0)
            {
                var datasets = await GetDatasetsAsync();
                string? maxC = null, maxI = null, maxA = null;
                foreach (var ds in datasets.Where(d => security.DataSourceIds.Contains(d.Id)))
                {
                    maxC = MaxScLevel(maxC, ds.ScConfidentiality);
                    maxI = MaxScLevel(maxI, ds.ScIntegrity);
                    maxA = MaxScLevel(maxA, ds.ScAvailability);
                }
                security.DerivedScC = maxC;
                security.DerivedScI = maxI;
                security.DerivedScA = maxA;
                security.FinalScC = maxC;
                security.FinalScI = maxI;
                security.FinalScA = maxA;
            }
            return security;
        }

        private static RequestSecurityDto NormalizeSecurity(RequestSecurityDto security)
        {
            var mode = security.SecurityMode == "manual" ? "manual" : "datasource";
            security.SecurityMode = mode;
            if (mode == "manual")
            {
                security.FinalScC = EmptyToNull(security.ManualScC);
                security.FinalScI = EmptyToNull(security.ManualScI);
                security.FinalScA = EmptyToNull(security.ManualScA);
            }
            else
            {
                security.FinalScC = EmptyToNull(security.DerivedScC);
                security.FinalScI = EmptyToNull(security.DerivedScI);
                security.FinalScA = EmptyToNull(security.DerivedScA);
            }
            return security;
        }

        private static string? EmptyToNull(string? value)
            => string.IsNullOrWhiteSpace(value) ? null : value.Trim();

        private static int ScRank(string? value)
        {
            if (string.IsNullOrWhiteSpace(value)) return -1;
            var digit = value[^1];
            return digit is >= '0' and <= '4' ? digit - '0' : -1;
        }

        private static string? MaxScLevel(string? current, string? next)
        {
            if (string.IsNullOrWhiteSpace(next)) return current;
            if (string.IsNullOrWhiteSpace(current)) return next;
            return ScRank(next) > ScRank(current) ? next : current;
        }

        private static string? GetSubmitBlocker(RequestFormDto form)
        {
            var b = form.Basic;
            if (string.IsNullOrWhiteSpace(b.Name)) return "Basic Infos: Name";
            if (string.IsNullOrWhiteSpace(b.Description)) return "Basic Infos: Description";
            if (string.IsNullOrWhiteSpace(b.Pjm?.Username)) return "Basic Infos: PJM";
            if (string.IsNullOrWhiteSpace(b.Sponsor?.Username)) return "Basic Infos: Sponsor";

            var mode = form.Security.SecurityMode ?? "datasource";
            if (mode == "datasource" && form.Security.DataSourceIds.Count == 0)
                return "Data & Security: select at least one data source";
            if (mode == "manual")
            {
                if (string.IsNullOrWhiteSpace(form.Security.ManualScC)
                    || string.IsNullOrWhiteSpace(form.Security.ManualScI)
                    || string.IsNullOrWhiteSpace(form.Security.ManualScA))
                    return "Data & Security: Manual C / I / A SC";
            }

            var hasSaving = form.Cost.SavingEntries.Count > 0 || form.Cost.AdditionalSavings.Count > 0;
            if (!hasSaving) return "Cost & Saving: add at least one Saving item";
            var incomeTaxRate = form.Cost.IncomeTaxRate > 0 ? form.Cost.IncomeTaxRate : RoiCalculator.DefaultIncomeTaxRate;
            var metrics = RequestMetrics.Compute(form.Cost, incomeTaxRate);
            if (metrics.InvestmentY0 <= 0 && metrics.SavingY0 <= 0)
                return "Cost & Saving: Investment or Saving amount must be greater than 0";
            if (!form.TermsAccepted) return "Review: accept the terms";
            return null;
        }

        private static void FreezeMetrics(AgentRequest entity, RequestFormDto form)
        {
            if (entity.MetricsFrozen) return;
            var incomeTaxRate = RequestGraphMapper.ResolveIncomeTaxRate(entity, form);
            var npvFactor = entity.NpvFactor > 0 ? entity.NpvFactor : RoiCalculator.DefaultNpvFactor;
            var metrics = RequestMetrics.Compute(form.Cost, incomeTaxRate, npvFactor);
            entity.InvestmentY0 = metrics.InvestmentY0;
            entity.SavingY0 = metrics.SavingY0;
            entity.SavingNextYear = metrics.SavingNextYear;
            entity.TotalSaving = metrics.TotalCashIn;
            entity.TotalInvestment = metrics.TotalCashOut;
            entity.Roi = metrics.Roi;
            entity.TaxAdjustedRoi = metrics.TaxAdjustedRoi;
            entity.Npv = metrics.Npv;
            entity.PbpYears = metrics.PbpYears;
            entity.PaybackMonths = metrics.PaybackMonths;
            entity.IncomeTaxRate = incomeTaxRate;
            entity.NpvFactor = npvFactor;
            entity.MetricsFrozen = true;
        }

        public async Task<RequestServiceResult<RequestRecordDto>> CloseMetricsAsync(Guid id, Guid? userId)
        {
            var entity = await _repository.GetActiveByIdAsync(id);
            if (entity == null) return RequestServiceResult<RequestRecordDto>.Fail("Request not found.");
            var form = RequestGraphMapper.ToForm(entity);
            FreezeMetrics(entity, form);
            return await Persist(entity, userId);
        }

        public async Task<RequestServiceResult<RequestRecordDto>> OpenMetricsAsync(Guid id, Guid? userId)
        {
            var entity = await _repository.GetActiveByIdAsync(id);
            if (entity == null) return RequestServiceResult<RequestRecordDto>.Fail("Request not found.");
            entity.MetricsFrozen = false;
            var form = RequestGraphMapper.ToForm(entity);
            RequestGraphMapper.ApplyForm(entity, form, _repository);
            return await Persist(entity, userId);
        }

        private static RequestFlowDto MergeFlow(RequestFlowDto current, RequestFlowDto patch)
        {
            if (patch.Checks.Count > 0) current.Checks = patch.Checks;
            if (patch.DevelopChecks.Count > 0) current.DevelopChecks = patch.DevelopChecks;
            if (patch.ReleaseChecklist.Count > 0) current.ReleaseChecklist = patch.ReleaseChecklist;
            if (patch.DevelopMode != null) current.DevelopMode = patch.DevelopMode;
            if (patch.SourcePackage != null) current.SourcePackage = patch.SourcePackage;
            if (patch.RoiActual != null) current.RoiActual = patch.RoiActual;
            if (patch.RoiApprovals.Count > 0) current.RoiApprovals = patch.RoiApprovals;
            if (patch.ReleaseArchive != null) current.ReleaseArchive = patch.ReleaseArchive;
            current.ReleaseSubmitted = patch.ReleaseSubmitted || current.ReleaseSubmitted;
            current.ReleaseApproved = patch.ReleaseApproved || current.ReleaseApproved;
            current.PublishCompleted = patch.PublishCompleted || current.PublishCompleted;
            return current;
        }

        private static RoiCalcResult ResolveListDisplayMetrics(AgentRequest entity, out int aiLevel)
        {
            var form = RequestGraphMapper.ToForm(entity);
            aiLevel = form.Options.AiLevel;
            var incomeTaxRate = RequestGraphMapper.ResolveIncomeTaxRate(entity, form);
            var npvFactor = entity.NpvFactor > 0 ? entity.NpvFactor : RoiCalculator.DefaultNpvFactor;
            return RequestMetrics.ComputeForListDisplay(form.Cost, incomeTaxRate, npvFactor, entity.ID);
        }

        private static RoiCalcResult ResolveListDisplayMetrics(AgentRequest entity)
            => ResolveListDisplayMetrics(entity, out _);

        private static RequestListItemDto ToListItem(
            AgentRequest entity,
            Guid? userId,
            string? userno,
            string? ntAccount)
        {
            var metrics = ResolveListDisplayMetrics(entity, out var aiLevel);

            return new RequestListItemDto
            {
                Id = entity.ID,
                Name = entity.Name,
                Status = entity.Status,
                FinalScC = entity.FinalScC,
                FinalScI = entity.FinalScI,
                FinalScA = entity.FinalScA,
                AiLevel = aiLevel,
                Owner = entity.OwnerUsername,
                Department = entity.OwnerDeptName,
                CanManageDraft = CanManageDraft(entity, userId, userno, ntAccount),
                InvestmentY0 = metrics.InvestmentY0,
                SavingY0 = metrics.SavingY0,
                SavingNextYear = metrics.SavingNextYear,
                Roi = metrics.Roi,
                TaxAdjustedRoi = metrics.TaxAdjustedRoi,
                Npv = metrics.Npv,
                PbpYears = metrics.PbpYears,
                PaybackMonths = metrics.PaybackMonths,
                PendingApprover = entity.PendingApprover,
                AwaitingMe = entity.AwaitingMe,
                CreatedAt = entity.CreatedAt,
                UpdatedAt = entity.UpdatedAt ?? entity.CreatedAt,
            };
        }

        private static RequestRecordDto ToRecord(AgentRequest entity, bool canManageDraft)
        {
            var form = RequestGraphMapper.ToForm(entity);
            var flow = RequestGraphMapper.ToFlow(entity);
            return new RequestRecordDto
            {
                Id = entity.ID,
                Status = entity.Status,
                Form = form,
                CreatedAt = entity.CreatedAt,
                UpdatedAt = entity.UpdatedAt ?? entity.CreatedAt,
                CreatedBy = entity.CreatedBy,
                CanManageDraft = canManageDraft,
                PendingApprover = entity.PendingApprover,
                AwaitingMe = entity.AwaitingMe,
                Checks = flow.Checks,
                DevelopMode = flow.DevelopMode,
                DevelopChecks = flow.DevelopChecks,
                SourcePackage = flow.SourcePackage,
                RoiActual = flow.RoiActual,
                RoiApprovals = flow.RoiApprovals,
                ReleaseChecklist = flow.ReleaseChecklist,
                ReleaseSubmitted = flow.ReleaseSubmitted,
                ReleaseApproved = flow.ReleaseApproved,
                ReleaseArchive = flow.ReleaseArchive,
                PublishCompleted = flow.PublishCompleted,
                InvestmentY0 = entity.InvestmentY0,
                SavingY0 = entity.SavingY0,
                SavingNextYear = entity.SavingNextYear,
                Roi = entity.Roi,
                TaxAdjustedRoi = entity.TaxAdjustedRoi,
                Npv = entity.Npv,
                PbpYears = entity.PbpYears,
                PaybackMonths = entity.PaybackMonths,
                IncomeTaxRate = entity.IncomeTaxRate,
                NpvFactor = entity.NpvFactor,
                MetricsFrozen = entity.MetricsFrozen,
            };
        }

        private async Task<(string? Userno, string? NtAccount)> ResolveUserKeysAsync(Guid? userId)
        {
            if (!userId.HasValue) return (null, null);
            var user = await _userRepository.GetByPropsAsync(nameof(UserInfo.ID), userId.Value);
            return (user?.Userno?.Trim(), user?.NtAccount?.Trim());
        }

        private async Task<bool> CanManageDraftAsync(AgentRequest entity, Guid? userId)
        {
            var (userno, ntAccount) = await ResolveUserKeysAsync(userId);
            return CanManageDraft(entity, userId, userno, ntAccount);
        }

        private static bool CanManageDraft(
            AgentRequest entity,
            Guid? userId,
            string? userno,
            string? ntAccount)
        {
            if (!userId.HasValue) return false;
            if (entity.CreatedBy == userId) return true;
            if (!string.IsNullOrEmpty(userno)
                && string.Equals(entity.OwnerUserno?.Trim(), userno, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
            if (!string.IsNullOrEmpty(ntAccount)
                && string.Equals(entity.OwnerNtAccount?.Trim(), ntAccount, StringComparison.OrdinalIgnoreCase))
            {
                return true;
            }
            return false;
        }

        private static string PipelineLastStep =>
            string.Equals(_pipelineLastStep.Value, "start", StringComparison.Ordinal)
                ? "save-changes"
                : (_pipelineLastStep.Value ?? "init");

        private static void LogRequestStep(string tag, string step, string? detail = null)
        {
            _pipelineLastStep.Value = step;
            LogHelper.Info(tag, string.IsNullOrWhiteSpace(detail) ? step : $"{step}: {detail}");
        }

        private static void LogRequestFail(string tag, string step, Exception ex, string? detail = null)
        {
            _pipelineLastStep.Value = step;
            var suffix = string.IsNullOrWhiteSpace(detail) ? ex.Message : $"{detail} — {ex.Message}";
            LogHelper.Error(tag, $"Failed at {step}: {suffix}", ex);
        }
    }
}
