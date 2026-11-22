using CommonService.Application.DTOs;
using CommonService.Core.Models;
using CommonService.Core.Repositories.Interfaces;
using CommonService.Core.Utils;
using System.Text.Json;

namespace CommonService.Application.Services
{
    internal static class RequestGraphMapper
    {
        private static string RequestLogTag => LogHelper.ScopeTag ?? "request/save";
        public static readonly string[] StagePhases = { "check", "roi", "develop", "release", "publish" };

        public static void EnsureGraph(AgentRequest entity)
        {
            entity.Token ??= new AgentRequestFormToken { RequestID = entity.ID };
            entity.Token.RequestID = entity.ID;
            entity.AiOptions ??= new AgentRequestFormAiOptions { RequestID = entity.ID };
            entity.AiOptions.RequestID = entity.ID;
            entity.Develop ??= new AgentRequestFlowDevelop { RequestID = entity.ID };
            entity.FlowRoi ??= new AgentRequestFlowRoi { RequestID = entity.ID };
            entity.Release ??= new AgentRequestFlowRelease { RequestID = entity.ID };
            if (entity.Stages.Count == 0)
            {
                for (var i = 0; i < StagePhases.Length; i++)
                {
                    entity.Stages.Add(new AgentRequestFlowStage
                    {
                        RequestID = entity.ID,
                        Phase = StagePhases[i],
                        Status = "pending",
                        SortOrder = i,
                    });
                }
            }
        }

        public static void SeedDefaultChecks(AgentRequest entity)
        {
            AddChecks(entity, "check", RequestFlowDefaults.DefaultChecks());
            AddChecks(entity, "develop", RequestFlowDefaults.DefaultDevelopChecks());
        }

        public static RequestFormDto ToForm(AgentRequest entity)
        {
            var token = entity.Token;
            var opts = entity.AiOptions;
            var app = entity.FormServers.FirstOrDefault(x => x.Type == "app");
            var db = entity.FormServers.FirstOrDefault(x => x.Type == "db");
            var rppEntries = entity.Rpps.OrderBy(x => x.SortOrder).Select(ToRpp).ToList();
            var rppFirst = rppEntries.FirstOrDefault();

            var dto = RequestFormFactory.CreateDefault();
            dto.Basic = new RequestBasicDto
            {
                Name = entity.Name,
                Domain = entity.Domain ?? "",
                Description = entity.Description ?? "",
                Owner = ToPerson(
                    entity.OwnerUserno,
                    entity.OwnerNtAccount,
                    entity.OwnerUsername,
                    entity.OwnerDeptName),
                Pjm = ToPerson(entity.PjmUserno, entity.PjmNtAccount, entity.PjmUsername, entity.PjmDeptName),
                Sponsor = ToPerson(entity.SponsorUserno, entity.SponsorNtAccount, entity.SponsorUsername, entity.SponsorDeptName),
            };
            dto.Security = new RequestSecurityDto
            {
                SecurityMode = entity.SecurityMode,
                DataSourceIds = entity.FormDatasets.OrderBy(x => x.SortOrder).Select(x => x.DatasetCode).ToList(),
                DerivedScC = entity.DerivedScC,
                DerivedScI = entity.DerivedScI,
                DerivedScA = entity.DerivedScA,
                ManualScC = entity.ManualScC,
                ManualScI = entity.ManualScI,
                ManualScA = entity.ManualScA,
                OverrideNote = entity.OverrideNote ?? "",
                FinalScC = entity.FinalScC,
                FinalScI = entity.FinalScI,
                FinalScA = entity.FinalScA,
            };
            dto.Cost = new RequestCostDto
            {
                FrequencyPerMonth = entity.FrequencyPerMonth,
                SavingMode = entity.SavingMode,
                SavingPerUseMoney = entity.SavingPerUseMoney,
                SavingPerUseFte = entity.SavingPerUseFte,
                EstimatedInvestment = entity.EstimatedInvestment,
                CycleStartMonth = entity.CycleStartMonth,
                IncomeTaxRate = entity.IncomeTaxRate > 0 ? entity.IncomeTaxRate : RoiCalculator.DefaultIncomeTaxRate,
                RppEntries = rppEntries,
                RppId = rppFirst?.RppId ?? "",
                RppLink = rppFirst?.RppLink ?? "",
                SavingYearRatios = Years(entity.RatioY0, entity.RatioY1, entity.RatioY2, entity.RatioY3, entity.RatioY4, entity.RatioY5),
                Investment = new RequestInvestmentDto
                {
                    Server = new RequestInvestmentServerDto
                    {
                        TierId = app?.ServerCode ?? "none",
                        Quantity = app?.Quantity ?? 1,
                    },
                    Db = new RequestInvestmentDbDto
                    {
                        DbTypeId = db?.ServerCode ?? "none",
                        InitialSizeGb = db?.DbInitialSizeGb ?? 50,
                        IncrementGbPerYear = db?.DbIncrementGbPerYear ?? 20,
                        RetentionYears = db?.DbRetentionYears ?? 3,
                    },
                    Token = new RequestInvestmentTokenDto
                    {
                        CallsPerMonth = token?.CallsPerMonth ?? 0,
                        AvgTokensPerCall = token?.AvgTokensPerCall ?? 0,
                        PricePer1kTokens = token?.PricePer1k ?? 0.012m,
                        QuotaMode = token?.QuotaMode ?? "money",
                        QuotaLimit = token?.QuotaLimit ?? 0,
                    },
                    Personnel = entity.CostSavings
                        .Where(x => x.Kind == "personnel")
                        .OrderBy(x => x.SortOrder)
                        .Select(ToPersonnel)
                        .ToList(),
                    ExternalPayments = entity.CostSavings
                        .Where(x => x.Kind == "payment_outside")
                        .OrderBy(x => x.SortOrder)
                        .Select(ToExternalPayment)
                        .ToList(),
                },
                SavingEntries = entity.CostSavings
                    .Where(x => x.Kind == "manual_efficiency")
                    .OrderBy(x => x.SortOrder)
                    .Select(ToSavingHc)
                    .ToList(),
                AdditionalSavings = entity.CostSavings
                    .Where(x => x.Kind == "additional")
                    .OrderBy(x => x.SortOrder)
                    .Select(ToAdditional)
                    .ToList(),
            };
            dto.Options = new RequestOptionsDto
            {
                HumanInLoop = opts?.HumanInLoop ?? true,
                BoschChinaOnly = opts?.BoschChinaOnly ?? true,
                PersonalDataLevel = Math.Clamp(opts?.PersonalDataLevel ?? 1, 1, 3),
                ImpactLossLevel = Math.Clamp(opts?.ImpactLossLevel ?? 1, 1, 3),
                NoReputationPhysicalHarm = opts?.NoReputationPhysicalHarm ?? true,
            };
            dto.Options.AiLevel = DeriveAiLevel(dto.Options);
            dto.Remarks = entity.Remarks ?? "";
            dto.Attachments = entity.Attachments
                .Where(a => a.Category == "basic")
                .OrderBy(a => a.SortOrder)
                .Select(a => new RequestCheckAttachmentDto
                {
                    Uid = a.Uid,
                    Name = a.Name,
                    Size = a.Size,
                    Type = a.Type,
                    UploadedAt = a.UploadedAt,
                }).ToList();
            dto.TermsAccepted = entity.TermsAccepted;
            return dto;
        }

