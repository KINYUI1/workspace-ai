import { useEffect, useState } from 'react';
import { Brain, Search, Trash2, Database, RefreshCw, FileUp } from 'lucide-react';
import { clsx } from 'clsx';
import { api } from '@/services/api';

interface MemoryDocument {
  id: string;
  name: string;
  type: string;
  chunkCount: number;
  indexedAt: string;
  size: number;
}

interface MemoryStats {
  totalDocuments: number;
  totalChunks: number;
  embeddingProvider: string;
  lastSyncAt: string | null;
}

export function MemoryPage() {
  const [documents, setDocuments] = useState<MemoryDocument[]>([]);
  const [stats, setStats] = useState<MemoryStats | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<Array<{ content: string; score: number; source: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [docsRes, statsRes] = await Promise.all([
        api.getMemoryDocuments(),
        api.getMemoryStats(),
      ]);
      setDocuments((docsRes as any).data ?? []);
      setStats((statsRes as any).data ?? null);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  };

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const res = await api.searchMemory(searchQuery);
      setSearchResults((res as any).data ?? []);
    } catch {
      // ignore
    } finally {
      setSearching(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const text = await file.text();
    try {
      await api.indexMemoryDocument(file.name, text);
      await fetchData();
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    try {
      await api.deleteMemoryDocument(id);
      setDocuments((prev) => prev.filter((d) => d.id !== id));
    } catch {
      // ignore
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-text-secondary" />
          <h1 className="text-xl font-bold text-text-primary">Memory</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={fetchData}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs font-medium text-text-secondary hover:bg-surface-light"
          >
            <RefreshCw size={12} />
            Refresh
          </button>
          <label className="flex cursor-pointer items-center gap-1.5 rounded-lg bg-primary-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-primary-700">
            <FileUp size={12} />
            Upload Document
            <input type="file" className="hidden" onChange={handleFileUpload} accept=".txt,.md,.json,.csv" />
          </label>
        </div>
      </div>

      {/* Stats */}
      {stats && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-4">
          {[
            { label: 'Documents', value: stats.totalDocuments, icon: Database },
            { label: 'Chunks', value: stats.totalChunks, icon: Database },
            { label: 'Provider', value: stats.embeddingProvider, icon: Brain, isText: true },
            { label: 'Last Sync', value: stats.lastSyncAt ? new Date(stats.lastSyncAt).toLocaleDateString() : 'Never', icon: RefreshCw, isText: true },
          ].map(({ label, value, icon: Icon, isText }) => (
            <div key={label} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center gap-2 text-text-secondary mb-2">
                <Icon size={14} />
                <span className="text-xs font-medium uppercase tracking-wider">{label}</span>
              </div>
              <p className={clsx('font-semibold text-text-primary', isText ? 'text-sm' : 'text-2xl')}>
                {typeof value === 'number' ? value.toLocaleString() : value}
              </p>
            </div>
          ))}
        </div>
      )}

      {/* Search */}
      <div className="rounded-xl border border-border bg-surface p-4">
        <h2 className="mb-3 text-sm font-semibold text-text-primary">Test Memory Search</h2>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-text-secondary" />
            <input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
              placeholder="Search your knowledge base..."
              className="w-full rounded-lg border border-border bg-background py-2 pl-9 pr-3 text-sm text-text-primary placeholder:text-text-secondary focus:border-primary-500 focus:outline-none"
            />
          </div>
          <button
            onClick={handleSearch}
            disabled={searching || !searchQuery.trim()}
            className="rounded-lg bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-50"
          >
            {searching ? 'Searching...' : 'Search'}
          </button>
        </div>
        {searchResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {searchResults.map((result, i) => (
              <div key={i} className="rounded-lg border border-border bg-background p-3">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-xs text-text-secondary">{result.source}</span>
                  <span className="text-xs text-primary-400">{(result.score * 100).toFixed(1)}% match</span>
                </div>
                <p className="text-sm text-text-primary">{result.content}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Document list */}
      <div>
        <h2 className="mb-3 text-sm font-semibold text-text-secondary uppercase tracking-wider">Indexed Documents</h2>
        {loading ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="animate-pulse rounded-xl border border-border bg-surface p-4 h-16" />
            ))}
          </div>
        ) : documents.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-border bg-surface py-12">
            <Brain size={40} className="mb-3 text-text-secondary opacity-20" />
            <p className="text-sm text-text-secondary">No documents indexed yet</p>
            <p className="mt-1 text-xs text-text-secondary opacity-60">Upload documents to build your knowledge base</p>
          </div>
        ) : (
          <div className="space-y-2">
            {documents.map((doc) => (
              <div key={doc.id} className="flex items-center justify-between rounded-xl border border-border bg-surface p-4">
                <div className="flex items-center gap-3">
                  <Database size={16} className="text-text-secondary" />
                  <div>
                    <p className="text-sm font-medium text-text-primary">{doc.name}</p>
                    <p className="text-xs text-text-secondary">
                      {doc.chunkCount} chunks &middot; {(doc.size / 1024).toFixed(1)} KB &middot; {new Date(doc.indexedAt).toLocaleDateString()}
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => handleDelete(doc.id)}
                  className="rounded-lg p-2 text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
