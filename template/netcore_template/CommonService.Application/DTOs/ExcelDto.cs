using Microsoft.AspNetCore.Http;
using System;
using System.Collections.Generic;
using System.ComponentModel.DataAnnotations;
using System.Linq;
using System.Text;
using System.Threading.Tasks;

namespace CommonService.Application.DTOs
{
    public class ExcelReadDto
    {

        [Required]
        public IFormFile File { get; set; }

        /// <summary>
        /// 读取配置列表。
        /// 如果为空（不传），则默认读取 Excel 中所有的 Sheet，且从数据起始位置开始。
        /// </summary>
        public List<SheetReadSetting>? Sheets { get; set; }
    }

    public class SheetReadSetting
    {
        /// <summary>
        /// 要读取的 Sheet 名称
        /// </summary>
        public string SheetName { get; set; }

        /// <summary>
        /// 该 Sheet 的开始读取位置 (例如 "A1", "B5")。
        /// 如果为空，自动识别该 Sheet 的有数据区域。
        /// </summary>
        public string? StartCell { get; set; }
    }
}