        public static RequestFlowDto ToFlow(AgentRequest entity)
        {
            var develop = entity.Develop;
            var roi = entity.FlowRoi;
            var release = entity.Release;
            var publish = entity.Stages.FirstOrDefault(s => s.Phase == "publish");
            return new RequestFlowDto
            {
                Checks = entity.Checks.Where(c => c.Phase == "check").OrderBy(c => c.SortOrder).Select(c => ToCheckDto(entity, c)).ToList(),
                DevelopChecks = entity.Checks.Where(c => c.Phase == "develop").OrderBy(c => c.SortOrder).Select(c => ToCheckDto(entity, c)).ToList(),
                DevelopMode = develop?.DevelopMode,
                SourcePackage = ToSource(develop),
                RoiActual = ToRoi(roi),
                RoiApprovals = ToRoiApprovals(roi),
                ReleaseChecklist = release?.Items.OrderBy(x => x.SortOrder).Select(ToReleaseItem).ToList() ?? new(),
                ReleaseSubmitted = release?.Submitted ?? false,
                ReleaseApproved = release?.Approved ?? false,
                ReleaseArchive = ToArchive(release),
                PublishCompleted = publish?.Status == "confirmed",
            };
        }

        public static void ApplyForm(AgentRequest entity, RequestFormDto form, IAgentRequestRepository repo)
        {
            LogHelper.Info(RequestLogTag,"apply-form/stages");
            repo.EnsureStagesLoaded(entity);
            LogHelper.Info(RequestLogTag,"apply-form/graph");
            EnsureGraph(entity);
            LogHelper.Info(RequestLogTag,"apply-form/remove-lines");
            repo.RemoveFormLines(entity);
            var costSavings = new List<AgentRequestFormCostSaving>();
            var incomeTaxRate = ResolveIncomeTaxRate(entity, form);
            var npvFactor = entity.NpvFactor > 0 ? entity.NpvFactor : RoiCalculator.DefaultNpvFactor;
            LogHelper.Info(RequestLogTag,"apply-form/metrics");
            var metrics = RequestMetrics.Compute(form.Cost, incomeTaxRate, npvFactor, entity.ID);

            entity.Name = form.Basic.Name?.Trim() ?? "";
            entity.Domain = EmptyToNull(form.Basic.Domain);
            entity.Description = form.Basic.Description;
            WritePerson(form.Basic.Owner, (u, n, name, d) =>
            {
                entity.OwnerUserno = u;
                entity.OwnerNtAccount = n;
                entity.OwnerUsername = name;
                entity.OwnerDeptName = d;
            });
            WritePerson(form.Basic.Pjm, (u, n, name, d) =>
            {
                entity.PjmUserno = u; entity.PjmNtAccount = n; entity.PjmUsername = name; entity.PjmDeptName = d;
            });
            WritePerson(form.Basic.Sponsor, (u, n, name, d) =>
            {
                entity.SponsorUserno = u; entity.SponsorNtAccount = n; entity.SponsorUsername = name; entity.SponsorDeptName = d;
            });

            entity.Remarks = form.Remarks ?? "";
            entity.SecurityMode = string.IsNullOrWhiteSpace(form.Security.SecurityMode) ? "datasource" : form.Security.SecurityMode;
            entity.DerivedScC = EmptyToNull(form.Security.DerivedScC);
            entity.DerivedScI = EmptyToNull(form.Security.DerivedScI);
            entity.DerivedScA = EmptyToNull(form.Security.DerivedScA);
            entity.ManualScC = EmptyToNull(form.Security.ManualScC);
            entity.ManualScI = EmptyToNull(form.Security.ManualScI);
            entity.ManualScA = EmptyToNull(form.Security.ManualScA);
            entity.OverrideNote = form.Security.OverrideNote;
            entity.FinalScC = EmptyToNull(form.Security.FinalScC);
            entity.FinalScI = EmptyToNull(form.Security.FinalScI);
            entity.FinalScA = EmptyToNull(form.Security.FinalScA);

            var inv = form.Cost.Investment;
            var serverCode = string.IsNullOrWhiteSpace(inv.Server.TierId) ? "none" : inv.Server.TierId.Trim();
            var dbCode = string.IsNullOrWhiteSpace(inv.Db.DbTypeId) ? "none" : inv.Db.DbTypeId.Trim();
            LogHelper.Info(RequestLogTag,
                $"apply-form/investment: server={serverCode} db={dbCode} datasets={form.Security.DataSourceIds?.Count ?? 0}");

            if (!string.Equals(serverCode, "none", StringComparison.OrdinalIgnoreCase))
            {
                repo.AddFormServer(entity, new AgentRequestFormServer
                {
                    Type = "app",
                    ServerCode = serverCode,
                    Quantity = inv.Server.Quantity <= 0 ? 1 : inv.Server.Quantity,
                    SortOrder = 0,
                });
            }

            if (!string.Equals(dbCode, "none", StringComparison.OrdinalIgnoreCase))
            {
                repo.AddFormServer(entity, new AgentRequestFormServer
                {
                    Type = "db",
                    ServerCode = dbCode,
                    Quantity = 1,
                    DbInitialSizeGb = inv.Db.InitialSizeGb,
                    DbIncrementGbPerYear = inv.Db.IncrementGbPerYear,
                    DbRetentionYears = inv.Db.RetentionYears,
                    SortOrder = 1,
                });
            }

            if (entity.Token == null)
            {
                entity.Token = new AgentRequestFormToken { RequestID = entity.ID };
            }
            entity.Token.CallsPerMonth = inv.Token.CallsPerMonth;
            entity.Token.AvgTokensPerCall = inv.Token.AvgTokensPerCall;
            entity.Token.PricePer1k = inv.Token.PricePer1kTokens;
            entity.Token.QuotaMode = inv.Token.QuotaMode ?? "money";
            entity.Token.QuotaLimit = inv.Token.QuotaLimit;

            entity.FrequencyPerMonth = form.Cost.FrequencyPerMonth;
            entity.SavingMode = form.Cost.SavingMode ?? "fte";
            entity.SavingPerUseMoney = form.Cost.SavingPerUseMoney;
            entity.SavingPerUseFte = form.Cost.SavingPerUseFte;
            entity.CycleStartMonth = NormalizeCycleStartMonth(form.Cost.CycleStartMonth);
            var ratios = Pad6(form.Cost.SavingYearRatios, 1);
            entity.RatioY0 = ratios[0]; entity.RatioY1 = ratios[1]; entity.RatioY2 = ratios[2];
            entity.RatioY3 = ratios[3]; entity.RatioY4 = ratios[4]; entity.RatioY5 = ratios[5];

            if (entity.AiOptions == null)
            {
                entity.AiOptions = new AgentRequestFormAiOptions { RequestID = entity.ID };
            }
            entity.AiOptions.HumanInLoop = form.Options.HumanInLoop;
            entity.AiOptions.BoschChinaOnly = form.Options.BoschChinaOnly;
            entity.AiOptions.PersonalDataLevel = Math.Clamp(form.Options.PersonalDataLevel, 1, 3);
            entity.AiOptions.ImpactLossLevel = Math.Clamp(form.Options.ImpactLossLevel, 1, 3);
            entity.AiOptions.NoReputationPhysicalHarm = form.Options.NoReputationPhysicalHarm;
            entity.AiLevel = DeriveAiLevel(form.Options);
            entity.TermsAccepted = form.TermsAccepted;

            if (!entity.MetricsFrozen)
            {
                ApplyMetrics(entity, metrics, incomeTaxRate, npvFactor);
                entity.EstimatedInvestment = metrics.InvestmentY0;
            }
            else
            {
                LogHelper.Info(RequestLogTag,
                    $"apply-form/metrics-frozen: requestId={entity.ID} skip write " +
                    $"storedSavingY0={entity.SavingY0} computedSavingY0={metrics.SavingY0}");
            }
            form.Cost.EstimatedInvestment = entity.InvestmentY0;

            var rppRows = (form.Cost.RppEntries ?? new List<RequestRppDto>()).ToList();
            if (rppRows.Count == 0
                && (!string.IsNullOrWhiteSpace(form.Cost.RppId) || !string.IsNullOrWhiteSpace(form.Cost.RppLink)))
            {
                rppRows.Add(new RequestRppDto
                {
                    RppId = form.Cost.RppId ?? "",
                    RppLink = form.Cost.RppLink ?? "",
                });
            }
            var rppSort = 0;
            foreach (var item in rppRows)
            {
                if (string.IsNullOrWhiteSpace(item.RppId) && string.IsNullOrWhiteSpace(item.RppLink)) continue;
                repo.AddFormRpp(entity, new AgentRequestFormRpp
                {
                    RppId = item.RppId ?? "",
                    RppLink = item.RppLink ?? "",
                    SortOrder = rppSort++,
                });
            }

            var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var i = 0;
            foreach (var code in form.Security.DataSourceIds ?? new())
            {
                if (string.IsNullOrWhiteSpace(code) || !seen.Add(code)) continue;
                repo.AddFormDataset(entity, new AgentRequestFormDataset
                {
                    DatasetCode = code,
                    SortOrder = i++,
                });
            }

            i = 0;
            foreach (var item in inv.Personnel ?? new())
            {
                var hc = Pad6(item.HcByYear, 0);
                costSavings.Add(new AgentRequestFormCostSaving
                {
                    RequestID = entity.ID,
                    Kind = "personnel",
                    ClientId = ClientId(item.Id),
                    Category = item.Category ?? "development",
                    CostCenter = item.CostCenter ?? "",
                    Level = HcLevelHelper.Normalize(item.Level),
                    HcY0 = hc[0], HcY1 = hc[1], HcY2 = hc[2], HcY3 = hc[3], HcY4 = hc[4], HcY5 = hc[5],
                    SortOrder = i++,
                });
            }

            i = 0;
            foreach (var item in inv.ExternalPayments ?? new())
            {
                var amt = Pad6(item.AmountByYear, 0);
                costSavings.Add(new AgentRequestFormCostSaving
                {
                    RequestID = entity.ID,
                    Kind = "payment_outside",
                    ClientId = ClientId(item.Id),
                    Category = NormalizeExternalPaymentCategory(item.Category),
                    CostCenter = item.CostCenter ?? "",
                    AmountY0 = amt[0], AmountY1 = amt[1], AmountY2 = amt[2],
                    AmountY3 = amt[3], AmountY4 = amt[4], AmountY5 = amt[5],
                    SortOrder = i++,
                });
            }

            i = 0;
            foreach (var item in form.Cost.SavingEntries ?? new())
            {
                var hc = Pad6(item.HcByYear, item.Hc);
                costSavings.Add(new AgentRequestFormCostSaving
                {
                    RequestID = entity.ID,
                    Kind = "manual_efficiency",
                    ClientId = ClientId(item.Id),
                    Dept = item.Dept ?? "",
                    CostCenter = item.CostCenter ?? "",
                    Level = HcLevelHelper.Normalize(item.Level),
                    Hc = hc[0],
                    HcY0 = hc[0], HcY1 = hc[1], HcY2 = hc[2], HcY3 = hc[3], HcY4 = hc[4], HcY5 = hc[5],
                    UnitPriceYearly = item.UnitPriceYearly,
                    SortOrder = i++,
                });
            }

            i = 0;
            foreach (var item in form.Cost.AdditionalSavings ?? new())
            {
                var amt = Pad6(item.AmountByYear, 0);
                costSavings.Add(new AgentRequestFormCostSaving
                {
                    RequestID = entity.ID,
                    Kind = "additional",
                    ClientId = ClientId(item.Id),
                    Category = item.Category ?? "risk_avoid",
                    CostCenter = item.CostCenter ?? "",
                    AmountY0 = amt[0], AmountY1 = amt[1], AmountY2 = amt[2],
                    AmountY3 = amt[3], AmountY4 = amt[4], AmountY5 = amt[5],
                    SortOrder = i++,
                });
            }

            repo.SetCostSavings(entity, costSavings);

            LogHelper.Info(RequestLogTag,"apply-form/attachments");
            repo.RemoveAttachments(entity, "basic");
            var basicAttachments = new List<AgentRequestAttachment>();
            i = 0;
            foreach (var att in form.Attachments ?? new())
            {
                if (string.IsNullOrWhiteSpace(att.Uid) && string.IsNullOrWhiteSpace(att.Name)) continue;
                basicAttachments.Add(new AgentRequestAttachment
                {
                    Category = "basic",
                    Uid = string.IsNullOrWhiteSpace(att.Uid) ? Guid.NewGuid().ToString("N") : att.Uid,
                    Name = att.Name ?? "",
                    Size = att.Size,
                    Type = att.Type,
                    UploadedAt = string.IsNullOrWhiteSpace(att.UploadedAt)
                        ? DateTime.UtcNow.ToString("o")
                        : att.UploadedAt,
                    SortOrder = i++,
                });
            }
            repo.SetBasicAttachments(entity, basicAttachments);
        }

