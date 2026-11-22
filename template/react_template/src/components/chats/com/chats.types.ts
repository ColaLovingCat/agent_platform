export type ChatAttachmentType = "image" | "pdf" | "file" | "video";

export interface PendingAttachment {
  id: string;
  file: File;
  url: string;
  name: string;
  type: ChatAttachmentType;
  mediaType: string;
}

export type ChatPlanStatus = "open" | "running" | "done" | "error";

export interface ChatPlanItem {
  id: string;
  content: string;
  status: ChatPlanStatus;
}

export interface ChatMessage {
  action?: "flows" | "tips" | "question" | "waiting" | "error";
  //
  connectionID: string;
  //
  isBot?: boolean;
  bot_id?: string;
  name?: string;
  //
  status?: "waiting" | "open" | "done";
  //
  thought?: string;
  hasThinking?: boolean;
  isThinking?: boolean;
  showThinking?: boolean;
  //
  plans?: ChatPlanItem[];
  //
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
    | "citation"
    | "confirm"
    | "loading";
    data: unknown;
  }[];
  attachments?: {
    type: ChatAttachmentType;
    url: string;
    name: string;
  }[];
  sources?: { href: string, title: string }[];
  suggests?: {
    key?: string;
    icon?: string;
    content: string; // 显示的内容
    infos?: unknown;
  }[];
}

export interface ChatModelOption {
  name: string;
  provider: string;
}

export interface ChatConfigs {
  robotName: string;
  limit: number;
  speed: number; // 对话速度
  show_bot: boolean; // 是否显示机器人名称
  show: {
    input: boolean;
    model: boolean;
    thinking: boolean;
    search: boolean;
    upload: boolean;
    tools: boolean;
  };
  model: string;
  models: ChatModelOption[];
}

export const defaultChatConfigs: ChatConfigs = {
  robotName: "Assistant",
  limit: 60,
  speed: 2,
  show_bot: false,
  show: {
    input: true,
    model: false,
    thinking: false,
    search: false,
    upload: false,
    tools: false,
  },
  model: "gpt-4o",
  models: [],
};

export interface ChatSendInfos {
  connectionID: string;
  message: string;
  tools: ChatSendTools;
}

export interface ChatSendTools {
  model?: string;
  thinking?: boolean;
  search?: boolean;
  attachments?: NonNullable<ChatMessage["attachments"]>;
}

export interface ChatRef {
  sendChat: (record: ChatMessage) => void;
  receiveMessage: (msg: ReceiveMessagePayload) => void;
  clearChat: (mark?: boolean) => void;
  refreshConnectionID: (oldID: string, newID: string) => void;
  setModel: (name: string) => void;
  /** 更新指定 connection 下某条 plan 的状态 */
  updatePlanStatus: (
    connectionID: string,
    planId: string,
    status: ChatPlanStatus,
  ) => void;
  /** HTTP SSE 真流式：开始输出（waiting → open） */
  beginStream: (connectionID: string) => void;
  /** HTTP SSE 真流式：追加文本片段（无人工 delay） */
  appendStreamDelta: (connectionID: string, text: string) => void;
  /** HTTP SSE 真流式：结束；error 非空时展示错误 */
  endStream: (connectionID: string, error?: string) => void;
  /** 用户点停止时 abort 外部 fetch；传 null 清除 */
  setStreamAbortHandler: (handler: (() => void) | null) => void;
}

export interface ReceiveMessagePayload {
  connectionID: string;
  category: string;
  message: string;
  remarks?: string | Record<string, unknown>;
}

export interface ChatEmitEvents {
  sended?: (values: ChatSendInfos) => void;
  received?: (values: { connectionID: string; action?: string }) => void;
  cleared?: (values: Record<string, never>) => void;
  clickItem?: (values: { action: string; values: unknown }) => void;
  onModelSelect?: () => void;
}
