import { useState, useRef, useEffect, useMemo } from 'react';
import { useCanvasStore } from '@/stores/canvas.store';
import { CanvasToolbar } from './CanvasToolbar';

type ViewMode = 'preview' | 'code' | 'split';

export function CanvasPanel() {
  const { isOpen, content, contentType, title, close } = useCanvasStore();
  const [viewMode, setViewMode] = useState<ViewMode>('preview');
  const [refreshKey, setRefreshKey] = useState(0);
  const iframeRef = useRef<HTMLIFrameElement>(null);

  // Reset view mode on new content
  useEffect(() => {
    if (content) setViewMode('preview');
  }, [content]);

  const handleExport = () => {
    if (!content) return;
    const ext =
      contentType === 'html' ? 'html' :
      contentType === 'svg' ? 'svg' :
      contentType === 'markdown' ? 'md' :
      contentType === 'mermaid' ? 'mmd' :
      'txt';
    const blob = new Blob([content], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `canvas-${Date.now()}.${ext}`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleRefresh = () => {
    setRefreshKey((k) => k + 1);
  };

  if (!isOpen || !content) return null;

  return (
    <div className="flex h-full w-[480px] flex-col border-l border-border bg-background">
      <CanvasToolbar
        title={title}
        contentType={contentType}
        viewMode={viewMode}
        onViewModeChange={setViewMode}
        onExport={handleExport}
        onRefresh={handleRefresh}
        onClose={close}
      />

      <div className="flex flex-1 min-h-0">
        {/* Preview pane */}
        {(viewMode === 'preview' || viewMode === 'split') && (
          <div className="flex-1 overflow-auto">
            <CanvasPreview
              key={refreshKey}
              content={content}
              contentType={contentType}
              iframeRef={iframeRef}
            />
          </div>
        )}

        {/* Code pane */}
        {(viewMode === 'code' || viewMode === 'split') && (
          <div className="flex-1 overflow-auto border-l border-border bg-surface">
            <pre className="p-4 text-xs text-text-primary font-mono whitespace-pre-wrap break-words">
              {content}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

function CanvasPreview({
  content,
  contentType,
  iframeRef,
}: {
  content: string;
  contentType: string;
  iframeRef: React.RefObject<HTMLIFrameElement | null>;
}) {
  const srcdoc = useMemo(() => {
    if (contentType === 'html') {
      // Wrap in a basic document with styles
      return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <style>
    body {
      margin: 0;
      padding: 16px;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      background: #0d1117;
      color: #c9d1d9;
    }
    * { box-sizing: border-box; }
  </style>
</head>
<body>${content}</body>
</html>`;
    }

    if (contentType === 'svg') {
      return `<!DOCTYPE html>
<html>
<head><style>body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #0d1117; }</style></head>
<body>${content}</body>
</html>`;
    }

    if (contentType === 'mermaid') {
      return `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/mermaid/dist/mermaid.min.js"></script>
  <style>body { margin: 0; padding: 16px; background: #0d1117; color: #c9d1d9; }</style>
</head>
<body>
  <pre class="mermaid">${content}</pre>
  <script>mermaid.initialize({ startOnLoad: true, theme: 'dark' });</script>
</body>
</html>`;
    }

    if (contentType === 'markdown') {
      // Basic markdown rendering via marked CDN
      return `<!DOCTYPE html>
<html>
<head>
  <script src="https://cdn.jsdelivr.net/npm/marked/marked.min.js"></script>
  <style>
    body { margin: 0; padding: 16px; font-family: -apple-system, sans-serif; background: #0d1117; color: #c9d1d9; line-height: 1.6; }
    code { background: #161b22; padding: 2px 6px; border-radius: 4px; font-size: 0.9em; }
    pre { background: #161b22; padding: 12px; border-radius: 8px; overflow-x: auto; }
    pre code { background: none; padding: 0; }
    a { color: #58a6ff; }
    h1, h2, h3 { border-bottom: 1px solid #21262d; padding-bottom: 4px; }
    blockquote { border-left: 3px solid #30363d; margin-left: 0; padding-left: 16px; color: #8b949e; }
    table { border-collapse: collapse; }
    th, td { border: 1px solid #30363d; padding: 6px 12px; }
  </style>
</head>
<body>
  <div id="content"></div>
  <script>
    document.getElementById('content').innerHTML = marked.parse(${JSON.stringify(content)});
  </script>
</body>
</html>`;
    }

    // Image type
    if (contentType === 'image') {
      return `<!DOCTYPE html>
<html>
<head><style>body { margin: 0; display: flex; justify-content: center; align-items: center; min-height: 100vh; background: #0d1117; }</style></head>
<body><img src="${content}" style="max-width:100%; height:auto;" /></body>
</html>`;
    }

    return content;
  }, [content, contentType]);

  return (
    <iframe
      ref={iframeRef}
      srcDoc={srcdoc}
      className="h-full w-full border-0"
      sandbox="allow-scripts allow-same-origin"
      title="Canvas preview"
    />
  );
}