        public static void ApplyFlow(
            AgentRequest entity,
            RequestFlowDto flow,
            IAgentRequestRepository repo,
            bool replaceChecks,
            bool replaceDevelopChecks,
            bool replaceReleaseItems)
        {
            LogHelper.Info(RequestLogTag,"apply-flow/graph");
            EnsureGraph(entity);
            if (replaceChecks)
            {
                LogHelper.Info(RequestLogTag, $"apply-flow/checks: count={flow.Checks.Count}");
                ReplaceChecks(entity, "check", flow.Checks, repo);
            }
            if (replaceDevelopChecks)
            {
                LogHelper.Info(RequestLogTag, $"apply-flow/develop-checks: count={flow.DevelopChecks.Count}");
                ReplaceChecks(entity, "develop", flow.DevelopChecks, repo);
            }

            var develop = entity.Develop!;
            if (flow.DevelopMode != null) develop.DevelopMode = flow.DevelopMode;
            if (flow.SourcePackage != null)
            {
                develop.SourceUrl = flow.SourcePackage.Url ?? "";
                develop.SourceRepo = flow.SourcePackage.Repo ?? "";
                develop.SourceBranch = flow.SourcePackage.Branch ?? "";
                develop.GeneratedAt = flow.SourcePackage.GeneratedAt ?? "";
            }

            if (flow.RoiActual != null)
            {
                entity.FlowRoi!.FrequencyPerMonth = flow.RoiActual.FrequencyPerMonth;
                entity.FlowRoi.SavingPerUseMoney = flow.RoiActual.SavingPerUseMoney;
                entity.FlowRoi.EstimatedInvestment = flow.RoiActual.EstimatedInvestment;
                entity.FlowRoi.Note = flow.RoiActual.Note ?? "";
            }
            if (flow.RoiApprovals.Count > 0)
            {
                entity.FlowRoi!.ApprovalsJson = JsonSerializer.Serialize(flow.RoiApprovals);
            }

            var release = entity.Release!;
            release.Submitted = flow.ReleaseSubmitted || release.Submitted;
            release.Approved = flow.ReleaseApproved || release.Approved;
            if (flow.ReleaseArchive != null)
            {
                release.ArchiveFileName = flow.ReleaseArchive.FileName ?? "";
                release.ArchiveSize = flow.ReleaseArchive.Size;
                release.ArchiveChangeDate = flow.ReleaseArchive.ChangeDate ?? "";
                release.ArchiveNote = flow.ReleaseArchive.Note ?? "";
                release.ArchiveUploadedAt = flow.ReleaseArchive.UploadedAt ?? "";
            }
            if (replaceReleaseItems)
            {
                SyncReleaseItems(entity, flow.ReleaseChecklist, repo);
            }

            if (flow.PublishCompleted)
                SetStage(entity, "publish", "confirmed");
        }

