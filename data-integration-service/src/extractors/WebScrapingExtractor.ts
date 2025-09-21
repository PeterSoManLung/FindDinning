import puppeteer, { Browser, Page } from 'puppeteer';
import * as cheerio from 'cheerio';
import { BaseDataExtractor } from './BaseDataExtractor';
import { RawRestaurantData, DataExtractionResult } from '../types/dataSource.types';

export abstract class WebScrapingExtractor extends BaseDataExtractor {
  protected browser: Browser | null = null;
  protected page: Page | null = null;

  /**
   * Initialize browser for web scraping
   */
  protected async initializeBrowser(): Promise<void> {
    if (this.browser) return;

    try {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--disable-gpu'
        ]
      });

      this.page = await this.browser.newPage();
      
      // Set user agent to avoid detection
      await this.page.setUserAgent(
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36'
      );

      // Set viewport
      await this.page.setViewport({ width: 1366, height: 768 });

      this.logger.info('Browser initialized successfully');
    } catch (error) {
      this.logger.error('Failed to initialize browser:', error);
      throw error;
    }
  }

  /**
   * Close browser and cleanup
   */
  protected async closeBrowser(): Promise<void> {
    try {
      if (this.page) {
        await this.page.close();
        this.page = null;
      }
      
      if (this.browser) {
        await this.browser.close();
        this.browser = null;
      }
      
      this.logger.info('Browser closed successfully');
    } catch (error) {
      this.logger.error('Error closing browser:', error);
    }
  }

  /**
   * Navigate to URL with error handling and retries
   */
  protected async navigateToUrl(url: string, waitForSelector?: string): Promise<void> {
    if (!this.page) {
      throw new Error('Browser not initialized');
    }

    await this.enforceRateLimit();

    try {
      this.logger.debug(`Navigating to: ${url}`);
      
      await this.page.goto(url, {
        waitUntil: 'networkidle2',
        timeout: this.dataSource.timeout
      });

      if (waitForSelector) {
        await this.page.waitForSelector(waitForSelector, { timeout: 10000 });
      }

      // Random delay to appear more human-like
      await this.randomDelay(1000, 3000);
      
    } catch (error) {
      this.logger.error(`Failed to navigate to ${url}:`, error);
      throw error;
    }
  }

  /**
   * Extract data using Cheerio from page HTML
   */
  protected async extractWithCheerio<T>(
    url: string,
    extractor: (cheerio: cheerio.CheerioAPI) => T
  ): Promise<T> {
    await this.navigateToUrl(url);
    
    if (!this.page) {
      throw new Error('Page not available');
    }

    const html = await this.page.content();
    const $ = cheerio.load(html);
    
    return extractor($);
  }

  /**
   * Extract data using Puppeteer page methods
   */
  protected async extractWithPuppeteer<T>(
    url: string,
    extractor: (page: Page) => Promise<T>
  ): Promise<T> {
    await this.navigateToUrl(url);
    
    if (!this.page) {
      throw new Error('Page not available');
    }

    return await extractor(this.page);
  }

  /**
   * Handle pagination for multi-page scraping
   */
  protected async handlePagination(
    baseUrl: string,
    maxPages: number = 10,
    pageExtractor: (pageNum: number) => Promise<RawRestaurantData[]>
  ): Promise<RawRestaurantData[]> {
    const allData: RawRestaurantData[] = [];
    
    for (let page = 1; page <= maxPages; page++) {
      try {
        this.logger.debug(`Processing page ${page} of ${maxPages}`);
        
        const pageData = await pageExtractor(page);
        
        if (pageData.length === 0) {
          this.logger.info(`No more data found at page ${page}, stopping pagination`);
          break;
        }
        
        allData.push(...pageData);
        
        // Random delay between pages
        await this.randomDelay(2000, 5000);
        
      } catch (error) {
        this.logger.error(`Error processing page ${page}:`, error);
        // Continue with next page instead of failing completely
        continue;
      }
    }
    
    return allData;
  }

  /**
   * Extract text content safely
   */
  protected extractText($: cheerio.CheerioAPI, selector: string): string {
    try {
      return $(selector).first().text().trim();
    } catch (error) {
      this.logger.debug(`Failed to extract text from selector ${selector}`);
      return '';
    }
  }

  /**
   * Extract attribute safely
   */
  protected extractAttribute($: cheerio.CheerioAPI, selector: string, attribute: string): string {
    try {
      return $(selector).first().attr(attribute) || '';
    } catch (error) {
      this.logger.debug(`Failed to extract attribute ${attribute} from selector ${selector}`);
      return '';
    }
  }

  /**
   * Extract multiple text values
   */
  protected extractMultipleText($: cheerio.CheerioAPI, selector: string): string[] {
    try {
      const results: string[] = [];
      $(selector).each((_, element) => {
        const text = $(element).text().trim();
        if (text) {
          results.push(text);
        }
      });
      return results;
    } catch (error) {
      this.logger.debug(`Failed to extract multiple text from selector ${selector}`);
      return [];
    }
  }

  /**
   * Random delay to avoid detection
   */
  protected async randomDelay(min: number, max: number): Promise<void> {
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise(resolve => setTimeout(resolve, delay));
  }

  /**
   * Check if element exists
   */
  protected elementExists($: cheerio.CheerioAPI, selector: string): boolean {
    return $(selector).length > 0;
  }

  /**
   * Scroll page to load dynamic content
   */
  protected async scrollToLoadContent(): Promise<void> {
    if (!this.page) return;

    try {
      await this.page.evaluate(() => {
        return new Promise<void>((resolve) => {
          let totalHeight = 0;
          const distance = 100;
          const timer = setInterval(() => {
            const scrollHeight = document.body.scrollHeight;
            window.scrollBy(0, distance);
            totalHeight += distance;

            if (totalHeight >= scrollHeight) {
              clearInterval(timer);
              resolve();
            }
          }, 100);
        });
      });
    } catch (error) {
      this.logger.debug('Error during scrolling:', error);
    }
  }

  /**
   * Wait for dynamic content to load
   */
  protected async waitForDynamicContent(selector: string, timeout: number = 10000): Promise<void> {
    if (!this.page) return;

    try {
      await this.page.waitForSelector(selector, { timeout });
    } catch (error) {
      this.logger.debug(`Timeout waiting for selector: ${selector}`);
    }
  }

  /**
   * Handle CAPTCHA or anti-bot measures (basic implementation)
   */
  protected async handleAntiBot(): Promise<boolean> {
    if (!this.page) return false;

    try {
      // Check for common CAPTCHA indicators
      const captchaSelectors = [
        '.captcha',
        '#captcha',
        '[data-captcha]',
        '.recaptcha',
        '.hcaptcha'
      ];

      for (const selector of captchaSelectors) {
        const element = await this.page.$(selector);
        if (element) {
          this.logger.warn('CAPTCHA detected, cannot proceed automatically');
          return false;
        }
      }

      return true;
    } catch (error) {
      this.logger.error('Error checking for anti-bot measures:', error);
      return false;
    }
  }

  /**
   * Override cleanup method to close browser
   */
  async cleanup(): Promise<void> {
    await this.closeBrowser();
  }
}