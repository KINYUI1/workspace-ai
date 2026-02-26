import { PanelRightClose, Download, RefreshCw, Code, Eye, Columns } from 'lucide-react';
import { clsx } from 'clsx';

type ViewMode = 'preview' | 'code' | 'split';

interface CanvasToolbarProps {
  title?: string | null;
  contentType: string;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  onExport: () => void;
  onRefresh: () => void;
  onClose: () => void;
}

export function CanvasToolbar({
  title,
  contentType,
  viewMode,
  onViewModeChange,
  onExport,
  onRefresh,
  onClose,
}: CanvasToolbarProps) {
  return (
    <div className="flex items-center justify-between border-b border-border bg-surface px-4 py-2">
      <div className="flex items-center gap-3">
        <h3 className="text-sm font-semibold text-text-primary">
          {title || 'Canvas'}
        </h3>
        <span className="rounded-full bg-surface-light px-2 py-0.5 text-[10px] font-medium uppercase text-text-secondary">
          {contentType}
        </span>
      </div>

      <div className="flex items-center gap-1">
        {/* View mode toggle */}
        <div className="flex items-center rounded-lg border border-border p-0.5">
          <button
            onClick={() => onViewModeChange('preview')}
            className={clsx(
              'rounded-md p-1.5 transition-colors',
              viewMode === 'preview'
                ? 'bg-primary-600/15 text-primary-400'
                : 'text-text-secondary hover:text-text-primary',
            )}
            title="Preview"
          >
            <Eye size={14} />
          </button>
          <button
            onClick={() => onViewModeChange('code')}
            className={clsx(
              'rounded-md p-1.5 transition-colors',
              viewMode === 'code'
                ? 'bg-primary-600/15 text-primary-400'
                : 'text-text-secondary hover:text-text-primary',
            )}
            title="Source"
          >
            <Code size={14} />
          </button>
          <button
            onClick={() => onViewModeChange('split')}
            className={clsx(
              'rounded-md p-1.5 transition-colors',
              viewMode === 'split'
                ? 'bg-primary-600/15 text-primary-400'
                : 'text-text-secondary hover:text-text-primary',
            )}
            title="Split"
          >
            <Columns size={14} />
          </button>
        </div>

        <button
          onClick={onRefresh}
          className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-light hover:text-text-primary"
          title="Refresh"
        >
          <RefreshCw size={14} />
        </button>

        <button
          onClick={onExport}
          className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-light hover:text-text-primary"
          title="Download"
        >
          <Download size={14} />
        </button>

        <button
          onClick={onClose}
          className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-light hover:text-text-primary"
          title="Close canvas"
        >
          <PanelRightClose size={14} />
        </button>
      </div>
    </div>
  );
}
