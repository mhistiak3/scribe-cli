#!/usr/bin/env node

const fs = require('fs');
const path = require('path');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const slugify = require('slugify');

// Import modules
const Logger = require('./utils/logger');
const Validator = require('./utils/validator');
const ProgressManager = require('./utils/progress');
const Scraper = require('./lib/scraper');
const Downloader = require('./lib/downloader');
const Converter = require('./lib/converter');
const ConfigManager = require('./lib/configManager');

// Output directory
const OUTPUT_DIR = path.join(process.cwd(), 'output');

async function main() {
  // Parse CLI arguments
  const argv = yargs(hideBin(process.argv))
    .usage('Usage: $0 <url> <demoMdPath> [options]')
    .command('$0 <url> <demoMdPath>', 'Scrape blog posts and convert to Markdown', (yargs) => {
      yargs
        .positional('url', {
          describe: 'Blog list page URL',
          type: 'string'
        })
        .positional('demoMdPath', {
          describe: 'Path to demo.md file with frontmatter template',
          type: 'string'
        });
    })
    .option('config', {
      alias: 'c',
      type: 'string',
      description: 'Path to JSON config file with selectors'
    })
    .option('output', {
      alias: 'o',
      type: 'string',
      description: 'Output directory',
      default: OUTPUT_DIR
    })
    .option('verbose', {
      alias: 'v',
      type: 'boolean',
      description: 'Enable verbose logging',
      default: false
    })
    .option('headless', {
      type: 'boolean',
      description: 'Run browser in headless mode',
      default: true
    })
    .option('timeout', {
      type: 'number',
      description: 'Page load timeout in milliseconds',
      default: 60000
    })
    .option('retry', {
      type: 'number',
      description: 'Number of retries for failed downloads',
      default: 3
    })
    .option('save-config', {
      type: 'string',
      description: 'Save the interactive config to a file'
    })
    .example('$0 https://blog.com/posts demo.md', 'Interactive mode')
    .example('$0 https://blog.com/posts demo.md -c config.json', 'Use config file')
    .example('$0 https://blog.com/posts demo.md --save-config myconfig.json', 'Save config')
    .help()
    .alias('help', 'h')
    .version()
    .alias('version', 'V')
    .argv;

  const listUrl = argv.url;
  const demoMdPath = argv.demoMdPath;
  const outputDir = argv.output;

  // Initialize utilities
  const logger = new Logger(argv.verbose);
  const progress = new ProgressManager();
  const configManager = new ConfigManager(logger);

  // Banner
  console.log('');
  console.log('╔═══════════════════════════════════╗');
  console.log('║       ScribeCLI v1.0.0           ║');
  console.log('║   Blog Scraper & MD Converter    ║');
  console.log('╚═══════════════════════════════════╝');
  console.log('');

  try {
    // Validate inputs
    if (!Validator.isValidUrl(listUrl)) {
      throw new Error(`Invalid URL: ${listUrl}`);
    }

    if (!Validator.fileExists(demoMdPath)) {
      throw new Error(`Demo file not found: ${demoMdPath}`);
    }

    // Parse demo.md for frontmatter keys
    const frontmatterKeys = configManager.parseDemoFile(demoMdPath);
    logger.info(`Frontmatter keys: ${frontmatterKeys.join(', ')}`);

    // Analyze demo.md format
    const formatInfo = configManager.analyzeDemoFormat(demoMdPath);

    // Load or prompt for config
    let config;
    if (argv.config) {
      config = configManager.loadConfig(argv.config);
      Validator.validateConfig(config);
    } else {
      logger.info('Interactive mode: Please provide CSS selectors');
      config = await configManager.promptForSelectors(frontmatterKeys);
      
      // Save config if requested
      if (argv.saveConfig) {
        configManager.saveConfig(config, argv.saveConfig);
      }
    }

    // Initialize scraper and downloader
    const scraper = new Scraper(logger, {
      headless: argv.headless,
      timeout: argv.timeout
    });
    const downloader = new Downloader(logger, argv.retry);
    const converter = new Converter(logger);

    // Scrape list page
    const spinner = progress.startSpinner('Scraping list page...');
    const links = await scraper.scrapeListPage(listUrl, config.postLinkSelector);
    progress.stopSpinner(`Found ${links.length} posts`, true);

    if (links.length === 0) {
      throw new Error('No posts found with the provided selector');
    }

    // Ensure output directory exists
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    // Create progress bar for posts
    const bar = progress.createProgressBar(links.length);

    // Process each post
    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < links.length; i++) {
      const link = links[i];
      
      try {
        bar.update(i + 1, { status: `Scraping ${i + 1}/${links.length}` });

        // Scrape detail page
        const { postData, contentData } = await scraper.scrapeDetailPage(
          link,
          config,
          frontmatterKeys
        );

        // Apply custom refinements
        postData.categories = Array.isArray(postData.categories) && postData.categories.length > 0 
          ? postData.categories 
          : (postData.categories ? [postData.categories] : ['news']);
        postData.tags = Array.isArray(postData.tags) && postData.tags.length > 0 
          ? postData.tags 
          : (postData.tags ? [postData.tags] : []);
        postData.draft = postData.draft !== undefined ? postData.draft : false;

        // Generate slug - use URL path if title-based slug would conflict
        const title = postData.title || postData.name || 'untitled';
        let slug = slugify(title, { lower: true, strict: true }) || `post-${Date.now()}`;
        
        // Extract unique identifier from URL to prevent overwrites
        const urlMatch = link.match(/\/([^\/]+)\/?$/);
        if (urlMatch && urlMatch[1]) {
          const urlPart = urlMatch[1];
          // If the URL has a unique part (like post-1, post-2), use it as suffix
          if (urlPart !== slug && !slug.includes(urlPart)) {
            slug = `${slug}-${urlPart}`;
          } else if (urlPart.match(/post-\d+/)) {
            // If URL is like "post-1", use that directly
            slug = urlPart;
          }
        }

        // Format date
        if (postData.date) {
          postData.date = converter.formatDate(postData.date);
        }

        // Download hero image
        if (postData.image) {
          postData.image = await converter.downloadHeroImage(
            postData.image,
            slug,
            downloader,
            outputDir
          );
        }

        // Process content images
        let finalHtml = contentData.html;
        if (contentData.images && contentData.images.length > 0) {
          finalHtml = await converter.processImages(
            contentData.html,
            contentData.images,
            slug,
            downloader,
            outputDir
          );
        }

        // Convert to Markdown
        let markdown = converter.htmlToMarkdown(finalHtml);
        markdown = converter.cleanupMarkdown(markdown);

        // Generate final file
        const frontmatter = converter.generateFrontmatter(postData, frontmatterKeys, formatInfo);
        const fileContent = frontmatter + markdown;
        const filePath = path.join(outputDir, `${slug}.md`);

        fs.writeFileSync(filePath, fileContent);
        successCount++;

        logger.debug(`Saved: ${slug}.md`);
      } catch (error) {
        failCount++;
        logger.error(`Failed to process ${link}`, error);
      }
    }

    progress.stopProgress();
    await scraper.close();

    // Summary
    console.log('');
    logger.success(`Completed! ${successCount} posts saved to ${outputDir}`);
    if (failCount > 0) {
      logger.warn(`${failCount} posts failed to process`);
    }
    console.log('');

  } catch (error) {
    progress.stopSpinner('Failed', false);
    progress.stopProgress();
    logger.error('Error:', error);
    process.exit(1);
  }
}

// Run the CLI
main().catch((error) => {
  console.error('Unexpected error:', error);
  process.exit(1);
});
