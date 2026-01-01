const puppeteer = require('puppeteer');

class Scraper {
  constructor(logger, options = {}) {
    this.logger = logger;
    this.browser = null;
    this.options = {
      headless: options.headless !== false ? 'new' : false,
      timeout: options.timeout || 60000,
      waitUntil: options.waitUntil || 'networkidle2',
      ...options
    };
  }

  async init() {
    if (this.browser) return;
    
    this.logger.debug('Launching browser...');
    this.browser = await puppeteer.launch({
      headless: this.options.headless,
      args: ['--no-sandbox', '--disable-setuid-sandbox']
    });
  }

  async close() {
    if (this.browser) {
      await this.browser.close();
      this.browser = null;
      this.logger.debug('Browser closed');
    }
  }

  async scrapeListPage(url, selector) {
    await this.init();
    
    const page = await this.browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    this.logger.debug(`Navigating to ${url}...`);
    await page.goto(url, { 
      waitUntil: this.options.waitUntil,
      timeout: this.options.timeout 
    });

    // Auto-scroll to load all content
    await this.autoScroll(page);

    // Extract links
    const links = await page.$$eval(selector, els => 
      els.map(el => el.href).filter(href => href)
    );
    
    await page.close();
    
    // Remove duplicates
    const uniqueLinks = [...new Set(links)];
    this.logger.debug(`Found ${uniqueLinks.length} unique links`);
    
    return uniqueLinks;
  }

  async scrapeDetailPage(url, config, frontmatterKeys) {
    await this.init();
    
    const page = await this.browser.newPage();
    await page.setViewport({ width: 1920, height: 1080 });
    
    this.logger.debug(`Scraping ${url}...`);
    await page.goto(url, { 
      waitUntil: 'domcontentloaded',
      timeout: this.options.timeout 
    });

    const postData = {};

    // Extract frontmatter fields
    for (const key of frontmatterKeys) {
      const selector = config[`fm_${key}`];
      if (!selector) {
        postData[key] = '';
        continue;
      }

      let value = null;

      try {
        if (key.toLowerCase().includes('image') || key.toLowerCase().includes('thumb')) {
          // Try selector first
          value = await page.$eval(selector, el => el.src).catch(() => null);
          // Fallback to Open Graph
          if (!value) {
            value = await page.$eval('meta[property="og:image"]', el => el.content).catch(() => null);
          }
        } else if (key.toLowerCase().includes('date')) {
          value = await page.$eval(selector, el => 
            el.getAttribute('datetime') || el.innerText
          ).catch(() => null);
        } else {
          value = await page.$eval(selector, el => el.innerText).catch(() => null);
        }
      } catch (error) {
        this.logger.debug(`Failed to extract ${key}: ${error.message}`);
      }

      postData[key] = value || '';
    }

    // Extract content
    const contentData = await this.extractContent(page, config.contentSelector, postData.title || '');
    
    await page.close();

    return { postData, contentData };
  }

  async extractContent(page, contentSelector, titleToClean) {
    return await page.evaluate(async (selector, title) => {
      const container = document.querySelector(selector);
      if (!container) return { html: '', images: [] };

      const div = container.cloneNode(true);

      // Remove H1 title if it matches
      if (title) {
        const h1s = Array.from(div.querySelectorAll('h1'));
        h1s.forEach(h1 => {
          const h1Text = h1.innerText.trim().toLowerCase();
          const titleText = title.trim().toLowerCase();
          if (h1Text === titleText || titleText.includes(h1Text)) {
            h1.remove();
          }
        });
      }

      // Remove metadata blocks
      const topElements = Array.from(div.children).slice(0, 5);
      for (const el of topElements) {
        const text = el.innerText.toLowerCase();
        if (
          (text.includes('min read') && text.length < 300) ||
          (text.match(/[a-z]{3} \d{1,2}, \d{4}/) && text.length < 100)
        ) {
          el.remove();
        }
      }

      // Remove "min read" from lists
      const uls = div.querySelectorAll('ul');
      for (const ul of uls) {
        if (ul.innerText.toLowerCase().includes('min read')) {
          ul.remove();
          break;
        }
      }

      // Clean up filler text
      div.innerHTML = div.innerHTML.replace(
        /this is just to fill empty area of this tag/gi,
        ''
      );

      // Extract images
      const imgs = Array.from(div.querySelectorAll('img'));
      const images = imgs.map((img, i) => ({
        src: img.src,
        index: i
      }));

      return { html: div.innerHTML, images };
    }, contentSelector, titleToClean);
  }

  async autoScroll(page) {
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 100;
        let checks = 0;
        const maxChecks = 50;

        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (window.innerHeight + window.scrollY >= scrollHeight - 50) {
            checks++;
            if (checks >= maxChecks) {
              clearInterval(timer);
              resolve();
            }
          } else {
            checks = 0;
          }
        }, 100);
      });
    });
  }
}

module.exports = Scraper;
