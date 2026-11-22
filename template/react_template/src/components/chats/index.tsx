import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useMemo,
  useState,
} from 'react';
import { Button, Popover } from 'antd';

import { logger } from '@/commons/utils/logger';

import ChatInput from './components/chat-input';
import ChatRecord from './components/chat-record';
import ModelSelectModal from './components/model-select-modal';
import { useChat } from './useChat';
import {
  defaultChatConfigs,
  type ChatConfigs,
  type ChatEmitEvents,
  type ChatModelOption,
  type ChatRef,
} from './com/chats.types';

import './com/chats.scss';
import { Bot } from 'lucide-react';

const log = logger.create('Chat');

export type {
  ChatConfigs,
  ChatMessage,
  ChatModelOption,
  ChatPlanItem,
  ChatPlanStatus,
  ChatRef,
} from './com/chats.types';

interface AppChatsProps extends ChatEmitEvents {
  configs?: Partial<ChatConfigs>;
}

const AppChats = forwardRef<ChatRef, AppChatsProps>(function AppChats(
  { configs: configsProp, sended, received, cleared, clickItem, onModelSelect },
  ref,
) {
  const configs = useMemo(
    () => ({ ...defaultChatConfigs, ...configsProp }),
    [configsProp],
  );

  const events = useMemo(
    () => ({ sended, received, cleared, clickItem }),
    [sended, received, cleared, clickItem],
  );

  const chat = useChat(configs, events);

  const [modelModalOpen, setModelModalOpen] = useState(false);

  const modelSelectEnabled =
    configs.show.model &&
    (configs.models.length > 0 || !!onModelSelect);

  const handleOpenModelSelect = useCallback(() => {
    if (configs.models.length > 0) {
      setModelModalOpen(true);
      return;
    }
    onModelSelect?.();
  }, [configs.models.length, onModelSelect]);

  const handleSelectModel = useCallback(
    (model: ChatModelOption) => {
      chat.setChatTools((prev) => ({ ...prev, model: model.name }));
    },
    [chat.setChatTools],
  );

  useImperativeHandle(ref, () => ({
    sendChat: chat.sendChat,
    receiveMessage: chat.receiveMessage,
    clearChat: chat.clearChat,
    refreshConnectionID: chat.refreshConnectionID,
    setModel: (name: string) =>
      chat.setChatTools((prev) => ({ ...prev, model: name })),
    updatePlanStatus: chat.updatePlanStatus,
    beginStream: chat.beginStream,
    appendStreamDelta: chat.appendStreamDelta,
    endStream: chat.endStream,
    setStreamAbortHandler: chat.setStreamAbortHandler,
  }));

  useEffect(() => {
    chat.scrollTo('bottom');
  }, [chat.records, chat.scrollTo]);

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      const target = event.target as HTMLElement;

      if (target.classList.contains('code-copy')) {
        const codeElement = target.nextElementSibling?.querySelector('code');
        if (codeElement) {
          navigator.clipboard.writeText(codeElement.innerText).then(() => {
            target.innerText = 'Copied';
            setTimeout(() => {
              target.innerText = 'Copy';
            }, 1500);
          });
        }
      }

      if (target.classList.contains('clickable-text')) {
        const content = target.innerHTML;
        const key = target.getAttribute('data-key');
        const value = target.getAttribute('data-value');
        if (key && value) {
          log.log('Text clicked:', { content, key, value });
          clickItem?.({ action: 'text', values: { content, key, value } });
        }
      }
    };

    document.addEventListener('click', onClick);
    return () => document.removeEventListener('click', onClick);
  }, [clickItem]);

  return (
    <div className="app-chat">
      <div
        ref={chat.containerRef}
        className="chat-contents"
        onWheel={chat.handleUserScroll}
      >
        {chat.records.length === 0 ? (
          <div className="chat-empty">
            <Bot size={48} className="text-gray-300 mb-4" />
            <p className="text-sm font-medium text-gray-400">This is the start of your conversation.</p>
          </div>
        ) : (
          <div className="list-chats">
            {chat.records.map((record) => (
              <ChatRecord
                key={`${record.connectionID}-${record.isBot ? 'bot' : 'user'}`}
                record={record}
                showBot={configs.show_bot}
                fallbackBotName={configs.robotName}
                showThinking={chat.chatTools.activeThinking}
                onToggleThinking={() =>
                  chat.updateRecord(record.connectionID, {
                    showThinking: !record.showThinking,
                  })
                }
                onTableClick={(key, column, row) => {
                  log.log('Table clicked:', { key, column, row });
                  clickItem?.({ action: 'table', values: { key, column, row } });
                }}
                onChartClick={(event) => {
                  log.log('Chart clicked:', event);
                  clickItem?.({ action: 'chart', values: event });
                }}
                onSuggestClick={(suggest) => {
                  log.log('Suggest clicked:', suggest);
                  clickItem?.({ action: 'suggest', values: suggest });
                }}
                onRegenerate={() => chat.regenerate(record)}
                onCopy={chat.copyToClipboard}
              />
            ))}
          </div>
        )}
      </div>

      <ChatInput
        configs={configs}
        message={chat.message}
        connectionID={chat.connectionID}
        pendingAttachments={chat.pendingAttachments}
        chatTools={chat.chatTools}
        onMessageChange={chat.setMessage}
        onSend={() => chat.sendMessage()}
        onStop={chat.stopMessage}
        onModelSelect={
          modelSelectEnabled ? handleOpenModelSelect : undefined
        }
        onToggleThinking={() =>
          chat.setChatTools((prev) => ({
            ...prev,
            activeThinking: !prev.activeThinking,
          }))
        }
        onToggleSearch={() =>
          chat.setChatTools((prev) => ({
            ...prev,
            activeSearch: !prev.activeSearch,
          }))
        }
        onAddAttachments={chat.addAttachments}
        onRemoveAttachment={chat.removePendingAttachment}
      />

      {/* 右上角清除按钮组 */}
      <div className="chat-tools">
        <Button
          shape="circle"
          title="Scroll to top"
          className="btn btn-tools"
          onClick={() => chat.scrollTo('top', true)}
        >
          <i className="fa-solid fa-arrow-up" />
        </Button>
        <Button
          shape="circle"
          title="Scroll to bottom"
          className="btn btn-tools"
          onClick={() => chat.scrollTo('bottom', true)}
        >
          <i className="fa-solid fa-arrow-down" />
        </Button>
        <Button
          shape="circle"
          title="Clear Chat"
          className="btn btn-tools"
          onClick={() => chat.clearChat()}
        >
          <i className="fa-solid fa-brush" />
        </Button>
        <Button
          shape="circle"
          title="Infos"
          className="btn btn-tools"
        >
          <Popover placement="leftTop" title="TIPS" content={
            <div>
              <p>Connection ID: {chat.connectionID}</p>
            </div>
          }>
            <i className="fa-solid fa-info" />
          </Popover>
        </Button>
      </div>

      <ModelSelectModal
        open={modelModalOpen}
        models={configs.models}
        onClose={() => setModelModalOpen(false)}
        onSelect={handleSelectModel}
      />
    </div>
  );
});

export default AppChats;
