using CommonService.Application.DTOs;
using CommonService.Application.Services.Interfaces;
using ClosedXML.Excel;

namespace CommonService.Application.Services
{
    public class ExcelService : IExcelService
    {
        public Dictionary<string, List<List<string>>> ReadExcel(IXLWorkbook workbook, List<SheetReadSetting>? sheetSettings)
        {
            var result = new Dictionary<string, List<List<string>>>();

            // 1. 决定要遍历的配置逻辑
            List<SheetReadSetting> finalSettings = new List<SheetReadSetting>();

            if (sheetSettings == null || sheetSettings.Count == 0)
            {
                // 默认读取所有 Sheet
                foreach (var sheet in workbook.Worksheets)
                {
                    finalSettings.Add(new SheetReadSetting { SheetName = sheet.Name, StartCell = null });
                }
            }
            else
            {
                finalSettings = sheetSettings;
            }

            // 2. 遍历读取
            foreach (var setting in finalSettings)
            {
                if (!workbook.Worksheets.TryGetWorksheet(setting.SheetName, out var sheet))
                {
                    throw new KeyNotFoundException($"Excel 文件中未找到名为 '{setting.SheetName}' 的 Sheet。");
                }

                var sheetData = new List<List<string>>();
                var usedRange = sheet.RangeUsed();

                if (usedRange == null)
                {
                    // 空 Sheet
                    result[setting.SheetName] = sheetData;
                    continue;
                }

                int startRow = usedRange.FirstRow().RowNumber();
                int startCol = usedRange.FirstColumn().ColumnNumber();
                int endRow = usedRange.LastRow().RowNumber();
                int endCol = usedRange.LastColumn().ColumnNumber();

                if (!string.IsNullOrWhiteSpace(setting.StartCell))
                {
                    var startCellAddress = sheet.Cell(setting.StartCell).Address;
                    startRow = startCellAddress.RowNumber;
                    startCol = startCellAddress.ColumnNumber;
                }

                for (int r = startRow; r <= endRow; r++)
                {
                    var rowData = new List<string>();
                    for (int c = startCol; c <= endCol; c++)
                    {
                        var cellValue = sheet.Cell(r, c).GetValue<string>();
                        rowData.Add(cellValue);
                    }
                    sheetData.Add(rowData);
                }

                // 存入结果
                if (result.ContainsKey(setting.SheetName))
                    result[setting.SheetName] = sheetData;
                else
                    result.Add(setting.SheetName, sheetData);
            }

            return result;
        }
    }
}