        public static void ReplaceChecks(
            AgentRequest entity, string phase, List<RequestStageCheckDto> items, IAgentRequestRepository repo)
        {
            var existing = entity.Checks.Where(c => c.Phase == phase).ToList();
            var byCode = existing.ToDictionary(c => c.Code, StringComparer.OrdinalIgnoreCase);
            var keepCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var sort = 0;

            foreach (var item in items)
            {
                var code = string.IsNullOrWhiteSpace(item.Id) ? Guid.NewGuid().ToString("N")[..12] : item.Id.Trim();
                keepCodes.Add(code);
                if (byCode.TryGetValue(code, out var row))
                {
                    row.Title = item.Title ?? "";
                    row.Description = item.Description;
                    row.Status = string.IsNullOrWhiteSpace(item.Status) ? "pending" : item.Status;
                    row.Note = item.Note;
                    row.SortOrder = sort++;
                }
                else
                {
                    AddCheckRow(entity, repo, phase, item, code, sort++);
                }
            }

            var removed = 0;
            foreach (var orphan in existing.Where(c => !keepCodes.Contains(c.Code)).ToList())
            {
                repo.RemoveChecks(new[] { orphan });
                entity.Checks.Remove(orphan);
                removed++;
            }

            LogHelper.Info(RequestLogTag,
                $"ReplaceChecks: requestId={entity.ID} phase={phase} kept={keepCodes.Count} removed={removed}");
        }

