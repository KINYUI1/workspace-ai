import { logger } from '../../utils/logger';

interface SearchResult {
  title: string;
  url: string;
  description: string;
}

export class WebService {
  // Search the web using Brave Search API
  async searchWeb(query: string, apiKey: string, count = 5): Promise<SearchResult[]> {
    if (!apiKey) {
      return [{ title: 'Error', url: '', description: 'No Brave Search API key configured. Add it in Settings > Integrations.' }];
    }
    try {
      const params = new URLSearchParams({ q: query, count: String(Math.min(count, 10)) });
      const res = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
        headers: {
          'X-Subscription-Token': apiKey,
          'Accept': 'application/json',
        },
      });
      if (!res.ok) {
        throw new Error(`Brave Search API error: ${res.status} ${res.statusText}`);
      }
      const data = await res.json() as any;
      const results: SearchResult[] = (data.web?.results || []).slice(0, count).map((r: any) => ({
        title: r.title || '',
        url: r.url || '',
        description: r.description || '',
      }));
      return results;
    } catch (error) {
      logger.error('Web search failed', { query, error: (error as Error).message });
      return [{ title: 'Search Error', url: '', description: (error as Error).message }];
    }
  }

  // Fetch URL content as text
  async fetchUrl(url: string): Promise<string> {
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'WorkspaceAI/1.0' },
        signal: AbortSignal.timeout(10000),
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} ${res.statusText}`);
      }
      const html = await res.text();
      // Strip HTML tags to get plain text
      const text = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
      // Truncate to 8000 chars to stay within token budget
      return text.slice(0, 8000);
    } catch (error) {
      logger.error('URL fetch failed', { url, error: (error as Error).message });
      return `Error fetching URL: ${(error as Error).message}`;
    }
  }
}
