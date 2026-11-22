import { useCallback, useRef, useState } from "react";
import { useStateRef } from "@/commons/hooks/useHooks";

import * as extend from "@/commons/utils/extends";
import * as messages from "@/commons/utils/messages";
import { logger } from "@/commons/utils/logger";
const log = logger.create("Chat");

import { ThinkingStreamParser } from "@/commons/utils/streams";

import { chatAttachmentTypeFromMime } from "./components/attachments";

import type {
  ChatConfigs,
  ChatEmitEvents,
  ChatMessage,
  ChatPlanStatus,
  ChatSendTools,
  PendingAttachment,
  ReceiveMessagePayload,
} from "./com/chats.types";

import * as pub from "@/services/pub.services";

function pendingToChatAttachments(
  items: PendingAttachment[],
): NonNullable<ChatMessage["attachments"]> {
  return items.map((item) => ({
    type: item.type,
    url: item.url,
    name: item.name,
  }));
}

function collectBlobUrls(
  records: ChatMessage[],
  pending: PendingAttachment[],
): string[] {
  const urls = new Set<string>();
  pending.forEach((item) => urls.add(item.url));
  records.forEach((record) =>
    record.attachments?.forEach((attach) => {
      if (attach.url.startsWith("blob:")) urls.add(attach.url);
    }),
  );
  return [...urls];
}

const SPEED_CONFIGS: Record<number, { min: number; max: number }> = {
  1: { min: 60, max: 100 },
  2: { min: 20, max: 50 },
  3: { min: 5, max: 15 },
};

function formatStr(str: string) {
  try {
    return JSON.parse(str) as unknown;
  } catch {
    return str;
  }
}

function findBot(records: ChatMessage[], connectionID: string) {
  return records.find((a) => a.connectionID === connectionID && a.isBot);
}

function buildSendTools(
  show: ChatConfigs["show"],
  chatTools: {
    model: string;
    activeThinking: boolean;
    activeSearch: boolean;
  },
  attachments: NonNullable<ChatMessage["attachments"]>,
): ChatSendTools {
  const tools: ChatSendTools = {};

  if (show.model) tools.model = chatTools.model;
  if (show.thinking) tools.thinking = chatTools.activeThinking;
  if (show.search) tools.search = chatTools.activeSearch;
  // upload 特殊：不论 show.upload 开关，有附件时都返回
  if (attachments.length > 0) tools.attachments = attachments;

  return tools;
}

