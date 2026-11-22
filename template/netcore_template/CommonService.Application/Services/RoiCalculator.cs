namespace CommonService.Application.Services
{
    internal sealed class YearlyCashFlow
    {
        public int Period { get; set; }
        public int Year { get; set; }
        public decimal CashIn { get; set; }
        public decimal CashOut { get; set; }
    }

    internal sealed class RoiCalcResult
    {
        public decimal InvestmentY0 { get; set; }
        public decimal SavingY0 { get; set; }
        public decimal SavingNextYear { get; set; }
        public decimal Roi { get; set; }
        public decimal TaxAdjustedRoi { get; set; }
        public decimal Npv { get; set; }
        public decimal? PbpYears { get; set; }
        public decimal? PaybackMonths { get; set; }
        public decimal IncomeTaxRate { get; set; }
        public decimal NpvFactor { get; set; }
        public decimal TotalCashIn { get; set; }
        public decimal TotalCashOut { get; set; }
    }

    /// <summary>
    /// NPV / PBP / ROI engine (aligned with finance sheet + FE roi-calculator.ts).
    /// </summary>
    /// <summary>
    /// PBP from NPV cum crossover, then minus (1 - y0Factor) for partial first calendar year.
    /// y0Factor = (13 - startMonth) / 12; e.g. 2026-03 → subtract 2/12 y.
    /// </summary>
    internal static class RoiCalculator
    {
        public const decimal CorpTaxRate = 0.15m;
        public const decimal ProfitShareForPersonalTax = 0.85m;
        public const decimal PersonalTaxRateOnProfit = 0.05m;
        /// <summary>15% + 85% × 5% = 19.25%</summary>
        public const decimal DefaultIncomeTaxRate = CorpTaxRate + ProfitShareForPersonalTax * PersonalTaxRateOnProfit;
        public const decimal DefaultNpvFactor = 0.08m;

        public static decimal GetPbpLeadInGapYears(string? cycleStartMonth)
        {
            var month = ParseStartMonth(cycleStartMonth);
            if (month <= 1) return 0;
            var y0Factor = (13 - month) / 12m;
            return 1 - y0Factor;
        }

        public static RoiCalcResult Calculate(
            IReadOnlyList<YearlyCashFlow> cashFlows,
            decimal? incomeTaxRate = null,
            decimal? npvFactor = null,
            string? cycleStartMonth = null)
        {
            var taxRate = incomeTaxRate ?? DefaultIncomeTaxRate;
            var factor = npvFactor ?? DefaultNpvFactor;

            decimal totalIn = 0, totalOut = 0, totalTaxAdj = 0, totalNpv = 0, cumNpv = 0;
            decimal? pbpYears = null;

            foreach (var cf in cashFlows)
            {
                var cashIn = Math.Max(0, cf.CashIn);
                var cashOut = Math.Max(0, cf.CashOut);
                var period = Math.Max(0, cf.Period);
                var net = cashIn - cashOut;
                var taxAdj = net * (1 - taxRate);
                var discount = period <= 0 ? 1m : 1m / (decimal)Math.Pow((double)(1 + factor), period);
                var npvN = taxAdj * discount;

                totalIn += cashIn;
                totalOut += cashOut;
                totalTaxAdj += taxAdj;
                var prevCum = cumNpv;
                cumNpv += npvN;
                totalNpv += npvN;

                if (pbpYears == null && prevCum < 0 && cumNpv >= 0 && npvN != 0)
                {
                    pbpYears = (period <= 0 ? 0 : period - 1) + Math.Abs(prevCum) / npvN;
                }
            }

            var roi = totalOut > 0 ? ((totalIn - totalOut) / totalOut) * 100 : 0;
            var taxAdjRoi = totalOut > 0 ? (totalTaxAdj / totalOut - 1) * 100 : 0;

            return new RoiCalcResult
            {
                Roi = Round2(roi),
                TaxAdjustedRoi = Round2(taxAdjRoi),
                Npv = Round2(totalNpv),
                PbpYears = pbpYears == null ? null : Round2(pbpYears.Value),
                PaybackMonths = pbpYears == null ? null : Round2(pbpYears.Value * 12),
                IncomeTaxRate = taxRate,
                NpvFactor = factor,
                TotalCashIn = Round2(totalIn),
                TotalCashOut = Round2(totalOut),
            };
        }

        private static decimal Round2(decimal n) => Math.Round(n, 2, MidpointRounding.AwayFromZero);

        private static int ParseStartMonth(string? cycleStartMonth)
        {
            if (!string.IsNullOrWhiteSpace(cycleStartMonth)
                && cycleStartMonth.Length == 7
                && cycleStartMonth[4] == '-'
                && int.TryParse(cycleStartMonth[..4], out _)
                && int.TryParse(cycleStartMonth[5..], out var month)
                && month is >= 1 and <= 12)
            {
                return month;
            }
            return 1;
        }
    }
}
