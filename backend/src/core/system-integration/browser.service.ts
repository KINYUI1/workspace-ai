import { chromium, Browser, Page } from 'playwright';
import { logger } from '../../utils/logger';

const IDLE_TIMEOUT_MS = 10 * 60 * 1000; // 10 minutes
const NAV_TIMEOUT_MS = 30_000;
const SCREENSHOT_WIDTH = 1024;
const JPEG_QUALITY = 60;

interface BrowserResult {
  screenshot: string; // base64 JPEG
  title: string;
  url: string;
}

/**
 * Singleton browser service using Playwright Chromium.
 * Manages tabs via Map<tabId, Page>. Auto-closes after idle timeout.
 */
export class BrowserService {
  private static instance: BrowserService | null = null;

  private browser: Browser | null = null;
  private tabs: Map<string, Page> = new Map();
  private idleTimer: ReturnType<typeof setTimeout> | null = null;
  private launching = false;

  static getInstance(): BrowserService {
    if (!BrowserService.instance) {
      BrowserService.instance = new BrowserService();
    }
    return BrowserService.instance;
  }

  private resetIdleTimer(): void {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      this.close().catch((err) =>
        logger.warn('Failed to auto-close browser', { error: (err as Error).message }),
      );
    }, IDLE_TIMEOUT_MS);
  }

  private async ensureBrowser(): Promise<Browser> {
    if (this.browser?.isConnected()) {
      this.resetIdleTimer();
      return this.browser;
    }

    if (this.launching) {
      // Wait for in-flight launch
      while (this.launching) {
        await new Promise((r) => setTimeout(r, 100));
      }
      if (this.browser?.isConnected()) return this.browser;
    }

    this.launching = true;
    try {
      logger.info('Launching headless Chromium');
      this.browser = await chromium.launch({
        headless: true,
        args: ['--no-sandbox', '--disable-gpu'],
      });
      this.resetIdleTimer();
      return this.browser;
    } finally {
      this.launching = false;
    }
  }

  private async getOrCreateTab(tabId?: string): Promise<{ page: Page; tabId: string }> {
    const id = tabId || 'default';
    let page = this.tabs.get(id);

    if (page && !page.isClosed()) {
      return { page, tabId: id };
    }

    const browser = await this.ensureBrowser();
    page = await browser.newPage({
      viewport: { width: SCREENSHOT_WIDTH, height: 768 },
    });
    this.tabs.set(id, page);
    return { page, tabId: id };
  }

  private async takeScreenshot(page: Page): Promise<string> {
    const buffer = await page.screenshot({
      type: 'jpeg',
      quality: JPEG_QUALITY,
      fullPage: false,
    });
    return buffer.toString('base64');
  }

  async navigateAndScreenshot(url: string, tabId?: string): Promise<BrowserResult> {
    const { page, tabId: tid } = await this.getOrCreateTab(tabId);
    this.resetIdleTimer();

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded', timeout: NAV_TIMEOUT_MS });
    } catch (err) {
      logger.warn('Navigation error (proceeding with screenshot)', { url, error: (err as Error).message });
    }

    const screenshot = await this.takeScreenshot(page);
    const title = await page.title();

    logger.info('Browser navigated', { tabId: tid, url, title });
    return { screenshot, title, url: page.url() };
  }

  async click(selector: string, tabId?: string): Promise<BrowserResult> {
    const { page } = await this.getOrCreateTab(tabId);
    this.resetIdleTimer();

    await page.click(selector, { timeout: 10_000 });
    // Small wait for any navigation / UI update
    await page.waitForTimeout(500);

    const screenshot = await this.takeScreenshot(page);
    return { screenshot, title: await page.title(), url: page.url() };
  }

  async type(selector: string, text: string, tabId?: string): Promise<BrowserResult> {
    const { page } = await this.getOrCreateTab(tabId);
    this.resetIdleTimer();

    await page.fill(selector, text, { timeout: 10_000 });

    const screenshot = await this.takeScreenshot(page);
    return { screenshot, title: await page.title(), url: page.url() };
  }

  async screenshot(tabId?: string): Promise<BrowserResult> {
    const { page } = await this.getOrCreateTab(tabId);
    this.resetIdleTimer();

    const ss = await this.takeScreenshot(page);
    return { screenshot: ss, title: await page.title(), url: page.url() };
  }

  async close(): Promise<void> {
    if (this.idleTimer) {
      clearTimeout(this.idleTimer);
      this.idleTimer = null;
    }
    this.tabs.clear();
    if (this.browser) {
      try {
        await this.browser.close();
      } catch {
        // already closed
      }
      this.browser = null;
    }
    logger.info('Browser closed');
  }
}
