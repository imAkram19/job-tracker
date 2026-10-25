import { chromium, Browser, BrowserContext, Page } from 'playwright';
import { ApplicationStateManager } from './ApplicationStateManager';

export interface BrowserManagerOptions {
  headless?: boolean;
  slowMo?: number;
  viewport?: { width: number; height: number };
}

export class BrowserManager {
  private browser: Browser | null = null;
  private context: BrowserContext | null = null;
  private page: Page | null = null;
  private stateManager: ApplicationStateManager;

  constructor(stateManager: ApplicationStateManager) {
    this.stateManager = stateManager;
  }

  public async launch(options: BrowserManagerOptions = {}): Promise<Page> {
    const headless = options.headless ?? false; // Default to headed as requested
    const slowMo = options.slowMo ?? 50; // Gentle typing & clicking pace

    this.stateManager.log('info', `Launching Playwright Chromium (headless=${headless})`);

    try {
      this.browser = await chromium.launch({
        headless,
        slowMo,
        args: [
          '--disable-blink-features=AutomationControlled',
          '--start-maximized',
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--new-window',
        ],
      });

      this.context = await this.browser.newContext({
        viewport: options.viewport ?? { width: 1280, height: 850 },
        userAgent:
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      });

      this.page = await this.context.newPage();
      await this.page.bringToFront().catch(() => {});

      // Track newly opened tabs/popups (e.g. Google Login, SSO, OAuth)
      this.context.on('page', (newPage) => {
        this.page = newPage;
        this.stateManager.log('info', `Detected new browser tab/popup: ${newPage.url()}`);
        
        newPage.on('close', () => {
          // When a popup closes (like Google auth popup), switch back to the remaining open application page
          if (!this.context) return;
          const remaining = this.context.pages().filter((p) => !p.isClosed() && p !== newPage);
          if (remaining.length > 0) {
            // Prefer the main job application tab (non-oauth, non-blank)
            const appTab = remaining.find((p) => {
              const u = p.url().toLowerCase();
              return !u.includes('accounts.google.com') && !u.startsWith('about:blank') && !u.includes('oauth');
            }) || remaining[0];

            this.page = appTab;
            this.stateManager.log('info', `Popup closed. Switched back to active application tab.`);
            appTab.bringToFront().catch(() => {});
          }
        });
      });

      // Configure default timeouts
      this.page.setDefaultTimeout(30000);
      this.page.setDefaultNavigationTimeout(45000);

      this.stateManager.log('info', 'Playwright browser and context ready');
      return this.page;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.stateManager.setError(`Failed to launch browser: ${msg}`);
      throw err;
    }
  }

  /**
   * Intelligently returns the active, unclosed page.
   * Handles multi-tab OAuth/Google login popups that open and close.
   */
  public getPage(): Page {
    if (this.context) {
      const openPages = this.context.pages().filter((p) => !p.isClosed());
      if (openPages.length > 0) {
        // If current page is null, closed, or still pointing to an auth popup
        if (!this.page || this.page.isClosed() || this.page.url().includes('accounts.google.com')) {
          const appTab = openPages.find((p) => {
            const u = p.url().toLowerCase();
            return !u.includes('accounts.google.com') && !u.startsWith('about:blank') && !u.includes('oauth');
          }) || openPages[openPages.length - 1];
          this.page = appTab;
        }
        return this.page;
      }
    }

    if (this.page && !this.page.isClosed()) {
      return this.page;
    }

    throw new Error('All browser tabs or popups have been closed. Click "Scan & Fill Current Page" to reopen.');
  }

  /**
   * Ensures an active, unclosed page is available.
   * If browser was closed or disconnected, automatically relaunches on screen.
   */
  public async ensureActivePage(fallbackUrl?: string): Promise<Page> {
    try {
      if (this.browser && this.browser.isConnected() && this.context) {
        const openPages = this.context.pages().filter((p) => !p.isClosed());
        if (openPages.length > 0) {
          const appTab = openPages.find((p) => {
            const u = p.url().toLowerCase();
            return !u.includes('accounts.google.com') && !u.startsWith('about:blank') && !u.includes('oauth');
          }) || openPages[openPages.length - 1];

          this.page = appTab;
          try {
            await this.page.bringToFront();
          } catch {
            // ignore if bringToFront fails
          }
          return this.page;
        }
      }
    } catch (err) {
      this.stateManager.log('warn', `Notice checking active page: ${err}`);
    }

    // Browser was closed, crashed, or disconnected. Relaunch cleanly.
    this.stateManager.log('info', 'Browser was closed. Reopening browser window...');
    await this.close().catch(() => {});
    const page = await this.launch({ headless: false });
    if (fallbackUrl) {
      await this.navigate(fallbackUrl);
    }
    return page;
  }

  public async navigate(url: string): Promise<void> {
    const page = this.getPage();
    this.stateManager.setState('OPENING_APPLICATION');
    this.stateManager.log('info', `Navigating to: ${url}`);

    try {
      await page.goto(url, { waitUntil: 'domcontentloaded' });
      // Short delay for modern client-side hydration
      await page.waitForTimeout(2000);
      this.stateManager.log('info', `Page loaded successfully: ${await page.title()}`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.stateManager.log('warn', `Navigation notice: ${msg}`);
    }
  }

  public async close(): Promise<void> {
    try {
      if (this.context) await this.context.close();
      if (this.browser) await this.browser.close();
      this.page = null;
      this.context = null;
      this.browser = null;
      this.stateManager.log('info', 'Browser closed cleanly');
    } catch (err) {
      console.error('Error closing browser:', err);
    }
  }
}