export function useChat(configs: ChatConfigs, events: ChatEmitEvents) {
  const [message, setMessage] = useState("");
  const [pendingAttachments, setPendingAttachments] = useState<
    PendingAttachment[]
  >([]);

  const [records, setRecords, recordsRef] = useStateRef<ChatMessage[]>([]);
  const [connectionID, setConnectionID, connectionIDRef] =
    useStateRef<string>("");

  const [isThinkingStream, setIsThinkingStream] = useState(false);
  const [isAutoScroll, setIsAutoScroll] = useState(true);

  const [chatTools, setChatTools] = useState({
    model: configs.model || "GPT-4o",
    activeThinking: true,
    activeSearch: false,
    activeTools: false,
    activeImage: false,
    activeCode: false,
  });

  const containerRef = useRef<HTMLDivElement>(null);
  const tempIDRef = useRef("");
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const countRef = useRef(0);
  const streamAbortHandlerRef = useRef<(() => void) | null>(null);
  const streamThinkingParserRef = useRef(new ThinkingStreamParser());
  const queueRef = useRef({
    isProcessing: false,
    sendQueues: [] as ChatMessage[],
    resolveSignal: null as null | (() => void),
  });

  const scrollTo = useCallback(
    (action: string = "bottom", force = false) => {
      if (force) setIsAutoScroll(true);
      if (!isAutoScroll && !force) return;
      requestAnimationFrame(() => {
        const el = containerRef.current;
        if (!el) return;
        el.scrollTo({
          top: action === "bottom" ? el.scrollHeight : 0,
          behavior: "smooth",
        });
      });
    },
    [isAutoScroll],
  );

  const shouldAbortFlow = useCallback((_cid: string) => {
    log.log("Stop", _cid);
    if (connectionIDRef.current === "") return true;
    if (recordsRef.current.length === 0) return true;
    return false;
  }, []);

  const getSmartDelay = useCallback(
    (char: string) => {
      const speed = configs.speed || 2;
      const { min, max } = SPEED_CONFIGS[speed] ?? SPEED_CONFIGS[2];
      let delay = Math.floor(Math.random() * (max - min + 1)) + min;
      if (
        ["，", ",", "。", ".", "！", "!", "？", "?", ":", "：", "\n"].includes(
          char,
        )
      ) {
        const pauseFactor = speed === 3 ? 0.5 : 1;
        delay += Math.floor(150 * pauseFactor);
      }
      return delay;
    },
    [configs.speed],
  );

  const clearTimer = useCallback(() => {
    countRef.current = 0;
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const endChat = useCallback(() => {
    log.log("end chat");
    streamAbortHandlerRef.current?.();
    streamAbortHandlerRef.current = null;
    setConnectionID("");
    clearTimer();
  }, [clearTimer]);

  const pushThinking = useCallback((connectionId: string, text: string) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.connectionID !== connectionId || !r.isBot) return r;
        return {
          ...r,
          isThinking: true,
          thought: r.thought ? r.thought + text : text,
        };
      }),
    );
  }, []);
  const markThinkingStart = useCallback((cid: string) => {
    setRecords((prev) =>
      prev.map((r) =>
        r.connectionID === cid && r.isBot
          ? {
              ...r,
              hasThinking: true,
              isThinking: true,
              showThinking: true,
            }
          : r,
      ),
    );
  }, []);
  const markThinkingEnd = useCallback((cid: string) => {
    setRecords((prev) =>
      prev.map((r) =>
        r.connectionID === cid && r.isBot ? { ...r, isThinking: false } : r,
      ),
    );
  }, []);

  const pushText = useCallback((connectionId: string, text: string) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.connectionID !== connectionId || !r.isBot) return r;

        const msgs = r.messages.filter((item) => item.type !== "loading");
        const latest = msgs[msgs.length - 1];

        if (latest?.type === "text") {
          const updated = [...msgs];
          updated[updated.length - 1] = {
            ...latest,
            data: String(latest.data) + text,
          };
          return { ...r, messages: updated };
        }
        return {
          ...r,
          messages: [...msgs, { type: "text", data: text }],
        };
      }),
    );
  }, []);
  
  const streamText = useCallback(
    async (cid: string, text: string, thinking = false) => {
      const chars = Array.from(text);
      for (const char of chars) {
        if (shouldAbortFlow(cid)) return;

        // 思考流
        if (thinking) {
          pushThinking(cid, char);
          await extend.Optimize.sleep(10 + Math.random() * 20);
        }
        // 文字流
        else {
          pushText(cid, char);
          await extend.Optimize.sleep(getSmartDelay(char));
        }
        scrollTo("bottom");
      }
    },
    [getSmartDelay, pushText, pushThinking, scrollTo, shouldAbortFlow],
  );
  const setStreamAbortHandler = useCallback((handler: (() => void) | null) => {
    streamAbortHandlerRef.current = handler;
  }, []);
  const beginStream = useCallback(
    (cid: string) => {
      streamThinkingParserRef.current.reset();
      setConnectionID(cid);
      setRecords((prev) =>
        prev.map((r) =>
          r.connectionID === cid && r.isBot
            ? {
                ...r,
                status: "open",
                thought: "",
                hasThinking: false,
                isThinking: false,
                messages: r.messages.filter((item) => item.type !== "loading"),
              }
            : r,
        ),
      );
      scrollTo("bottom");
    },
    [scrollTo],
  );
  const appendStreamDelta = useCallback(
    (cid: string, text: string) => {
      streamThinkingParserRef.current.feed(text, {
        onText: (chunk) => pushText(cid, chunk),
        onThinkingStart: () => markThinkingStart(cid),
        onThinking: (chunk) => pushThinking(cid, chunk),
        onThinkingEnd: () => markThinkingEnd(cid),
      });
      scrollTo("bottom");
    },
    [markThinkingEnd, markThinkingStart, pushText, pushThinking, scrollTo],
  );
  const endStream = useCallback(
    (cid: string, error?: string) => {
      streamAbortHandlerRef.current = null;
      if (!error) {
        streamThinkingParserRef.current.flush({
          onText: (chunk) => pushText(cid, chunk),
          onThinkingStart: () => markThinkingStart(cid),
          onThinking: (chunk) => pushThinking(cid, chunk),
          onThinkingEnd: () => markThinkingEnd(cid),
        });
      }
      streamThinkingParserRef.current.reset();
      if (error) {
        setRecords((prev) =>
          prev.map((r) => {
            if (r.connectionID !== cid || !r.isBot) return r;
            const msgs = r.messages.filter((item) => item.type !== "loading");
            return {
              ...r,
              status: "done",
              messages: [...msgs, { type: "error" as const, data: error }],
            };
          }),
        );
      } else {
        setRecords((prev) =>
          prev.map((r) =>
            r.connectionID === cid && r.isBot
              ? {
                  ...r,
                  status: "done",
                  messages: r.messages.filter(
                    (item) => item.type !== "loading",
                  ),
                }
              : r,
          ),
        );
      }
      setConnectionID("");
      scrollTo("bottom", true);
    },
    [markThinkingEnd, markThinkingStart, pushText, pushThinking, scrollTo],
  );

  const pushList = useCallback((connectionId: string, content: unknown) => {
    setRecords((prev) =>
      prev.map((r) => {
        if (r.connectionID !== connectionId || !r.isBot) return r;
        const msgs = r.messages.filter((item) => item.type !== "loading");
        const latest = msgs[msgs.length - 1];
        if (latest?.type === "list" && Array.isArray(latest.data)) {
          const updated = [...msgs];
          updated[updated.length - 1] = {
            ...latest,
            data: [...latest.data, content],
          };
          return { ...r, messages: updated };
        }
        return {
          ...r,
          messages: [...msgs, { type: "list", data: [content] }],
        };
      }),
    );
  }, []);

  const pushMessage = useCallback((values: ChatMessage) => {
    const { connectionID: cid, messages: msgs } = values;
    setRecords((prev) =>
      prev.map((r) => {
        if (r.connectionID !== cid || !r.isBot) return r;
        return {
          ...r,
          status: "open",
          messages: [...r.messages, ...msgs],
        };
      }),
    );
  }, []);

  const pushError = useCallback(() => {
    setRecords((prev) => [
      ...prev,
      {
        connectionID: "",
        isBot: true,
        messages: [
          { type: "error", data: "server is busy, please try again later." },
        ],
      },
    ]);
  }, []);

  // 附件
  const addAttachments = useCallback(
    async (files: FileList | File[], mode: "image" | "file") => {
      const list = Array.from(files);
      const accepted =
        mode === "image"
          ? list.filter((file) => file.type.startsWith("image/"))
          : list;

      if (list.length === 0) return;

      if (mode === "image" && accepted.length === 0) {
        messages.showError("Please select image");
        return;
      }

      const results = await Promise.all(
        accepted.map(async (file) => {
          const formData = new FormData();
          formData.append("File", file);

          const resp: any = await pub.upload(formData);
          const { status, data } = resp;

          if (!status) return null;

          log.log("attach uploaded", data);

          const mediaType =
            data.type || file.type || "application/octet-stream";

          return {
            id: extend.ExString.uuid(),
            file,
            url: data.url,
            name: data.originalName,
            type: chatAttachmentTypeFromMime(mediaType),
            mediaType,
          } as PendingAttachment;
        }),
      );

      const nextItems = results.filter(Boolean) as PendingAttachment[];
      setPendingAttachments((prev) => [...prev, ...nextItems]);
    },
    [],
  );
  const removePendingAttachment = useCallback((id: string) => {
    setPendingAttachments((prev) => {
      const target = prev.find((item) => item.id === id);
      if (target) URL.revokeObjectURL(target.url);
      return prev.filter((item) => item.id !== id);
    });
    log.log("attach removed");
  }, []);

  const submitMessage = useCallback(
    (
      text: string,
      presetConnectionID?: string,
      presetAttachments?: ChatMessage["attachments"],
    ) => {
      if (connectionIDRef.current) {
        messages.showInfo(
          "Another conversation is currently in progress. Please wait until it is completed.",
        );
        return;
      }
      const trimmed = text.trim();
      const attachments =
        presetAttachments ?? pendingToChatAttachments(pendingAttachments);

      if (!trimmed && attachments.length === 0) {
        messages.showError("please input something");
        return;
      }

      let cid = extend.ExString.uuid();
      if (presetConnectionID) {
        cid = presetConnectionID;
      } else if (tempIDRef.current) {
        cid = tempIDRef.current;
        tempIDRef.current = "";
      }

      setIsAutoScroll(true);
      setRecords((prev) => [
        ...prev,
        {
          connectionID: cid,
          name: "You",
          isBot: false,
          status: "done",
          messages: trimmed ? [{ type: "text", data: trimmed }] : [],
          attachments: attachments.length > 0 ? attachments : undefined,
        },
      ]);

      events.sended?.({
        connectionID: cid,
        message: trimmed,
        tools: buildSendTools(configs.show, chatTools, attachments),
      });

      // 清空
      setMessage("");
      if (!presetAttachments) {
        setPendingAttachments([]);
      }
    },
    [events, pendingAttachments, chatTools, configs.show],
  );

  const sendDirect = useCallback(
    (
      text: string,
      presetConnectionID?: string,
      presetAttachments?: ChatMessage["attachments"],
    ) => {
      submitMessage(text, presetConnectionID, presetAttachments);
    },
    [submitMessage],
  );

  const handleRecord = useCallback(
    async (record: ChatMessage) => {
      log.log("run", record);
      const {
        connectionID: cid,
        messages: msgs,
        thought,
        attachments,
        sources,
        suggests,
        plans,
      } = record;

      switch (record.action) {
        case "flows": {
          setConnectionID(cid);
          setRecords((prev) => {
            const target = findBot(prev, cid);
            if (!target) {
              return [
                ...prev,
                {
                  ...record,
                  status: "open",
                  thought: "",
                  plans: [],
                  messages: [],
                  attachments: [],
                  sources: [],
                  suggests: [],
                },
              ];
            }
            return prev.map((r) =>
              r.connectionID === cid && r.isBot
                ? {
                    ...r,
                    ...record,
                    status: "open",
                    thought: "",
                    plans: [],
                    messages: [],
                    attachments: [],
                    sources: [],
                    suggests: [],
                  }
                : r,
            );
          });

          if (thought) {
            setRecords((prev) =>
              prev.map((r) =>
                r.connectionID === cid && r.isBot
                  ? {
                      ...r,
                      hasThinking: true,
                      isThinking: true,
                      showThinking: true,
                    }
                  : r,
              ),
            );
            await streamText(cid, thought, true);
            setRecords((prev) =>
              prev.map((r) =>
                r.connectionID === cid && r.isBot
                  ? { ...r, isThinking: false }
                  : r,
              ),
            );
          }

          if (plans && plans.length > 0) {
            setRecords((prev) =>
              prev.map((r) =>
                r.connectionID === cid && r.isBot ? { ...r, plans } : r,
              ),
            );
            await extend.Optimize.sleep(200);
          }

          for (const mes of msgs) {
            if (shouldAbortFlow(cid)) break;

            // 处理 Text
            if (mes.type === "text") {
              await streamText(cid, String(mes.data), false);
            }
            // 处理 List
            else if (mes.type === "list" && Array.isArray(mes.data)) {
              for (const content of mes.data) {
                if (shouldAbortFlow(cid)) break;
                pushList(cid, content);
                await extend.Optimize.sleep(300);
              }
            }
            // 处理
            else {
              await extend.Optimize.sleep(400);
              pushMessage({ connectionID: cid, isBot: true, messages: [mes] });
            }
          }

          if (attachments?.length) {
            await extend.Optimize.sleep(200);
            setRecords((prev) =>
              prev.map((r) =>
                r.connectionID === cid && r.isBot ? { ...r, attachments } : r,
              ),
            );
          }

          if (sources?.length) {
            await extend.Optimize.sleep(200);
            setRecords((prev) =>
              prev.map((r) =>
                r.connectionID === cid && r.isBot ? { ...r, sources } : r,
              ),
            );
          }

          if (suggests?.length) {
            await extend.Optimize.sleep(200);
            setRecords((prev) =>
              prev.map((r) =>
                r.connectionID === cid && r.isBot ? { ...r, suggests } : r,
              ),
            );
            scrollTo("bottom", true);
          }

          setRecords((prev) =>
            prev.map((r) => {
              if (r.connectionID !== cid || !r.isBot) return r;
              return {
                ...r,
                status: "done",
                messages: r.messages.filter((item) => item.type !== "loading"),
              };
            }),
          );

          setConnectionID("");
          queueRef.current.resolveSignal?.();
          queueRef.current.resolveSignal = null;
          break;
        }
        case "question": {
          tempIDRef.current = cid;
          sendDirect(String(msgs[0]?.data ?? ""), cid || undefined);
          break;
        }
        case "waiting": {
          setConnectionID(record.connectionID);
          setRecords((prev) => [...prev, { ...record, status: "waiting" }]);
          break;
        }
        case "error": {
          pushError();
          break;
        }
        case "tips":
        default: {
          setRecords((prev) => {
            const target = findBot(prev, cid);
            if (target) {
              return prev.map((r) =>
                r.connectionID === cid && r.isBot
                  ? { ...record, ...r, status: "done" }
                  : r,
              );
            }
            return [...prev, record];
          });
          setConnectionID("");
          break;
        }
      }
      events.received?.({ connectionID: cid, action: record.action });
    },
    [
      events,
      pushError,
      pushList,
      pushMessage,
      scrollTo,
      shouldAbortFlow,
      streamText,
      sendDirect,
    ],
  );

  // 推送消息进队列
  const processQueue = useCallback(async () => {
    if (queueRef.current.isProcessing) return;

    queueRef.current.isProcessing = true;
    try {
      while (queueRef.current.sendQueues.length > 0) {
        const record = queueRef.current.sendQueues.shift();
        if (!record) continue;

        setIsAutoScroll(true);

        // flows 结束时会在 handleRecord 内调用 resolveSignal，必须先注册再执行
        let flowDone: Promise<void> | undefined;
        if (record.action === "flows") {
          flowDone = new Promise<void>((resolve) => {
            queueRef.current.resolveSignal = resolve;
          });
        }

        await handleRecord(record);

        if (flowDone) {
          await flowDone;
        } else if (record.action === "waiting") {
          await extend.Optimize.sleep(350);
        } else {
          await extend.Optimize.sleep(100);
        }
      }
    } finally {
      queueRef.current.isProcessing = false;
      if (queueRef.current.sendQueues.length > 0) {
        void processQueue();
      }
    }
  }, [handleRecord]);
  const sendChat = useCallback(
    (record: ChatMessage) => {
      queueRef.current.sendQueues.push(record);
      processQueue();
    },
    [processQueue],
  );

  const sendMessage = useCallback(
    (event?: React.KeyboardEvent) => {
      event?.preventDefault();
      submitMessage(message);
    },
    [message, submitMessage],
  );

  // 处理消息
  const receiveMessage = useCallback(
    (msg: ReceiveMessagePayload) => {
      const parsedMessage = formatStr(msg.message);
      const remarks = formatStr(String(msg.remarks ?? "{}")) as Record<
        string,
        unknown
      >;

      if (connectionID !== msg.connectionID) return;

      setRecords((prev) =>
        prev.map((r) =>
          r.connectionID === msg.connectionID && r.isBot
            ? { ...r, status: "open" }
            : r,
        ),
      );

      if (timerRef.current) {
        clearTimer();
        log.log("clear timer with receive");
      }

      const text = String(parsedMessage);

      if (msg.category === "text") {
        if (text === "<think>") {
          setIsThinkingStream(true);
          return;
        }
        if (text === "</think>") {
          setIsThinkingStream(false);
          setRecords((prev) =>
            prev.map((r) =>
              r.connectionID === msg.connectionID && r.isBot
                ? { ...r, isThinking: false }
                : r,
            ),
          );
          return;
        }

        if (isThinkingStream) {
          pushThinking(msg.connectionID, text);
        } else if (remarks.paragraph_start) {
          pushMessage({
            connectionID: msg.connectionID,
            isBot: true,
            messages: [{ type: msg.category, data: parsedMessage }],
          });
        } else {
          pushText(msg.connectionID, text);
        }
      } else if (msg.category === "error") {
        pushMessage({
          connectionID: msg.connectionID,
          isBot: true,
          messages: [{ type: "error", data: parsedMessage }],
        });
      } else {
        pushMessage({
          connectionID: msg.connectionID,
          isBot: true,
          messages: [
            {
              type: msg.category as ChatMessage["messages"][number]["type"],
              data: parsedMessage,
            },
          ],
        });
      }

      if (remarks.response_end) {
        setRecords((prev) =>
          prev.map((r) =>
            r.connectionID === msg.connectionID && r.isBot
              ? { ...r, status: "done" }
              : r,
          ),
        );
        endChat();
      }
    },
    [
      clearTimer,
      connectionID,
      endChat,
      isThinkingStream,
      pushMessage,
      pushText,
      pushThinking,
    ],
  );

  const clearChat = useCallback(() => {
    collectBlobUrls(recordsRef.current, pendingAttachments).forEach((url) =>
      URL.revokeObjectURL(url),
    );
    endChat();
    setRecords([]);
    setPendingAttachments([]);
    log.log("cleared");
    events.cleared?.({});
  }, [endChat, events, pendingAttachments]);

  const refreshConnectionID = useCallback((oldID: string, newID: string) => {
    setRecords((prev) =>
      prev.map((item) =>
        item.connectionID === oldID ? { ...item, connectionID: newID } : item,
      ),
    );
    setConnectionID((cur) => (cur === oldID ? newID : cur));
  }, []);

  const regenerate = useCallback(
    (record: ChatMessage) => {
      const cid = record.connectionID;
      const text = String(record.messages[0]?.data ?? "");
      setRecords((prev) => prev.filter((r) => r.connectionID !== cid));
      sendDirect(text, cid, record.attachments);
    },
    [sendDirect],
  );

  const copyToClipboard = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      messages.showInfo("The information has been copied to the clipboard.");
    } catch (err) {
      console.error("复制失败:", err);
    }
  }, []);

  const handleUserScroll = useCallback(() => {
    setIsAutoScroll(false);
  }, []);

  const updateRecord = useCallback(
    (cid: string, patch: Partial<ChatMessage>) => {
      setRecords((prev) =>
        prev.map((r) => (r.connectionID === cid ? { ...r, ...patch } : r)),
      );
    },
    [],
  );

  const updatePlanStatus = useCallback(
    (connectionID: string, planId: string, status: ChatPlanStatus) => {
      setRecords((prev) =>
        prev.map((r) => {
          if (r.connectionID !== connectionID || !r.isBot || !r.plans?.length) {
            return r;
          }
          return {
            ...r,
            plans: r.plans.map((plan) =>
              plan.id === planId ? { ...plan, status } : plan,
            ),
          };
        }),
      );
    },
    [],
  );

  return {
    records,
    message,
    setMessage,
    connectionID,
    chatTools,
    setChatTools,
    containerRef,
    scrollTo,
    sendChat,
    sendMessage,
    stopMessage: endChat,
    beginStream,
    appendStreamDelta,
    endStream,
    setStreamAbortHandler,
    receiveMessage,
    clearChat,
    refreshConnectionID,
    regenerate,
    copyToClipboard,
    handleUserScroll,
    updateRecord,
    updatePlanStatus,
    pendingAttachments,
    addAttachments,
    removePendingAttachment,
    sendAudio: () => messages.showInfo("暂未开放"),
  };
}
