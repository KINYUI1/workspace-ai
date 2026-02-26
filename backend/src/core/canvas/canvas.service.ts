import { logger } from '../../utils/logger';

export interface CanvasEntry {
  id: string;
  title?: string;
  content: string;
  contentType: 'html' | 'svg' | 'markdown' | 'mermaid' | 'image';
  createdAt: Date;
}

class CanvasService {
  private history: CanvasEntry[] = [];
  private maxHistory = 50;

  /**
   * Store a new canvas entry from an agent tool call.
   */
  addEntry(entry: Omit<CanvasEntry, 'id' | 'createdAt'>): CanvasEntry {
    const full: CanvasEntry = {
      id: crypto.randomUUID(),
      ...entry,
      createdAt: new Date(),
    };

    this.history.unshift(full);
    if (this.history.length > this.maxHistory) {
      this.history = this.history.slice(0, this.maxHistory);
    }

    logger.info('Canvas entry created', {
      id: full.id,
      contentType: full.contentType,
      contentLength: full.content.length,
    });

    return full;
  }

  getEntry(id: string): CanvasEntry | undefined {
    return this.history.find((e) => e.id === id);
  }

  getHistory(): CanvasEntry[] {
    return this.history;
  }

  clearHistory(): void {
    this.history = [];
  }
}

export const canvasService = new CanvasService();
