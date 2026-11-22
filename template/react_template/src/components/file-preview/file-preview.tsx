import FileViewer, { type FileRef } from '@file-viewer/react';
import { Spin } from 'antd';
import { clsx } from 'clsx';
import type { CSSProperties, ReactNode } from 'react';
import { useEffect, useState } from 'react';

import { getFileIconKind } from '@/commons/utils/files';

import { fetchPreviewBlob } from './preview-fetch';
import { getFilePreviewMode } from './preview-mode';
import type { FilePreviewSource } from './types';
import { filePreviewViewerOptions } from './viewer-options';

export interface FilePreviewProps {
  /** null / missing url → empty state */
  file: FilePreviewSource | null;
  className?: string;
  /** 加载失败时在错误信息下方渲染的兜底操作 */
  errorExtra?: ReactNode;
}

export function FilePreview({ file, className, errorExtra }: FilePreviewProps) {
  const [previewBlob, setPreviewBlob] = useState<Blob | null>(null);
  const [htmlPreviewUrl, setHtmlPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!file?.url) {
      setPreviewBlob(null);
      setHtmlPreviewUrl(null);
      setLoading(false);
      setError(null);
      return;
    }

    let cancelled = false;
    let objectUrl: string | null = null;

    async function loadPreview() {
      const url = file?.url;
      const name = file?.name;
      if (!url || !name) return;

      setLoading(true);
      setError(null);
      setPreviewBlob(null);
      setHtmlPreviewUrl(null);

      try {
        const blob = await fetchPreviewBlob(url);
        if (cancelled) return;

        if (getFilePreviewMode(name) === 'html') {
          objectUrl = URL.createObjectURL(
            new Blob([await blob.arrayBuffer()], { type: 'text/html' }),
          );
          if (cancelled) {
            URL.revokeObjectURL(objectUrl);
            return;
          }
          setHtmlPreviewUrl(objectUrl);
        } else {
          setPreviewBlob(blob);
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Failed to load preview');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void loadPreview();

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [file?.url, file?.name]);

  const viewerFile: FileRef | undefined = previewBlob ?? undefined;
  const fileIconKind = file?.name ? getFileIconKind(file.name) : 'default';
  const useOuterScroll = fileIconKind === 'text' || fileIconKind === 'code';
  const viewerStyle: CSSProperties = useOuterScroll
    ? { display: 'block', width: '100%', minHeight: '100%' }
    : { display: 'block', width: '100%', height: '100%', minHeight: 0 };

  return (
    <div
      className={clsx(
        'relative flex h-full min-h-0 flex-col overflow-hidden bg-white',
        className,
      )}
    >
      {!file?.url ? (
        <p className="flex flex-1 items-center justify-center px-6 text-center text-sm text-slate-500">
          No preview URL available
        </p>
      ) : loading ? (
        <div className="flex flex-1 items-center justify-center">
          <Spin tip="Loading preview..." />
        </div>
      ) : error ? (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center">
          <p className="text-sm text-red-500">{error}</p>
          {errorExtra}
        </div>
      ) : htmlPreviewUrl ? (
        <iframe
          src={htmlPreviewUrl}
          title={file.name}
          className="h-full min-h-0 w-full flex-1 border-0 bg-white"
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups"
        />
      ) : viewerFile ? (
        useOuterScroll ? (
          <div className="relative min-h-0 flex-1 overflow-auto">
            <FileViewer
              file={viewerFile}
              name={file.name}
              style={viewerStyle}
              options={filePreviewViewerOptions}
            />
          </div>
        ) : (
          <div className="relative min-h-0 w-full flex-1">
            <FileViewer
              file={viewerFile}
              name={file.name}
              style={viewerStyle}
              options={filePreviewViewerOptions}
            />
          </div>
        )
      ) : null}
    </div>
  );
}