        private static void SyncReleaseItems(
            AgentRequest entity, List<RequestReleaseItemDto> items, IAgentRequestRepository repo)
        {
            var release = entity.Release!;
            var existing = release.Items.ToList();
            var byCode = existing.ToDictionary(x => x.Code, StringComparer.OrdinalIgnoreCase);
            var keepCodes = new HashSet<string>(StringComparer.OrdinalIgnoreCase);
            var sort = 0;
            var added = 0;
            var removed = 0;

            foreach (var item in items)
            {
                var code = string.IsNullOrWhiteSpace(item.Id) ? Guid.NewGuid().ToString("N")[..12] : item.Id.Trim();
                keepCodes.Add(code);
                if (byCode.TryGetValue(code, out var row))
                {
                    row.Category = item.Category ?? "";
                    row.Title = item.Title ?? "";
                    row.AiLevel = item.AiLevel;
                    row.Content = item.Content;
                    row.SortOrder = sort++;
                }
                else
                {
                    repo.AddReleaseItem(entity, new AgentRequestFlowReleaseItem
                    {
                        Code = code,
                        Category = item.Category ?? "",
                        Title = item.Title ?? "",
                        AiLevel = item.AiLevel,
                        Content = item.Content,
                        SortOrder = sort++,
                    });
                    added++;
                }
            }

            foreach (var orphan in existing.Where(x => !keepCodes.Contains(x.Code)).ToList())
            {
                release.Items.Remove(orphan);
                repo.RemoveReleaseItem(orphan);
                removed++;
            }

            LogHelper.Info(RequestLogTag,
                $"SyncReleaseItems: requestId={entity.ID} kept={keepCodes.Count} added={added} removed={removed}");
        }

