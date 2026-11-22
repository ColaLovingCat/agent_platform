import { defineAsyncComponent } from "vue";
import type { NodeInfos } from "@/components/workflows/contents/flow.types";

// 定义节点的唯一code
export enum CategoryID {
  // 触发方式
  Trigger_Manually = "Trigger_Manually",
  Trigger_Schedule = "Trigger_Schedule",
  Trigger_WebCall = "Trigger_WebCall",
  Trigger_Chat = "Trigger_Chat",
  // 数据输入
  Data_Input_Const = "Data_Input_Const",
  Data_Input_File = "Data_Input_File",
  Data_Input_SQL = "Data_Input_SQL",
  Data_Input_HTTP_Request = "Data_Input_HTTP_Request",
  // 逻辑节点
  Logi_If = "Logi_If",
  Logi_Switch = "Logi_Switch",
  Logi_Loops = "Logi_Loops",
  Logi_Loops_Continue = "Logi_Loops_Continue",
  Logi_Loops_Break = "Logi_Loops_Break",
  Logi_Merge = "Logi_Merge",
  Logi_Error_Output = "Logi_Error_Output",
  // 数据处理
  Data_Process_Filter = "Data_Process_Filter",
  Data_Process_Sort = "Data_Process_Sort",
  Data_Process_Remove_Duplicates = "Data_Process_Remove_Duplicates",
  Data_Process_Summarize = "Data_Process_Summarize",
  Data_Process_Code = "Data_Process_Code",
  // 数据输出
  Data_Output_Data = "Data_Output_Data",
  Data_Output_File = "Data_Output_File",
}

// 获取节点的图标
export const getIcon = (category: string) => {
  let result = "fa-database";
  switch (category) {
    case "触发方式": {
      result = "fa-bell";
      break;
    }
    case CategoryID.Trigger_Manually: {
      result = "fa-arrow-pointer";
      break;
    }
    case CategoryID.Trigger_Schedule: {
      result = "fa-clock";
      break;
    }
    case CategoryID.Trigger_WebCall: {
      result = "fa-tower-broadcast";
      break;
    }
    case CategoryID.Trigger_Chat: {
      result = "fa-comment";
      break;
    }
    //
    case "数据输入": {
      result = "fa-cloud-arrow-up";
      break;
    }
    case CategoryID.Data_Input_Const: {
      result = "fa-terminal";
      break;
    }
    case CategoryID.Data_Input_File: {
      result = "fa-file-arrow-up";
      break;
    }
    case CategoryID.Data_Input_SQL: {
      result = "fa-database";
      break;
    }
    case CategoryID.Data_Input_HTTP_Request: {
      result = "fa-cloud";
      break;
    }
    //
    case "逻辑节点": {
      result = "fa-code-fork";
      break;
    }
    case CategoryID.Logi_If: {
      result = "fa-arrows-left-right";
      break;
    }
    case CategoryID.Logi_Switch: {
      result = "fa-arrow-right-arrow-left";
      break;
    }
    case CategoryID.Logi_Loops: {
      result = "fa-arrows-rotate";
      break;
    }
    case CategoryID.Logi_Loops_Continue: {
      result = "fa-arrow-right-to-bracket";
      break;
    }
    case CategoryID.Logi_Loops_Break: {
      result = "fa-arrow-right-from-bracket";
      break;
    }
    case CategoryID.Logi_Merge: {
      result = "fa-code-pull-request";
      break;
    }
    case CategoryID.Logi_Error_Output: {
      result = "fa-triangle-exclamation";
      break;
    }
    //
    case "数据处理": {
      result = "fa-table";
      break;
    }
    case CategoryID.Data_Process_Filter: {
      result = "fa-filter";
      break;
    }
    case CategoryID.Data_Process_Sort: {
      result = "fa-sort";
      break;
    }
    case CategoryID.Data_Process_Remove_Duplicates: {
      result = "fa-clone";
      break;
    }
    case CategoryID.Data_Process_Summarize: {
      result = "fa-clipboard-list";
      break;
    }
    case CategoryID.Data_Process_Code: {
      result = "fa-code";
      break;
    }
    //
    case "数据输出": {
      result = "fa-file-export";
      break;
    }
    case CategoryID.Data_Output_Data: {
      result = "fa-file-export";
      break;
    }
    case CategoryID.Data_Output_File: {
      result = "fa-download";
      break;
    }
    default: {
      break;
    }
  }
  return result;
};

// 基于category生成node所需的基础信息
export const getNode = (type: string, category: any): NodeInfos => {
  let params = {};
  let preCheck = "none";
  let model = "normal";
  let ports = [
    { id: "left", group: "left" },
    { id: "right", group: "right" },
  ];
  //
  switch (category.id) {
    case CategoryID.Trigger_Schedule: {
      params = {
        taskName: "",
        interval: null,
        value: null,
        day: null,
        weeks: [],
        hour: null,
        minute: null,
      };
      ports = [{ id: "right", group: "right" }];
      break;
    }
  }
  //
  return {
    id: "",
    shape: "flows-node",
    label: category.name,
    width: 250,
    height: 50,
    data: {
      id: "",
      flowID: "",
      name: "",
      isStencil: true,
      type,
      category: { ...category },
      preCheck,
      preInfos: [],
      datas: {},
      params,
      model,
      status: "",
      resultID: null,
      result: {},
    },
    ports,
  };
};
export const getEdge = () => {
  return {
    shape: "edge",
    attrs: {
      line: {
        stroke: "#5F95FF",
        strokeWidth: 2,
        targetMarker: {
          name: "block",
          width: 12,
          height: 8,
        },
      },
    },
    zIndex: 0,
  };
};

//#region Node Config
// 匹配不同节点的配置界面
export const configComponentMap: Record<string, any> = {
  trigger_schedule: defineAsyncComponent(
    () => import("./configs/trigger/trigger-schedule.vue")
  ),
  data_input_const: defineAsyncComponent(
    () => import("./configs/data-input/data-input-const.vue")
  ),
};
// 匹配不同节点的运行方法
type RunNode = (input: any, config: any) => Promise<any>;
export const runNodeMap: Record<string, RunNode> = {
  trigger_schedule: async (_, config) => config.initialValue,
};
//#endregion
