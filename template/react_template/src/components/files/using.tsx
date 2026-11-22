import { useState } from 'react';

import {
  FileTree,
  FileTreeFile,
  FileTreeFolder,
} from '@/components/files';

const FileTreeUse = () => {
  const [selectedPath, setSelectedPath] = useState<string | undefined>();

  return (
    <div className="sections flex min-h-[60vh] items-start justify-center p-8">
      <div className="w-full max-w-sm">
        <div className="mb-4">
          <h2 className="text-base font-semibold text-slate-800">File Tree</h2>
          <p className="mt-1 text-xs text-slate-500">
            点击文件夹箭头切换展开/折叠；点击文件选中并触发 onSelect。
          </p>
        </div>

        <FileTree
          defaultExpanded={new Set(['src', 'src/components'])}
          onSelect={setSelectedPath}
          selectedPath={selectedPath}
        >
          <FileTreeFolder name="src" path="src">
            <FileTreeFolder name="components" path="src/components">
              <FileTreeFile name="button.tsx" path="src/components/button.tsx" />
              <FileTreeFile name="input.tsx" path="src/components/input.tsx" />
              <FileTreeFile name="modal.tsx" path="src/components/modal.tsx" />
            </FileTreeFolder>
            <FileTreeFolder name="hooks" path="src/hooks">
              <FileTreeFile name="use-auth.ts" path="src/hooks/use-auth.ts" />
              <FileTreeFile name="use-theme.ts" path="src/hooks/use-theme.ts" />
            </FileTreeFolder>
            <FileTreeFolder name="lib" path="src/lib">
              <FileTreeFile name="utils.ts" path="src/lib/utils.ts" />
            </FileTreeFolder>
            <FileTreeFile name="app.tsx" path="src/app.tsx" />
            <FileTreeFile name="main.tsx" path="src/main.tsx" />
          </FileTreeFolder>
          <FileTreeFile name="package.json" path="package.json" />
          <FileTreeFile name="tsconfig.json" path="tsconfig.json" />
          <FileTreeFile name="README.md" path="README.md" />
        </FileTree>

        <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50/80 px-4 py-3">
          <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">
            Selected Path
          </p>
          <p className="mt-1 break-all font-mono text-sm text-slate-700">
            {selectedPath ?? '—'}
          </p>
        </div>
      </div>
    </div>
  );
};

export default FileTreeUse;