        public static void SetStage(AgentRequest entity, string phase, string status, string? note = null)
        {
            var row = entity.Stages.FirstOrDefault(s => s.Phase == phase);
            if (row == null)
            {
                row = new AgentRequestFlowStage
                {
                    RequestID = entity.ID,
                    Phase = phase,
                    SortOrder = Array.IndexOf(StagePhases, phase),
                };
                entity.Stages.Add(row);
            }
            row.Status = status;
            if (note != null) row.Note = note;
            if (status == "confirmed")
            {
                row.ConfirmedAt = DateTime.UtcNow;
                row.RejectedAt = null;
            }
            else if (status == "rejected")
            {
                row.RejectedAt = DateTime.UtcNow;
            }
            else
            {
                row.ConfirmedAt = null;
                row.RejectedAt = null;
            }
        }

        public static string? ToFlowPhase(string phase) => phase switch
        {
            "checking" or "submitted" or "check" => "check",
            "developing" or "develop" => "develop",
            "roi_followup" or "roi" => "roi",
            "releasing" or "release" => "release",
            "published" or "publish" => "publish",
            _ => null,
        };

        private static void AddChecks(AgentRequest entity, string phase, List<RequestStageCheckDto> items)
        {
            var i = 0;
            foreach (var item in items)
            {
                var code = string.IsNullOrWhiteSpace(item.Id) ? Guid.NewGuid().ToString("N")[..12] : item.Id;
                AddCheckRow(entity, null, phase, item, code, i++);
            }
        }

