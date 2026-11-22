interface DataItem {
  description: string;
  startDate: string;
  endDate?: string;
  remark?: string;
  color?: string; // 可选覆盖颜色
}

interface ListItem {
  id: number;
  category: string;
  color: string;
  imgPath?: string;
  datas: DataItem[];
}

export interface GanttInfos {
  range: [string, string];
  periods: [string, string];
  list: ListItem[];
}
