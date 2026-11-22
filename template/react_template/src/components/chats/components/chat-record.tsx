import { Tooltip } from 'antd';

import ChartView from '@/components/echarts/index';

import {
  Attachment,
  AttachmentInfo,
  AttachmentPreview,
  Attachments,
  openAttachment,
  fromChatAttachment,
} from './attachments';
import { Source, Sources, SourcesContent, SourcesTrigger } from './sources';

import type { ChatMessage } from '../com/chats.types';

import { md } from '../markdown/markdown';
import '../markdown/markdown.scss';

interface TableColumn {
  key: string;
  title: string;
}

interface TableData {
  key?: string;
  columns: TableColumn[];
  rows: Record<string, unknown>[];
}

interface ChartData {
  key?: string;
  options: any;
}

type SuggestItem = NonNullable<ChatMessage['suggests']>[number];

function getBotInitials(name: string) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .map((word) => word[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

interface ChatRecordProps {
  record: ChatMessage;
  showBot: boolean;
  fallbackBotName: string;
  showThinking: boolean;
  onToggleThinking: () => void;
  onTableClick: (key: string, column: string, row: Record<string, unknown>) => void;
  onChartClick: (event: unknown) => void;
  onSuggestClick: (suggest: SuggestItem) => void;
  onRegenerate: () => void;
  onCopy: (text: string) => void;
}

export default function ChatRecord({
  record,
  showBot,
  fallbackBotName,
  showThinking,
  onToggleThinking,
  onTableClick,
  onChartClick,
  onSuggestClick,
  onRegenerate,
  onCopy,
}: ChatRecordProps) {
  const copyText = String(record.messages[0]?.data ?? '');
  const botName = record.name || fallbackBotName;

  return (
    <div className={`chat-item ${record.isBot ? '' : 'item-user'}`}>
      {showBot && record.isBot && (
        <div className="item-bot-meta">
          <div className="item-bot-avatar">{getBotInitials(botName)}</div>
          <span className="item-bot-name">{botName}</span>
        </div>
      )}
      <div className="item-content">

        {/* Thinking */}
        {showThinking && record.hasThinking && (
          <div className="item-thinks">
            <div className="item-think" onClick={onToggleThinking} role="button" tabIndex={0}>
              <i className="fa-solid fa-atom" />
              <i className={`think-status ${record.isThinking ? 'shimmer' : ''}`}>
                {record.isThinking ? 'deep thinking...' : 'thoughts'}
              </i>
              <i
                className={`fa-solid ${record.showThinking ? 'fa-angle-up' : 'fa-angle-down'}`}
              />
            </div>
            {record.showThinking && record.thought && (
              <p
                className="think-contents markdown-contents"
                dangerouslySetInnerHTML={{ __html: md.render(record.thought) }}
              />
            )}
          </div>
        )}

        {/* Plans */}
        {record.plans && record.plans.length > 0 && (
          <div className="item-plans">
            {record.plans.map((plan) => (
              <div key={plan.id} className={`plan-item plan-${plan.status}`}>
                <span className="plan-status-icon" aria-hidden>
                  {plan.status === 'running' && (
                    <i className="fa-solid fa-spinner fa-spin" />
                  )}
                  {plan.status === 'done' && (
                    <i className="fa-solid fa-check" />
                  )}
                  {plan.status === 'error' && (
                    <i className="fa-solid fa-xmark" />
                  )}
                  {plan.status === 'open' && (
                    <i className="fa-regular fa-circle" />
                  )}
                </span>
                <span className="plan-content">{plan.content}</span>
              </div>
            ))}
          </div>
        )}

        {/* Messages */}
        <div className="item-messages">
          {record.messages.map((msg, index) => (
            <div className="item-message" key={`${msg.type}-${index}`}>
              {msg.type === 'text' && (
                <p
                  className="item-txt markdown-contents"
                  dangerouslySetInnerHTML={{ __html: md.render(String(msg.data)) }}
                />
              )}

              {msg.type === 'list' && Array.isArray(msg.data) && (
                <div className="markdown-contents">
                  <ul>
                    {msg.data.map((item, i) => (
                      <li key={i}>{String(item)}</li>
                    ))}
                  </ul>
                </div>
              )}

              {msg.type === 'table' && (
                <div className="markdown-contents">
                  <table>
                    <thead>
                      <tr>
                        {(msg.data as TableData).columns.map((th) => (
                          <th key={th.key}>{th.title}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(msg.data as TableData).rows.map((row, ri) => (
                        <tr key={ri}>
                          {(msg.data as TableData).columns.map((column) => (
                            <td
                              key={column.key}
                              onClick={() => onTableClick((msg.data as TableData).key || '', column.key, row)}
                            >
                              {String(row[column.key] ?? '')}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {msg.type === 'image' && (
                <img src={(msg.data as { url: string }).url} alt="" />
              )}

              {msg.type === 'audio' && (
                <audio controls>
                  <source
                    src={(msg.data as { url: string }).url}
                    type={(msg.data as { contentType?: string }).contentType}
                  />
                </audio>
              )}

              {msg.type === 'video' && (
                <video controls>
                  <source
                    src={(msg.data as { url: string }).url}
                    type={(msg.data as { contentType?: string }).contentType}
                  />
                </video>
              )}

              {msg.type === 'echart' && (
                <div className="item-chart">
                  <ChartView
                    width="100%"
                    height="300px"
                    options={(msg.data as ChartData).options}
                    onChartClick={(event) => onChartClick({
                      key: (msg.data as ChartData).key || '',
                      ...event
                    })}
                  />
                </div>
              )}

              {msg.type === 'error' && (
                <p className="item-txt" style={{ color: 'var(--color-error)' }}>
                  {String(msg.data)}
                </p>
              )}
            </div>
          ))}
        </div>

        {/* Attachments */}
        {record.attachments && record.attachments.length > 0 && (
          <div
            className={`item-attachments ${record.isBot ? '' : 'item-attachments-user'}`}
          >
            <Attachments variant="normal">
              {record.attachments.map((attach) => {
                const data = fromChatAttachment(attach);
                return (
                  <Attachment
                    key={attach.url + attach.name}
                    data={data}
                    onClick={() => openAttachment(data)}
                  >
                    <AttachmentPreview />
                    <AttachmentInfo />
                  </Attachment>
                );
              })}
            </Attachments>
          </div>
        )}

        {/* Sources */}
        {record.sources && record.sources.length > 0 && (
          <div className="item-sources">
            <Sources>
              <SourcesTrigger count={record.sources.length} />
              <SourcesContent>
                {record.sources.map((source) => (
                  <Source
                    href={source.href}
                    key={source.href}
                    title={source.title}
                  />
                ))}
              </SourcesContent>
            </Sources>
          </div>
        )}

        {/* Suggests */}
        {record.suggests && record.suggests.length > 0 && (
          <div className="item-suggests">
            {record.suggests.map((suggest) => (
              <div
                className="suggest-item"
                key={suggest.content}
                onClick={() => onSuggestClick(suggest)}
                role="button"
                tabIndex={0}
              >
                <i className={`fa-solid ${suggest.icon || 'fa-arrow-right'}`} />
                {suggest.content}
              </div>
            ))}
          </div>
        )}

        {/* Btns */}
        {!record.isBot && (
          <div className="item-tools">
            <Tooltip title="Regenerate">
              <button type="button" className="btn btn-tools" onClick={onRegenerate}>
                <i className="fa-solid fa-arrows-rotate" />
              </button>
            </Tooltip>
            <Tooltip title="Copy">
              <button type="button" className="btn btn-tools" onClick={() => onCopy(copyText)}>
                <i className="fa-solid fa-copy" />
              </button>
            </Tooltip>
          </div>
        )}
        {record.isBot && record.status === 'done' && (
          <div className="item-tools">
            <Tooltip title="Copy">
              <button type="button" className="btn btn-tools" onClick={() => onCopy(copyText)}>
                <i className="fa-solid fa-copy" />
              </button>
            </Tooltip>
            <Tooltip title="Like">
              <button type="button" className="btn btn-tools">
                <i className="fa-solid fa-thumbs-up" />
              </button>
            </Tooltip>
          </div>
        )}
      </div>

      {record.status !== 'done' && (
        <div className="dots">
          <div />
          <div />
          <div />
        </div>
      )}
    </div>
  );
}