        private static void AddCheckRow(
            AgentRequest entity,
            IAgentRequestRepository? repo,
            string phase,
            RequestStageCheckDto item,
            string code,
            int sortOrder)
        {
            var category = phase == "develop" ? "develop" : "check";
            var row = new AgentRequestFlowCheck
            {
                RequestID = entity.ID,
                Phase = phase,
                Code = code,
                Title = item.Title ?? "",
                Description = item.Description,
                Status = string.IsNullOrWhiteSpace(item.Status) ? "pending" : item.Status,
                Note = item.Note,
                SortOrder = sortOrder,
            };
            if (repo != null)
                repo.AddFlowCheck(entity, row);
            else
                entity.Checks.Add(row);

            var a = 0;
            foreach (var att in item.Attachments ?? new())
            {
                var attachment = new AgentRequestAttachment
                {
                    Category = category,
                    RefCode = code,
                    Uid = att.Uid ?? "",
                    Name = att.Name ?? "",
                    Size = att.Size,
                    Type = att.Type,
                    UploadedAt = att.UploadedAt ?? "",
                    SortOrder = a++,
                };
                if (repo != null)
                    repo.AddAttachment(entity, attachment);
                else
                {
                    attachment.ID = Guid.NewGuid();
                    attachment.RequestID = entity.ID;
                    entity.Attachments.Add(attachment);
                }
            }
        }

        private static void ApplyMetrics(AgentRequest entity, RoiCalcResult metrics, decimal incomeTaxRate, decimal npvFactor)
        {
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
        }

        internal static decimal ResolveIncomeTaxRate(AgentRequest entity, RequestFormDto form)
        {
            if (entity.MetricsFrozen && entity.IncomeTaxRate > 0)
                return entity.IncomeTaxRate;
            if (form.Cost.IncomeTaxRate > 0)
                return form.Cost.IncomeTaxRate;
            if (entity.IncomeTaxRate > 0)
                return entity.IncomeTaxRate;
            return RoiCalculator.DefaultIncomeTaxRate;
        }

        private static RequestPersonDto? ToPerson(string? userno, string? nt, string? username, string? dept)
        {
            if (string.IsNullOrWhiteSpace(username)) return null;
            return new RequestPersonDto
            {
                Userno = userno ?? "",
                NtAccount = nt ?? "",
                Username = username,
                DeptName = dept ?? "",
            };
        }

        private static void WritePerson(RequestPersonDto? person, Action<string?, string?, string?, string?> write)
        {
            if (person == null || string.IsNullOrWhiteSpace(person.Username))
            {
                write(null, null, null, null);
                return;
            }
            write(person.Userno, person.NtAccount, person.Username, person.DeptName);
        }

        private static RequestPersonnelDto ToPersonnel(AgentRequestFormCostSaving x) => new()
        {
            Id = x.ClientId,
            Category = x.Category ?? "development",
            CostCenter = x.CostCenter ?? "",
            Level = HcLevelHelper.Normalize(x.Level),
            HcByYear = Years(x.HcY0 ?? 0, x.HcY1 ?? 0, x.HcY2 ?? 0, x.HcY3 ?? 0, x.HcY4 ?? 0, x.HcY5 ?? 0),
        };

        private static RequestRppDto ToRpp(AgentRequestFormRpp x) => new()
        {
            Id = x.ID.ToString("N"),
            RppId = x.RppId,
            RppLink = x.RppLink,
        };

        private static RequestExternalPaymentDto ToExternalPayment(AgentRequestFormCostSaving x) => new()
        {
            Id = x.ClientId,
            Category = x.Category ?? "",
            CostCenter = x.CostCenter ?? "",
            AmountByYear = Years(x.AmountY0 ?? 0, x.AmountY1 ?? 0, x.AmountY2 ?? 0, x.AmountY3 ?? 0, x.AmountY4 ?? 0, x.AmountY5 ?? 0),
        };

        private static string NormalizeExternalPaymentCategory(string? value) =>
            string.IsNullOrWhiteSpace(value) ? "" : value.Trim();

        private static RequestSavingHcDto ToSavingHc(AgentRequestFormCostSaving x) => new()
        {
            Id = x.ClientId,
            Dept = x.Dept ?? "",
            CostCenter = x.CostCenter ?? "",
            Level = HcLevelHelper.Normalize(x.Level),
            Hc = x.Hc ?? x.HcY0 ?? 0,
            HcByYear = Years(
                x.HcY0 ?? x.Hc ?? 0,
                x.HcY1 ?? 0,
                x.HcY2 ?? 0,
                x.HcY3 ?? 0,
                x.HcY4 ?? 0,
                x.HcY5 ?? 0),
            UnitPriceYearly = x.UnitPriceYearly ?? 0,
        };

        private static RequestAdditionalSavingDto ToAdditional(AgentRequestFormCostSaving x) => new()
        {
            Id = x.ClientId,
            Category = x.Category ?? "risk_avoid",
            CostCenter = x.CostCenter ?? "",
            AmountByYear = Years(x.AmountY0 ?? 0, x.AmountY1 ?? 0, x.AmountY2 ?? 0, x.AmountY3 ?? 0, x.AmountY4 ?? 0, x.AmountY5 ?? 0),
        };

