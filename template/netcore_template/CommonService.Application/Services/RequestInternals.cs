using CommonService.Application.DTOs;
using CommonService.Core.Utils;

namespace CommonService.Application.Services
{
    internal static class RequestFormFactory
    {
        public static RequestFormDto CreateDefault()
        {
            var now = DateTime.UtcNow;
            var next = now.AddMonths(1);
            var cycle = $"{next.Year:D4}-{next.Month:D2}";
            return new RequestFormDto
            {
                Basic = new RequestBasicDto(),
                Security = new RequestSecurityDto(),
                Cost = new RequestCostDto
                {
                    CycleStartMonth = cycle,
                    Investment = new RequestInvestmentDto(),
                    SavingEntries = new(),
                    AdditionalSavings = new(),
                    SavingYearRatios = new() { 1, 1, 1, 1, 1, 1 },
                    IncomeTaxRate = RoiCalculator.DefaultIncomeTaxRate,
                },
                Options = new RequestOptionsDto(),
                TermsAccepted = false,
            };
        }

        public static RequestFlowDto CreateDefaultFlow(RequestFormDto form, IEnumerable<RequestDatasetDto> datasets)
        {
            return new RequestFlowDto
            {
                Checks = RequestFlowDefaults.DefaultChecks(),
                DevelopChecks = RequestFlowDefaults.DefaultDevelopChecks(),
                ReleaseChecklist = RequestFlowDefaults.BuildReleaseChecklist(form, datasets, null),
            };
        }
    }

    internal static class RequestMetrics
    {
        private const string LogTag = "request/metrics";

        private static readonly Dictionary<string, decimal> ServerMonthly = new()
        {
            ["starter"] = 180,
            ["standard"] = 420,
            ["performance"] = 780,
            ["enterprise"] = 1450,
        };

        private static readonly Dictionary<string, (decimal Instance, decimal PerGb)> DbPrice = new()
        {
            ["postgresql"] = (220, 0.85m),
            ["mysql"] = (200, 0.8m),
            ["mongodb"] = (320, 1.1m),
            ["vector"] = (480, 1.6m),
            ["redis"] = (150, 2.2m),
        };

        public static RoiCalcResult Compute(
            RequestCostDto cost,
            decimal? incomeTaxRate = null,
            decimal? npvFactor = null,
            Guid? requestId = null)
        {
            var y0Year = ParseCycle(cost.CycleStartMonth).Year;
            var flows = BuildYearlyCashFlows(cost, y0Year);
            var metrics = RoiCalculator.Calculate(flows, incomeTaxRate, npvFactor);

            metrics.InvestmentY0 = flows.Count > 1
                ? Math.Round(flows[0].CashOut + flows[1].CashOut, 2)
                : (flows.Count > 0 ? Math.Round(flows[0].CashOut, 2) : 0);
            metrics.SavingY0 = flows.Count > 1 ? Math.Round(flows[1].CashIn, 2) : 0;
            metrics.SavingNextYear = flows.Count > 2 ? Math.Round(flows[2].CashIn, 2) : 0;

            LogSavingTrace(requestId, cost, flows, metrics);
            return metrics;
        }

        /// <summary>
        /// List/KPI display: Y0 = current calendar year, Next = current year + 1.
        /// ROI/NPV/PBP/totals still come from the full cash-flow model.
        /// </summary>
        public static RoiCalcResult ComputeForListDisplay(
            RequestCostDto cost,
            decimal? incomeTaxRate = null,
            decimal? npvFactor = null,
            Guid? requestId = null,
            int? baseYear = null)
        {
            var metrics = Compute(cost, incomeTaxRate, npvFactor, requestId);
            var currentYear = baseYear ?? DateTime.UtcNow.Year;
            var y0Year = ParseCycle(cost.CycleStartMonth).Year;
            var flows = BuildYearlyCashFlows(cost, y0Year);

            metrics.SavingY0 = CashInForCalendarYear(flows, y0Year, currentYear);
            metrics.SavingNextYear = CashInForCalendarYear(flows, y0Year, currentYear + 1);
            metrics.InvestmentY0 = CashOutForCalendarYear(flows, y0Year, currentYear);
            return metrics;
        }

        private static decimal CashInForCalendarYear(List<YearlyCashFlow> flows, int cycleStartYear, int calendarYear)
        {
            var yearIndex = calendarYear - cycleStartYear;
            if (yearIndex < 0 || yearIndex > 5) return 0;
            var flowIndex = yearIndex + 1;
            return flowIndex < flows.Count ? Math.Round(flows[flowIndex].CashIn, 2) : 0;
        }

