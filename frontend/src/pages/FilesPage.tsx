import { useCallback, useEffect, useRef, useState } from 'react';
import Editor, { loader } from '@monaco-editor/react';
import {
  FileText,
  Folder,
  FolderOpen,
  ChevronRight,
  ChevronDown,
  Download,
  Upload,
  FolderUp,
  Save,
  Play,
  Monitor,
  X,
} from 'lucide-react';
import { useFileStore } from '@/stores/file.store';
import { api } from '@/services/api';
import type { FileTreeNode } from '@/stores/file.store';

// Configure Monaco to use dark theme by default
loader.init().then((monaco) => {
  monaco.editor.defineTheme('workspace-dark', {
    base: 'vs-dark',
    inherit: true,
    rules: [],
    colors: {
      'editor.background': '#0f1117',
      'editor.foreground': '#e4e4e7',
      'editorLineNumber.foreground': '#52525b',
      'editorLineNumber.activeForeground': '#a1a1aa',
      'editor.selectionBackground': '#3f3f4640',
      'editor.lineHighlightBackground': '#18181b',
      'editorCursor.foreground': '#818cf8',
      'editorWidget.background': '#18181b',
      'editorWidget.border': '#27272a',
      'input.background': '#18181b',
      'input.border': '#27272a',
      'dropdown.background': '#18181b',
      'dropdown.border': '#27272a',
    },
  });
});

/** Map our language tags to Monaco language IDs. */
function toMonacoLanguage(lang: string | null): string {
  const map: Record<string, string> = {
    ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
    py: 'python', css: 'css', html: 'html', json: 'json',
    md: 'markdown', yaml: 'yaml', sql: 'sql', sh: 'shell',
    xml: 'xml', java: 'java', go: 'go', rust: 'rust', ruby: 'ruby',
    php: 'php', c: 'c', cpp: 'cpp', txt: 'plaintext',
  };
  return (lang && map[lang]) || 'plaintext';
}

/** Map file language to sandbox execution language, or null if not runnable. */
function toExecutionLanguage(lang: string | null): 'python' | 'javascript' | 'bash' | null {
  if (!lang) return null;
  const map: Record<string, 'python' | 'javascript' | 'bash'> = {
    py: 'python',
    js: 'javascript',
    jsx: 'javascript',
    sh: 'bash',
    bash: 'bash',
  };
  return map[lang] ?? null;
}

/** Check if file can be previewed in browser. */
function isPreviewable(lang: string | null): boolean {
  return lang === 'html';
}

/** Build the directory prefix from a node's ancestry. */
function buildFolderPrefix(ancestors: string[], nodeName: string): string {
  return [...ancestors, nodeName, ''].join('/');
}

/** Derive a language tag from file extension. */
function extToLang(filename: string): string | undefined {
  const ext = filename.split('.').pop()?.toLowerCase();
  const map: Record<string, string> = {
    ts: 'ts', tsx: 'tsx', js: 'js', jsx: 'jsx',
    py: 'py', css: 'css', html: 'html', json: 'json',
    md: 'md', yaml: 'yaml', yml: 'yaml', sql: 'sql',
    sh: 'sh', bash: 'sh', txt: 'txt', xml: 'xml',
    java: 'java', go: 'go', rs: 'rust', rb: 'ruby',
    php: 'php', c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp',
  };
  return ext ? map[ext] : undefined;
}

