export interface ChatMessage {
  // Connection Info
  connectionID: string;
  isBot?: boolean;
  name?: string;
  status?: "waiting" | "open" | "done";
  // deep thinking
  thought?: string; // 内容
  hasThinking?: boolean; // 是否需要
  isThinking?: boolean; // 状态
  showThinking?: boolean; // 折叠
  //
  action?:
    | "flows" // 文字流
    | "tips" // 提示
    | "question" // 问题
    | "waiting" // 等待
    | "error"; // 报错
  // 消息内容
  messages: {
    type:
      | "error"
      | "text"
      | "list"
      | "table"
      | "image"
      | "audio"
      | "video"
      | "echart"
      | "citation" // 引文
      | "confirm";
    data: any;
  }[];
  // 附件
  attachments?: {
    type: "image" | "pdf" | "file" | "video";
    url: string;
    name: string;
  }[];
  // 建议
  suggests?: {
    key?: string;
    icon?: string;
    content: string;
    infos?: any;
  }[];
}

export interface ChatConfigs {
  robotName: string;
  limit: number;
  speed: number;
  //
  show: {
    input: boolean; // 是否使用输入框
    model: boolean;
    thinking: boolean;
    search: boolean;
    upload: boolean;
    tools: boolean;
  };
  //
  model: string;
}
