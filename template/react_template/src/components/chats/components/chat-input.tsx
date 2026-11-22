import { useRef } from 'react';
import { Button, Dropdown, Input, Tooltip } from 'antd';

import {
  Attachments,
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  AttachmentRemove,
  fromPendingAttachment,
} from './attachments';
import type { ChatConfigs, PendingAttachment } from '../com/chats.types';

interface ChatInputProps {
  configs: ChatConfigs;
  message: string;
  connectionID: string;
  pendingAttachments: PendingAttachment[];
  chatTools: {
    model: string;
    activeThinking: boolean;
    activeSearch: boolean;
  };
  onMessageChange: (value: string) => void;
  onSend: () => void;
  onStop: () => void;
  onModelSelect?: () => void;
  onToggleThinking: () => void;
  onToggleSearch: () => void;
  onAddAttachments: (files: FileList | File[], mode: 'image' | 'file') => void;
  onRemoveAttachment: (id: string) => void;
}

export default function ChatInput({
  configs,
  message,
  connectionID,
  pendingAttachments,
  chatTools,
  onMessageChange,
  onSend,
  onStop,
  onModelSelect,
  onToggleThinking,
  onToggleSearch,
  onAddAttachments,
  onRemoveAttachment,
}: ChatInputProps) {
  const imageInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!configs.show.input) return null;

  const canSend =
    connectionID === '' &&
    (message.trim() !== '' || pendingAttachments.length > 0);

  // 处理输入框粘贴图片
  const handlePaste = (e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    const imageFiles: File[] = [];
    for (let i = 0; i < items.length; i += 1) {
      const item = items[i];
      if (item.kind === 'file' && item.type.startsWith('image/')) {
        const file = item.getAsFile();
        if (file) imageFiles.push(file);
      }
    }

    if (imageFiles.length === 0) return;

    e.preventDefault();
    onAddAttachments(imageFiles, 'image');
  };

  return (
    <div className="chat-view">
      <div className="chat-input">
        <input
          ref={imageInputRef}
          type="file"
          accept="image/*"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) {
              onAddAttachments(e.target.files, 'image');
            }
            e.target.value = '';
          }}
        />
        <input
          ref={fileInputRef}
          type="file"
          multiple
          hidden
          onChange={(e) => {
            if (e.target.files?.length) {
              onAddAttachments(e.target.files, 'file');
            }
            e.target.value = '';
          }}
        />

        {/* 附件列表 */}
        {pendingAttachments.length > 0 && (
          <div className="files">
            <Attachments variant="small">
              {pendingAttachments.map((file) => (
                <Attachment
                  key={file.id}
                  data={fromPendingAttachment(file)}
                  onRemove={() => onRemoveAttachment(file.id)}
                >
                  <AttachmentPreview />
                  <AttachmentInfo />
                  <AttachmentRemove label="Remove attachment" />
                </Attachment>
              ))}
            </Attachments>
          </div>
        )}

        <div className="input">
          <Input.TextArea
            autoSize={{ minRows: 1, maxRows: 3 }}
            value={message}
            onChange={(e) => onMessageChange(e.target.value)}
            onPaste={handlePaste}
            onPressEnter={(e) => {
              if (!e.shiftKey) {
                e.preventDefault();
                if (canSend) onSend();
              }
            }}
            placeholder="Message here..."
          />
        </div>

        {/* 操作按钮 */}
        <div className="btns">
          <div className="btns-left">
            {configs.show.model && (
              <Button
                className="btn btn-tool"
                disabled={!onModelSelect}
                onClick={() => onModelSelect?.()}
              >
                <i className="fa-solid fa-atom" />
                <span>{chatTools.model}</span>
              </Button>
            )}

            {configs.show.thinking && (
              <Button
                className={`btn btn-tool ${chatTools.activeThinking ? 'active' : ''}`}
                onClick={onToggleThinking}
              >
                <i className="fa-solid fa-globe" />
                <span>Reason</span>
              </Button>
            )}

            {configs.show.search && (
              <Button
                className={`btn btn-tool ${chatTools.activeSearch ? 'active' : ''}`}
                onClick={onToggleSearch}
              >
                <i className="fa-solid fa-globe" />
                <span>Search</span>
              </Button>
            )}

            {configs.show.upload && (
              <Dropdown
                placement="topLeft"
                menu={{
                  items: [
                    {
                      key: 'image',
                      label: (
                        <button
                          type="button"
                          className="btn btn-tool"
                          onClick={() => imageInputRef.current?.click()}
                        >
                          <i className="fa-solid fa-image" />
                          <span>Upload images</span>
                        </button>
                      ),
                    },
                    {
                      key: 'file',
                      label: (
                        <button
                          type="button"
                          className="btn btn-tool"
                          onClick={() => fileInputRef.current?.click()}
                        >
                          <i className="fa-solid fa-file" />
                          <span>Upload files</span>
                        </button>
                      ),
                    },
                  ],
                }}
              >
                <Button className="btn btn-tool">
                  <i className="fa-solid fa-upload" />
                  Upload
                </Button>
              </Dropdown>
            )}

            {configs.show.tools && (
              <Button className="btn btn-tool">
                <i className="fa-solid fa-sliders" />
                Tools
              </Button>
            )}
          </div>

          <div className="btns-right">
            <div className="btns-send">
              {connectionID === '' ? (
                <Tooltip title="Send Message">
                  <Button
                    shape="circle"
                    className="btn btn-send"
                    onClick={onSend}
                    disabled={!canSend}
                  >
                    <i className="fa-solid fa-arrow-up" />
                  </Button>
                </Tooltip>
              ) : (
                <Tooltip title="Stop Message">
                  <Button shape="circle" className="btn btn-stop" onClick={onStop}>
                    <i className="fa-solid fa-stop" />
                  </Button>
                </Tooltip>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
