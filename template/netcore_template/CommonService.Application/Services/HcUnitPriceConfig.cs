using System.Reflection;
using System.Text.Json;
using System.Text.Json.Serialization;

namespace CommonService.Application.Services
{
    internal sealed class HcUnitPriceRow
    {
        [JsonPropertyName("level")]
        public string Level { get; set; } = "";

        [JsonPropertyName("cost")]
        public decimal Cost { get; set; }

        [JsonPropertyName("saving")]
        public decimal Saving { get; set; }
    }

    internal sealed class HcUnitPriceByCostCenter
    {
        [JsonPropertyName("costcenter")]
        public string CostCenter { get; set; } = "";

        [JsonPropertyName("units")]
        public List<HcUnitPriceRow> Units { get; set; } = new();
    }

    /// <summary>
    /// O(1) HC unit price lookup by cost center + level.
    /// Source: Data/costcenter_grade_cost_saving.json (keep in sync with FE).
    /// </summary>
    internal static class HcUnitPriceConfig
    {
        /// <summary>Hidden JSON key used when cost center is empty.</summary>
        private const string DefaultCostCenterKey = "default";

        /// <summary>costcenter → level → unit</summary>
        private static readonly Dictionary<string, Dictionary<string, HcUnitPriceRow>> Index =
            BuildIndex();

        public static decimal ResolveCost(string? costCenter, string? level, decimal? legacyOverride = null)
            => Resolve(costCenter, level, isSaving: false);

        public static decimal ResolveSaving(string? costCenter, string? level, decimal? legacyOverride = null)
            => Resolve(costCenter, level, isSaving: true);

        /// <summary>
        /// Empty cost center → "default" row.
        /// Matched but price is 0 → "default" row (many CCs only fill cost).
        /// Unmatched explicit cost center → 0.
        /// </summary>
        private static decimal Resolve(string? costCenter, string? level, bool isSaving)
        {
            var code = HcLevelHelper.Normalize(level);
            var keys = CostCenterKeys(costCenter).ToList();
            if (keys.Count == 0)
                return PriceFromDefault(code, isSaving);

            foreach (var key in keys)
            {
                if (!Index.TryGetValue(key, out var byLevel)) continue;
                if (!byLevel.TryGetValue(code, out var unit)) continue;
                var price = isSaving ? unit.Saving : unit.Cost;
                if (price > 0) return price;
                return PriceFromDefault(code, isSaving);
            }
            return 0;
        }

        private static decimal PriceFromDefault(string level, bool isSaving)
        {
            if (!Index.TryGetValue(DefaultCostCenterKey, out var byLevel)) return 0;
            if (!byLevel.TryGetValue(level, out var unit)) return 0;
            return isSaving ? unit.Saving : unit.Cost;
        }

        private static IEnumerable<string> CostCenterKeys(string? value)
        {
            var raw = (value ?? "").Trim();
            if (raw.Length == 0) yield break;
            yield return raw;
            var digits = new string(raw.Where(char.IsDigit).ToArray());
            if (digits.Length > 0 && !string.Equals(digits, raw, StringComparison.Ordinal))
                yield return digits;
        }

        private static Dictionary<string, Dictionary<string, HcUnitPriceRow>> BuildIndex()
        {
            var index = new Dictionary<string, Dictionary<string, HcUnitPriceRow>>(StringComparer.OrdinalIgnoreCase);
            foreach (var row in LoadTable())
            {
                if (string.IsNullOrWhiteSpace(row.CostCenter)) continue;
                foreach (var key in CostCenterKeys(row.CostCenter))
                {
                    if (!index.TryGetValue(key, out var byLevel))
                    {
                        byLevel = new Dictionary<string, HcUnitPriceRow>(StringComparer.OrdinalIgnoreCase);
                        index[key] = byLevel;
                    }
                    foreach (var unit in row.Units)
                    {
                        var level = HcLevelHelper.Normalize(unit.Level);
                        byLevel[level] = unit;
                    }
                }
            }
            return index;
        }

        private static List<HcUnitPriceByCostCenter> LoadTable()
        {
            var asm = Assembly.GetExecutingAssembly();
            var name = asm.GetManifestResourceNames()
                .FirstOrDefault(n => n.EndsWith("costcenter_grade_cost_saving.json", StringComparison.OrdinalIgnoreCase));
            if (name == null) return new List<HcUnitPriceByCostCenter>();

            using var stream = asm.GetManifestResourceStream(name);
            if (stream == null) return new List<HcUnitPriceByCostCenter>();

            var rows = JsonSerializer.Deserialize<List<HcUnitPriceByCostCenter>>(stream);
            return rows ?? new List<HcUnitPriceByCostCenter>();
        }
    }
}
