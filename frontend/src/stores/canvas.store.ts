import { create } from 'zustand';

export interface CanvasEntry {
  id: string;
  title?: string;
  content: string;
  contentType: 'html' | 'svg' | 'markdown' | 'mermaid' | 'image';
  createdAt: string;
}

interface CanvasState {
  isOpen: boolean;
  content: string | null;
  contentType: 'html' | 'svg' | 'markdown' | 'mermaid' | 'image';
  title: string | null;
  canvasHistory: CanvasEntry[];

  toggle: () => void;
  open: () => void;
  close: () => void;
  setContent: (content: string, type: CanvasState['contentType'], title?: string) => void;
  clearContent: () => void;
}

export const useCanvasStore = create<CanvasState>((set, get) => ({
  isOpen: false,
  content: null,
  contentType: 'html',
  title: null,
  canvasHistory: [],

  toggle: () => set({ isOpen: !get().isOpen }),
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),

  setContent: (content, contentType, title) => {
    const entry: CanvasEntry = {
      id: crypto.randomUUID(),
      content,
      contentType,
      title,
      createdAt: new Date().toISOString(),
    };
    set({
      content,
      contentType,
      title: title || null,
      isOpen: true,
      canvasHistory: [entry, ...get().canvasHistory].slice(0, 50),
    });
  },

  clearContent: () => set({ content: null, title: null }),
}));