        private static decimal CashOutForCalendarYear(List<YearlyCashFlow> flows, int cycleStartYear, int calendarYear)
        {
            var yearIndex = calendarYear - cycleStartYear;
            if (yearIndex < 0 || yearIndex > 5) return 0;
            if (yearIndex == 0)
            {
                var start = flows.Count > 0 ? flows[0].CashOut : 0;
                var y0 = flows.Count > 1 ? flows[1].CashOut : 0;
                return Math.Round(start + y0, 2);
            }
            var flowIndex = yearIndex + 1;
            return flowIndex < flows.Count ? Math.Round(flows[flowIndex].CashOut, 2) : 0;
        }

        private static void LogSavingTrace(
            Guid? requestId,
            RequestCostDto cost,
            List<YearlyCashFlow> flows,
            RoiCalcResult metrics)
        {
            var id = requestId?.ToString() ?? "(none)";
            var manualY0 = SavingYearTotal(cost.SavingEntries, 0);
            var addY0 = AmountAt(cost.AdditionalSavings, 0);

            LogHelper.Info(LogTag,
                $"saving-trace/start: requestId={id} cycle={cost.CycleStartMonth} " +
                $"manualRows={cost.SavingEntries?.Count ?? 0} additionalRows={cost.AdditionalSavings?.Count ?? 0} " +
                $"y0Factor={GetY0Factor(cost.CycleStartMonth):0.####}");

            LogHelper.Info(LogTag,
                $"saving-trace/y0-formula: savingY0 = flow[1].cashIn = manualY0({manualY0}) + additionalY0({addY0})");

            foreach (var e in cost.SavingEntries ?? new List<RequestSavingHcDto>())
            {
                var hcList = PadHcByYear(e.HcByYear, e.Hc);
                var hc0 = hcList.Count > 0 ? hcList[0] : 0;
                var unit = HcUnitPriceConfig.ResolveSaving(e.CostCenter, e.Level, e.UnitPriceYearly);
                LogHelper.Info(LogTag,
                    $"saving-trace/manual-row: requestId={id} client={e.Id} cc={e.CostCenter} level={e.Level} " +
                    $"hcY0={hc0} unit={unit} lineY0={hc0 * unit} hcByYear=[{string.Join(',', hcList)}]");
            }

            foreach (var e in cost.AdditionalSavings ?? new List<RequestAdditionalSavingDto>())
            {
                var amounts = e.AmountByYear ?? new List<decimal>();
                var y0 = amounts.Count > 0 ? amounts[0] : 0;
                LogHelper.Info(LogTag,
                    $"saving-trace/additional-row: requestId={id} client={e.Id} category={e.Category} " +
                    $"cc={e.CostCenter} amountY0={y0} amounts=[{string.Join(',', amounts)}]");
            }

            for (var i = 0; i < flows.Count; i++)
            {
                var f = flows[i];
                LogHelper.Info(LogTag,
                    $"saving-trace/flow[{i}]: requestId={id} period={f.Period} year={f.Year} " +
                    $"cashIn={f.CashIn} cashOut={f.CashOut}");
            }

            LogHelper.Info(LogTag,
                $"saving-trace/result: requestId={id} savingY0={metrics.SavingY0} " +
                $"savingNextYear={metrics.SavingNextYear} totalCashIn={metrics.TotalCashIn} " +
                $"investmentY0={metrics.InvestmentY0}");
        }

        private static List<YearlyCashFlow> BuildYearlyCashFlows(RequestCostDto cost, int y0Year)
        {
            var serverYear = GetServerMonthly(cost.Investment.Server) * 12;
            var dbYear = GetDbMonthly(cost.Investment.Db) * 12;
            var tokenYear = GetTokenMonthly(cost.Investment.Token) * 12;
            var infraFull = serverYear + dbYear + tokenYear;
            var externalY0 = ExternalPaymentYearTotal(cost.Investment.ExternalPayments, 0);

            // [0] start-year Payment outside only (period 0 → factor 1, sheet shows 8%=0)
            // [1..6] calendar Y0..Y5 (period 0..5 → factors 1.00, 0.93, 0.86, …)
            var flows = new List<YearlyCashFlow>(7)
            {
                new YearlyCashFlow
                {
                    Period = 0,
                    Year = y0Year,
                    CashIn = 0,
                    CashOut = externalY0,
                },
            };

            for (var i = 0; i < 6; i++)
            {
                var calendarYear = y0Year + i;
                var prorate = i == 0 ? GetY0Factor(cost.CycleStartMonth) : 1m;
                var infra = infraFull * prorate; // App/DB/Token monthly → Y0 n/12
                var personnel = PersonnelYearTotal(cost.Investment.Personnel, i);
                var external = i == 0 ? 0 : ExternalPaymentYearTotal(cost.Investment.ExternalPayments, i);
                var cashOut = infra + personnel + external;
                var cashIn = SavingYearTotal(cost.SavingEntries, i) + AmountAt(cost.AdditionalSavings, i);
                flows.Add(new YearlyCashFlow
                {
                    Period = i,
                    Year = calendarYear,
                    CashIn = cashIn,
                    CashOut = cashOut,
                });
            }
            return flows;
        }