        private static RequestStageCheckDto ToCheckDto(AgentRequest entity, AgentRequestFlowCheck x)
        {
            var category = x.Phase == "develop" ? "develop" : "check";
            return new RequestStageCheckDto
            {
                Id = x.Code,
                Title = x.Title,
                Description = x.Description ?? "",
                Status = x.Status,
                Note = x.Note,
                Attachments = entity.Attachments
                    .Where(a => a.Category == category && a.RefCode == x.Code)
                    .OrderBy(a => a.SortOrder)
                    .Select(a => new RequestCheckAttachmentDto
                    {
                        Uid = a.Uid,
                        Name = a.Name,
                        Size = a.Size,
                        Type = a.Type,
                        UploadedAt = a.UploadedAt,
                    }).ToList(),
            };
        }

        private static RequestSourcePackageDto? ToSource(AgentRequestFlowDevelop? develop)
        {
            if (develop == null || string.IsNullOrWhiteSpace(develop.SourceUrl)) return null;
            return new RequestSourcePackageDto
            {
                Url = develop.SourceUrl,
                Repo = develop.SourceRepo,
                Branch = develop.SourceBranch,
                GeneratedAt = develop.GeneratedAt,
            };
        }

        private static RequestRoiActualDto? ToRoi(AgentRequestFlowRoi? roi)
        {
            if (roi == null) return null;
            if (string.IsNullOrWhiteSpace(roi.Note)
                && roi.FrequencyPerMonth == 0
                && roi.SavingPerUseMoney == 0
                && roi.EstimatedInvestment == 0)
                return null;
            return new RequestRoiActualDto
            {
                FrequencyPerMonth = roi.FrequencyPerMonth,
                SavingPerUseMoney = roi.SavingPerUseMoney,
                EstimatedInvestment = roi.EstimatedInvestment,
                Note = roi.Note,
            };
        }

        private static List<RequestRoiApprovalDto> ToRoiApprovals(AgentRequestFlowRoi? roi)
        {
            if (roi == null || string.IsNullOrWhiteSpace(roi.ApprovalsJson)) return new();
            try
            {
                return JsonSerializer.Deserialize<List<RequestRoiApprovalDto>>(roi.ApprovalsJson) ?? new();
            }
            catch (JsonException)
            {
                return new();
            }
        }

        private static RequestReleaseArchiveDto? ToArchive(AgentRequestFlowRelease? release)
        {
            if (release == null || string.IsNullOrWhiteSpace(release.ArchiveFileName)) return null;
            return new RequestReleaseArchiveDto
            {
                FileName = release.ArchiveFileName,
                Size = release.ArchiveSize,
                ChangeDate = release.ArchiveChangeDate,
                Note = release.ArchiveNote,
                UploadedAt = release.ArchiveUploadedAt,
            };
        }

        private static RequestReleaseItemDto ToReleaseItem(AgentRequestFlowReleaseItem x) => new()
        {
            Id = x.Code,
            Category = x.Category,
            Title = x.Title,
            AiLevel = x.AiLevel,
            Content = x.Content ?? "",
        };

        private static string ClientId(string? id)
            => string.IsNullOrWhiteSpace(id) ? Guid.NewGuid().ToString("N") : id;

        private static string? EmptyToNull(string? value)
            => string.IsNullOrWhiteSpace(value) ? null : value;

        private static int DeriveAiLevel(RequestOptionsDto options)
            => new[]
            {
                options.HumanInLoop ? 1 : 4,
                options.BoschChinaOnly ? 1 : 3,
                Math.Clamp(options.PersonalDataLevel, 1, 3),
                Math.Clamp(options.ImpactLossLevel, 1, 3),
                options.NoReputationPhysicalHarm ? 1 : 3,
            }.Max();

        private static List<decimal> Years(params decimal[] values) => values.ToList();

        private static decimal[] Pad6(List<decimal>? values, decimal fill)
        {
            var result = new[] { fill, fill, fill, fill, fill, fill };
            if (values == null) return result;
            for (var i = 0; i < 6 && i < values.Count; i++) result[i] = values[i];
            return result;
        }

        // YYYY-MM；无效或空则默认下一自然月
        private static string NormalizeCycleStartMonth(string? value)
        {
            if (!string.IsNullOrWhiteSpace(value) && value.Length == 7 && value[4] == '-'
                && int.TryParse(value[..4], out var year) && int.TryParse(value[5..], out var month)
                && year > 0 && month is >= 1 and <= 12)
            {
                return $"{year:D4}-{month:D2}";
            }

            var next = DateTime.UtcNow.AddMonths(1);
            return $"{next.Year:D4}-{next.Month:D2}";
        }
    }
}
