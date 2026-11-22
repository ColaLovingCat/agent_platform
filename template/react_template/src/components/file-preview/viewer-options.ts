import litePreset from '@file-viewer/preset-lite';
import type { ViewerOptions } from '@file-viewer/react';
import { ofdRenderer } from '@file-viewer/renderer-ofd';
import { pdfRenderer } from '@file-viewer/renderer-pdf';
import { presentationRenderer } from '@file-viewer/renderer-presentation';
import { spreadsheetRenderer } from '@file-viewer/renderer-spreadsheet';
import { wordRenderer } from '@file-viewer/renderer-word';

/** Office + lite without hangul/iwork/wordperfect (broken on current Artifactory core). */
export const filePreviewViewerOptions = {
  preset: litePreset,
  // Renderer plugins are typed against HTMLDivElement; ViewerOptions expects HTMLElement.
  renderers: [
    pdfRenderer,
    wordRenderer,
    spreadsheetRenderer,
    presentationRenderer,
    ofdRenderer,
  ] as unknown as ViewerOptions['renderers'],
  rendererMode: 'extend',
  theme: 'light',
  styleIsolation: 'shadow',
  toolbar: {
    position: 'top',
    zoom: true,
    download: false,
    print: false,
    exportHtml: false,
    theme: false,
    items: {
      'zoom-reset': false,
    },
  },
} satisfies ViewerOptions;
