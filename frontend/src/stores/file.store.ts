import { create } from 'zustand';
import { api } from '@/services/api';
import { getCached, setCache } from '@/services/cache';

interface ProjectFile {
  id: string;
  path: string;
  content: string;
  language: string | null;
  size: number;
  createdAt: string;
  updatedAt: string;
}

interface FileTreeNode {
  name: string;
  type: 'file' | 'folder';
  path?: string;
  children?: FileTreeNode[];
}

interface FileState {
  files: ProjectFile[];
  tree: FileTreeNode | null;
  selectedFile: ProjectFile | null;
  isLoading: boolean;

  fetchFiles: (prefix?: string) => Promise<void>;
  fetchTree: () => Promise<void>;
  selectFile: (path: string) => Promise<void>;
  clearSelection: () => void;
}

export const useFileStore = create<FileState>((set) => ({
  files: [],
  tree: null,
  selectedFile: null,
  isLoading: false,

  fetchFiles: async (prefix) => {
    const cacheKey = prefix ? `files:${prefix}` : 'files';
    const cached = await getCached<ProjectFile[]>(cacheKey);
    if (cached) set({ files: cached.data });

    set({ isLoading: !cached });
    try {
      const res = await api.getFiles(prefix);
      const files = (res.data ?? []) as ProjectFile[];
      set({ files, isLoading: false });
      await setCache(cacheKey, files);
    } catch {
      set({ isLoading: false });
    }
  },

  fetchTree: async () => {
    const cached = await getCached<FileTreeNode | null>('fileTree');
    if (cached) set({ tree: cached.data });

    try {
      const res = await api.getFileTree();
      const tree = (res.data ?? null) as FileTreeNode | null;
      set({ tree });
      await setCache('fileTree', tree);
    } catch {
      // silent
    }
  },

  selectFile: async (path) => {
    const cacheKey = `file:${path}`;
    const cached = await getCached<ProjectFile>(cacheKey);
    if (cached) set({ selectedFile: cached.data });

    try {
      const res = await api.getFileByPath(path);
      const file = (res.data ?? null) as ProjectFile | null;
      set({ selectedFile: file });
      if (file) await setCache(cacheKey, file);
    } catch {
      if (!cached) set({ selectedFile: null });
    }
  },

  clearSelection: () => set({ selectedFile: null }),
}));

export type { ProjectFile, FileTreeNode };