        private static List<decimal> PadRatios(List<decimal>? ratios)
        {
            var next = (ratios ?? new()).Take(6).ToList();
            while (next.Count < 6) next.Add(1);
            return next;
        }

        private static List<decimal> PadHcByYear(List<decimal>? values, decimal legacyHc = 0)
        {
            if (values == null || values.Count == 0)
            {
                var y0 = Math.Max(0, legacyHc);
                return new List<decimal> { y0, 0, 0, 0, 0, 0 };
            }
            var next = values.Take(6).ToList();
            while (next.Count < 6) next.Add(0);
            return next.Select(v => Math.Max(0, v)).ToList();
        }

        private static decimal GetServerMonthly(RequestInvestmentServerDto server)
        {
            var id = server.TierId ?? "none";
            if (string.IsNullOrWhiteSpace(id) || id == "none") return 0;
            if (!ServerMonthly.TryGetValue(id, out var price)) return 0;
            return price * Math.Max(0, server.Quantity);
        }

        private static decimal GetDbMonthly(RequestInvestmentDbDto db)
        {
            var id = db.DbTypeId ?? "none";
            if (string.IsNullOrWhiteSpace(id) || id == "none") return 0;
            if (!DbPrice.TryGetValue(id, out var price)) return 0;
            var years = Math.Max(1, db.RetentionYears);
            var storage = Math.Max(0, db.InitialSizeGb) + Math.Max(0, db.IncrementGbPerYear) * (years - 1);
            return price.Instance + storage * price.PerGb;
        }

        private static decimal GetTokenMonthly(RequestInvestmentTokenDto token)
        {
            var tokens = Math.Max(0, token.CallsPerMonth) * Math.Max(0, token.AvgTokensPerCall);
            return (tokens / 1000m) * Math.Max(0, token.PricePer1kTokens);
        }

        private static decimal PersonnelYearTotal(List<RequestPersonnelDto>? entries, int yearIndex)
        {
            return (entries ?? new()).Sum(e =>
            {
                var unit = HcUnitPriceConfig.ResolveCost(e.CostCenter, e.Level);
                var hc = yearIndex < e.HcByYear.Count ? e.HcByYear[yearIndex] : 0;
                hc = Math.Max(0, hc);
                return hc * unit;
            });
        }

        private static decimal SavingYearTotal(List<RequestSavingHcDto>? entries, int yearIndex)
        {
            return (entries ?? new()).Sum(e =>
            {
                var unit = HcUnitPriceConfig.ResolveSaving(e.CostCenter, e.Level, e.UnitPriceYearly);
                var hcList = PadHcByYear(e.HcByYear, e.Hc);
                var hc = yearIndex < hcList.Count ? hcList[yearIndex] : 0;
                hc = Math.Max(0, hc);
                return hc * unit;
            });
        }

        private static decimal HcYearly(RequestSavingHcDto entry)
        {
            return SavingYearTotal(new List<RequestSavingHcDto> { entry }, 0);
        }

        private static decimal AmountAt(List<RequestAdditionalSavingDto>? entries, int yearIndex)
        {
            return (entries ?? new()).Sum(e =>
                yearIndex < e.AmountByYear.Count ? Math.Max(0, e.AmountByYear[yearIndex]) : 0);
        }

        private static decimal ExternalPaymentYearTotal(List<RequestExternalPaymentDto>? entries, int yearIndex)
        {
            return (entries ?? new()).Sum(e =>
                yearIndex < e.AmountByYear.Count ? Math.Max(0, e.AmountByYear[yearIndex]) : 0);
        }

        private static int GetY0MonthCount(string? cycle)
        {
            var month = ParseCycle(cycle).Month;
            return 13 - month;
        }

        private static decimal GetY0Factor(string? cycle) => GetY0MonthCount(cycle) / 12m;

        private static (int Year, int Month) ParseCycle(string? value)
        {
            if (!string.IsNullOrWhiteSpace(value) && value.Length == 7 && value[4] == '-')
            {
                if (int.TryParse(value[..4], out var year) && int.TryParse(value[5..], out var month)
                    && year > 0 && month is >= 1 and <= 12)
                {
                    return (year, month);
                }
            }
            var next = DateTime.UtcNow.AddMonths(1);
            return (next.Year, next.Month);
        }
    }

    internal static class RequestFlowDefaults
    {
        public static readonly string[] Timeline =
        {
            "submitted", "checking", "roi_followup", "developing", "releasing", "published",
        };

