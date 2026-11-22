using ClosedXML.Excel;
using CommonService.Application.DTOs;

namespace CommonService.Application.Services.Interfaces
{
    public interface IExcelService
    {
        Dictionary<string, List<List<string>>> ReadExcel(IXLWorkbook workbook, List<SheetReadSetting>? sheetSettings);
    }
}
