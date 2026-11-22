namespace CommonService.Application.Services
{
    internal static class HcLevelHelper
    {
        private static readonly Dictionary<string, decimal> UnitPrices = new(StringComparer.OrdinalIgnoreCase)
        {
            ["1_D"] = 36000,
            ["2_D"] = 36000,
            ["3_D"] = 36000,
            ["4_D"] = 62000,
            ["5_D"] = 62000,
            ["6_D"] = 62000,
            ["7_ID"] = 95000,
            ["8_ID"] = 95000,
            ["9_ID"] = 118000,
        };

        private static readonly Dictionary<string, string> LegacyMap = new(StringComparer.OrdinalIgnoreCase)
        {
            ["1-3_D"] = "2_D",
            ["4-6_D"] = "5_D",
            ["7-8_ID"] = "8_ID",
        };

        public const string DefaultCode = "4_D";

        public static string Normalize(string? level)
        {
            if (string.IsNullOrWhiteSpace(level)) return DefaultCode;
            var code = level.Trim();
            if (UnitPrices.ContainsKey(code)) return code;
            if (LegacyMap.TryGetValue(code, out var mapped)) return mapped;
            if (int.TryParse(code, out var n) && n is >= 1 and <= 9)
            {
                return n <= 6 ? $"{n}_D" : $"{n}_ID";
            }
            return DefaultCode;
        }

        public static decimal UnitPrice(string? level, decimal? overridePrice)
        {
            if (overridePrice > 0) return overridePrice.Value;
            return UnitPrices.GetValueOrDefault(Normalize(level), UnitPrices[DefaultCode]);
        }
    }
}