function TreeItem({
  node,
  depth,
  ancestors,
  onSelect,
  onDownloadFile,
  onDownloadFolder,
}: {
  node: FileTreeNode;
  depth: number;
  ancestors: string[];
  onSelect: (path: string) => void;
  onDownloadFile: (path: string) => void;
  onDownloadFolder: (prefix: string) => void;
}) {
  const [expanded, setExpanded] = useState(depth < 2);
  const isFolder = node.type === 'folder';

  return (
    <div>
      <div
        className="group flex w-full items-center gap-1.5 rounded px-2 py-1 text-left text-sm hover:bg-surface-light"
        style={{ paddingLeft: `${depth * 16 + 8}px` }}
      >
        <button
          onClick={() => {
            if (isFolder) {
              setExpanded(!expanded);
            } else if (node.path) {
              onSelect(node.path);
            }
          }}
          className="flex flex-1 items-center gap-1.5 min-w-0"
        >
          {isFolder ? (
            <>
              {expanded ? (
                <ChevronDown size={14} className="shrink-0 text-text-secondary" />
              ) : (
                <ChevronRight size={14} className="shrink-0 text-text-secondary" />
              )}
              {expanded ? (
                <FolderOpen size={14} className="shrink-0 text-yellow-400" />
              ) : (
                <Folder size={14} className="shrink-0 text-yellow-400" />
              )}
            </>
          ) : (
            <>
              <span className="w-3.5" />
              <FileText size={14} className="shrink-0 text-blue-400" />
            </>
          )}
          <span className="truncate text-text-primary">{node.name}</span>
        </button>

        {/* Download button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (isFolder) {
              onDownloadFolder(buildFolderPrefix(ancestors, node.name));
            } else if (node.path) {
              onDownloadFile(node.path);
            }
          }}
          className="shrink-0 rounded p-0.5 text-text-secondary opacity-0 transition-opacity hover:text-primary-400 group-hover:opacity-100"
          title={isFolder ? 'Download as ZIP' : 'Download file'}
        >
          <Download size={13} />
        </button>
      </div>

      {isFolder && expanded && node.children && (
        <div>
          {node.children.map((child, i) => (
            <TreeItem
              key={`${child.name}-${i}`}
              node={child}
              depth={depth + 1}
              ancestors={[...ancestors, node.name]}
              onSelect={onSelect}
              onDownloadFile={onDownloadFile}
              onDownloadFolder={onDownloadFolder}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Simple language-to-color mapping
function langColor(lang: string | null): string {
  switch (lang) {
    case 'tsx':
    case 'ts':
      return 'text-blue-400';
    case 'jsx':
    case 'js':
      return 'text-yellow-400';
    case 'py':
      return 'text-green-400';
    case 'css':
      return 'text-pink-400';
    case 'html':
      return 'text-orange-400';
    case 'json':
      return 'text-purple-400';
    case 'md':
      return 'text-text-secondary';
    default:
      return 'text-text-secondary';
  }
}

interface OutputState {
  isOpen: boolean;
  isRunning: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  executionTimeMs: number | null;
  timedOut: boolean;
  error: string | null;
}

const INITIAL_OUTPUT: OutputState = {
  isOpen: false,
  isRunning: false,
  stdout: '',
  stderr: '',
  exitCode: null,
  executionTimeMs: null,
  timedOut: false,
  error: null,
};

export function FilesPage() {
  const { files, tree, selectedFile, isLoading, fetchFiles, fetchTree, selectFile, clearSelection } =
    useFileStore();
  const [downloading, setDownloading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ done: 0, total: 0 });
  const [dragOver, setDragOver] = useState(false);
  const [editorContent, setEditorContent] = useState<string>('');
  const [isDirty, setIsDirty] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Code execution
  const [output, setOutput] = useState<OutputState>(INITIAL_OUTPUT);

  // Browser preview
  const [previewOpen, setPreviewOpen] = useState(false);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const folderInputRef = useRef<HTMLInputElement>(null);
  const handleRunRef = useRef<() => void>(() => {});

  const execLang = selectedFile ? toExecutionLanguage(selectedFile.language) : null;
  const canPreview = selectedFile ? isPreviewable(selectedFile.language) : false;

  useEffect(() => {
    fetchFiles();
    fetchTree();
  }, [fetchFiles, fetchTree]);

  // Sync editor content when a new file is selected
  useEffect(() => {
    if (selectedFile) {
      setEditorContent(selectedFile.content);
      setIsDirty(false);
      setSaveMessage(null);
      setOutput(INITIAL_OUTPUT);
      setPreviewOpen(false);
    }
  }, [selectedFile]);

  const handleEditorChange = useCallback(
    (value: string | undefined) => {
      if (value === undefined) return;
      setEditorContent(value);
      setIsDirty(value !== selectedFile?.content);
      setSaveMessage(null);
    },
    [selectedFile],
  );

  const handleSave = useCallback(async () => {
    if (!selectedFile || !isDirty) return;
    setIsSaving(true);
    try {
      await api.createFile({
        path: selectedFile.path,
        content: editorContent,
        language: selectedFile.language ?? undefined,
      });
      await selectFile(selectedFile.path);
      setIsDirty(false);
      setSaveMessage('Saved');
      setTimeout(() => setSaveMessage(null), 2000);
    } catch {
      setSaveMessage('Save failed');
    } finally {
      setIsSaving(false);
    }
  }, [selectedFile, isDirty, editorContent, selectFile]);

  const handleRun = useCallback(async () => {
    if (!selectedFile || !execLang) return;

    setOutput({
      isOpen: true,
      isRunning: true,
      stdout: '',
      stderr: '',
      exitCode: null,
      executionTimeMs: null,
      timedOut: false,
      error: null,
    });

    try {
      const res = await api.executeCode(execLang, editorContent);
      if (res.data) {
        setOutput((prev) => ({
          ...prev,
          isRunning: false,
          stdout: res.data!.stdout,
          stderr: res.data!.stderr,
          exitCode: res.data!.exitCode,
          executionTimeMs: res.data!.executionTimeMs,
          timedOut: res.data!.timedOut,
        }));
      }
    } catch (err) {
      setOutput((prev) => ({
        ...prev,
        isRunning: false,
        error: err instanceof Error ? err.message : 'Execution failed',
      }));
    }
  }, [selectedFile, execLang, editorContent]);

  // Keep ref in sync for Monaco keybinding
  handleRunRef.current = handleRun;

  const handleDownloadFile = async (path: string) => {
    setDownloading(true);
    try {
      await api.downloadFile(path);
    } finally {
      setDownloading(false);
    }
  };

  const handleDownloadFolder = async (prefix: string) => {
    setDownloading(true);
    try {
      await api.downloadDirectory(prefix);
    } finally {
      setDownloading(false);
    }
  };

  /** Read a File object as text, returning null for binary files. */
  const readFileAsText = (file: File): Promise<string | null> => {
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => resolve(null);
      reader.readAsText(file);
    });
  };

  /** Upload an array of File objects, preserving their webkitRelativePath or name. */
  const uploadFiles = async (fileList: File[]) => {
    const filtered = fileList.filter(
      (f) =>
        !f.name.startsWith('.') &&
        !f.webkitRelativePath.includes('/.') &&
        !f.webkitRelativePath.includes('node_modules/') &&
        !f.webkitRelativePath.includes('__pycache__/') &&
        f.size < 5 * 1024 * 1024,
    );

    if (filtered.length === 0) return;

    setUploading(true);
    setUploadProgress({ done: 0, total: filtered.length });

    let done = 0;
    for (let i = 0; i < filtered.length; i += 5) {
      const batch = filtered.slice(i, i + 5);
      await Promise.all(
        batch.map(async (file) => {
          const content = await readFileAsText(file);
          if (content === null) return;

          const path = file.webkitRelativePath || file.name;
          const language = extToLang(file.name);

          try {
            await api.createFile({ path, content, language });
          } catch {
            // silently skip failed files
          }
          done++;
          setUploadProgress({ done, total: filtered.length });
        }),
      );
    }

    await Promise.all([fetchFiles(), fetchTree()]);
    setUploading(false);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const fileList = e.target.files;
    if (!fileList || fileList.length === 0) return;
    uploadFiles(Array.from(fileList));
    e.target.value = '';
  };

  /** Handle drag-and-drop. */
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);

    const items = e.dataTransfer.items;
    if (!items) return;

    const allFiles: File[] = [];

    const traverseEntry = (entry: FileSystemEntry, parentPath: string): Promise<void> => {
      return new Promise((resolve) => {
        if (entry.isFile) {
          (entry as FileSystemFileEntry).file((file) => {
            const pathToUse = parentPath ? `${parentPath}/${entry.name}` : entry.name;
            Object.defineProperty(file, 'webkitRelativePath', { value: pathToUse, writable: false });
            allFiles.push(file);
            resolve();
          });
        } else if (entry.isDirectory) {
          const dirReader = (entry as FileSystemDirectoryEntry).createReader();
          dirReader.readEntries(async (entries) => {
            const dirPath = parentPath ? `${parentPath}/${entry.name}` : entry.name;
            for (const child of entries) {
              await traverseEntry(child, dirPath);
            }
            resolve();
          });
        } else {
          resolve();
        }
      });
    };

    for (let i = 0; i < items.length; i++) {
      const entry = items[i].webkitGetAsEntry?.();
      if (entry) {
        await traverseEntry(entry, '');
      }
    }

    if (allFiles.length > 0) {
      uploadFiles(allFiles);
    }
  };

  return (
    <div
      className="flex h-[calc(100vh-8rem)] gap-4 relative"
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target || !e.currentTarget.contains(e.relatedTarget as Node)) {
          setDragOver(false);
        }
      }}
      onDrop={handleDrop}
    >
      {/* Drag-and-drop overlay */}
      {dragOver && (
        <div className="absolute inset-0 z-40 flex items-center justify-center rounded-xl border-2 border-dashed border-primary-500 bg-primary-600/10">
          <div className="text-center">
            <Upload size={48} className="mx-auto mb-3 text-primary-400" />
            <p className="text-lg font-medium text-primary-400">Drop files or folders here</p>
            <p className="mt-1 text-sm text-text-secondary">
              They will be uploaded for your agents to work on
            </p>
          </div>
        </div>
      )}

      {/* File tree panel */}
      <div className="w-72 shrink-0 overflow-y-auto rounded-xl border border-border bg-surface">
        <div className="border-b border-border px-4 py-3">
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-sm font-semibold text-text-primary">Project Files</h2>
            <div className="flex items-center gap-1">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-light hover:text-primary-400"
                title="Upload files"
              >
                <Upload size={14} />
              </button>
              <button
                onClick={() => folderInputRef.current?.click()}
                className="rounded-lg p-1.5 text-text-secondary hover:bg-surface-light hover:text-primary-400"
                title="Upload folder"
              >
                <FolderUp size={14} />
              </button>
            </div>
          </div>
          <p className="text-xs text-text-secondary">
            {files.length} file{files.length !== 1 ? 's' : ''}
          </p>
        </div>

        {/* Hidden file inputs */}
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />
        <input
          ref={folderInputRef}
          type="file"
          // @ts-expect-error webkitdirectory is not in React's type definitions
          webkitdirectory=""
          directory=""
          multiple
          className="hidden"
          onChange={handleFileInputChange}
        />

        {isLoading && (
          <p className="px-4 py-4 text-xs text-text-secondary">Loading...</p>
        )}

        {!isLoading && !tree && files.length === 0 && (
          <div className="px-4 py-8 text-center">
            <Upload size={32} className="mx-auto mb-2 text-text-secondary/30" />
            <p className="text-xs text-text-secondary mb-2">
              No files yet. Upload files or folders for your agents to work on.
            </p>
            <div className="flex justify-center gap-2">
              <button
                onClick={() => fileInputRef.current?.click()}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-light hover:text-text-primary"
              >
                Upload Files
              </button>
              <button
                onClick={() => folderInputRef.current?.click()}
                className="rounded-lg border border-border px-3 py-1.5 text-xs text-text-secondary hover:bg-surface-light hover:text-text-primary"
              >
                Upload Folder
              </button>
            </div>
          </div>
        )}

        {tree && tree.children && (
          <div className="py-2">
            {tree.children.map((child, i) => (
              <TreeItem
                key={`${child.name}-${i}`}
                node={child}
                depth={0}
                ancestors={[]}
                onSelect={selectFile}
                onDownloadFile={handleDownloadFile}
                onDownloadFolder={handleDownloadFolder}
              />
            ))}
          </div>
        )}
      </div>

      {/* Editor + Preview row */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Editor column */}
        <div className="flex flex-1 flex-col rounded-xl border border-border bg-surface overflow-hidden">
          {selectedFile ? (
            <>
              {/* File header */}
              <div className="flex items-center justify-between border-b border-border px-4 py-2">
                <div className="flex items-center gap-2 min-w-0">
                  <FileText size={16} className={langColor(selectedFile.language)} />
                  <span className="text-sm font-medium text-text-primary truncate">
                    {selectedFile.path}
                  </span>
                  {isDirty && (
                    <span className="h-2 w-2 shrink-0 rounded-full bg-amber-400" title="Unsaved changes" />
                  )}
                  {selectedFile.language && (
                    <span className="rounded bg-surface-light px-1.5 py-0.5 text-xs text-text-secondary shrink-0">
                      {selectedFile.language}
                    </span>
                  )}
                  <span className="text-xs text-text-secondary shrink-0">
                    {selectedFile.size > 1024
                      ? `${(selectedFile.size / 1024).toFixed(1)} KB`
                      : `${selectedFile.size} B`}
                  </span>
                  {saveMessage && (
                    <span className={`text-xs shrink-0 ${saveMessage === 'Saved' ? 'text-green-400' : 'text-red-400'}`}>
                      {saveMessage}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  {/* Run button */}
                  {execLang && (
                    <button
                      onClick={handleRun}
                      disabled={output.isRunning}
                      className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-40 bg-green-600/15 text-green-400 hover:bg-green-600/25"
                      title="Run code (Ctrl+Enter)"
                    >
                      <Play size={13} />
                      {output.isRunning ? 'Running...' : 'Run'}
                    </button>
                  )}
                  {/* Preview button */}
                  {canPreview && (
                    <button
                      onClick={() => setPreviewOpen((p) => !p)}
                      className={`flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                        previewOpen
                          ? 'bg-blue-600/25 text-blue-300'
                          : 'bg-blue-600/15 text-blue-400 hover:bg-blue-600/25'
                      }`}
                      title="Toggle browser preview"
                    >
                      <Monitor size={13} />
                      Preview
                    </button>
                  )}
                  {/* Save button */}
                  <button
                    onClick={handleSave}
                    disabled={!isDirty || isSaving}
                    className="flex items-center gap-1 rounded-lg px-2.5 py-1 text-xs font-medium transition-colors disabled:opacity-30 bg-primary-600/15 text-primary-400 hover:bg-primary-600/25"
                    title="Save (Ctrl+S)"
                  >
                    <Save size={13} />
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                  <button
                    onClick={() => handleDownloadFile(selectedFile.path)}
                    disabled={downloading}
                    className="rounded p-1 text-text-secondary hover:bg-surface-light hover:text-primary-400 disabled:opacity-40"
                    title="Download file"
                  >
                    <Download size={16} />
                  </button>
                  <button
                    onClick={() => {
                      clearSelection();
                      setIsDirty(false);
                      setOutput(INITIAL_OUTPUT);
                      setPreviewOpen(false);
                    }}
                    className="rounded p-1 text-text-secondary hover:bg-surface-light hover:text-text-primary"
                    title="Close"
                  >
                    <X size={16} />
                  </button>
                </div>
              </div>

              {/* Monaco Editor */}
              <div className="flex-1 min-h-0">
                <Editor
                  height="100%"
                  language={toMonacoLanguage(selectedFile.language)}
                  value={editorContent}
                  onChange={handleEditorChange}
                  theme="workspace-dark"
                  options={{
                    fontSize: 13,
                    fontFamily: "'JetBrains Mono', 'Fira Code', 'Cascadia Code', Menlo, monospace",
                    fontLigatures: true,
                    minimap: { enabled: true, scale: 1 },
                    scrollBeyondLastLine: false,
                    wordWrap: 'off',
                    tabSize: 2,
                    renderWhitespace: 'selection',
                    smoothScrolling: true,
                    cursorBlinking: 'smooth',
                    cursorSmoothCaretAnimation: 'on',
                    bracketPairColorization: { enabled: true },
                    autoIndent: 'advanced',
                    formatOnPaste: true,
                    suggest: { showKeywords: true, showSnippets: true },
                    padding: { top: 12 },
                  }}
                  onMount={(editor, monaco) => {
                    // Ctrl+S / Cmd+S to save
                    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.KeyS, () => {
                      handleSave();
                    });
                    // Ctrl+Enter / Cmd+Enter to run
                    editor.addCommand(monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter, () => {
                      handleRunRef.current();
                    });
                  }}
                />
              </div>

              {/* Output panel */}
              {output.isOpen && (
                <div className="h-52 shrink-0 border-t border-border bg-[#0a0a0f] flex flex-col">
                  {/* Output header */}
                  <div className="flex items-center justify-between border-b border-border/50 px-3 py-1.5">
                    <div className="flex items-center gap-3 text-xs">
                      <span className="font-medium text-text-primary">Output</span>
                      {output.isRunning && (
                        <span className="text-primary-400 animate-pulse">running...</span>
                      )}
                      {output.exitCode !== null && (
                        <span className={output.exitCode === 0 ? 'text-green-400' : 'text-red-400'}>
                          exit {output.exitCode}
                        </span>
                      )}
                      {output.executionTimeMs !== null && (
                        <span className="text-text-secondary">{output.executionTimeMs}ms</span>
                      )}
                      {output.timedOut && (
                        <span className="text-amber-400">timed out (30s)</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1">
                      {!output.isRunning && execLang && (
                        <button
                          onClick={handleRun}
                          className="rounded p-0.5 text-text-secondary hover:text-green-400"
                          title="Re-run"
                        >
                          <Play size={13} />
                        </button>
                      )}
                      <button
                        onClick={() => setOutput((p) => ({ ...p, isOpen: false }))}
                        className="rounded p-0.5 text-text-secondary hover:text-text-primary"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>

                  {/* Output content */}
                  <div className="flex-1 overflow-y-auto p-3 font-mono text-xs">
                    {output.error && (
                      <pre className="text-red-400 whitespace-pre-wrap">{output.error}</pre>
                    )}
                    {output.stdout && (
                      <pre className="text-green-300 whitespace-pre-wrap">{output.stdout}</pre>
                    )}
                    {output.stderr && (
                      <pre className="text-red-400 whitespace-pre-wrap mt-1">{output.stderr}</pre>
                    )}
                    {!output.isRunning && !output.error && !output.stdout && !output.stderr && (
                      <p className="text-text-secondary italic">No output</p>
                    )}
                  </div>
                </div>
              )}
            </>
          ) : (
            <div className="flex flex-1 items-center justify-center">
              <div className="text-center">
                <Upload size={48} className="mx-auto mb-3 text-text-secondary/30" />
                <p className="text-sm text-text-secondary">
                  Select a file to edit, or drag &amp; drop files here
                </p>
                <p className="mt-1 text-xs text-text-secondary">
                  Code editor with execution, browser preview, and more
                </p>
                <div className="mt-4 flex justify-center gap-3">
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-light hover:text-text-primary"
                  >
                    <Upload size={14} />
                    Upload Files
                  </button>
                  <button
                    onClick={() => folderInputRef.current?.click()}
                    className="flex items-center gap-1.5 rounded-lg border border-border px-4 py-2 text-sm text-text-secondary hover:bg-surface-light hover:text-text-primary"
                  >
                    <FolderUp size={14} />
                    Upload Folder
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Browser preview panel */}
        {previewOpen && selectedFile && canPreview && (
          <div className="flex w-1/2 shrink-0 flex-col rounded-xl border border-border bg-surface overflow-hidden">
            <div className="flex items-center justify-between border-b border-border px-4 py-2.5">
              <div className="flex items-center gap-2 text-xs">
                <Monitor size={14} className="text-blue-400" />
                <span className="font-medium text-text-primary">Browser Preview</span>
                <span className="text-text-secondary truncate">{selectedFile.path}</span>
              </div>
              <button
                onClick={() => setPreviewOpen(false)}
                className="rounded p-0.5 text-text-secondary hover:text-text-primary"
              >
                <X size={14} />
              </button>
            </div>
            <iframe
              srcDoc={editorContent}
              sandbox="allow-scripts"
              className="flex-1 w-full border-0 bg-white"
              title="HTML Preview"
            />
          </div>
        )}
      </div>

      {/* Upload progress overlay */}
      {uploading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="w-80 rounded-xl bg-surface px-6 py-5 shadow-lg">
            <p className="mb-3 text-sm font-medium text-text-primary">Uploading files...</p>
            <div className="mb-2 h-2 overflow-hidden rounded-full bg-surface-light">
              <div
                className="h-full rounded-full bg-primary-500 transition-all"
                style={{
                  width: `${uploadProgress.total > 0 ? (uploadProgress.done / uploadProgress.total) * 100 : 0}%`,
                }}
              />
            </div>
            <p className="text-xs text-text-secondary">
              {uploadProgress.done} / {uploadProgress.total} files
            </p>
          </div>
        </div>
      )}

      {/* Download overlay */}
      {downloading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
          <div className="rounded-xl bg-surface px-6 py-4 shadow-lg">
            <p className="text-sm text-text-primary">Preparing download...</p>
          </div>
        </div>
      )}
    </div>
  );
}
