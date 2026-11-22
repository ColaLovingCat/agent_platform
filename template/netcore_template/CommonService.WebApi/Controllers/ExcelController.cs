using ClosedXML.Excel;
using CommonService.Application.DTOs;
using CommonService.Application.Services.Interfaces;
using CommonService.Core.Models;
using Microsoft.AspNetCore.Mvc;

namespace CommonService.WebApi.Controllers
{
    [ApiController]
    [Route("api/excels")]
    public class ExcelsController : ControllerBase
    {
        private readonly IExcelService _excelService;
        public ExcelsController(IExcelService excelService)
        {
            _excelService = excelService;
        }

        public class ExcelExportDto
        {
            public string Filename { get; set; }
            public List<List<string>> Data { get; set; }
        }

        /// <summary>
        /// 读取excel数据
        /// </summary>
        /// <remarks>
        /// 示例：
        /// { "File": "export.xlsx", "Sheets[0].SheetName": "Data", "Sheets[0].StartCell": "B22" }
        /// </remarks>
        [HttpPost("read")]
        public ActionResult<ApiResponse<Dictionary<string, List<List<string>>>>> Read([FromForm] ExcelReadDto dto)
        {
            if (dto.File == null || dto.File.Length == 0)
                return ApiResponse<Dictionary<string, List<List<string>>>>.Fail("请上传有效的文件");

            var ext = Path.GetExtension(dto.File.FileName).ToLower();
            if (ext != ".xlsx" && ext != ".xlsm")
            {
                return ApiResponse<Dictionary<string, List<List<string>>>>.Fail("仅支持 .xlsx 或 .xlsm 格式的文件");
            }

            try
            {
                // 1. 打开流
                using var stream = dto.File.OpenReadStream();

                // 2. 在 Controller 层创建 Workbook 对象
                // 注意：这里使用 using，确保请求结束或报错时 Workbook 能被正确释放(Dispose)
                using var workbook = new XLWorkbook(stream);

                // (可选) 你可以在这里做一些 Workbook 级别的校验，例如：
                // if (workbook.Author == "BadGuy") throw new Exception("Blocked");

                // 3. 将 Workbook 对象传递给 Service
                var data = _excelService.ReadExcel(workbook, dto.Sheets);

                return ApiResponse<Dictionary<string, List<List<string>>>>.Ok(data);
            }
            catch (KeyNotFoundException ex)
            {
                return ApiResponse<Dictionary<string, List<List<string>>>>.Fail(ex.Message);
            }
            catch (Exception ex)
            {
                return ApiResponse<Dictionary<string, List<List<string>>>>.Fail($"解析失败: {ex.Message}");
            }
        }

        /// <summary>
        /// 生成excel文件
        /// </summary>
        /// <remarks>
        /// 示例：
        /// { "filename": "export.xlsx", "data": [ ["ID","Name","Age"], ["1","Alice","25"] ] }
        /// </remarks>
        [HttpPost("export")]
        public IActionResult Export([FromBody] ExcelExportDto dto)
        {
            if (string.IsNullOrWhiteSpace(dto.Filename))
                dto.Filename = "export.xlsx";

            if (!dto.Filename.EndsWith(".xlsx"))
                dto.Filename += ".xlsx";

            if (dto.Data == null || dto.Data.Count == 0)
                return BadRequest("数据不能为空");

            using var workbook = new ClosedXML.Excel.XLWorkbook();
            var worksheet = workbook.Worksheets.Add("Sheet1");

            for (int i = 0; i < dto.Data.Count; i++)
            {
                var row = dto.Data[i];
                for (int j = 0; j < row.Count; j++)
                {
                    worksheet.Cell(i + 1, j + 1).Value = row[j];
                }
            }

            using var stream = new MemoryStream();
            workbook.SaveAs(stream);
            stream.Position = 0;

            // 返回文件流，浏览器将触发下载
            return File(stream.ToArray(),
                        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        dto.Filename);
        }
    }
}
