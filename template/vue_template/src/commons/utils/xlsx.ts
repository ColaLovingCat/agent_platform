import * as XLSX from 'xlsx'

export const readExcel = async (path: string) => {
    try {
        // 动态导入Excel文件
        const response = await fetch(new URL(path, import.meta.url).href)
        const arrayBuffer = await response.arrayBuffer()
        // 解析Excel数据
        const data = new Uint8Array(arrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        // 返回数据
        let result: any = {}
        workbook.SheetNames.map((name: string) => {
            result[name] = XLSX.utils.sheet_to_json(workbook.Sheets[name])
        })
        return result
    } catch (error) {
        console.error('读取Excel文件失败:', error)
    }
    return {}
}

interface SheetData {
  sheetName: string;
  data: any[];
}
interface ExportExcelOptions {
  arraySeparator?: string;
  dateFormat?: string;
}

export const exportExcel = (
  sheets: SheetData[], 
  filename: string = 'export.xlsx', 
  options: ExportExcelOptions = {}
): void => {
  try {
    const {
      arraySeparator = ';',
    } = options;

    // 创建工作簿
    const workbook = XLSX.utils.book_new();
    
    sheets.forEach((sheet, index) => {
      const { sheetName, data } = sheet;
      
      if (!data || data.length === 0) {
        // 如果数据为空，创建空的工作表
        const emptyWorksheet = XLSX.utils.aoa_to_sheet([[]]);
        XLSX.utils.book_append_sheet(workbook, emptyWorksheet, sheetName);
        return;
      }
      
      // 处理数据
      const processedData = data.map(item => {
        const processedItem: any = {};
        
        Object.keys(item).forEach(key => {
          const value = item[key];
          
          if (Array.isArray(value)) {
            processedItem[key] = value.join(arraySeparator);
          } 
          else if (typeof value === 'object' && value !== null) {
            if (value instanceof Date) {
              processedItem[key] = value.toISOString().split('T')[0];
            } else {
              processedItem[key] = JSON.stringify(value);
            }
          }
          else {
            processedItem[key] = value;
          }
        });
        
        return processedItem;
      });
      
      // 创建工作表
      const worksheet = XLSX.utils.json_to_sheet(processedData);
      
      // 设置列宽（可选）
      if (processedData.length > 0) {
        const colWidths = Object.keys(processedData[0]).map(key => ({
          wch: Math.max(
            key.length,
            ...processedData.map(row => 
              String(row[key] || '').length
            )
          )
        }));
        worksheet['!cols'] = colWidths;
      }
      
      // 将工作表添加到工作簿
      XLSX.utils.book_append_sheet(workbook, worksheet, sheetName);
    });
    
    // 生成Excel文件并下载
    XLSX.writeFile(workbook, filename);
    
    console.log(`Excel文件 ${filename} 导出成功，包含 ${sheets.length} 个工作表`);
  } catch (error) {
    console.error('导出Excel文件失败:', error);
    throw error;
  }
};