        public static List<RequestStageCheckDto> DefaultChecks() => new()
        {
            new() { Id = "same-solution", Title = "Same Solution Check", Description = "Confirm no duplicate agent / existing product already covers this scope.", Status = "pending" },
            new() { Id = "data-pipe", Title = "Data Pipe Status Check", Description = "Validate pipelines for selected sources are healthy and accessible.", Status = "pending" },
            new() { Id = "data-security", Title = "Data Security Check", Description = "Confirm C / I / A SC levels, access control, and data handling notes.", Status = "pending" },
        };

        public static List<RequestStageCheckDto> DefaultDevelopChecks() => new()
        {
            new() { Id = "code-review", Title = "Code Review", Description = "Peer review of source delivery.", Status = "pending" },
            new() { Id = "opensource-scan", Title = "Opensource Scan", Description = "License / vulnerability scan.", Status = "pending" },
            new() { Id = "compliance", Title = "Compliance Check", Description = "Policy & regulatory compliance.", Status = "pending" },
        };

        public static List<RequestReleaseItemDto> BuildReleaseChecklist(
            RequestFormDto form,
            IEnumerable<RequestDatasetDto> datasets,
            RequestRoiActualDto? roi)
        {
            var level = Math.Clamp(form.Options.AiLevel, 1, 5);
            var sources = datasets
                .Where(d => form.Security.DataSourceIds.Contains(d.Id))
                .Select(d => $"{d.Name} ({d.ScConfidentiality}/{d.ScIntegrity}/{d.ScAvailability})")
                .ToList();
            var owner = FormatPerson(form.Basic.Owner);
            var pjm = FormatPerson(form.Basic.Pjm);
            var sponsor = FormatPerson(form.Basic.Sponsor);
            var roiSummary = roi == null
                ? string.Empty
                : $"Actual freq {roi.FrequencyPerMonth}/mo · saving/use {roi.SavingPerUseMoney} · inv {roi.EstimatedInvestment}";
            var finalScText = string.Join(" ", new[]
            {
                form.Security.FinalScC,
                form.Security.FinalScI,
                form.Security.FinalScA,
            }.Where(x => !string.IsNullOrWhiteSpace(x)));

            var all = new List<RequestReleaseItemDto>
            {
                Item("basic-name", "Basic Information", "Agent / project name", 1, form.Basic.Name),
                Item("basic-desc", "Basic Information", "Describe the main features of the project", 1, form.Basic.Description),
                Item("basic-owner", "Basic Information", "Owner & department", 1, owner),
                Item("basic-pjm", "Basic Information", "Project manager (PJM)", 1, pjm),
                Item("basic-sponsor", "Basic Information", "Sponsor", 1, sponsor),
                Item("sec-sc", "Data Security", "Final C / I / A SC levels confirmed", 1, finalScText),
                Item("sec-sources", "Data Security", "Data sources & access paths", 1, string.Join("; ", sources)),
                Item("roi-summary", "Cost & ROI", "Benefit / ROI summary", 1, roiSummary),
                Item("roi-sponsor", "Cost & ROI", "Business owner confirmed scope & success metrics", 1, ""),
                Item("ops-rollback", "Operations", "Rollback / disable procedure", 1, ""),
                Item("ops-monitor", "Operations", "Monitoring & on-call owner", 1, string.IsNullOrWhiteSpace(owner) ? "" : $"Primary: {owner}"),
                Item("ai-hil", "AI Level Controls", "Human-in-the-loop checkpoints verified", 2, ""),
                Item("ai-cross", "AI Level Controls", "Cross-domain stakeholders signed off", 3, ""),
                Item("ai-write", "AI Level Controls", "Auto write-actions audit trail enabled", 4, ""),
                Item("ai-sec", "AI Level Controls", "Security review for elevated autonomy", 4, ""),
                Item("ai-dpia", "AI Level Controls", "External model / outbound data DPIA approved", 5, ""),
                Item("ai-exec", "AI Level Controls", "Executive sponsor approval", 5, ""),
            };
            return all.Where(x => x.AiLevel <= level).ToList();
        }

        public static int StatusIndex(string status)
        {
            if (status is "draft" or "rejected") return -1;
            if (status == "submitted") return 0;
            var idx = Array.IndexOf(Timeline, status);
            return idx;
        }

        private static RequestReleaseItemDto Item(string id, string category, string title, int level, string content)
            => new() { Id = id, Category = category, Title = title, AiLevel = level, Content = content };

        private static string FormatPerson(RequestPersonDto? person)
        {
            if (person == null || string.IsNullOrWhiteSpace(person.Username)) return "";
            return string.IsNullOrWhiteSpace(person.DeptName)
                ? person.Username
                : $"{person.Username} ({person.DeptName})";
        }

        private static string Join(string sep, params string?[] parts)
            => string.Join(sep, parts.Where(p => !string.IsNullOrWhiteSpace(p)));
    }
}
